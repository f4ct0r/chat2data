import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MysqlAdapter } from '../adapters/mysql';
import * as mysql from 'mysql2/promise';

vi.mock('mysql2/promise', () => {
  return {
    createConnection: vi.fn()
  };
});

describe('MysqlAdapter', () => {
  let adapter: MysqlAdapter;

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
});
