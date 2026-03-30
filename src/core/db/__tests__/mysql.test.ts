import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MysqlAdapter } from '../adapters/mysql';
import * as mysql from 'mysql2/promise';
import { DatabaseDriver } from '../types';

vi.mock('mysql2/promise', () => {
  return {
    createConnection: vi.fn()
  };
});

describe('MysqlAdapter', () => {
  let adapter: DatabaseDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MysqlAdapter();
  });

  it('should test connection successfully', async () => {
    const mockConn = {
      ping: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined)
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mysql.createConnection as any).mockResolvedValue(mockConn);

    const result = await adapter.testConnection({
      id: 'test',
      name: 'test',
      dbType: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'password'
    });

    expect(result).toBe(true);
    expect(mysql.createConnection).toHaveBeenCalledWith(expect.objectContaining({
      host: 'localhost',
      user: 'root',
      password: 'password'
    }));
    expect(mockConn.ping).toHaveBeenCalled();
    expect(mockConn.end).toHaveBeenCalled();
  });

  it('should return false if test connection fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mysql.createConnection as any).mockRejectedValue(new Error('Connection failed'));

    const result = await adapter.testConnection({
      id: 'test',
      name: 'test',
      dbType: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root'
    });

    expect(result).toBe(false);
  });

  it('returns primary key metadata with ordered columns when the table is editable', async () => {
    const query = vi.fn().mockResolvedValue([[
      {
        constraint_name: 'users_email_unique',
        constraint_type: 'UNIQUE',
        column_name: 'email',
        ordinal_position: 1,
      },
      {
        constraint_name: 'PRIMARY',
        constraint_type: 'PRIMARY KEY',
        column_name: 'tenant_id',
        ordinal_position: 2,
      },
      {
        constraint_name: 'PRIMARY',
        constraint_type: 'PRIMARY KEY',
        column_name: 'id',
        ordinal_position: 1,
      },
    ]]);
    const mockConn = {
      query,
      end: vi.fn().mockResolvedValue(undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mysql.createConnection as any).mockResolvedValue(mockConn);

    await adapter.connect({
      id: 'mysql-1',
      name: 'MySQL',
      dbType: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      database: 'analytics',
    });

    const result = await adapter.getTableEditMetadata?.({
      dbType: 'mysql',
      database: 'analytics',
      table: 'users',
      previewSql: 'SELECT * FROM users LIMIT 100',
    });

    expect(result).toEqual({
      editable: true,
      key: {
        type: 'primary',
        columns: ['id', 'tenant_id'],
      },
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('information_schema'), ['analytics', 'users']);
  });

  it('executes a batch inside a transaction and commits on success', async () => {
    const query = vi.fn().mockResolvedValue([[], []]);
    const beginTransaction = vi.fn().mockResolvedValue(undefined);
    const commit = vi.fn().mockResolvedValue(undefined);
    const rollback = vi.fn().mockResolvedValue(undefined);
    const mockConn = {
      query,
      beginTransaction,
      commit,
      rollback,
      end: vi.fn().mockResolvedValue(undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mysql.createConnection as any).mockResolvedValue(mockConn);

    await adapter.connect({
      id: 'mysql-1',
      name: 'MySQL',
      dbType: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      database: 'analytics',
    });

    const result = await adapter.executeBatch?.([
      'UPDATE users SET name = "Alice" WHERE id = 1',
      'DELETE FROM users WHERE id = 2',
    ]);

    expect(beginTransaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(1, 'UPDATE users SET name = "Alice" WHERE id = 1');
    expect(query).toHaveBeenNthCalledWith(2, 'DELETE FROM users WHERE id = 2');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(rollback).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('rolls back the batch and reports the failing statement index when a statement fails', async () => {
    const beginTransaction = vi.fn().mockResolvedValue(undefined);
    const commit = vi.fn().mockResolvedValue(undefined);
    const rollback = vi.fn().mockResolvedValue(undefined);
    const query = vi.fn()
      .mockResolvedValueOnce([[], []])
      .mockRejectedValueOnce(new Error('Duplicate entry'));
    const mockConn = {
      query,
      beginTransaction,
      commit,
      rollback,
      end: vi.fn().mockResolvedValue(undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mysql.createConnection as any).mockResolvedValue(mockConn);

    await adapter.connect({
      id: 'mysql-1',
      name: 'MySQL',
      dbType: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      database: 'analytics',
    });

    const result = await adapter.executeBatch?.([
      'UPDATE users SET name = "Alice" WHERE id = 1',
      'DELETE FROM users WHERE id = 2',
    ]);

    expect(beginTransaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(1, 'UPDATE users SET name = "Alice" WHERE id = 1');
    expect(query).toHaveBeenNthCalledWith(2, 'DELETE FROM users WHERE id = 2');
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      failedStatementIndex: 1,
      error: 'Duplicate entry',
    });
  });
});
