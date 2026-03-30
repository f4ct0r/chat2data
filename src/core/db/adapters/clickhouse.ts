import { createClient, ClickHouseClient } from '@clickhouse/client';
import { DatabaseDriver, QueryResult } from '../types';
import { DecryptedConnectionConfig } from '../../../shared/types';

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
