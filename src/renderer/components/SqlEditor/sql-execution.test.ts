import { describe, expect, it } from 'vitest';
import { resolveExecutableSql } from './sql-execution';

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
});
