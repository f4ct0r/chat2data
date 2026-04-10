import { describe, expect, it } from 'vitest';
import { createTableEditBuffer } from '../../features/table-edit-buffer';
import { applyEditablePreviewPaste } from './sql-workspace-utils';

describe('sql workspace paste helpers', () => {
  it('pastes a bounded matrix into the loaded edit buffer and reports truncation', () => {
    const buffer = createTableEditBuffer(
      [
        { id: 1, name: 'Ada', visits: 1 },
        { id: 2, name: 'Grace', visits: 2 },
      ],
      ['id']
    );

    const result = applyEditablePreviewPaste({
      editBuffer: buffer,
      columns: ['id', 'name', 'visits'],
      selection: {
        selectedRowIds: [],
        selectedCell: { rowId: buffer.rows[0].rowId, column: 'name' },
        anchorRowId: buffer.rows[0].rowId,
        anchorCell: { rowId: buffer.rows[0].rowId, column: 'name' },
        selectedRange: {
          anchor: { rowId: buffer.rows[0].rowId, column: 'name' },
          focus: { rowId: buffer.rows[0].rowId, column: 'name' },
        },
      },
      clipboardText: 'Alice\t10\r\nBob\t20\r\nCarol\t30',
    });

    expect(result.truncated).toBe(true);
    expect(result.updatedCellCount).toBe(4);
    expect(result.buffer.rows[0].pendingRow).toMatchObject({
      id: 1,
      name: 'Alice',
      visits: 10,
    });
    expect(result.buffer.rows[1].pendingRow).toMatchObject({
      id: 2,
      name: 'Bob',
      visits: 20,
    });
  });

  it('returns the original buffer when there is no active cell target', () => {
    const buffer = createTableEditBuffer([{ id: 1, name: 'Ada' }], ['id']);

    const result = applyEditablePreviewPaste({
      editBuffer: buffer,
      columns: ['id', 'name'],
      selection: {
        selectedRowIds: [],
        selectedCell: null,
        anchorRowId: null,
        anchorCell: null,
        selectedRange: null,
      },
      clipboardText: 'Alice',
    });

    expect(result.buffer).toBe(buffer);
    expect(result.updatedCellCount).toBe(0);
    expect(result.truncated).toBe(false);
  });
});
