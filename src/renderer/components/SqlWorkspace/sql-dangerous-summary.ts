import { SqlClassifier, SqlRiskLevel } from '../../../core/security/sql-classifier';
import { splitSqlStatements } from '../SqlEditor/sql-execution';

export interface SqlDangerousOperationSummary {
  operation: string;
  count: number;
}

export interface SqlDangerousSummary {
  totalDangerousStatementCount: number;
  operations: SqlDangerousOperationSummary[];
}

const findDisplayOperation = (sql: string, operation: string) => {
  if (operation !== 'WITH_DANGEROUS') {
    return operation;
  }

  const dangerousOperationMatch = sql.toUpperCase().match(
    /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE|GRANT|REVOKE|EXECUTE|EXEC|CALL|MERGE|UPSERT)\b/
  );

  return dangerousOperationMatch?.[1] ?? 'WITH';
};

export const summarizeDangerousSql = (sql: string): SqlDangerousSummary | null => {
  const statements = splitSqlStatements(sql);
  const operations = new Map<string, number>();
  let totalDangerousStatementCount = 0;

  for (const statement of statements) {
    const classification = SqlClassifier.classify(statement.sql);

    if (classification.level !== SqlRiskLevel.DANGEROUS) {
      continue;
    }

    const displayOperation = findDisplayOperation(statement.sql, classification.operation);
    totalDangerousStatementCount += 1;
    operations.set(
      displayOperation,
      (operations.get(displayOperation) ?? 0) + 1
    );
  }

  if (totalDangerousStatementCount === 0) {
    return null;
  }

  return {
    totalDangerousStatementCount,
    operations: Array.from(operations, ([operation, count]) => ({
      operation,
      count,
    })),
  };
};
