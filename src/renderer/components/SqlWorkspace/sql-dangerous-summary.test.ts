import { describe, expect, it } from 'vitest';
import { summarizeDangerousSql } from './sql-dangerous-summary';

describe('summarizeDangerousSql', () => {
  it('counts repeated dangerous statements of the same type', () => {
    expect(
      summarizeDangerousSql(`
UPDATE users SET name = 'Ada' WHERE id = 1;
UPDATE users SET name = 'Bea' WHERE id = 2;
`.trim())
    ).toEqual({
      totalDangerousStatementCount: 2,
      operations: [
        {
          operation: 'UPDATE',
          count: 2,
        },
      ],
    });
  });

  it('groups mixed dangerous statement types in encounter order', () => {
    expect(
      summarizeDangerousSql(`
SELECT * FROM users;
INSERT INTO users (id, name) VALUES (1, 'Ada');
DELETE FROM sessions WHERE id = 3;
CREATE TABLE audit_log (id INT);
`.trim())
    ).toEqual({
      totalDangerousStatementCount: 3,
      operations: [
        {
          operation: 'INSERT',
          count: 1,
        },
        {
          operation: 'DELETE',
          count: 1,
        },
        {
          operation: 'CREATE',
          count: 1,
        },
      ],
    });
  });

  it('ignores safe statements', () => {
    expect(
      summarizeDangerousSql(`
SELECT * FROM users;
EXPLAIN SELECT * FROM users;
UPDATE users SET active = false WHERE id = 1;
SHOW TABLES;
`.trim())
    ).toEqual({
      totalDangerousStatementCount: 1,
      operations: [
        {
          operation: 'UPDATE',
          count: 1,
        },
      ],
    });
  });

  it('returns null for empty or whitespace-only batches', () => {
    expect(summarizeDangerousSql(' ; \n \n ; ')).toBeNull();
  });

  it('ignores semicolons inside string literals and comments when grouping dangerous statements', () => {
    expect(
      summarizeDangerousSql(`
-- keep; comment
DELETE FROM scan_requests WHERE note = 'retry; later';
UPDATE scan_tasks SET status = 'pending' WHERE id = 1;
`.trim())
    ).toEqual({
      totalDangerousStatementCount: 2,
      operations: [
        {
          operation: 'DELETE',
          count: 1,
        },
        {
          operation: 'UPDATE',
          count: 1,
        },
      ],
    });
  });

  it('derives a user-facing operation for dangerous CTE statements', () => {
    expect(
      summarizeDangerousSql(`
WITH archived AS (
  DELETE FROM jobs
  WHERE status = 'done'
  RETURNING id
)
SELECT * FROM archived;
`.trim())
    ).toEqual({
      totalDangerousStatementCount: 1,
      operations: [
        {
          operation: 'DELETE',
          count: 1,
        },
      ],
    });
  });
});
