import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SchemaIndex } from '../types';
import { connectionManager } from '../../db/connection-manager';
import { schemaIndexer } from '../schema-indexer';

vi.mock('../../db/connection-manager', () => ({
  connectionManager: {
    getConfigFromStorage: vi.fn(),
  },
}));

vi.mock('../schema-indexer', () => ({
  schemaIndexer: {
    buildIndex: vi.fn(),
    getIndex: vi.fn(),
  },
}));

describe('completionSchemaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializes an indexed schema into plain completion metadata', async () => {
    vi.mocked(connectionManager.getConfigFromStorage).mockReturnValue({
      id: 'conn-1',
      name: 'Analytics',
      dbType: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      database: 'analytics',
    });

    const indexedSchema: SchemaIndex = {
      database: 'analytics',
      schema: 'public',
      lastUpdated: 123,
      tables: new Map([
        [
          'users',
          {
            name: 'users',
            comment: 'Application users',
            columns: [
              { name: 'id', type: 'uuid', comment: 'Primary key' },
              { name: 'email', type: 'text' },
            ],
            ddl: 'CREATE TABLE users (...);',
          },
        ],
      ]),
    };

    vi.mocked(schemaIndexer.getIndex).mockReturnValue(indexedSchema);

    const { completionSchemaService } = await import('../completion-schema-service');

    const result = await completionSchemaService.getSchemaIndex('conn-1', 'analytics', 'public');

    expect(result).toEqual({
      database: 'analytics',
      schema: 'public',
      lastUpdated: 123,
      tables: [
        {
          name: 'users',
          comment: 'Application users',
          columns: [
            { name: 'id', type: 'uuid', comment: 'Primary key' },
            { name: 'email', type: 'text' },
          ],
        },
      ],
    });
  });

  it('builds an index on cache miss before returning serialized metadata', async () => {
    vi.mocked(connectionManager.getConfigFromStorage).mockReturnValue({
      id: 'conn-2',
      name: 'Warehouse',
      dbType: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      database: 'warehouse',
    });

    const indexedSchema: SchemaIndex = {
      database: 'warehouse',
      schema: 'warehouse',
      lastUpdated: 456,
      tables: new Map([
        [
          'orders',
          {
            name: 'orders',
            columns: [{ name: 'id', type: 'bigint' }],
          },
        ],
      ]),
    };

    vi.mocked(schemaIndexer.getIndex)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(indexedSchema);

    const { completionSchemaService } = await import('../completion-schema-service');

    const result = await completionSchemaService.getSchemaIndex('conn-2');

    expect(schemaIndexer.buildIndex).toHaveBeenCalledWith('conn-2', 'warehouse', 'warehouse');
    expect(result?.database).toBe('warehouse');
    expect(result?.schema).toBe('warehouse');
    expect(result?.tables).toHaveLength(1);
  });

  it('refreshes the schema index explicitly and resolves default schemas by db type', async () => {
    vi.mocked(connectionManager.getConfigFromStorage).mockReturnValue({
      id: 'conn-3',
      name: 'Reporting',
      dbType: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'sa',
      database: 'reporting',
    });

    const indexedSchema: SchemaIndex = {
      database: 'reporting',
      schema: 'dbo',
      lastUpdated: 789,
      tables: new Map(),
    };

    vi.mocked(schemaIndexer.getIndex).mockReturnValue(indexedSchema);

    const { completionSchemaService } = await import('../completion-schema-service');

    const result = await completionSchemaService.refreshSchemaIndex('conn-3');

    expect(schemaIndexer.buildIndex).toHaveBeenCalledWith('conn-3', 'reporting', 'dbo');
    expect(result).toEqual({
      database: 'reporting',
      schema: 'dbo',
      lastUpdated: 789,
      tables: [],
    });
  });
});
