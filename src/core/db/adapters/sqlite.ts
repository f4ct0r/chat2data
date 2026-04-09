import Database from 'better-sqlite3';
import {
  DatabaseDriver,
  QueryResult,
  QueryStreamOptions,
  QueryStreamResult,
  QueryStreamSink,
} from '../types';
import type { QueryRow } from '../../../shared/types';
import {
  BatchExecutionResult,
  DecryptedConnectionConfig,
  PreviewTableRef,
  TableEditMetadata,
} from '../../../shared/types';

type SqliteTableInfoRow = {
  name?: string;
  type?: string;
  pk?: number;
};

type SqliteIndexRow = {
  name?: string;
  unique?: number;
};

type SqliteIndexInfoRow = {
  seqno?: number;
  name?: string;
};

const SQLITE_UNEDITABLE_REASON = 'Table preview is read-only because no primary key or unique key was found.';

const getSqliteErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const quoteSqliteIdentifier = (identifier: string) =>
  `"${identifier.replace(/"/g, '""')}"`;

export class SqliteAdapter implements DatabaseDriver {
  private db: Database.Database | null = null;
  private config: DecryptedConnectionConfig | null = null;

  private requireDatabasePath(config: Pick<DecryptedConnectionConfig, 'database'>): string {
    if (!config.database) {
      throw new Error('SQLite database path is required');
    }

    return config.database;
  }

  async connect(config: DecryptedConnectionConfig): Promise<void> {
    if (this.db) {
      await this.disconnect();
    }

    const databasePath = this.requireDatabasePath(config);
    this.config = config;
    this.db = new Database(databasePath, { fileMustExist: true });
    this.db.pragma('foreign_keys = ON');
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.config = null;
  }

  async testConnection(config: DecryptedConnectionConfig): Promise<boolean> {
    try {
      const databasePath = this.requireDatabasePath(config);
      const db = new Database(databasePath, {
        fileMustExist: true,
        readonly: true,
      });
      db.prepare('SELECT 1 AS ok').get();
      db.close();
      return true;
    } catch (error) {
      console.error('SQLite test connection failed:', error);
      return false;
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    const start = performance.now();
    try {
      const statement = this.db.prepare(sql);

      if (statement.reader) {
        const rows = statement.all() as Record<string, unknown>[];
        const columns = statement.columns().map((column) => column.name);
        const durationMs = performance.now() - start;
        return {
          columns,
          rows,
          rowCount: rows.length,
          durationMs,
        };
      }

      const result = statement.run();
      const durationMs = performance.now() - start;
      return {
        columns: [],
        rows: [],
        rowCount: result.changes,
        durationMs,
      };
    } catch (error) {
      const durationMs = performance.now() - start;
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs,
        error: getSqliteErrorMessage(error),
      };
    }
  }

  async streamQuery(
    sql: string,
    sink: QueryStreamSink,
    options: QueryStreamOptions = {}
  ): Promise<QueryStreamResult> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    const statement = this.db.prepare(sql);
    if (!statement.reader) {
      throw new Error('Export only supports row-returning statements.');
    }

    const columns = statement.columns().map((column) => column.name);
    await sink.onColumns(columns);

    const batchSize = options.batchSize ?? 500;
    let rowCount = 0;
    let bufferedRows: QueryRow[] = [];

    for (const row of statement.iterate() as Iterable<QueryRow>) {
      if (options.signal?.aborted) {
        const error = new Error('Export cancelled');
        error.name = 'AbortError';
        throw error;
      }

      bufferedRows.push(row);
      if (bufferedRows.length >= batchSize) {
        await sink.onRows(bufferedRows);
        rowCount += bufferedRows.length;
        bufferedRows = [];
      }
    }

    if (bufferedRows.length > 0) {
      await sink.onRows(bufferedRows);
      rowCount += bufferedRows.length;
    }

    return { rowCount };
  }

  async getDatabases(): Promise<string[]> {
    return [this.requireDatabasePath(this.config ?? {})];
  }

  async getSchemas(): Promise<string[]> {
    return [];
  }

  async getTables(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Not connected');
    }

    const rows = this.db
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type IN ('table', 'view')
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all() as { name: string }[];

    return rows.map((row) => row.name);
  }

  async getColumns(_database?: string, _schema?: string, table?: string): Promise<{ name: string; type: string }[]> {
    if (!this.db) {
      throw new Error('Not connected');
    }

    if (!table) {
      throw new Error('Table is required');
    }

    const rows = this.db
      .prepare(`PRAGMA table_info(${quoteSqliteIdentifier(table)})`)
      .all() as SqliteTableInfoRow[];

    return rows.map((row) => ({
      name: row.name ?? '',
      type: row.type ?? '',
    }));
  }

  async getTableEditMetadata(table: PreviewTableRef): Promise<TableEditMetadata> {
    if (!this.db) {
      throw new Error('Not connected');
    }

    const tableInfo = this.db
      .prepare(`PRAGMA table_info(${quoteSqliteIdentifier(table.table)})`)
      .all() as SqliteTableInfoRow[];

    const primaryKey = tableInfo
      .filter((row) => Number(row.pk ?? 0) > 0 && row.name)
      .sort((left, right) => Number(left.pk ?? 0) - Number(right.pk ?? 0))
      .map((row) => row.name as string);

    if (primaryKey.length > 0) {
      return {
        editable: true,
        key: {
          type: 'primary',
          columns: primaryKey,
        },
      };
    }

    const indexes = this.db
      .prepare(`PRAGMA index_list(${quoteSqliteIdentifier(table.table)})`)
      .all() as SqliteIndexRow[];

    for (const index of indexes) {
      if (!index.name || Number(index.unique ?? 0) !== 1) {
        continue;
      }

      const uniqueColumns = this.db
        .prepare(`PRAGMA index_info(${quoteSqliteIdentifier(index.name)})`)
        .all() as SqliteIndexInfoRow[];

      const columns = uniqueColumns
        .sort((left, right) => Number(left.seqno ?? 0) - Number(right.seqno ?? 0))
        .map((row) => row.name)
        .filter((name): name is string => Boolean(name));

      if (columns.length > 0) {
        return {
          editable: true,
          key: {
            type: 'unique',
            columns,
          },
        };
      }
    }

    return {
      editable: false,
      reason: SQLITE_UNEDITABLE_REASON,
      key: null,
    };
  }

  async executeBatch(statements: string[]): Promise<BatchExecutionResult> {
    if (!this.db) {
      throw new Error('Not connected');
    }

    if (statements.length === 0) {
      return { ok: true };
    }

    const transaction = this.db.transaction((queries: string[]) => {
      for (const [index, statement] of queries.entries()) {
        try {
          this.db!.prepare(statement).run();
        } catch (error) {
          const wrappedError = error instanceof Error ? error : new Error(String(error));
          Object.assign(wrappedError, { statementIndex: index });
          throw wrappedError;
        }
      }
    });

    try {
      transaction(statements);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        failedStatementIndex:
          typeof (error as { statementIndex?: unknown }).statementIndex === 'number'
            ? (error as { statementIndex: number }).statementIndex
            : undefined,
        error: getSqliteErrorMessage(error),
      };
    }
  }
}
