import * as sql from 'mssql';
import { DatabaseDriver, QueryResult } from '../types';
import {
  BatchExecutionResult,
  DecryptedConnectionConfig,
  PreviewTableRef,
  TableEditMetadata,
} from '../../../shared/types';

type MssqlConstraintRow = {
  constraint_name?: string;
  CONSTRAINT_NAME?: string;
  constraint_type?: string;
  CONSTRAINT_TYPE?: string;
  column_name?: string;
  COLUMN_NAME?: string;
  ordinal_position?: number;
  ORDINAL_POSITION?: number;
};

const MSSQL_UNEDITABLE_REASON = 'Table preview is read-only because no primary key or unique key was found.';

const getMssqlErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const pickMssqlKey = (rows: MssqlConstraintRow[]): TableEditMetadata['key'] => {
  const sorted = rows
    .map((row) => ({
      constraintName: row.constraint_name ?? row.CONSTRAINT_NAME ?? '',
      constraintType: row.constraint_type ?? row.CONSTRAINT_TYPE ?? '',
      columnName: row.column_name ?? row.COLUMN_NAME ?? '',
      ordinalPosition: Number(row.ordinal_position ?? row.ORDINAL_POSITION ?? 0),
    }))
    .sort((left, right) => {
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

export class MssqlAdapter implements DatabaseDriver {
  private pool: sql.ConnectionPool | null = null;
  private currentRequest: sql.Request | null = null;

  private getConfig(config: DecryptedConnectionConfig): sql.config {
    return {
      user: config.username,
      password: config.password,
      database: config.database || 'master',
      server: config.host,
      port: config.port,
      options: {
        encrypt: true,
        trustServerCertificate: true, // Often needed for local/dev servers
      },
    };
  }

  async connect(config: DecryptedConnectionConfig): Promise<void> {
    if (this.pool) {
      await this.disconnect();
    }

    this.pool = new sql.ConnectionPool(this.getConfig(config));
    await this.pool.connect();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async testConnection(config: DecryptedConnectionConfig): Promise<boolean> {
    try {
      const testPool = new sql.ConnectionPool(this.getConfig(config));
      await testPool.connect();
      await testPool.request().query('SELECT 1 as test');
      await testPool.close();
      return true;
    } catch (error) {
      console.error('MSSQL test connection failed:', error);
      return false;
    }
  }

  async executeQuery(sqlQuery: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const start = performance.now();
    try {
      this.currentRequest = this.pool.request();
      const result = await this.currentRequest.query(sqlQuery);
      this.currentRequest = null;
      
      const durationMs = performance.now() - start;
// Ensure recordset exists
      const rows = result.recordset || [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const rowCount = result.rowsAffected.reduce((a, b) => a + b, 0);

      return {
        columns,
        rows,
        rowCount,
        durationMs,
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.currentRequest = null;
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
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.request().query("SELECT name FROM sys.databases WHERE state_desc = 'ONLINE'");
    return result.recordset.map(row => row.name);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSchemas(_database?: string): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.request().query('SELECT schema_name FROM information_schema.schemata');
    return result.recordset.map(row => row.schema_name);
  }

  async getTables(_database?: string, schema?: string): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    const targetSchema = schema || 'dbo';
    const result = await this.pool.request()
      .input('schema', sql.NVarChar, targetSchema)
      .query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema');
    return result.recordset.map(row => row.TABLE_NAME);
  }

  async getColumns(_database?: string, schema?: string, table?: string): Promise<{ name: string; type: string }[]> {
    if (!this.pool) throw new Error('Not connected');
    const targetSchema = schema || 'dbo';
    if (!table) throw new Error('Table is required');

    const result = await this.pool.request()
      .input('schema', sql.NVarChar, targetSchema)
      .input('table', sql.NVarChar, table)
      .query('SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table');
    return result.recordset.map(row => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
    }));
  }

  async getTableEditMetadata(table: PreviewTableRef): Promise<TableEditMetadata> {
    if (!this.pool) {
      throw new Error('Not connected');
    }

    const targetSchema = table.schema || 'dbo';
    const result = await this.pool.request()
      .input('schema', sql.NVarChar, targetSchema)
      .input('table', sql.NVarChar, table.table)
      .query(`
        SELECT
          tc.CONSTRAINT_NAME AS constraint_name,
          tc.CONSTRAINT_TYPE AS constraint_type,
          kcu.COLUMN_NAME AS column_name,
          kcu.ORDINAL_POSITION AS ordinal_position
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
         AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
         AND tc.TABLE_NAME = kcu.TABLE_NAME
        WHERE tc.TABLE_SCHEMA = @schema
          AND tc.TABLE_NAME = @table
          AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE')
      `);

    const key = pickMssqlKey(result.recordset as MssqlConstraintRow[]);
    if (!key) {
      return {
        editable: false,
        reason: MSSQL_UNEDITABLE_REASON,
        key: null,
      };
    }

    return {
      editable: true,
      key,
    };
  }

  async executeBatch(statements: string[]): Promise<BatchExecutionResult> {
    if (!this.pool) {
      throw new Error('Not connected');
    }

    if (statements.length === 0) {
      return { ok: true };
    }

    const transaction = new sql.Transaction(this.pool);
    try {
      await transaction.begin();
    } catch (error) {
      return {
        ok: false,
        error: getMssqlErrorMessage(error),
      };
    }

    for (const [index, statement] of statements.entries()) {
      try {
        const request = transaction.request();
        await request.query(statement);
      } catch (error) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          return {
            ok: false,
            failedStatementIndex: index,
            error: getMssqlErrorMessage(rollbackError),
          };
        }
        return {
          ok: false,
          failedStatementIndex: index,
          error: getMssqlErrorMessage(error),
        };
      }
    }

    try {
      await transaction.commit();
    } catch (error) {
      return {
        ok: false,
        error: getMssqlErrorMessage(error),
      };
    }

    return { ok: true };
  }

  async killQuery(): Promise<void> {
    if (this.currentRequest) {
      this.currentRequest.cancel();
    }
  }
}
