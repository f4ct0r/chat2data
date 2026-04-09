import { createClient, ClickHouseClient } from '@clickhouse/client';
import {
  DatabaseDriver,
  QueryResult,
  QueryStreamOptions,
  QueryStreamResult,
  QueryStreamSink,
} from '../types';
import {
  BatchExecutionResult,
  DecryptedConnectionConfig,
  PreviewTableRef,
  TableEditMetadata,
} from '../../../shared/types';

const CLICKHOUSE_QUERY_STATEMENTS = new Set([
  'SELECT',
  'SHOW',
  'DESCRIBE',
  'DESC',
  'EXISTS',
  'WITH',
]);

export const shouldUseClickHouseQuery = (sql: string): boolean => {
  const normalized = sql.trim().replace(/^[;(]+/, '').trim();
  const firstToken = normalized.match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
  return firstToken ? CLICKHOUSE_QUERY_STATEMENTS.has(firstToken) : false;
};

export class ClickhouseAdapter implements DatabaseDriver {
  private client: ClickHouseClient | null = null;
  private currentQueryId: string | null = null;

  private getUrl(config: DecryptedConnectionConfig): string {
    const protocol = config.port === 8443 || config.port === 443 ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  async connect(config: DecryptedConnectionConfig): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }

    this.client = createClient({
      url: this.getUrl(config),
      username: config.username,
      password: config.password,
      database: config.database || 'default',
    });
    
    // Test connection to ensure it is established
    await this.client.ping();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  async testConnection(config: DecryptedConnectionConfig): Promise<boolean> {
    try {
      const testClient = createClient({
        url: this.getUrl(config),
        username: config.username,
        password: config.password,
        database: config.database || 'default',
      });
      await testClient.ping();
      await testClient.close();
      return true;
    } catch (error) {
      console.error('ClickHouse test connection failed:', error);
      return false;
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    const start = performance.now();
    try {
      this.currentQueryId = globalThis.crypto.randomUUID();

      if (!shouldUseClickHouseQuery(sql)) {
        await this.client.command({
          query: sql,
          query_id: this.currentQueryId,
        });
        this.currentQueryId = null;
        const durationMs = performance.now() - start;

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs,
        };
      }

      const resultSet = await this.client.query({
        query: sql,
        format: 'JSON',
        query_id: this.currentQueryId,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataset = await resultSet.json<any>();
      this.currentQueryId = null;
      const durationMs = performance.now() - start;

      const rows = dataset.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const columns = dataset.meta ? dataset.meta.map((m: any) => m.name) : (rows.length > 0 ? Object.keys(rows[0]) : []);
      const rowCount = dataset.rows || rows.length;

      return {
        columns,
        rows,
        rowCount,
        durationMs,
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.currentQueryId = null;
      const durationMs = performance.now() - start;
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs,
        error: error.message || String(error),
      };
    }
  }

  async streamQuery(
    sql: string,
    sink: QueryStreamSink,
    options: QueryStreamOptions = {}
  ): Promise<QueryStreamResult> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    this.currentQueryId = globalThis.crypto.randomUUID();
    const resultSet = await this.client.query({
      query: sql,
      format: 'JSONCompactEachRowWithNamesAndTypes',
      query_id: this.currentQueryId,
    });

    const abort = () => {
      resultSet.close();
      void this.killQuery().catch(() => undefined);
    };
    options.signal?.addEventListener('abort', abort, { once: true });

    let rowCount = 0;
    let columns: string[] | null = null;
    let skipTypesRow = false;
    let bufferedRows: Array<Record<string, unknown>> = [];
    const batchSize = options.batchSize ?? 500;

    try {
      for await (const rowChunk of resultSet.stream() as AsyncIterable<Array<{ json<T>(): T }>>) {
        for (const row of rowChunk) {
          if (options.signal?.aborted) {
            const error = new Error('Export cancelled');
            error.name = 'AbortError';
            throw error;
          }

          const parsedRow = row.json<unknown>();
          if (!columns) {
            columns = Array.isArray(parsedRow) ? parsedRow.map((value) => String(value)) : [];
            await sink.onColumns(columns);
            skipTypesRow = true;
            continue;
          }

          if (skipTypesRow) {
            skipTypesRow = false;
            continue;
          }

          const values = Array.isArray(parsedRow) ? parsedRow : [];
          bufferedRows.push(
            Object.fromEntries(columns.map((column, index) => [column, values[index]]))
          );

          if (bufferedRows.length >= batchSize) {
            await sink.onRows(bufferedRows);
            rowCount += bufferedRows.length;
            bufferedRows = [];
          }
        }
      }

      if (!columns) {
        await sink.onColumns([]);
      }

      if (bufferedRows.length > 0) {
        await sink.onRows(bufferedRows);
        rowCount += bufferedRows.length;
      }

      return { rowCount };
    } finally {
      options.signal?.removeEventListener('abort', abort);
      this.currentQueryId = null;
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.client) throw new Error('Not connected');
    const resultSet = await this.client.query({ query: 'SHOW DATABASES', format: 'JSON' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataset = await resultSet.json<any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return dataset.data.map((row: any) => row.name);
  }

  async getSchemas(database?: string): Promise<string[]> {
    if (database) {
      return [database];
    }
    return this.getDatabases();
  }

  async getTables(database?: string, schema?: string): Promise<string[]> {
    if (!this.client) throw new Error('Not connected');
    const dbName = schema || database;
    if (!dbName) throw new Error('Database is required');

    const resultSet = await this.client.query({
      query: `SELECT name FROM system.tables WHERE database = '${dbName}'`,
      format: 'JSON'
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataset = await resultSet.json<any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return dataset.data.map((row: any) => row.name);
  }

  async getColumns(database?: string, schema?: string, table?: string): Promise<{ name: string; type: string }[]> {
    if (!this.client) throw new Error('Not connected');
    const dbName = schema || database;
    if (!dbName || !table) throw new Error('Database and table are required');

    const resultSet = await this.client.query({
      query: `SELECT name, type FROM system.columns WHERE database = '${dbName}' AND table = '${table}'`,
      format: 'JSON'
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataset = await resultSet.json<any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return dataset.data.map((row: any) => ({
      name: row.name,
      type: row.type,
    }));
  }

  async getTableEditMetadata(table: PreviewTableRef): Promise<TableEditMetadata> {
    void table;
    return {
      editable: false,
      reason: 'ClickHouse table previews are read-only because editable preview requires transactional writes.',
      key: null,
    };
  }

  async executeBatch(statements: string[]): Promise<BatchExecutionResult> {
    if (statements.length === 0) {
      return { ok: true };
    }

    return {
      ok: false,
      failedStatementIndex: 0,
      error: 'ClickHouse does not support transactional batch execution for editable previews.',
    };
  }

  async killQuery(): Promise<void> {
    if (!this.client || !this.currentQueryId) return;

    try {
      await this.client.command({
        query: `KILL QUERY WHERE query_id = '${this.currentQueryId}' SYNC`,
      });
    } catch (error) {
      console.error('Failed to kill ClickHouse query:', error);
      throw error;
    }
  }
}
