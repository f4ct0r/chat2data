import {
  FieldPacket,
} from 'mysql2';
import {
  createConnection,
  Connection as PromiseConnection,
} from 'mysql2/promise';
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
  QueryRow,
  PreviewTableRef,
  TableEditMetadata,
} from '../../../shared/types';

type MysqlConstraintRow = {
  constraint_name?: string;
  CONSTRAINT_NAME?: string;
  constraint_type?: string;
  CONSTRAINT_TYPE?: string;
  column_name?: string;
  COLUMN_NAME?: string;
  ordinal_position?: number;
  ORDINAL_POSITION?: number;
};

const MYSQL_UNEDITABLE_REASON = 'Table preview is read-only because no primary key or unique key was found.';

const getMysqlErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const pickMysqlKey = (rows: MysqlConstraintRow[]): TableEditMetadata['key'] => {
  const normalized = rows.map((row) => ({
    constraintName: row.constraint_name ?? row.CONSTRAINT_NAME ?? '',
    constraintType: row.constraint_type ?? row.CONSTRAINT_TYPE ?? '',
    columnName: row.column_name ?? row.COLUMN_NAME ?? '',
    ordinalPosition: Number(row.ordinal_position ?? row.ORDINAL_POSITION ?? 0),
  }));

  const sorted = normalized.sort((left, right) => {
    const leftPriority = left.constraintType === 'PRIMARY KEY' ? 0 : 1;
    const rightPriority = right.constraintType === 'PRIMARY KEY' ? 0 : 1;
    return leftPriority - rightPriority
      || left.constraintName.localeCompare(right.constraintName)
      || left.ordinalPosition - right.ordinalPosition;
  });

  const groups = new Map<string, { type: 'primary' | 'unique'; columns: string[] }>();

  for (const row of sorted) {
    if (!row.constraintName || !row.columnName) {
      continue;
    }

    const type = row.constraintType === 'PRIMARY KEY' ? 'primary' : row.constraintType === 'UNIQUE' ? 'unique' : null;
    if (!type) {
      continue;
    }

    const existing = groups.get(row.constraintName);
    if (existing) {
      existing.columns.push(row.columnName);
      continue;
    }

    groups.set(row.constraintName, {
      type,
      columns: [row.columnName],
    });
  }

  for (const group of groups.values()) {
    if (group.type === 'primary') {
      return group;
    }
  }

  for (const group of groups.values()) {
    if (group.type === 'unique') {
      return group;
    }
  }

  return null;
};

export class MysqlAdapter implements DatabaseDriver {
  private connection: PromiseConnection | null = null;
  // mysql2/promise wraps the core connection; export streaming needs the raw stream API.
  private rawConnection: import('mysql2').Connection | null = null;
  private config: DecryptedConnectionConfig | null = null;
  private currentStreamDestroy: (() => void) | null = null;

  async connect(config: DecryptedConnectionConfig): Promise<void> {
    if (this.connection) {
      await this.disconnect();
    }
    
    this.config = config;

    this.connection = await createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      multipleStatements: true,
    });
    this.rawConnection =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((this.connection as any).connection as import('mysql2').Connection | undefined)
      ?? null;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end().catch(() => undefined);
      this.connection = null;
    }
    this.rawConnection = null;
    this.currentStreamDestroy = null;
  }

  async testConnection(config: DecryptedConnectionConfig): Promise<boolean> {
    try {
      const conn = await createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
      });
      await conn.ping();
      await conn.end();
      return true;
    } catch (error) {
      console.error('MySQL test connection failed:', error);
      return false;
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    const start = performance.now();
    try {
      const [rows, fields] = await this.connection.query(sql);
      const durationMs = performance.now() - start;

      // Handle multiple statements
      const isArrayOfResults = Array.isArray(rows) && Array.isArray(rows[0]) && fields && Array.isArray(fields[0]);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let actualRows: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let actualFields: any[] = [];
      let rowCount = 0;

      if (isArrayOfResults) {
        // Just take the last result for multiple statements
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actualRows = (rows as any[])[(rows as any[]).length - 1] || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actualFields = (fields as any[])[(fields as any[]).length - 1] || [];
        actualRows = Array.isArray(actualRows) ? actualRows : [actualRows];
        rowCount = actualRows.length;
      } else if (Array.isArray(rows)) {
        actualRows = rows;
        actualFields = fields || [];
        rowCount = rows.length;
      } else {
        // Insert/Update/Delete result
        actualRows = [rows];
        actualFields = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rowCount = (rows as any).affectedRows || 0;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const columns = actualFields ? actualFields.map((f: any) => f.name) : [];

      return {
        columns,
        rows: actualRows,
        rowCount,
        durationMs,
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
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
    if (!this.connection) {
      throw new Error('Not connected to database');
    }
    if (!this.rawConnection) {
      throw new Error('Streaming is not available for this MySQL connection');
    }

    const batchSize = options.batchSize ?? 500;
    const query = this.rawConnection.query(sql);
    const stream = query.stream({ objectMode: true });
    const abort = () => {
      stream.destroy(Object.assign(new Error('Export cancelled'), { name: 'AbortError' }));
      this.rawConnection?.destroy();
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    this.currentStreamDestroy = abort;

    let rowCount = 0;
    let columnsSent = false;
    let bufferedRows: QueryRow[] = [];

    try {
      const columns = await new Promise<string[]>((resolve, reject) => {
        stream.once('fields', (fields: FieldPacket[]) => {
          resolve(fields.map((field) => field.name));
        });
        stream.once('error', (error) => {
          reject(error);
        });
        stream.once('end', () => {
          resolve([]);
        });
      });

      await sink.onColumns(columns);
      columnsSent = true;

      for await (const row of stream as AsyncIterable<QueryRow>) {
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

      if (!columnsSent) {
        await sink.onColumns([]);
      }

      if (bufferedRows.length > 0) {
        await sink.onRows(bufferedRows);
        rowCount += bufferedRows.length;
      }

      return { rowCount };
    } finally {
      options.signal?.removeEventListener('abort', abort);
      this.currentStreamDestroy = null;
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.connection) throw new Error('Not connected');
    const [rows] = await this.connection.query('SHOW DATABASES');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map(row => row.Database);
  }

  async getSchemas(database?: string): Promise<string[]> {
    // In MySQL, schemas are databases
    if (database) {
      return [database];
    }
    return this.getDatabases();
  }

  async getTables(database?: string, schema?: string): Promise<string[]> {
    if (!this.connection) throw new Error('Not connected');
    const dbName = schema || database;
    if (!dbName) throw new Error('Database or schema is required');
    
    const [rows] = await this.connection.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [dbName]
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map(row => row.table_name || row.TABLE_NAME);
  }

  async getColumns(database?: string, schema?: string, table?: string): Promise<{ name: string; type: string }[]> {
    if (!this.connection) throw new Error('Not connected');
    const dbName = schema || database;
    if (!dbName || !table) throw new Error('Database/schema and table are required');

    const [rows] = await this.connection.query(
      'SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
      [dbName, table]
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map(row => ({
      name: row.column_name || row.COLUMN_NAME,
      type: row.data_type || row.DATA_TYPE,
    }));
  }

  async getTableEditMetadata(table: PreviewTableRef): Promise<TableEditMetadata> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    const databaseName = table.schema || table.database || this.config?.database;
    if (!databaseName) {
      return {
        editable: false,
        reason: MYSQL_UNEDITABLE_REASON,
        key: null,
      };
    }

    const [rows] = await this.connection.query(
      `
        SELECT
          tc.CONSTRAINT_NAME AS constraint_name,
          tc.CONSTRAINT_TYPE AS constraint_type,
          kcu.COLUMN_NAME AS column_name,
          kcu.ORDINAL_POSITION AS ordinal_position
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
         AND tc.TABLE_NAME = kcu.TABLE_NAME
         AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        WHERE tc.TABLE_SCHEMA = ?
          AND tc.TABLE_NAME = ?
          AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE')
      `,
      [databaseName, table.table]
    );

    const key = pickMysqlKey(rows as MysqlConstraintRow[]);
    if (!key) {
      return {
        editable: false,
        reason: MYSQL_UNEDITABLE_REASON,
        key: null,
      };
    }

    return {
      editable: true,
      key,
    };
  }

  async executeBatch(statements: string[]): Promise<BatchExecutionResult> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    if (statements.length === 0) {
      return { ok: true };
    }

    try {
      await this.connection.beginTransaction();
    } catch (error) {
      return {
        ok: false,
        error: getMysqlErrorMessage(error),
      };
    }

    for (const [index, statement] of statements.entries()) {
      try {
        await this.connection.query(statement);
      } catch (error) {
        try {
          await this.connection.rollback();
        } catch (rollbackError) {
          return {
            ok: false,
            failedStatementIndex: index,
            error: getMysqlErrorMessage(rollbackError),
          };
        }
        return {
          ok: false,
          failedStatementIndex: index,
          error: getMysqlErrorMessage(error),
        };
      }
    }

    try {
      await this.connection.commit();
    } catch (error) {
      return {
        ok: false,
        error: getMysqlErrorMessage(error),
      };
    }

    return { ok: true };
  }

  async killQuery(): Promise<void> {
    this.currentStreamDestroy?.();
  }
}
