import type { QueryRow } from '../../shared/types';

export interface TableEditBufferRow {
  rowId: string;
  originalRow: QueryRow;
  pendingRow: QueryRow;
  changedColumns: string[];
  deleted: boolean;
}

export interface TableEditBuffer {
  keyColumns: string[];
  rows: TableEditBufferRow[];
}

const cloneRow = (row: QueryRow): QueryRow => ({ ...row });

const serializeIdentityValue = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'string':
      return `string:${JSON.stringify(value)}`;
    case 'number':
      return Number.isFinite(value)
        ? `number:${String(value)}`
        : `number:${String(value)}`;
    case 'boolean':
      return `boolean:${String(value)}`;
    case 'undefined':
      return 'undefined';
    case 'bigint':
      return `bigint:${value.toString()}`;
    case 'symbol':
      return `symbol:${String(value)}`;
    case 'function':
      return 'function';
    case 'object':
      if (value instanceof Date) {
        return `date:${value.toISOString()}`;
      }

      if (Array.isArray(value)) {
        return `array:${JSON.stringify(value)}`;
      }

      if (Buffer.isBuffer(value) || value instanceof ArrayBuffer) {
        return `binary:${value.byteLength}`;
      }

      if (ArrayBuffer.isView(value)) {
        return `binary:${value.byteLength}`;
      }

      try {
        return `object:${JSON.stringify(value)}`;
      } catch {
        return 'object:[unserializable]';
      }
    default:
      return 'unknown';
  }
};

export const deriveTableEditRowId = (
  originalRow: QueryRow,
  keyColumns: string[]
) =>
  keyColumns
    .map((column) => `${column}:${serializeIdentityValue(originalRow[column])}`)
    .join('|');

const getChangedColumns = (originalRow: QueryRow, pendingRow: QueryRow) =>
  Array.from(
    new Set([...Object.keys(originalRow), ...Object.keys(pendingRow)])
  ).filter((column) => !Object.is(originalRow[column], pendingRow[column]));

const buildRowState = (
  originalRow: QueryRow,
  keyColumns: string[]
): TableEditBufferRow => {
  const clonedRow = cloneRow(originalRow);

  return {
    rowId: deriveTableEditRowId(originalRow, keyColumns),
    originalRow: clonedRow,
    pendingRow: cloneRow(originalRow),
    changedColumns: [],
    deleted: false,
  };
};

const updateRow = (
  buffer: TableEditBuffer,
  rowId: string,
  updater: (row: TableEditBufferRow) => TableEditBufferRow
) => {
  let updated = false;

  const rows = buffer.rows.map((row) => {
    if (row.rowId !== rowId) {
      return row;
    }

    updated = true;
    return updater(row);
  });

  return updated ? { ...buffer, rows } : buffer;
};

export const createTableEditBuffer = (
  rows: QueryRow[],
  keyColumns: string[]
): TableEditBuffer => ({
  keyColumns: [...keyColumns],
  rows: rows.map((row) => buildRowState(row, keyColumns)),
});

export const updateTableEditCell = (
  buffer: TableEditBuffer,
  rowId: string,
  column: string,
  nextValue: unknown
) =>
  updateRow(buffer, rowId, (row) => {
    if (row.deleted) {
      return row;
    }

    const pendingRow = {
      ...row.pendingRow,
      [column]: nextValue,
    };

    return {
      ...row,
      pendingRow,
      changedColumns: getChangedColumns(row.originalRow, pendingRow),
    };
  });

export const markTableEditRowDeleted = (
  buffer: TableEditBuffer,
  rowId: string
) =>
  updateRow(buffer, rowId, (row) => ({
    ...row,
    deleted: true,
    changedColumns: [],
  }));

export const resetTableEditBuffer = (buffer: TableEditBuffer): TableEditBuffer => ({
  ...buffer,
  rows: buffer.rows.map((row) => ({
    ...row,
    pendingRow: cloneRow(row.originalRow),
    changedColumns: [],
    deleted: false,
  })),
});
