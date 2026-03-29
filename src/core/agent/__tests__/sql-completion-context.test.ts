import { describe, expect, it } from 'vitest';

describe('resolveSqlCompletionContext', () => {
  it('detects a SELECT clause and alias member access', async () => {
    const { resolveSqlCompletionContext } = await import('../sql-completion-context');
    const sql = 'SELECT u. FROM users u';
    const cursorOffset = 'SELECT u.'.length;

    const context = resolveSqlCompletionContext(sql, cursorOffset, 'postgres');

    expect(context.clause).toBe('select');
    expect(context.memberAccess).toBe('u');
    expect(context.aliases).toEqual({
      u: { tableName: 'users' },
    });
  });

  it('detects FROM clause suggestions at the current cursor position', async () => {
    const { resolveSqlCompletionContext } = await import('../sql-completion-context');
    const sql = 'SELECT * FROM ';
    const cursorOffset = sql.length;

    const context = resolveSqlCompletionContext(sql, cursorOffset, 'mysql');

    expect(context.clause).toBe('from');
    expect(context.memberAccess).toBeUndefined();
  });

  it('falls back to heuristic parsing when AST parsing fails', async () => {
    const { resolveSqlCompletionContext } = await import('../sql-completion-context');
    const sql = 'SELECT * FROM users u WHERE u.';
    const cursorOffset = sql.length;

    const context = resolveSqlCompletionContext(sql, cursorOffset, 'postgres');

    expect(context.source).toBe('heuristic');
    expect(context.clause).toBe('where');
    expect(context.memberAccess).toBe('u');
    expect(context.aliases).toEqual({
      u: { tableName: 'users' },
    });
  });
});
