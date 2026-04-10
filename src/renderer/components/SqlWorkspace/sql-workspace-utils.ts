import {
  GridCellSelection,
  GridSelectionState,
} from '../DataGrid/data-grid-editing-state';
import { parseClipboardTable } from '../DataGrid/data-grid-clipboard';
import {
  TableEditBuffer,
  TableEditBufferRow,
  updateTableEditCell,
} from '../../features/table-edit-buffer';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const formatEditablePreviewValue = (value: unknown) => {
  if (value === null) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

export const findEditablePreviewBufferRow = (
  editBuffer: TableEditBuffer,
  editingCell: GridCellSelection
): TableEditBufferRow | undefined =>
  editBuffer.rows.find((candidate) => candidate.rowId === editingCell.rowId);

export const getEditablePreviewApplyError = ({
  batchResult,
  batchExecutionError,
  formatFailedStatement,
  fallbackMessage,
}: {
  batchResult?: {
    ok: boolean;
    failedStatementIndex?: number;
    error?: string;
  } | null;
  batchExecutionError?: unknown;
  formatFailedStatement?: (index: number, message: string) => string;
  fallbackMessage?: string;
}) => {
  if (batchExecutionError) {
    return getErrorMessage(batchExecutionError);
  }

  if (!batchResult || batchResult.ok) {
    return null;
  }

  if (
    batchResult.failedStatementIndex !== undefined &&
    batchResult.error &&
    formatFailedStatement
  ) {
    return formatFailedStatement(batchResult.failedStatementIndex + 1, batchResult.error);
  }

  return batchResult.error ?? fallbackMessage ?? null;
};

export const coerceEditablePreviewCellValue = (
  rawValue: string,
  currentValue: unknown
) => {
  if (rawValue === formatEditablePreviewValue(currentValue)) {
    return currentValue;
  }

  if (typeof currentValue === 'number') {
    if (rawValue.trim() === '') {
      return rawValue;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : rawValue;
  }

  if (typeof currentValue === 'boolean') {
    if (rawValue === '1' || rawValue === '0') {
      return rawValue === '1';
    }

    if (/^(true|false)$/i.test(rawValue)) {
      return rawValue.toLowerCase() === 'true';
    }
  }

  return rawValue;
};

export const getEditablePreviewApplyBuffer = ({
  editBuffer,
  editingCell,
  editingValue,
}: {
  editBuffer: TableEditBuffer;
  editingCell: GridCellSelection | null;
  editingValue: string;
}) => {
  if (!editingCell) {
    return editBuffer;
  }

  const row = findEditablePreviewBufferRow(editBuffer, editingCell);
  if (!row) {
    return editBuffer;
  }

  const nextValue = coerceEditablePreviewCellValue(
    editingValue,
    row.pendingRow[editingCell.column]
  );

  return updateTableEditCell(
    editBuffer,
    editingCell.rowId,
    editingCell.column,
    nextValue
  );
};

export const applyEditablePreviewPaste = ({
  editBuffer,
  columns,
  selection,
  clipboardText,
}: {
  editBuffer: TableEditBuffer;
  columns: string[];
  selection: GridSelectionState;
  clipboardText: string;
}) => {
  const targetCell = selection.selectedCell;
  if (!targetCell) {
    return {
      buffer: editBuffer,
      updatedCellCount: 0,
      truncated: false,
    };
  }

  const startRowIndex = editBuffer.rows.findIndex((row) => row.rowId === targetCell.rowId);
  const startColumnIndex = columns.indexOf(targetCell.column);

  if (startRowIndex === -1 || startColumnIndex === -1) {
    return {
      buffer: editBuffer,
      updatedCellCount: 0,
      truncated: false,
    };
  }

  const parsedRows = parseClipboardTable(clipboardText);
  let nextBuffer = editBuffer;
  let updatedCellCount = 0;
  let truncated = false;

  parsedRows.forEach((clipboardRow, rowOffset) => {
    const targetRow = editBuffer.rows[startRowIndex + rowOffset];

    if (!targetRow) {
      if (clipboardRow.some((value) => value !== '')) {
        truncated = true;
      }
      return;
    }

    if (targetRow.deleted) {
      truncated = true;
      return;
    }

    clipboardRow.forEach((rawValue, columnOffset) => {
      const column = columns[startColumnIndex + columnOffset];

      if (!column) {
        if (rawValue !== '') {
          truncated = true;
        }
        return;
      }

      const currentRow =
        nextBuffer.rows.find((candidate) => candidate.rowId === targetRow.rowId) ?? targetRow;
      const nextValue = coerceEditablePreviewCellValue(
        rawValue,
        currentRow.pendingRow[column]
      );

      nextBuffer = updateTableEditCell(nextBuffer, targetRow.rowId, column, nextValue);
      updatedCellCount += 1;
    });
  });

  return {
    buffer: nextBuffer,
    updatedCellCount,
    truncated,
  };
};
