import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectionManager } from '../connection-manager';
import { sqliteService } from '../../storage/sqlite-service';
import { CredentialService } from '../../security/credential-service';

// Mock adapters
vi.mock('../adapters/mysql', () => ({
  MysqlAdapter: class {
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    testConnection = vi.fn().mockResolvedValue(true);
    executeQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, columns: [] });
  }
}));

vi.mock('../adapters/postgresql', () => ({
  PostgresAdapter: class {
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    testConnection = vi.fn().mockResolvedValue(true);
    executeQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, columns: [] });
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

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sqliteService.getDb as any).mockReturnValue(mockDb);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (CredentialService.decrypt as any).mockReturnValue('secret-password');

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
});
