export enum SqlRiskLevel {
  SAFE = 'SAFE', // SELECT, SHOW, EXPLAIN, PRAGMA (read-only)
  DANGEROUS = 'DANGEROUS', // INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, TRUNCATE, etc.
  UNKNOWN = 'UNKNOWN' // Unable to parse or unsupported
}

export interface SqlClassificationResult {
  isSafe: boolean;
  level: SqlRiskLevel;
  operation: string;
}

export class SqlClassifier {
  private static readonly SAFE_OPERATIONS = new Set([
    'SELECT',
    'SHOW',
    'EXPLAIN',
    'DESCRIBE',
    'PRAGMA'
  ]);

  private static readonly DANGEROUS_OPERATIONS = new Set([
    'INSERT',
    'UPDATE',
    'DELETE',
    'CREATE',
    'DROP',
    'ALTER',
    'TRUNCATE',
    'REPLACE',
    'GRANT',
    'REVOKE',
    'EXEC',
    'EXECUTE',
    'CALL',
    'MERGE',
    'UPSERT'
  ]);

  /**
   * Classifies a SQL query as safe or dangerous.
   * Basic heuristic based on the first keyword of the query.
   */
  public static classify(sql: string): SqlClassificationResult {
    if (!sql || typeof sql !== 'string') {
      return { isSafe: false, level: SqlRiskLevel.UNKNOWN, operation: 'UNKNOWN' };
    }

    // Remove comments and trim whitespace
    const cleanSql = this.removeComments(sql).trim();
    if (!cleanSql) {
      return { isSafe: false, level: SqlRiskLevel.UNKNOWN, operation: 'EMPTY' };
    }

    // Get the first word
    const match = cleanSql.match(/^([a-zA-Z]+)/);
    if (!match) {
      return { isSafe: false, level: SqlRiskLevel.UNKNOWN, operation: 'UNKNOWN' };
    }

    const firstWord = match[1].toUpperCase();

    if (this.SAFE_OPERATIONS.has(firstWord)) {
      // For PRAGMA, some could be dangerous, but we'll consider simple ones safe for now.
      // In a real implementation, you'd parse further.
      return { isSafe: true, level: SqlRiskLevel.SAFE, operation: firstWord };
    }

    if (this.DANGEROUS_OPERATIONS.has(firstWord)) {
      return { isSafe: false, level: SqlRiskLevel.DANGEROUS, operation: firstWord };
    }

    // If it's something like WITH cte AS (...), it usually precedes a SELECT, INSERT, etc.
    if (firstWord === 'WITH') {
      // Check if there's an INSERT/UPDATE/DELETE after WITH
      if (this.containsDangerousKeywords(cleanSql)) {
         return { isSafe: false, level: SqlRiskLevel.DANGEROUS, operation: 'WITH_DANGEROUS' };
      }
      return { isSafe: true, level: SqlRiskLevel.SAFE, operation: 'WITH_SELECT' };
    }

    return { isSafe: false, level: SqlRiskLevel.UNKNOWN, operation: firstWord };
  }

  private static removeComments(sql: string): string {
    // Remove multi-line comments
    let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove single-line comments
    cleaned = cleaned.replace(/--.*$/gm, '');
    return cleaned;
  }

  private static containsDangerousKeywords(sql: string): string | null {
    const upperSql = sql.toUpperCase();
    for (const op of this.DANGEROUS_OPERATIONS) {
      // Looking for word boundaries around dangerous operations
      const regex = new RegExp(`\\b${op}\\b`);
      if (regex.test(upperSql)) {
        return op;
      }
    }
    return null;
  }
}
