import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgresAdapter } from '../adapters/postgresql';
import { DatabaseDriver } from '../types';
import * as pg from 'pg';

const connectMock = vi.fn();
const endMock = vi.fn();
const queryMock = vi.fn();

vi.mock('pg', () => ({
  Client: vi.fn(function Client() {
    return {
      connect: connectMock,
      end: endMock,
      query: queryMock,
    };
  }),
}));

describe('PostgresAdapter', () => {
  let adapter: DatabaseDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
    endMock.mockResolvedValue(undefined);
    adapter = new PostgresAdapter();
  });

  it('returns unique key metadata with ordered columns when no primary key is available', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          constraint_name: 'users_email_workspace_key',
          constraint_type: 'UNIQUE',
          column_name: 'workspace_id',
          ordinal_position: 2,
        },
        {
          constraint_name: 'users_email_workspace_key',
          constraint_type: 'UNIQUE',
          column_name: 'email',
          ordinal_position: 1,
        },
      ],
    });

    await adapter.connect({
      id: 'pg-1',
      name: 'PostgreSQL',
      dbType: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      database: 'analytics',
    });

    const result = await adapter.getTableEditMetadata?.({
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
      table: 'users',
      previewSql: 'SELECT * FROM public.users LIMIT 100',
    });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('information_schema'), ['public', 'users']);
    expect(result).toEqual({
      editable: true,
      key: {
        type: 'unique',
        columns: ['email', 'workspace_id'],
      },
    });
  });

  it('executes a batch inside a transaction and commits on success', async () => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });

    await adapter.connect({
      id: 'pg-1',
      name: 'PostgreSQL',
      dbType: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      database: 'analytics',
    });

    const result = await adapter.executeBatch?.([
      "UPDATE users SET name = 'Alice' WHERE id = 1",
      'DELETE FROM users WHERE id = 2',
    ]);

    expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(queryMock).toHaveBeenNthCalledWith(2, "UPDATE users SET name = 'Alice' WHERE id = 1");
    expect(queryMock).toHaveBeenNthCalledWith(3, 'DELETE FROM users WHERE id = 2');
    expect(queryMock).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(result).toEqual({ ok: true });
  });

  it('rolls back the batch and reports the failing statement index when a statement fails', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockRejectedValueOnce(new Error('violates unique constraint'))
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await adapter.connect({
      id: 'pg-1',
      name: 'PostgreSQL',
      dbType: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      database: 'analytics',
    });

    const result = await adapter.executeBatch?.([
      "UPDATE users SET name = 'Alice' WHERE id = 1",
      'DELETE FROM users WHERE id = 2',
    ]);

    expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(queryMock).toHaveBeenNthCalledWith(2, "UPDATE users SET name = 'Alice' WHERE id = 1");
    expect(queryMock).toHaveBeenNthCalledWith(3, 'DELETE FROM users WHERE id = 2');
    expect(queryMock).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    expect(result).toEqual({
      ok: false,
      failedStatementIndex: 1,
      error: 'violates unique constraint',
    });
  });
});
