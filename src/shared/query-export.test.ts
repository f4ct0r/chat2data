import { describe, expect, it } from 'vitest';
import { validateQueryExportSql } from './query-export';

describe('validateQueryExportSql', () => {
  it('accepts a single read-only statement', () => {
    expect(
      validateQueryExportSql(`
        WITH recent_users AS (
          SELECT id, email
          FROM users
        )
        SELECT *
        FROM recent_users;
      `)
    ).toEqual({
      ok: true,
      statementSql: `WITH recent_users AS (
          SELECT id, email
          FROM users
        )
        SELECT *
        FROM recent_users;`,
    });
  });

  it('rejects empty SQL', () => {
    expect(validateQueryExportSql('   \n  ')).toEqual({
      ok: false,
      code: 'empty',
    });
  });

  it('rejects multiple statements', () => {
    expect(
      validateQueryExportSql(`
        SELECT * FROM users;
        SELECT * FROM teams;
      `)
    ).toEqual({
      ok: false,
      code: 'multipleStatements',
    });
  });

  it('rejects dangerous statements', () => {
    expect(validateQueryExportSql('DELETE FROM users WHERE id = 1;')).toEqual({
      ok: false,
      code: 'notReadOnly',
      operation: 'DELETE',
    });
  });
});
