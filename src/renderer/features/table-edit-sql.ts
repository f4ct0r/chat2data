import type { ConnectionConfig, PreviewTableRef } from '../../shared/types';
import type { TableEditBuffer, TableEditBufferRow } from './table-edit-buffer';

export type TableEditSqlValueKind =
  | 'array'
  | 'binary'
  | 'bigint'
  | 'date'
  | 'function'
  | 'missing-key-columns'
  | 'number'
  | 'object'
  | 'symbol'
  | 'undefined'
  | 'unknown';

export interface TableEditSqlUnsupportedValue {
  kind: 'unsupported-value';
  rowId: string;
  column: string;
  valueKind: TableEditSqlValueKind;
  reason: string;
}

export interface TableEditSqlStatement {
  kind: 'update' | 'delete';
  rowId: string;
  sql: string;
}

export interface TableEditSqlSuccess {
  ok: true;
  statements: TableEditSqlStatement[];
  batchStatements: string[];
  previewSql: string;
}

export interface TableEditSqlFailure {
  ok: false;
  unsupportedValue: TableEditSqlUnsupportedValue;
}

export type TableEditSqlResult = TableEditSqlSuccess | TableEditSqlFailure;

interface SqlLiteralSuccess {
  ok: true;
  sql: string;
}

interface SqlLiteralFailure {
  ok: false;
  unsupportedValue: TableEditSqlUnsupportedValue;
}

type SqlLiteralResult = SqlLiteralSuccess | SqlLiteralFailure;

const getBufferConstructor = () =>
  (globalThis as typeof globalThis & {
    Buffer?: {
      isBuffer?: (value: unknown) => boolean;
    };
  }).Buffer;

const quoteIdentifier = (
  identifier: string,
  dbType: ConnectionConfig['dbType']
) => {
  switch (dbType) {
    case 'mysql':
    case 'clickhouse':
      return `\`${identifier.replace(/`/g, '``')}\``;
    case 'mssql':
      return `[${identifier.replace(/]/g, ']]')}]`;
    case 'postgres':
    default:
      return `"${identifier.replace(/"/g, '""')}"`;
  }
};

const getQualifiedTableSegments = (
  table: Pick<PreviewTableRef, 'dbType' | 'database' | 'schema' | 'table'>
) => {
  const segments = [table.database, table.schema, table.table].filter(
    (segment): segment is string => Boolean(segment)
  );

  if (table.dbType === 'sqlite') {
    return [table.table];
  }

  if (
    (table.dbType === 'mysql' || table.dbType === 'clickhouse') &&
    table.database &&
    table.schema === table.database
  ) {
    return [table.database, table.table];
  }

  return segments;
};

const buildQualifiedTableName = (
  table: Pick<PreviewTableRef, 'dbType' | 'database' | 'schema' | 'table'>
) =>
  getQualifiedTableSegments(table)
    .map((segment) => quoteIdentifier(segment, table.dbType))
    .join('.');

const unsupportedValue = (
  rowId: string,
  column: string,
  valueKind: TableEditSqlValueKind,
  reason: string
): SqlLiteralFailure => ({
  ok: false,
  unsupportedValue: {
    kind: 'unsupported-value',
    rowId,
    column,
    valueKind,
    reason,
  },
});

const serializeSqlLiteral = (
  rowId: string,
  column: string,
  value: unknown,
  dbType: ConnectionConfig['dbType']
): SqlLiteralResult => {
  if (value === null) {
    return { ok: true, sql: 'NULL' };
  }

  if (typeof value === 'string') {
    return {
      ok: true,
      sql: `'${value.replace(/'/g, "''")}'`,
    };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return unsupportedValue(
        rowId,
        column,
        'number',
        'Non-finite numbers are not supported in SQL edit generation.'
      );
    }

    return { ok: true, sql: String(value) };
  }

  if (typeof value === 'boolean') {
    return {
      ok: true,
      sql:
        dbType === 'mssql'
          ? value
            ? '1'
            : '0'
          : value
            ? 'TRUE'
            : 'FALSE',
    };
  }

  if (typeof value === 'bigint') {
    return unsupportedValue(
      rowId,
      column,
      'bigint',
      'BigInt values are not supported in SQL edit generation.'
    );
  }

  if (typeof value === 'undefined') {
    return unsupportedValue(
      rowId,
      column,
      'undefined',
      'Undefined values are not supported in SQL edit generation.'
    );
  }

  if (typeof value === 'function') {
    return unsupportedValue(
      rowId,
      column,
      'function',
      'Function values are not supported in SQL edit generation.'
    );
  }

  if (typeof value === 'symbol') {
    return unsupportedValue(
      rowId,
      column,
      'symbol',
      'Symbol values are not supported in SQL edit generation.'
    );
  }

  if (value instanceof Date) {
    return unsupportedValue(
      rowId,
      column,
      'date',
      'Date values are not supported in SQL edit generation.'
    );
  }

  if (Array.isArray(value)) {
    return unsupportedValue(
      rowId,
      column,
      'array',
      'Array values are not supported in SQL edit generation.'
    );
  }

  if (
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    getBufferConstructor()?.isBuffer?.(value) === true
  ) {
    return unsupportedValue(
      rowId,
      column,
      'binary',
      'Binary values are not supported in SQL edit generation.'
    );
  }

  if (typeof value === 'object') {
    return unsupportedValue(
      rowId,
      column,
      'object',
      'Object values are not supported in SQL edit generation.'
    );
  }

  return unsupportedValue(
    rowId,
    column,
    'unknown',
    'This value type is not supported in SQL edit generation.'
  );
};

const buildWhereClause = (
  row: TableEditBufferRow,
  column: string,
  table: Pick<PreviewTableRef, 'dbType' | 'database' | 'schema' | 'table'>
) => {
  const literal = serializeSqlLiteral(
    row.rowId,
    column,
    row.originalRow[column],
    table.dbType
  );

  if (!literal.ok) {
    return literal;
  }

  if (literal.sql === 'NULL') {
    return {
      ok: true,
      sql: `${quoteIdentifier(column, table.dbType)} IS NULL`,
    } as const;
  }

  return {
    ok: true,
    sql: `${quoteIdentifier(column, table.dbType)} = ${literal.sql}`,
  } as const;
};

const buildAssignment = (
  row: TableEditBufferRow,
  column: string,
  value: unknown,
  table: Pick<PreviewTableRef, 'dbType' | 'database' | 'schema' | 'table'>
) => {
  const literal = serializeSqlLiteral(row.rowId, column, value, table.dbType);

  if (!literal.ok) {
    return literal;
  }

  return {
    ok: true,
    sql: `${quoteIdentifier(column, table.dbType)} = ${literal.sql}`,
  } as const;
};

export const generateTableEditSql = (
  buffer: TableEditBuffer,
  table: Pick<PreviewTableRef, 'dbType' | 'database' | 'schema' | 'table'>
): TableEditSqlResult => {
  if (buffer.keyColumns.length === 0) {
    return unsupportedValue(
      '__row__',
      '__row__',
      'missing-key-columns',
      'At least one key column is required to generate editable SQL.'
    );
  }

  const statements: TableEditSqlStatement[] = [];

  for (const row of buffer.rows) {
    if (row.deleted || row.changedColumns.length === 0) {
      continue;
    }

    const setClauses: string[] = [];

    for (const column of row.changedColumns) {
      const assignment = buildAssignment(
        row,
        column,
        row.pendingRow[column],
        table
      );

      if (!assignment.ok) {
        return assignment;
      }

      setClauses.push(assignment.sql);
    }

    const whereClauses: string[] = [];

    for (const column of buffer.keyColumns) {
      const whereClause = buildWhereClause(row, column, table);

      if (!whereClause.ok) {
        return whereClause;
      }

      whereClauses.push(whereClause.sql);
    }

    statements.push({
      kind: 'update',
      rowId: row.rowId,
      sql: `UPDATE ${buildQualifiedTableName(table)} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`,
    });
  }

  for (const row of buffer.rows) {
    if (!row.deleted) {
      continue;
    }

    const whereClauses: string[] = [];

    for (const column of buffer.keyColumns) {
      const whereClause = buildWhereClause(row, column, table);

      if (!whereClause.ok) {
        return whereClause;
      }

      whereClauses.push(whereClause.sql);
    }

    statements.push({
      kind: 'delete',
      rowId: row.rowId,
      sql: `DELETE FROM ${buildQualifiedTableName(table)} WHERE ${whereClauses.join(' AND ')}`,
    });
  }

  return {
    ok: true,
    statements,
    batchStatements: statements.map((statement) => statement.sql),
    previewSql:
      statements.length === 0
        ? ''
        : `${statements.map((statement) => statement.sql).join(';\n')};`,
  };
};
