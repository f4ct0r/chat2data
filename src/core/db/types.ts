import { DecryptedConnectionConfig, QueryResult } from '../../shared/types';

export type { QueryResult };

export interface DatabaseDriver {
  /** 建立数据库连接 */
  connect(config: DecryptedConnectionConfig): Promise<void>;
  
  /** 断开数据库连接 */
  disconnect(): Promise<void>;
  
  /** 测试连接连通性与认证 */
  testConnection(config: DecryptedConnectionConfig): Promise<boolean>;
  
  /** 执行 SQL 查询 */
  executeQuery(sql: string): Promise<QueryResult>;
  
  /** 获取所有数据库 */
  getDatabases(): Promise<string[]>;

  /** 获取指定数据库的 Schemas */
  getSchemas(database?: string): Promise<string[]>;

  /** 获取指定数据库和 Schema 的 Tables */
  getTables(database?: string, schema?: string): Promise<string[]>;

  /** 获取指定 Table 的 Columns */
  getColumns(database?: string, schema?: string, table?: string): Promise<{ name: string; type: string }[]>;

  /** 中断/取消当前正在执行的长查询 */
  killQuery?(): Promise<void>;
  
  /** 获取数据库基础元数据 (如 Schema 列表、表列表) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMetadata?(): Promise<any>;
}
