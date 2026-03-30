import { sqliteService } from '../storage/sqlite-service';
import { CredentialService } from '../security/credential-service';
import {
  BatchExecutionResult,
  ConnectionConfig,
  DecryptedConnectionConfig,
  PreviewTableRef,
  TableEditMetadata,
} from '../../shared/types';
import { DatabaseDriver, QueryResult } from './types';
import { MysqlAdapter } from './adapters/mysql';
import { PostgresAdapter } from './adapters/postgresql';
import { MssqlAdapter } from './adapters/mssql';
import { ClickhouseAdapter } from './adapters/clickhouse';

export class ConnectionManager {
  private connections = new Map<string, DatabaseDriver>();

  /**
   * 从 SQLite 获取连接配置并解密密码
   */
  public getConfigFromStorage(id: string): DecryptedConnectionConfig {
    const db = sqliteService.getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
    if (!row) {
      throw new Error(`Connection ${id} not found`);
    }

    let password = undefined;
    if (row.encrypted_password) {
      password = CredentialService.decrypt(row.encrypted_password) || undefined;
    }

    return {
      id: row.id,
      name: row.name,
      dbType: row.db_type,
      host: row.host,
      port: row.port,
      username: row.username,
      database: row.database || undefined,
      password,
    };
  }

  /**
   * 根据数据库类型创建适配器实例
   */
  private createAdapter(dbType: string): DatabaseDriver {
    switch (dbType) {
      case 'mysql':
        return new MysqlAdapter();
      case 'postgres':
        return new PostgresAdapter();
      case 'mssql':
        return new MssqlAdapter();
      case 'clickhouse':
        return new ClickhouseAdapter();
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  /**
   * 获取当前活跃的连接实例，如果不存在则抛出异常
   */
  public getConnection(id: string): DatabaseDriver {
    const driver = this.connections.get(id);
    if (!driver) {
      throw new Error(`Connection ${id} is not active`);
    }
    return driver;
  }

  /**
   * 测试连接连通性
   * @param config 测试的配置，如果没有提供 id 则视为一次性测试，如果有 id 则尝试从数据库加载密码进行测试
   */
  public async testConnection(config: ConnectionConfig | { id: string }): Promise<boolean> {
    let fullConfig: DecryptedConnectionConfig;

    if ('dbType' in config && config.dbType) {
      // 传递了完整的 config
      fullConfig = { ...config } as DecryptedConnectionConfig;
      // 如果配置中有 id 但没有密码且标记了 hasPassword，则尝试从数据库中加载密码
      if (config.id && !config.password && config.hasPassword) {
        try {
          const storedConfig = this.getConfigFromStorage(config.id);
          fullConfig.password = storedConfig.password;
        } catch (e) {
          console.warn(`Failed to fetch stored password for testConnection: ${e}`);
        }
      }
    } else {
      // 只传递了 id
      fullConfig = this.getConfigFromStorage(config.id);
    }

    const adapter = this.createAdapter(fullConfig.dbType);
    return await adapter.testConnection(fullConfig);
  }

  /**
   * 建立数据库连接并存入连接池
   */
  public async connect(id: string): Promise<void> {
    if (this.connections.has(id)) {
      return; // 已经连接
    }

    const config = this.getConfigFromStorage(id);
    const adapter = this.createAdapter(config.dbType);
    
    await adapter.connect(config);
    this.connections.set(id, adapter);
  }

  /**
   * 断开数据库连接并从连接池移除
   */
  public async disconnect(id: string): Promise<void> {
    const driver = this.connections.get(id);
    if (driver) {
      await driver.disconnect();
      this.connections.delete(id);
    }
  }

  /**
   * 执行 SQL 查询
   */
  public async executeQuery(id: string, sql: string): Promise<QueryResult> {
    const driver = this.getConnection(id);
    return await driver.executeQuery(sql);
  }

  public async getDatabases(id: string): Promise<string[]> {
    const driver = this.getConnection(id);
    return await driver.getDatabases();
  }

  public async getSchemas(id: string, database?: string): Promise<string[]> {
    const driver = this.getConnection(id);
    return await driver.getSchemas(database);
  }

  public async getTables(id: string, database?: string, schema?: string): Promise<string[]> {
    const driver = this.getConnection(id);
    return await driver.getTables(database, schema);
  }

  public async getColumns(id: string, database?: string, schema?: string, table?: string): Promise<{name: string, type: string}[]> {
    const driver = this.getConnection(id);
    return await driver.getColumns(database, schema, table);
  }

  public async getTableEditMetadata(id: string, table: PreviewTableRef): Promise<TableEditMetadata> {
    const driver = this.getConnection(id);
    if (!driver.getTableEditMetadata) {
      return {
        editable: false,
        reason: 'Editing is not supported for this database.',
        key: null,
      };
    }

    return await driver.getTableEditMetadata(table);
  }

  public async executeBatch(id: string, statements: string[]): Promise<BatchExecutionResult> {
    const driver = this.getConnection(id);
    if (!driver.executeBatch) {
      throw new Error(`Connection ${id} does not support batch execution`);
    }

    return await driver.executeBatch(statements);
  }

  /**
   * 中断当前连接上正在执行的查询
   */
  public async killQuery(id: string): Promise<void> {
    const driver = this.getConnection(id);
    if (driver.killQuery) {
      await driver.killQuery();
    } else {
      throw new Error(`Connection ${id} does not support killQuery`);
    }
  }
}

export const connectionManager = new ConnectionManager();
