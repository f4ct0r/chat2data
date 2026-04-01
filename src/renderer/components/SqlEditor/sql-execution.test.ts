import { describe, expect, it } from 'vitest';
import { resolveExecutableSql, splitSqlStatements } from './sql-execution';

describe('resolveExecutableSql', () => {
  const sql = `
SELECT *
FROM users;

UPDATE users
SET name = 'Alice'
WHERE id = 1;

DELETE FROM logs
WHERE created_at < NOW() - INTERVAL '7 days';
`.trim();

  it('executes the statement at the cursor line when there is no selection', () => {
    expect(
      resolveExecutableSql(sql, {
        startLineNumber: 2,
        endLineNumber: 2,
        hasSelection: false,
      })
    ).toBe('SELECT *\nFROM users;');
  });

  it('executes statements intersecting selected lines', () => {
    expect(
      resolveExecutableSql(sql, {
        startLineNumber: 4,
        endLineNumber: 8,
        hasSelection: true,
      })
    ).toBe("UPDATE users\nSET name = 'Alice'\nWHERE id = 1;\n\nDELETE FROM logs\nWHERE created_at < NOW() - INTERVAL '7 days';");
  });

  it('treats partial multi-line selection as whole selected lines', () => {
    expect(
      resolveExecutableSql(sql, {
        startLineNumber: 2,
        endLineNumber: 5,
        hasSelection: true,
      })
    ).toBe("SELECT *\nFROM users;\n\nUPDATE users\nSET name = 'Alice'\nWHERE id = 1;");
  });

  it('falls back to the nearest statement when cursor is on a blank line', () => {
    expect(
      resolveExecutableSql(sql, {
        startLineNumber: 3,
        endLineNumber: 3,
        hasSelection: false,
      })
    ).toBe('SELECT *\nFROM users;');
  });

  it('returns the full rendered script for auto-execute runs', () => {
    expect(
      resolveExecutableSql(
        sql,
        {
          startLineNumber: 4,
          endLineNumber: 8,
          hasSelection: true,
        },
        'full-content'
      )
    ).toBe(sql);
  });

  it('does not split statements on semicolons inside string literals', () => {
    expect(
      splitSqlStatements(`
UPDATE users
SET note = 'queued; needs review'
WHERE id = 1;

DELETE FROM audit_logs
WHERE id = 9;
`.trim())
    ).toEqual([
      {
        sql: "UPDATE users\nSET note = 'queued; needs review'\nWHERE id = 1;",
        startLineNumber: 1,
        endLineNumber: 3,
      },
      {
        sql: 'DELETE FROM audit_logs\nWHERE id = 9;',
        startLineNumber: 5,
        endLineNumber: 6,
      },
    ]);
  });

  it('does not split statements on semicolons inside comments', () => {
    expect(
      splitSqlStatements(`
-- keep the next statement; do not split here
UPDATE users SET status = 'pending' WHERE id = 1;
/* archive; later */
DELETE FROM jobs WHERE id = 2;
`.trim())
    ).toEqual([
      {
        sql: "-- keep the next statement; do not split here\nUPDATE users SET status = 'pending' WHERE id = 1;",
        startLineNumber: 1,
        endLineNumber: 2,
      },
      {
        sql: '/* archive; later */\nDELETE FROM jobs WHERE id = 2;',
        startLineNumber: 3,
        endLineNumber: 4,
      },
    ]);
  });
});
