import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MssqlAdapter } from '../adapters/mssql';
import { DatabaseDriver } from '../types';
import * as sql from 'mssql';

const requestInputMock = vi.fn();
const requestQueryMock = vi.fn();
const poolConnectMock = vi.fn();
const poolCloseMock = vi.fn();
const poolRequestMock = vi.fn();
const transactionBeginMock = vi.fn();
const transactionCommitMock = vi.fn();
const transactionRollbackMock = vi.fn();
const transactionRequestQueryMock = vi.fn();
const transactionRequestMock = vi.fn();

vi.mock('mssql', () => ({
  ConnectionPool: vi.fn(function ConnectionPool() {
    return {
      connect: poolConnectMock,
      close: poolCloseMock,
      request: poolRequestMock,
    };
  }),
  Transaction: vi.fn(function Transaction() {
    return {
      begin: transactionBeginMock,
      commit: transactionCommitMock,
      rollback: transactionRollbackMock,
      request: transactionRequestMock,
    };
  }),
  NVarChar: Symbol('NVarChar'),
}));

describe('MssqlAdapter', () => {
  let adapter: DatabaseDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    requestInputMock.mockReturnThis();
    poolConnectMock.mockResolvedValue(undefined);
    poolCloseMock.mockResolvedValue(undefined);
    poolRequestMock.mockReturnValue({
      input: requestInputMock,
      query: requestQueryMock,
    });
    transactionBeginMock.mockResolvedValue(undefined);
    transactionCommitMock.mockResolvedValue(undefined);
    transactionRollbackMock.mockResolvedValue(undefined);
    transactionRequestMock.mockReturnValue({
      query: transactionRequestQueryMock,
    });
    adapter = new MssqlAdapter();
  });

  it('returns primary key metadata with ordered columns when the table is editable', async () => {
    requestQueryMock.mockResolvedValue({
      recordset: [
        {
          constraint_name: 'UQ_users_email',
          constraint_type: 'UNIQUE',
          column_name: 'email',
          ordinal_position: 1,
        },
        {
          constraint_name: 'PK_users',
          constraint_type: 'PRIMARY KEY',
          column_name: 'tenant_id',
          ordinal_position: 2,
        },
        {
          constraint_name: 'PK_users',
          constraint_type: 'PRIMARY KEY',
          column_name: 'id',
          ordinal_position: 1,
        },
      ],
    });

    await adapter.connect({
      id: 'mssql-1',
      name: 'SQL Server',
      dbType: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'sa',
      database: 'analytics',
    });

    const result = await adapter.getTableEditMetadata?.({
      dbType: 'mssql',
      database: 'analytics',
      schema: 'dbo',
      table: 'users',
      previewSql: 'SELECT TOP 100 * FROM dbo.users',
    });

    expect(requestInputMock).toHaveBeenCalledWith('schema', sql.NVarChar, 'dbo');
    expect(requestInputMock).toHaveBeenCalledWith('table', sql.NVarChar, 'users');
    expect(result).toEqual({
      editable: true,
      key: {
        type: 'primary',
        columns: ['id', 'tenant_id'],
      },
    });
  });

  it('executes a batch inside a transaction and commits on success', async () => {
    transactionRequestQueryMock.mockResolvedValue({ rowsAffected: [1] });

    await adapter.connect({
      id: 'mssql-1',
      name: 'SQL Server',
      dbType: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'sa',
      database: 'analytics',
    });

    const result = await adapter.executeBatch?.([
      "UPDATE users SET name = 'Alice' WHERE id = 1",
      'DELETE FROM users WHERE id = 2',
    ]);

    expect(transactionBeginMock).toHaveBeenCalledTimes(1);
    expect(transactionRequestQueryMock).toHaveBeenNthCalledWith(1, "UPDATE users SET name = 'Alice' WHERE id = 1");
    expect(transactionRequestQueryMock).toHaveBeenNthCalledWith(2, 'DELETE FROM users WHERE id = 2');
    expect(transactionCommitMock).toHaveBeenCalledTimes(1);
    expect(transactionRollbackMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('rolls back the batch and reports the failing statement index when a statement fails', async () => {
    transactionRequestQueryMock
      .mockResolvedValueOnce({ rowsAffected: [1] })
      .mockRejectedValueOnce(new Error('The DELETE statement conflicted with the REFERENCE constraint'));

    await adapter.connect({
      id: 'mssql-1',
      name: 'SQL Server',
      dbType: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'sa',
      database: 'analytics',
    });

    const result = await adapter.executeBatch?.([
      "UPDATE users SET name = 'Alice' WHERE id = 1",
      'DELETE FROM users WHERE id = 2',
    ]);

    expect(transactionBeginMock).toHaveBeenCalledTimes(1);
    expect(transactionRequestQueryMock).toHaveBeenNthCalledWith(1, "UPDATE users SET name = 'Alice' WHERE id = 1");
    expect(transactionRequestQueryMock).toHaveBeenNthCalledWith(2, 'DELETE FROM users WHERE id = 2');
    expect(transactionRollbackMock).toHaveBeenCalledTimes(1);
    expect(transactionCommitMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      failedStatementIndex: 1,
      error: 'The DELETE statement conflicted with the REFERENCE constraint',
    });
  });
});
