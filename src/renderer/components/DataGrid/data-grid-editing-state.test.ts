import { describe, expect, it } from 'vitest';
import {
  resolveGridDeleteAction,
  resolveGridRowSelection,
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
});
