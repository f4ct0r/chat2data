import Database from 'better-sqlite3';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectionManager } from '../connection-manager';
import { DatabaseDriver } from '../types';
import { sqliteService } from '../../storage/sqlite-service';
import { CredentialService } from '../../security/credential-service';

// Mock adapters
vi.mock('../adapters/mysql', () => ({
  MysqlAdapter: class {
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    testConnection = vi.fn().mockResolvedValue(true);
    executeQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, columns: [] });
    getTableEditMetadata = vi.fn().mockResolvedValue({
      editable: true,
      key: { type: 'primary', columns: ['id'] }
    });
    executeBatch = vi.fn().mockResolvedValue({ ok: true });
  }
}));

vi.mock('../adapters/postgresql', () => ({
  PostgresAdapter: class {
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    testConnection = vi.fn().mockResolvedValue(true);
    executeQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, columns: [] });
    getTableEditMetadata = vi.fn().mockResolvedValue({
      editable: true,
      key: { type: 'primary', columns: ['id'] }
    });
    executeBatch = vi.fn().mockResolvedValue({ ok: true });
  }
}));

vi.mock('../../storage/sqlite-service', () => ({
  sqliteService: {
    getDb: vi.fn()
  }
}));

vi.mock('../../security/credential-service', () => ({
  CredentialService: {
    decrypt: vi.fn()
  }
}));

describe('ConnectionManager', () => {
  const mockDb = {
    prepare: vi.fn()
  };
  const connectionManagerState = connectionManager as unknown as {
    connections: Map<string, DatabaseDriver>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    connectionManagerState.connections.clear();
    vi.mocked(sqliteService.getDb).mockReturnValue(mockDb as unknown as Database.Database);
  });

  it('should fetch config from storage and decrypt password', async () => {
    const mockRow = {
      id: 'test-id',
      name: 'Test DB',
      db_type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      database: 'test',
      encrypted_password: 'encrypted-secret'
    };

    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue(mockRow)
    });

    vi.mocked(CredentialService.decrypt).mockReturnValue('secret-password');

    // testConnection uses the storage to fetch config
    const result = await connectionManager.testConnection({ id: 'test-id' });

    expect(result).toBe(true);
    expect(sqliteService.getDb).toHaveBeenCalled();
    expect(CredentialService.decrypt).toHaveBeenCalledWith('encrypted-secret');
  });

  it('should successfully connect and store driver in connections map', async () => {
    const mockRow = {
      id: 'conn-id',
      name: 'Test DB 2',
      db_type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      database: 'test',
      encrypted_password: null
    };

    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue(mockRow)
    });

    await connectionManager.connect('conn-id');

    // The connection should be active
    const driver = connectionManager.getConnection('conn-id');
    expect(driver).toBeDefined();
    expect(driver.connect).toHaveBeenCalledWith(expect.objectContaining({
      dbType: 'postgres',
      username: 'user'
    }));
  });

  it('should disconnect and remove driver from connections map', async () => {
    const mockRow = {
      id: 'conn-id-3',
      name: 'Test DB 3',
      db_type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      database: 'test',
      encrypted_password: null
    };

    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue(mockRow)
    });

    await connectionManager.connect('conn-id-3');
    const driver = connectionManager.getConnection('conn-id-3');
    
    await connectionManager.disconnect('conn-id-3');
    
    expect(driver.disconnect).toHaveBeenCalled();
    expect(() => connectionManager.getConnection('conn-id-3')).toThrow('Connection conn-id-3 is not active');
  });

  it('should return table edit metadata from the active driver', async () => {
    const mockRow = {
      id: 'conn-id-4',
      name: 'Test DB 4',
      db_type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      database: 'analytics',
      encrypted_password: null
    };

    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue(mockRow)
    });

    await connectionManager.connect('conn-id-4');

    const result = await connectionManager.getTableEditMetadata('conn-id-4', {
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
      table: 'users',
      previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100'
    });

    expect(result).toEqual({
      editable: true,
      key: { type: 'primary', columns: ['id'] }
    });
  });

  it('should return read-only metadata when the driver does not support table edit metadata', async () => {
    connectionManagerState.connections.set('conn-id-5', {} as DatabaseDriver);

    const result = await connectionManager.getTableEditMetadata('conn-id-5', {
      dbType: 'mysql',
      database: 'analytics',
      schema: 'public',
      table: 'users',
      previewSql: 'SELECT * FROM users LIMIT 100'
    });

    expect(result).toEqual({
      editable: false,
      reason: 'Editing is not supported for this database.',
      key: null
    });
  });

  it('should forward batch execution to the active driver', async () => {
    const mockRow = {
      id: 'conn-id-6',
      name: 'Test DB 6',
      db_type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      database: 'analytics',
      encrypted_password: null
    };

    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue(mockRow)
    });

    await connectionManager.connect('conn-id-6');

    const result = await connectionManager.executeBatch('conn-id-6', ['UPDATE users SET name = "A"', 'DELETE FROM users WHERE id = 1']);

    expect(result).toEqual({ ok: true });

    const driver = connectionManager.getConnection('conn-id-6');
    expect(vi.mocked(driver.executeBatch!)).toHaveBeenCalledWith(['UPDATE users SET name = "A"', 'DELETE FROM users WHERE id = 1']);
  });

  it('should reject batch execution when the driver does not support it', async () => {
    connectionManagerState.connections.set('conn-id-7', {
      getTableEditMetadata: vi.fn().mockResolvedValue({
        editable: false,
        reason: 'Editing is not supported for this database.',
        key: null
      })
    } as unknown as DatabaseDriver);

    await expect(
      connectionManager.executeBatch('conn-id-7', ['UPDATE users SET name = "A"'])
    ).rejects.toThrow('does not support batch execution');
  });
});
