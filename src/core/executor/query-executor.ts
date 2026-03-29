import { connectionManager } from '../db/connection-manager';
import { QueryResult } from '../db/types';

export class QueryExecutor {
  private static executionStatus = new Map<string, 'idle' | 'executing'>();

  /**
   * 获取当前连接的查询状态
   */
  public static getStatus(connectionId: string): 'idle' | 'executing' {
    return this.executionStatus.get(connectionId) || 'idle';
  }

  /**
   * 自动为 SELECT 查询注入 LIMIT 1000 以防御大结果集
   */
  public static injectLimit(sql: string): string {
    const trimmed = sql.trim();
    // 简单的防御：如果是 SELECT 开头，且没有包含 LIMIT
    // 仅适用于最外层没有 LIMIT 的情况
    const isSelect = /^select\s/i.test(trimmed);
    const hasLimit = /\blimit\s+\d+/i.test(trimmed);
    const hasTop = /^select\s+top\s+\d+/i.test(trimmed);

    if (isSelect && !hasLimit && !hasTop) {
      // 避免语句末尾带有分号时插入 LIMIT 导致语法错误
      if (trimmed.endsWith(';')) {
        return `${trimmed.slice(0, -1)} LIMIT 1000;`;
      }
      return `${trimmed} LIMIT 1000`;
    }
    return sql;
  }

  /**
   * 执行查询（带大结果集防御）
   */
  public static async execute(connectionId: string, sql: string): Promise<QueryResult> {
    const safeSql = this.injectLimit(sql);
    
    this.executionStatus.set(connectionId, 'executing');
    try {
      return await connectionManager.executeQuery(connectionId, safeSql);
    } finally {
      this.executionStatus.set(connectionId, 'idle');
    }
  }

  /**
   * 中断查询
   */
  public static async cancel(connectionId: string): Promise<void> {
    return await connectionManager.killQuery(connectionId);
  }
}
