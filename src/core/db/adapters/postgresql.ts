import { Client } from 'pg';
import { DatabaseDriver, QueryResult } from '../types';
import { DecryptedConnectionConfig } from '../../../shared/types';

export class PostgresAdapter implements DatabaseDriver {
  private client: Client | null = null;
  private config: DecryptedConnectionConfig | null = null;

  async connect(config: DecryptedConnectionConfig): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }
    
    this.config = config;

    this.client = new Client({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });

    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async testConnection(config: DecryptedConnectionConfig): Promise<boolean> {
    try {
      const testClient = new Client({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
      });
      await testClient.connect();
      await testClient.query('SELECT 1');
      await testClient.end();
      return true;
    } catch (error) {
      console.error('PostgreSQL test connection failed:', error);
      return false;
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    const start = performance.now();
    try {
      const result = await this.client.query(sql);
      const durationMs = performance.now() - start;

      // Handle multiple statements (pg returns array of results)
      const isArray = Array.isArray(result);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalResult = isArray ? (result as any[])[(result as any[]).length - 1] : result;
      
      const columns = finalResult.fields ? finalResult.fields.map((f: { name: string }) => f.name) : [];
      const rows = finalResult.rows || [];
      const rowCount = finalResult.rowCount || rows.length;

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
    if (!this.client) throw new Error('Not connected');
    const result = await this.client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
    return result.rows.map(row => row.datname);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSchemas(_database?: string): Promise<string[]> {
    if (!this.client) throw new Error('Not connected');
    // Note: To list schemas of another database, we would need to connect to it. 
    // Here we just return the schemas for the current database.
    const result = await this.client.query('SELECT schema_name FROM information_schema.schemata');
    return result.rows.map(row => row.schema_name);
  }

  async getTables(_database?: string, schema?: string): Promise<string[]> {
    if (!this.client) throw new Error('Not connected');
    const targetSchema = schema || 'public';
    const result = await this.client.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
      [targetSchema]
    );
    return result.rows.map(row => row.table_name);
  }

  async getColumns(_database?: string, schema?: string, table?: string): Promise<{ name: string; type: string }[]> {
    if (!this.client) throw new Error('Not connected');
    const targetSchema = schema || 'public';
    if (!table) throw new Error('Table is required');

    const result = await this.client.query(
      'SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
      [targetSchema, table]
    );
    return result.rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
    }));
  }

  async killQuery(): Promise<void> {
    if (!this.client || !this.config) {
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pid = (this.client as any).processID;
      if (!pid) {
        throw new Error('Could not find processID for current connection');
      }

      const killClient = new Client({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
      });

      await killClient.connect();
      await killClient.query('SELECT pg_cancel_backend($1)', [pid]);
      await killClient.end();
    } catch (error) {
      console.error('Failed to kill PostgreSQL query:', error);
      throw error;
    }
  }
}
