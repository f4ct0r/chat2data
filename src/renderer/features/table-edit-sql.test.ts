import { describe, expect, it } from 'vitest';
import { createTableEditBuffer, markTableEditRowDeleted, updateTableEditCell } from './table-edit-buffer';
import { generateTableEditSql } from './table-edit-sql';

const previewTable = {
  dbType: 'postgres' as const,
  database: 'analytics',
  schema: 'public',
  table: 'users',
  previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
};

describe('table edit sql generation', () => {
  it('orders UPDATE statements before DELETE statements in row order', () => {
    const buffer = createTableEditBuffer(
      [
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Bea' },
        { id: 3, name: 'Cy' },
      ],
      ['id']
    );

    const row1 = buffer.rows[0].rowId;
    const row2 = buffer.rows[1].rowId;
    const row3 = buffer.rows[2].rowId;

    const updatedBuffer = updateTableEditCell(buffer, row2, 'name', 'Bee');
    const deletedBuffer = markTableEditRowDeleted(updatedBuffer, row1);
    const finalBuffer = updateTableEditCell(deletedBuffer, row3, 'name', 'See');

    const result = generateTableEditSql(finalBuffer, previewTable);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.batchStatements).toEqual([
      'UPDATE "analytics"."public"."users" SET "name" = \'Bee\' WHERE "id" = 2',
      'UPDATE "analytics"."public"."users" SET "name" = \'See\' WHERE "id" = 3',
      'DELETE FROM "analytics"."public"."users" WHERE "id" = 1',
    ]);
    expect(result.previewSql).toBe(
      'UPDATE "analytics"."public"."users" SET "name" = \'Bee\' WHERE "id" = 2;\n' +
        'UPDATE "analytics"."public"."users" SET "name" = \'See\' WHERE "id" = 3;\n' +
        'DELETE FROM "analytics"."public"."users" WHERE "id" = 1;'
    );
  });

  it('uses original key values in WHERE and new values in SET', () => {
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
    const editedBuffer = updateTableEditCell(buffer, rowId, 'id', 2);
    const result = generateTableEditSql(editedBuffer, previewTable);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.batchStatements).toEqual([
      'UPDATE "analytics"."public"."users" SET "id" = 2 WHERE "id" = 1',
    ]);
  });

  it('serializes scalar literals for strings, numbers, booleans, and null', () => {
    const buffer = createTableEditBuffer(
      [
        {
          id: 1,
          name: 'Ada',
          score: 10,
          active: true,
          archivedAt: '2020-01-01',
        },
      ],
      ['id']
    );

    const rowId = buffer.rows[0].rowId;
    const editedBuffer = updateTableEditCell(buffer, rowId, 'name', "O'Reilly");
    const editedScore = updateTableEditCell(editedBuffer, rowId, 'score', 42);
    const editedActive = updateTableEditCell(editedScore, rowId, 'active', false);
    const editedArchived = updateTableEditCell(editedActive, rowId, 'archivedAt', null);
    const result = generateTableEditSql(editedArchived, previewTable);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.batchStatements).toEqual([
      'UPDATE "analytics"."public"."users" SET "name" = \'O\'\'Reilly\', "score" = 42, "active" = FALSE, "archivedAt" = NULL WHERE "id" = 1',
    ]);
  });

  it.each([
    ['object', { nested: true }, 'object'],
    ['array', [1, 2, 3], 'array'],
    ['binary', Buffer.from([1, 2, 3]), 'binary'],
  ])('returns a structured failure for %s values', (_label, value, valueKind) => {
    const buffer = createTableEditBuffer(
      [
        {
          id: 1,
          payload: 'ok',
        },
      ],
      ['id']
    );

    const rowId = buffer.rows[0].rowId;
    const editedBuffer = updateTableEditCell(buffer, rowId, 'payload', value);
    const result = generateTableEditSql(editedBuffer, previewTable);

    expect(result).toEqual({
      ok: false,
      unsupportedValue: {
        kind: 'unsupported-value',
        rowId,
        column: 'payload',
        valueKind,
        reason: expect.stringContaining('not supported'),
      },
    });
  });
});
