import * as sql from 'mssql';
import { DatabaseDriver, QueryResult } from '../types';
import { DecryptedConnectionConfig } from '../../../shared/types';

export class MssqlAdapter implements DatabaseDriver {
  private pool: sql.ConnectionPool | null = null;

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
      const result = await this.pool.request().query(sqlQuery);
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
}
