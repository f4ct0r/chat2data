import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTableEditBuffer,
  markTableEditRowDeleted,
  updateTableEditCell,
} from './table-edit-buffer';

const originalBuffer = globalThis.Buffer;

beforeEach(() => {
  (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer = undefined;
});

afterEach(() => {
  (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer = originalBuffer;
});

describe('table edit buffer', () => {
  it('derives row identities from original key values and keeps them stable after edits', () => {
    const buffer = createTableEditBuffer(
      [
        {
          id: 1,
          tenant: 'west',
          name: 'Ada',
        },
      ],
      ['id', 'tenant']
    );

    const rowId = buffer.rows[0].rowId;

    expect(rowId).toBe('id:number:1|tenant:string:"west"');

    const editedBuffer = updateTableEditCell(buffer, rowId, 'id', 2);

    expect(editedBuffer.rows[0].rowId).toBe(rowId);
    expect(editedBuffer.rows[0].pendingRow).toMatchObject({
      id: 2,
      tenant: 'west',
      name: 'Ada',
    });
  });

  it('collapses repeated cell edits to the final pending value and final differences only', () => {
    const buffer = createTableEditBuffer(
      [
        {
          id: 1,
          name: 'Ada',
        },
      ],
      ['id']
    );

    const rowId = buffer.rows[0].rowId;
    const firstEdit = updateTableEditCell(buffer, rowId, 'name', 'Mina');
    const secondEdit = updateTableEditCell(firstEdit, rowId, 'name', 'Nina');
    const reverted = updateTableEditCell(secondEdit, rowId, 'name', 'Ada');

    expect(secondEdit.rows[0].pendingRow).toMatchObject({
      id: 1,
      name: 'Nina',
    });
    expect(secondEdit.rows[0].changedColumns).toEqual(['name']);
    expect(reverted.rows[0].pendingRow).toMatchObject({
      id: 1,
      name: 'Ada',
    });
    expect(reverted.rows[0].changedColumns).toEqual([]);
  });

  it('marks deleted rows and suppresses pending updates', () => {
    const buffer = createTableEditBuffer(
      [
        {
          id: 1,
          name: 'Ada',
        },
      ],
      ['id']
    );

    const rowId = buffer.rows[0].rowId;
    const editedBuffer = updateTableEditCell(buffer, rowId, 'name', 'Mina');
    const deletedBuffer = markTableEditRowDeleted(editedBuffer, rowId);

    expect(deletedBuffer.rows[0]).toMatchObject({
      rowId,
      deleted: true,
      changedColumns: [],
      pendingRow: {
        id: 1,
        name: 'Mina',
      },
    });
  });

  it('remains usable when global Buffer is unset and distinguishes binary key values by content', () => {
    const buffer = createTableEditBuffer(
      [
        {
          id: new Uint8Array([1, 2, 3]),
          name: 'first',
        },
        {
          id: new Uint8Array([1, 2, 4]),
          name: 'second',
        },
      ],
      ['id']
    );

    expect(buffer.rows[0].rowId).toBe('id:binary:010203');
    expect(buffer.rows[1].rowId).toBe('id:binary:010204');
    expect(buffer.rows[0].rowId).not.toBe(buffer.rows[1].rowId);
  });
});
