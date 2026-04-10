import { describe, expect, it } from 'vitest';
import {
  getClipboardTextForGridSelection,
  isCellWithinGridSelection,
  parseClipboardTable,
  resolveGridCopyShortcutText,
} from './data-grid-clipboard';

describe('data grid clipboard helpers', () => {
  const columns = ['id', 'name', 'email'];
  const rows = [
    {
      rowId: 'row-1',
      row: { id: 1, name: 'Ada', email: 'ada@example.com' },
    },
    {
      rowId: 'row-2',
      row: { id: 2, name: 'Grace', email: 'grace@example.com' },
    },
  ];

  it('serializes rectangular selections as TSV', () => {
    expect(
      getClipboardTextForGridSelection({
        selection: {
          selectedRowIds: [],
          selectedCell: { rowId: 'row-2', column: 'email' },
          anchorRowId: 'row-1',
          anchorCell: { rowId: 'row-1', column: 'name' },
          selectedRange: {
            anchor: { rowId: 'row-1', column: 'name' },
            focus: { rowId: 'row-2', column: 'email' },
          },
        },
        columns,
        rows,
      })
    ).toBe('Ada\tada@example.com\r\nGrace\tgrace@example.com');
  });

  it('serializes selected rows across every column', () => {
    expect(
      getClipboardTextForGridSelection({
        selection: {
          selectedRowIds: ['row-2'],
          selectedCell: null,
          anchorRowId: 'row-2',
          anchorCell: null,
          selectedRange: null,
        },
        columns,
        rows,
      })
    ).toBe('2\tGrace\tgrace@example.com');
  });

  it('parses quoted TSV clipboard text', () => {
    expect(parseClipboardTable('Ada\t"line 1\r\nline 2"\r\n"Grace ""H"""')).toEqual([
      ['Ada', 'line 1\r\nline 2'],
      ['Grace "H"'],
    ]);
  });

  it('checks whether a cell is inside the active rectangular selection', () => {
    const selection = {
      selectedRowIds: [],
      selectedCell: { rowId: 'row-2', column: 'email' },
      anchorRowId: 'row-1',
      anchorCell: { rowId: 'row-1', column: 'name' },
      selectedRange: {
        anchor: { rowId: 'row-1', column: 'name' },
        focus: { rowId: 'row-2', column: 'email' },
      },
    };

    expect(
      isCellWithinGridSelection({
        selection,
        rowId: 'row-1',
        column: 'email',
        rowOrder: ['row-1', 'row-2'],
        columnOrder: columns,
      })
    ).toBe(true);

    expect(
      isCellWithinGridSelection({
        selection,
        rowId: 'row-1',
        column: 'id',
        rowOrder: ['row-1', 'row-2'],
        columnOrder: columns,
      })
    ).toBe(false);
  });

  it('resolves keyboard copy text from the active selection', () => {
    expect(
      resolveGridCopyShortcutText({
        key: 'c',
        metaKey: false,
        ctrlKey: true,
        isEditingCell: false,
        selection: {
          selectedRowIds: [],
          selectedCell: { rowId: 'row-2', column: 'email' },
          anchorRowId: 'row-1',
          anchorCell: { rowId: 'row-1', column: 'name' },
          selectedRange: {
            anchor: { rowId: 'row-1', column: 'name' },
            focus: { rowId: 'row-2', column: 'email' },
          },
        },
        columns,
        rows,
      })
    ).toBe('Ada\tada@example.com\r\nGrace\tgrace@example.com');
  });
});
