import { describe, expect, it } from 'vitest';
import {
  resolveGridCellSelectionRequest,
  resolveGridDeleteAction,
  resolveGridDeleteKeyboardInteraction,
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
        isEditingCell: false,
        key: 'Backspace',
        metaKey: true,
        ctrlKey: false,
        platform: 'MacIntel',
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
        isEditingCell: false,
        key: 'Delete',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
      })
    ).toEqual({
      type: 'setCellNull',
      cell: { rowId: 'row-1', column: 'name' },
    });
  });

  it('extends row selection across the current row range when shift-clicking', () => {
    expect(
      resolveGridRowSelection({
        selectedRowIds: ['row-2'],
        selectedCell: null,
        anchorRowId: 'row-2',
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
    });
  });

  it('returns focus requests for row, cell, and edit-start interactions', () => {
    expect(
      resolveGridRowSelectionRequest({
        selectedRowIds: [],
        selectedCell: null,
        anchorRowId: null,
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
      },
      shouldFocusGrid: true,
    });

    expect(
      resolveGridCellSelectionRequest({
        selectedRowIds: [],
        selectedCell: null,
        anchorRowId: null,
        cell: { rowId: 'row-1', column: 'email' },
      })
    ).toEqual({
      selection: {
        selectedRowIds: [],
        selectedCell: { rowId: 'row-1', column: 'email' },
        anchorRowId: 'row-1',
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
        isEditingCell: false,
        key: 'Delete',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        canHandleDeleteAction: false,
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
        selectedRowIds: ['row-1'],
        selectedCell: { rowId: 'row-1', column: 'name' },
        isEditingCell: false,
        key: 'Delete',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        canHandleDeleteAction: true,
      })
    ).toEqual({
      action: {
        type: 'deleteRows',
        rowIds: ['row-1'],
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
    });

    expect(
      resolveGridDeleteAction({
        selectedRowIds: ['row-2'],
        selectedCell: { rowId: 'row-2', column: 'name' },
        isEditingCell: false,
        key: 'Delete',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        deletedRowIds: ['row-2'],
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
        isEditingCell: false,
        key: 'Escape',
        metaKey: false,
        ctrlKey: false,
        platform: 'Win32',
        canHandleDeleteAction: true,
      })
    ).toEqual({
      action: {
        type: 'none',
      },
      shouldPreventDefault: false,
    });
  });
});
