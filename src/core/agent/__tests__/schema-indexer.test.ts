import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaIndexer } from '../schema-indexer';
import { connectionManager } from '../../db/connection-manager';
import { DatabaseDriver } from '../../db/types';

vi.mock('../../db/connection-manager', () => ({
  connectionManager: {
    getConfigFromStorage: vi.fn(),
    getConnection: vi.fn(),
  }
}));

describe('SchemaIndexer', () => {
  let indexer: SchemaIndexer;
  let mockDriver: Partial<DatabaseDriver>;

  beforeEach(() => {
    indexer = new SchemaIndexer();
    mockDriver = {
      executeQuery: vi.fn(),
    };
    
    vi.mocked(connectionManager.getConnection).mockReturnValue(mockDriver as DatabaseDriver);
  });

  it('should build index for mysql database', async () => {
    vi.mocked(connectionManager.getConfigFromStorage).mockReturnValue({
      id: 'conn1',
      name: 'Test Mysql',
      dbType: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
    });

    // Mock table and column queries
    vi.mocked(mockDriver.executeQuery!)
      .mockResolvedValueOnce({
        columns: ['tableName', 'tableComment'],
        rows: [{ tableName: 'users', tableComment: 'User table' }],
        rowCount: 1,
        durationMs: 1
      })
      .mockResolvedValueOnce({
        columns: ['tableName', 'columnName', 'dataType', 'columnComment'],
        rows: [
          { tableName: 'users', columnName: 'id', dataType: 'int', columnComment: 'Primary key' },
          { tableName: 'users', columnName: 'name', dataType: 'varchar', columnComment: 'User name' }
        ],
        rowCount: 2,
        durationMs: 1
      });

    await indexer.buildIndex('conn1', 'test_db');

    const index = indexer.getIndex('conn1', 'test_db');
    expect(index).toBeDefined();
    expect(index?.database).toBe('test_db');
    expect(index?.tables.size).toBe(1);
    
    const usersTable = index?.tables.get('users');
    expect(usersTable).toBeDefined();
    expect(usersTable?.columns.length).toBe(2);
    expect(usersTable?.ddl).toContain('CREATE TABLE users');
    expect(usersTable?.ddl).toContain('COMMENT \'Primary key\'');
    expect(usersTable?.ddl).toContain('COMMENT=\'User table\'');
  });

  it('should handle missing database error', async () => {
    vi.mocked(connectionManager.getConfigFromStorage).mockReturnValue({
      id: 'conn1',
      name: 'Test Mysql',
      dbType: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
    });

    await expect(indexer.buildIndex('conn1', '')).rejects.toThrow('Database is required for indexing');
  });
});
