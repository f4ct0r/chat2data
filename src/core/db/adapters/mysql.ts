import { createConnection, Connection } from 'mysql2/promise';
import { DatabaseDriver, QueryResult } from '../types';
import { DecryptedConnectionConfig } from '../../../shared/types';

export class MysqlAdapter implements DatabaseDriver {
  private connection: Connection | null = null;
  private config: DecryptedConnectionConfig | null = null;

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
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
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

  async killQuery(): Promise<void> {
    if (!this.connection || !this.config) {
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const threadId = (this.connection as any).threadId || (this.connection as any).connection?.threadId;
      if (!threadId) {
        throw new Error('Could not find threadId for current connection');
      }

      // Create a new connection just to kill the query
      const killConn = await createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
      });

      await killConn.query(`KILL QUERY ${threadId}`);
      await killConn.end();
    } catch (error) {
      console.error('Failed to kill MySQL query:', error);
      throw error;
    }
  }
}
