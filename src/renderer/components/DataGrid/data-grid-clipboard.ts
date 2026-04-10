import type { QueryRow } from '../../../shared/types';
import type {
  GridCellSelection,
  GridSelectionState,
} from './data-grid-editing-state';

interface GridRowSnapshot {
  rowId: string;
  row: QueryRow;
}

const formatGridCellValue = (value: unknown) =>
  value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value);

const getIndexBounds = (firstIndex: number, secondIndex: number) =>
  firstIndex <= secondIndex ? [firstIndex, secondIndex] : [secondIndex, firstIndex];

const getRangeEndpoints = (selection: GridSelectionState) => {
  if (selection.selectedRange) {
    return selection.selectedRange;
  }

  if (!selection.selectedCell) {
    return null;
  }

  return {
    anchor: selection.selectedCell,
    focus: selection.selectedCell,
  };
};

const getRangeIndices = ({
  selection,
  rowOrder,
  columnOrder,
}: {
  selection: GridSelectionState;
  rowOrder: string[];
  columnOrder: string[];
}) => {
  const endpoints = getRangeEndpoints(selection);
  if (!endpoints) {
    return null;
  }

  const anchorRowIndex = rowOrder.indexOf(endpoints.anchor.rowId);
  const focusRowIndex = rowOrder.indexOf(endpoints.focus.rowId);
  const anchorColumnIndex = columnOrder.indexOf(endpoints.anchor.column);
  const focusColumnIndex = columnOrder.indexOf(endpoints.focus.column);

  if (
    anchorRowIndex === -1 ||
    focusRowIndex === -1 ||
    anchorColumnIndex === -1 ||
    focusColumnIndex === -1
  ) {
    return null;
  }

  const [rowStart, rowEnd] = getIndexBounds(anchorRowIndex, focusRowIndex);
  const [columnStart, columnEnd] = getIndexBounds(anchorColumnIndex, focusColumnIndex);

  return {
    rowStart,
    rowEnd,
    columnStart,
    columnEnd,
  };
};

const encodeClipboardCell = (value: string) =>
  /[\t\r\n"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export const getCellsForGridSelection = ({
  selection,
  rowOrder,
  columnOrder,
  deletedRowIds = [],
}: {
  selection: GridSelectionState;
  rowOrder: string[];
  columnOrder: string[];
  deletedRowIds?: readonly string[];
}) => {
  if (selection.selectedRowIds.length > 0) {
    return [];
  }

  const rangeIndices = getRangeIndices({
    selection,
    rowOrder,
    columnOrder,
  });

  if (!rangeIndices) {
    return [];
  }

  const deletedRowIdSet = new Set(deletedRowIds);
  const cells: GridCellSelection[] = [];

  for (let rowIndex = rangeIndices.rowStart; rowIndex <= rangeIndices.rowEnd; rowIndex += 1) {
    const rowId = rowOrder[rowIndex];

    if (!rowId || deletedRowIdSet.has(rowId)) {
      continue;
    }

    for (
      let columnIndex = rangeIndices.columnStart;
      columnIndex <= rangeIndices.columnEnd;
      columnIndex += 1
    ) {
      const column = columnOrder[columnIndex];
      if (!column) {
        continue;
      }

      cells.push({ rowId, column });
    }
  }

  return cells;
};

export const isCellWithinGridSelection = ({
  selection,
  rowId,
  column,
  rowOrder,
  columnOrder,
}: {
  selection: GridSelectionState;
  rowId: string;
  column: string;
  rowOrder: string[];
  columnOrder: string[];
}) => {
  if (selection.selectedRowIds.length > 0) {
    return false;
  }

  const rangeIndices = getRangeIndices({
    selection,
    rowOrder,
    columnOrder,
  });

  if (!rangeIndices) {
    return false;
  }

  const rowIndex = rowOrder.indexOf(rowId);
  const columnIndex = columnOrder.indexOf(column);

  return (
    rowIndex >= rangeIndices.rowStart &&
    rowIndex <= rangeIndices.rowEnd &&
    columnIndex >= rangeIndices.columnStart &&
    columnIndex <= rangeIndices.columnEnd
  );
};

export const getClipboardTextForGridSelection = ({
  selection,
  columns,
  rows,
}: {
  selection: GridSelectionState;
  columns: string[];
  rows: GridRowSnapshot[];
}) => {
  const rowOrder = rows.map((row) => row.rowId);
  const rowMap = new Map(rows.map((row) => [row.rowId, row.row]));

  if (selection.selectedRowIds.length > 0) {
    const selectedRowIdSet = new Set(selection.selectedRowIds);
    const selectedRows = rowOrder.filter((rowId) => selectedRowIdSet.has(rowId));

    if (selectedRows.length === 0) {
      return null;
    }

    return selectedRows
      .map((rowId) =>
        columns
          .map((column) => encodeClipboardCell(formatGridCellValue(rowMap.get(rowId)?.[column])))
          .join('\t')
      )
      .join('\r\n');
  }

  const rangeIndices = getRangeIndices({
    selection,
    rowOrder,
    columnOrder: columns,
  });

  if (!rangeIndices) {
    return null;
  }

  const lines: string[] = [];

  for (let rowIndex = rangeIndices.rowStart; rowIndex <= rangeIndices.rowEnd; rowIndex += 1) {
    const rowId = rowOrder[rowIndex];
    const row = rowMap.get(rowId);

    if (!row) {
      continue;
    }

    const cells: string[] = [];
    for (
      let columnIndex = rangeIndices.columnStart;
      columnIndex <= rangeIndices.columnEnd;
      columnIndex += 1
    ) {
      const column = columns[columnIndex];
      cells.push(encodeClipboardCell(formatGridCellValue(row[column])));
    }

    lines.push(cells.join('\t'));
  }

  return lines.length > 0 ? lines.join('\r\n') : null;
};

export const resolveGridCopyShortcutText = ({
  key,
  metaKey,
  ctrlKey,
  isEditingCell,
  selection,
  columns,
  rows,
}: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  isEditingCell: boolean;
  selection: GridSelectionState;
  columns: string[];
  rows: GridRowSnapshot[];
}) => {
  if (isEditingCell || key.toLowerCase() !== 'c' || (!metaKey && !ctrlKey)) {
    return null;
  }

  return getClipboardTextForGridSelection({
    selection,
    columns,
    rows,
  });
};

export const parseClipboardTable = (clipboardText: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < clipboardText.length; index += 1) {
    const character = clipboardText[index];

    if (inQuotes) {
      if (character === '"') {
        if (clipboardText[index + 1] === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === '\t') {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (character === '\r' || character === '\n') {
      if (character === '\r' && clipboardText[index + 1] === '\n') {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  if (rows.length > 1) {
    const lastRow = rows[rows.length - 1];
    const hasTrailingNewline = /(?:\r\n|\n|\r)$/.test(clipboardText);

    if (hasTrailingNewline && lastRow.every((value) => value === '')) {
      rows.pop();
    }
  }

  return rows;
};
