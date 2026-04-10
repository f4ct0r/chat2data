import { describe, expect, it } from 'vitest';
import {
  resolveGridCellSelectionRequest,
  resolveGridDeleteAction,
  resolveGridDeleteKeyboardInteraction,
  resolveGridEscapeKeyboardInteraction,
  resolveGridEditStartRequest,
  resolveGridRowSelection,
  resolveGridRowSelectionRequest,
} from './data-grid-editing-state';

describe('data grid editing state', () => {
  it('prefers row deletion when rows are selected even if a cell is also selected', () => {
    expect(
      resolveGridDeleteAction({
        selectedRowIds: ['row-1'],
        selectedCell: { rowId: 'row-1', column: 'name' },
        selectedRange: {
          anchor: { rowId: 'row-1', column: 'name' },
          focus: { rowId: 'row-1', column: 'name' },
        },
        isEditingCell: false,
        key: 'Backspace',
        metaKey: true,
        ctrlKey: false,
        platform: 'MacIntel',
        rowOrder: ['row-1'],
        columnOrder: ['name'],
      })
    ).toEqual({
      type: 'deleteRows',
      rowIds: ['row-1'],
    });
  });

  it('sets the selected cell to NULL when no rows are selected and Delete is pressed outside edit mode', () => {
    expect(
      resolveGridDeleteAction({
        selectedRowIds: [],
        selectedCell: { rowId: 'row-1', column: 'name' },
        selectedRange: {
          anchor: { rowId: 'row-1', column: 'name' },
          focus: { rowId: 'row-1', column: 'name' },
        },
        isEditingCell: false,
        key: 'Delete',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        rowOrder: ['row-1'],
        columnOrder: ['name'],
      })
    ).toEqual({
      type: 'clearCells',
      cells: [{ rowId: 'row-1', column: 'name' }],
    });
  });

  it('extends row selection across the current row range when shift-clicking', () => {
    expect(
      resolveGridRowSelection({
        selectedRowIds: ['row-2'],
        selectedCell: null,
        anchorRowId: 'row-2',
        selectedRange: null,
        anchorCell: null,
        rowId: 'row-4',
        rowOrder: ['row-1', 'row-2', 'row-3', 'row-4'],
        shiftKey: true,
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
      })
    ).toEqual({
      selectedRowIds: ['row-2', 'row-3', 'row-4'],
      selectedCell: null,
      anchorRowId: 'row-2',
      selectedRange: null,
      anchorCell: null,
    });
  });

  it('returns focus requests for row, cell, and edit-start interactions', () => {
    expect(
      resolveGridRowSelectionRequest({
        selectedRowIds: [],
        selectedCell: null,
        anchorRowId: null,
        selectedRange: null,
        anchorCell: null,
        rowId: 'row-1',
        rowOrder: ['row-1', 'row-2'],
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
      })
    ).toEqual({
      selection: {
        selectedRowIds: ['row-1'],
        selectedCell: null,
        anchorRowId: 'row-1',
        selectedRange: null,
        anchorCell: null,
      },
      shouldFocusGrid: true,
    });

    expect(
      resolveGridCellSelectionRequest({
        selectedRowIds: [],
        selectedCell: null,
        anchorRowId: null,
        selectedRange: null,
        anchorCell: null,
        cell: { rowId: 'row-1', column: 'email' },
        rowOrder: ['row-1', 'row-2'],
        columnOrder: ['id', 'email'],
        shiftKey: false,
      })
    ).toEqual({
      selection: {
        selectedRowIds: [],
        selectedCell: { rowId: 'row-1', column: 'email' },
        anchorRowId: 'row-1',
        selectedRange: {
          anchor: { rowId: 'row-1', column: 'email' },
          focus: { rowId: 'row-1', column: 'email' },
        },
        anchorCell: { rowId: 'row-1', column: 'email' },
      },
      shouldFocusGrid: true,
    });

    expect(
      resolveGridEditStartRequest({
        cell: { rowId: 'row-1', column: 'email' },
      })
    ).toEqual({
      cell: { rowId: 'row-1', column: 'email' },
      shouldFocusGrid: true,
    });
  });

  it('does not request keyboard interception when delete is actionable but no handler is wired', () => {
    expect(
      resolveGridDeleteKeyboardInteraction({
        selectedRowIds: ['row-1'],
        selectedCell: { rowId: 'row-1', column: 'name' },
        selectedRange: {
          anchor: { rowId: 'row-1', column: 'name' },
          focus: { rowId: 'row-1', column: 'name' },
        },
        isEditingCell: false,
        key: 'Delete',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        canHandleDeleteAction: false,
        rowOrder: ['row-1'],
        columnOrder: ['name'],
      })
    ).toEqual({
      action: {
        type: 'none',
      },
      shouldPreventDefault: false,
    });
  });

  it('prevents the delete key only when a handler can actually process the resolved action', () => {
    expect(
      resolveGridDeleteKeyboardInteraction({
        selectedRowIds: [],
        selectedCell: { rowId: 'row-1', column: 'name' },
        selectedRange: {
          anchor: { rowId: 'row-1', column: 'name' },
          focus: { rowId: 'row-2', column: 'email' },
        },
        isEditingCell: false,
        key: 'Delete',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        canHandleDeleteAction: true,
        rowOrder: ['row-1', 'row-2'],
        columnOrder: ['name', 'email'],
      })
    ).toEqual({
      action: {
        type: 'clearCells',
        cells: [
          { rowId: 'row-1', column: 'name' },
          { rowId: 'row-1', column: 'email' },
          { rowId: 'row-2', column: 'name' },
          { rowId: 'row-2', column: 'email' },
        ],
      },
      shouldPreventDefault: true,
    });
  });

  it('ignores deleted rows for selection and delete shortcuts', () => {
    expect(
      resolveGridRowSelection({
        selectedRowIds: ['row-1'],
        selectedCell: null,
        anchorRowId: 'row-1',
        selectedRange: null,
        anchorCell: null,
        rowId: 'row-2',
        rowOrder: ['row-1', 'row-2'],
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        deletedRowIds: ['row-2'],
      })
    ).toEqual({
      selectedRowIds: ['row-1'],
      selectedCell: null,
      anchorRowId: 'row-1',
      selectedRange: null,
      anchorCell: null,
    });

    expect(
      resolveGridDeleteAction({
        selectedRowIds: ['row-2'],
        selectedCell: { rowId: 'row-2', column: 'name' },
        selectedRange: {
          anchor: { rowId: 'row-2', column: 'name' },
          focus: { rowId: 'row-2', column: 'name' },
        },
        isEditingCell: false,
        key: 'Delete',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        deletedRowIds: ['row-2'],
        rowOrder: ['row-1', 'row-2'],
        columnOrder: ['name'],
      })
    ).toEqual({
      type: 'none',
    });
  });

  it('does not intercept no-op delete keyboard events', () => {
    expect(
      resolveGridDeleteKeyboardInteraction({
        selectedRowIds: [],
        selectedCell: null,
        selectedRange: null,
        isEditingCell: false,
        key: 'Escape',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        canHandleDeleteAction: true,
        rowOrder: ['row-1'],
        columnOrder: ['name'],
      })
    ).toEqual({
      action: {
        type: 'none',
      },
      shouldPreventDefault: false,
    });
  });

  it('restores the most recent deleted row batch on Escape outside edit mode', () => {
    expect(
      resolveGridEscapeKeyboardInteraction({
        isEditingCell: false,
        key: 'Escape',
        restorableDeletedRowIds: ['row-2', 'row-3'],
        canHandleEscapeAction: true,
      })
    ).toEqual({
      action: {
        type: 'restoreDeletedRows',
        rowIds: ['row-2', 'row-3'],
      },
      shouldPreventDefault: true,
    });
  });

  it('extends a rectangular cell range when shift-clicking another cell', () => {
    expect(
      resolveGridCellSelectionRequest({
        selectedRowIds: [],
        selectedCell: { rowId: 'row-1', column: 'name' },
        anchorRowId: 'row-1',
        selectedRange: {
          anchor: { rowId: 'row-1', column: 'name' },
          focus: { rowId: 'row-1', column: 'name' },
        },
        anchorCell: { rowId: 'row-1', column: 'name' },
        cell: { rowId: 'row-3', column: 'email' },
        rowOrder: ['row-1', 'row-2', 'row-3'],
        columnOrder: ['id', 'name', 'email'],
        shiftKey: true,
      })
    ).toEqual({
      selection: {
        selectedRowIds: [],
        selectedCell: { rowId: 'row-3', column: 'email' },
        anchorRowId: 'row-1',
        selectedRange: {
          anchor: { rowId: 'row-1', column: 'name' },
          focus: { rowId: 'row-3', column: 'email' },
        },
        anchorCell: { rowId: 'row-1', column: 'name' },
      },
      shouldFocusGrid: true,
    });
  });

  it('does not restore deleted rows on Escape while a cell is being edited', () => {
    expect(
      resolveGridEscapeKeyboardInteraction({
        isEditingCell: true,
        key: 'Escape',
        restorableDeletedRowIds: ['row-2', 'row-3'],
        canHandleEscapeAction: true,
      })
    ).toEqual({
      action: {
        type: 'none',
      },
      shouldPreventDefault: false,
    });
  });
});
