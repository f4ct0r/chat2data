import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TableEditBuffer } from '../../features/table-edit-buffer';
import { QueryRow, QueryResult } from '../../../shared/types';
import { useI18n } from '../../i18n/i18n-context';
import {
  getClipboardTextForGridSelection,
  isCellWithinGridSelection,
  resolveGridCopyShortcutText,
} from './data-grid-clipboard';
import {
  focusGridKeyboardTarget,
  getDefaultColumnWidth,
  getInitialColumnWidths,
  resizeColumnWidth,
  shouldRemeasureViewport,
} from './data-grid-utils';
import {
  GridCellSelection,
  GridDeleteAction,
  GridEscapeAction,
  GridSelectionState,
  resolveGridCellSelectionRequest,
  resolveGridDeleteKeyboardInteraction,
  resolveGridEscapeKeyboardInteraction,
  resolveGridEditStartRequest,
  resolveGridRowSelectionRequest,
} from './data-grid-editing-state';

interface DataGridEditablePreview {
  buffer: TableEditBuffer;
  selection: GridSelectionState;
  editingCell: GridCellSelection | null;
  editingValue?: string;
}

interface DataGridProps {
  result: QueryResult;
  editablePreview?: DataGridEditablePreview;
  onSelectionChange?: (selection: GridSelectionState) => void;
  onEditStart?: (cell: GridCellSelection) => void;
  onEditChange?: (value: string) => void;
  onEditCommit?: () => void;
  onEditCancel?: () => void;
  onDeleteAction?: (action: GridDeleteAction) => void;
  onEscapeAction?: (action: GridEscapeAction) => void;
  onPasteClipboard?: (clipboardText: string) => void;
  restorableDeletedRowIds?: string[];
}

type ViewportSize = {
  width: number;
  height: number;
};

type RenderedRowState = {
  rowId: string;
  row: QueryRow;
  deleted: boolean;
  changedColumns: string[];
};

const EMPTY_GRID_SELECTION: GridSelectionState = {
  selectedRowIds: [],
  selectedCell: null,
  selectedRange: null,
  anchorRowId: null,
  anchorCell: null,
};

const formatCellValue = (value: unknown) =>
  value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value);

const getRowState = (
  row: QueryRow,
  bufferRow: TableEditBuffer['rows'][number] | undefined
) => {
  if (!bufferRow) {
    return {
      row,
      deleted: false,
      changedColumns: [] as string[],
    };
  }

  return {
    row: bufferRow.pendingRow,
    deleted: bufferRow.deleted,
    changedColumns: bufferRow.changedColumns,
  };
};

const DataGrid: React.FC<DataGridProps> = ({
  result,
  editablePreview,
  onSelectionChange,
  onEditStart,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onDeleteAction,
  onEscapeAction,
  onPasteClipboard,
  restorableDeletedRowIds = [],
}) => {
  const { t } = useI18n();
  const gridKeyboardTargetRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const viewportSizeRef = useRef<ViewportSize | null>(null);
  const resizeStateRef = useRef<{
    column: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const selectionDragActiveRef = useRef(false);

  const { columns, rows } = result;
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    getInitialColumnWidths(columns)
  );
  const [internalSelection, setInternalSelection] = useState<GridSelectionState>(EMPTY_GRID_SELECTION);

  useEffect(() => {
    setColumnWidths((currentWidths) => getInitialColumnWidths(columns, currentWidths));
  }, [columns]);

  useEffect(() => {
    if (!editablePreview) {
      setInternalSelection(EMPTY_GRID_SELECTION);
    }
  }, [editablePreview, result]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const nextWidth = resizeColumnWidth(
        resizeState.startWidth,
        event.clientX - resizeState.startX
      );

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [resizeState.column]: nextWidth,
      }));
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      selectionDragActiveRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) {
      return;
    }

    let frameId: number | null = null;

    const readViewportSize = (): ViewportSize => ({
      width: parent.clientWidth,
      height: parent.clientHeight,
    });

    const syncViewport = () => {
      const nextSize = readViewportSize();
      const shouldMeasure = shouldRemeasureViewport(viewportSizeRef.current, nextSize);
      viewportSizeRef.current = nextSize;

      if (shouldMeasure) {
        rowVirtualizer.measure();
      }
    };

    const scheduleSync = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        syncViewport();
      });
    };

    scheduleSync();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleSync);

      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }

        window.removeEventListener('resize', scheduleSync);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });

    resizeObserver.observe(parent);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();
    };
  }, [columns, rows.length, rowVirtualizer]);

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('dataGrid.noData')}
      </div>
    );
  }

  const editableRows = editablePreview?.buffer.rows ?? [];
  const renderedRows: RenderedRowState[] = rows.map((row, index) => {
    const bufferRow = editableRows[index];
    const renderedRow = getRowState(row, bufferRow);

    return {
      rowId: bufferRow?.rowId ?? `row-${index}`,
      row: renderedRow.row,
      deleted: renderedRow.deleted,
      changedColumns: renderedRow.changedColumns,
    };
  });
  const selection = editablePreview?.selection ?? internalSelection;
  const selectedRowIds = selection.selectedRowIds;
  const selectedCell = selection.selectedCell;
  const rowOrder = renderedRows.map((row) => row.rowId);
  const deletedRowIds = renderedRows.filter((row) => row.deleted).map((row) => row.rowId);
  const isEditable = Boolean(editablePreview);
  const colWidths = columns.map((col) => columnWidths[col] ?? getDefaultColumnWidth(col));
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0) + 48;

  const emitSelectionChange = (nextSelection: GridSelectionState) => {
    if (editablePreview) {
      onSelectionChange?.(nextSelection);
      return;
    }

    setInternalSelection(nextSelection);
    onSelectionChange?.(nextSelection);
  };

  const selectCell = (rowId: string, column: string, shiftKey: boolean) => {
    const nextRequest = resolveGridCellSelectionRequest({
      ...selection,
      cell: { rowId, column },
      rowOrder,
      columnOrder: columns,
      shiftKey,
      deletedRowIds,
    });

    if (nextRequest.shouldFocusGrid) {
      focusGridKeyboardTarget(gridKeyboardTargetRef.current);
    }

    emitSelectionChange(nextRequest.selection);
  };

  const handleRowSelection = (
    rowId: string,
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (!editablePreview) {
      return;
    }

    const nextRequest = resolveGridRowSelectionRequest({
      ...selection,
      rowId,
      rowOrder,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      platform: window.navigator.platform,
      deletedRowIds,
    });

    if (nextRequest.shouldFocusGrid) {
      focusGridKeyboardTarget(gridKeyboardTargetRef.current);
    }

    emitSelectionChange(nextRequest.selection);
  };

  const handleCellEditStart = (rowId: string, column: string) => {
    if (!editablePreview) {
      return;
    }

    if (deletedRowIds.includes(rowId)) {
      return;
    }

    const nextRequest = resolveGridEditStartRequest({
      cell: { rowId, column },
      deletedRowIds,
    });

    if (!nextRequest.shouldFocusGrid || !nextRequest.cell) {
      return;
    }

    focusGridKeyboardTarget(gridKeyboardTargetRef.current);
    onEditStart?.(nextRequest.cell);
  };

  const handleKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const copyShortcutText = resolveGridCopyShortcutText({
      key: event.key,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      isEditingCell: Boolean(editablePreview?.editingCell),
      selection,
      columns,
      rows: renderedRows.map(({ rowId, row }) => ({ rowId, row })),
    });

    if (copyShortcutText) {
      void navigator.clipboard?.writeText?.(copyShortcutText);
    }

    if (!editablePreview) {
      return;
    }

    const nextEscapeInteraction = resolveGridEscapeKeyboardInteraction({
      isEditingCell: Boolean(editablePreview.editingCell),
      key: event.key,
      restorableDeletedRowIds,
      canHandleEscapeAction: Boolean(onEscapeAction),
    });

    if (nextEscapeInteraction.shouldPreventDefault) {
      event.preventDefault();
      event.stopPropagation();
      onEscapeAction?.(nextEscapeInteraction.action);
      return;
    }

    const nextInteraction = resolveGridDeleteKeyboardInteraction({
      selectedRowIds,
      selectedCell,
      selectedRange: selection.selectedRange,
      isEditingCell: Boolean(editablePreview.editingCell),
      key: event.key,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      platform: window.navigator.platform,
      rowOrder,
      columnOrder: columns,
      deletedRowIds,
      canHandleDeleteAction: Boolean(onDeleteAction),
    });

    if (!nextInteraction.shouldPreventDefault) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onDeleteAction?.(nextInteraction.action);
  };

  const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (editablePreview?.editingCell) {
      return;
    }

    const clipboardText = getClipboardTextForGridSelection({
      selection,
      columns,
      rows: renderedRows.map(({ rowId, row }) => ({ rowId, row })),
    });

    if (!clipboardText) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData('text/plain', clipboardText);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!editablePreview || !onPasteClipboard || editablePreview.editingCell) {
      return;
    }

    const clipboardText = event.clipboardData.getData('text/plain');
    if (!clipboardText) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onPasteClipboard(clipboardText);
  };

  return (
    <div
      ref={gridKeyboardTargetRef}
      className="flex-1 min-h-0 w-full flex flex-col overflow-hidden border border-[#333333] rounded-sm bg-[#050505] font-mono text-[#a3a3a3]"
      data-grid-editable={isEditable ? 'true' : undefined}
      tabIndex={0}
      onKeyDownCapture={handleKeyDownCapture}
      onCopy={handleCopy}
      onPaste={handlePaste}
    >
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-auto relative custom-scrollbar"
      >
        <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
          <div className="flex bg-[#121212] border-b border-[#333333] font-semibold text-sm sticky top-0 z-10 text-[#FF5722]">
            <div className="flex-none w-12 border-r border-[#333333] px-2 py-2 text-center text-[#737373] bg-[#121212] sticky left-0 z-20">
              #
            </div>
            {columns.map((col, idx) => (
              <div
                key={col}
                className="relative flex-none border-r border-[#333333] truncate"
                style={{ width: colWidths[idx] }}
                title={col}
              >
                <div className="px-4 py-2 pr-5">{col}</div>
                <button
                  type="button"
                  aria-label={`Resize ${col} column`}
                  data-column-resize-handle={col}
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize border-l border-[#333333] bg-[#121212] hover:bg-[#FF5722]/20"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    resizeStateRef.current = {
                      column: col,
                      startX: event.clientX,
                      startWidth: colWidths[idx],
                    };
                  }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const renderedRow = renderedRows[virtualRow.index];
              if (!renderedRow) {
                return null;
              }

              const isRowSelected = selectedRowIds.includes(renderedRow.rowId);
              const rowClassName = `absolute top-0 left-0 flex text-sm border-b border-[#1a1a1a] hover:bg-[#FF5722]/10 hover:text-[#00ff00] transition-colors ${
                virtualRow.index % 2 === 0 ? 'bg-[#0a0a0a]' : 'bg-[#050505]'
              } ${
                renderedRow.deleted ? 'opacity-60 text-[#737373] cursor-not-allowed' : ''
              }`;

              return (
                <div
                  key={virtualRow.index}
                  className={rowClassName}
                  data-pending-delete={renderedRow.deleted ? 'true' : undefined}
                  data-row-selected={isRowSelected ? 'true' : undefined}
                  aria-readonly={renderedRow.deleted ? 'true' : undefined}
                  style={{
                    height: `${virtualRow.size}px`,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className="flex-none w-12 border-r border-[#1a1a1a] px-2 py-2 text-center text-[#737373] bg-[#050505] sticky left-0 z-10 select-none"
                    onClick={
                      isEditable
                        ? (event) => handleRowSelection(renderedRow.rowId, event)
                        : undefined
                    }
                  >
                    <span>{virtualRow.index + 1}</span>
                    {renderedRow.deleted ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-[#FF5722]">
                        Pending delete
                      </span>
                    ) : null}
                  </div>
                  {columns.map((col, colIdx) => {
                    const value = renderedRow.row[col];
                    const displayVal = formatCellValue(value);
                    const isDirty = renderedRow.changedColumns.includes(col);
                    const isCellInRange = isCellWithinGridSelection({
                      selection,
                      rowId: renderedRow.rowId,
                      column: col,
                      rowOrder,
                      columnOrder: columns,
                    });
                    const isCellActive = Boolean(
                      selectedCell &&
                        selectedCell.rowId === renderedRow.rowId &&
                        selectedCell.column === col
                    );
                    const isEditingCell = Boolean(
                      editablePreview?.editingCell &&
                        editablePreview.editingCell.rowId === renderedRow.rowId &&
                        editablePreview.editingCell.column === col
                    );

                    return (
                      <div
                        key={colIdx}
                        className={`flex-none px-4 py-2 border-r border-[#1a1a1a] truncate select-none ${
                          value === null ? 'text-[#737373] italic' : ''
                        } ${isCellInRange ? 'bg-[#FF5722]/10' : ''} ${
                          isCellActive ? 'bg-[#FF5722]/20 text-[#f5f5f5]' : ''
                        } ${renderedRow.deleted ? 'pointer-events-none' : ''}`}
                        data-cell-dirty={isDirty ? 'true' : undefined}
                        data-cell-selected={isCellActive ? 'true' : undefined}
                        data-cell-in-range={isCellInRange ? 'true' : undefined}
                        data-cell-active={isCellActive ? 'true' : undefined}
                        style={{ width: colWidths[colIdx] }}
                        title={displayVal}
                        onPointerDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }

                          selectCell(renderedRow.rowId, col, event.shiftKey);
                          selectionDragActiveRef.current = !event.shiftKey;
                        }}
                        onPointerEnter={(event) => {
                          if (!selectionDragActiveRef.current || event.buttons !== 1) {
                            return;
                          }

                          selectCell(renderedRow.rowId, col, true);
                        }}
                        onDoubleClick={
                          isEditable
                            ? () => handleCellEditStart(renderedRow.rowId, col)
                            : undefined
                        }
                      >
                        {isEditingCell ? (
                          <input
                            data-grid-inline-editor="true"
                            className="w-full bg-transparent text-[#f5f5f5] outline-none"
                            value={editablePreview?.editingValue ?? displayVal}
                            autoFocus
                            spellCheck={false}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => onEditChange?.(event.target.value)}
                            onBlur={() => onEditCommit?.()}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                onEditCommit?.();
                                return;
                              }

                              if (event.key === 'Escape') {
                                event.preventDefault();
                                onEditCancel?.();
                              }
                            }}
                          />
                        ) : (
                          displayVal
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-[#121212] border-t border-[#333333] px-4 py-1 flex-none text-xs text-[#00ff00] flex justify-between tracking-wider">
        <span>{t('dataGrid.rows', { count: result.rowCount })}</span>
        <span>{t('dataGrid.ms', { count: result.durationMs })}</span>
      </div>
    </div>
  );
};

export default DataGrid;
