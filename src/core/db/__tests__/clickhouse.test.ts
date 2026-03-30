import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClickhouseAdapter } from '../adapters/clickhouse';
import { DatabaseDriver } from '../types';

const queryMock = vi.fn();
const commandMock = vi.fn();
const pingMock = vi.fn();
const closeMock = vi.fn();

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => ({
    query: queryMock,
    command: commandMock,
    ping: pingMock,
    close: closeMock,
  })),
}));

describe('ClickhouseAdapter', () => {
  let adapter: DatabaseDriver;

  beforeEach(async () => {
    vi.clearAllMocks();
    pingMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    adapter = new ClickhouseAdapter();

    await adapter.connect({
      id: 'conn-1',
      name: 'ClickHouse',
      dbType: 'clickhouse',
      host: 'localhost',
      port: 8123,
      username: 'default',
      database: 'default',
    });
  });

  it('uses command for DDL statements and returns a successful empty result', async () => {
    commandMock.mockResolvedValue({
      query_id: 'query-1',
      response_headers: {},
      http_status_code: 200,
    });

    const result = await adapter.executeQuery('CREATE TABLE test (id UInt8) ENGINE = Memory');

    expect(commandMock).toHaveBeenCalledWith(expect.objectContaining({
      query: 'CREATE TABLE test (id UInt8) ENGINE = Memory',
      query_id: expect.any(String),
    }));
    expect(queryMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      columns: [],
      rows: [],
      rowCount: 0,
    });
    expect(result.error).toBeUndefined();
  });

  it('uses query for SELECT statements and parses JSON results', async () => {
    queryMock.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: [{ id: 1, name: 'alice' }],
        rows: 1,
        meta: [{ name: 'id' }, { name: 'name' }],
      }),
    });

    const result = await adapter.executeQuery('SELECT id, name FROM test');

    expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
      query: 'SELECT id, name FROM test',
      format: 'JSON',
      query_id: expect.any(String),
    }));
    expect(commandMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      columns: ['id', 'name'],
      rows: [{ id: 1, name: 'alice' }],
      rowCount: 1,
    });
  });

  it('returns read-only edit metadata for table previews', async () => {
    const result = await adapter.getTableEditMetadata?.({
      dbType: 'clickhouse',
      database: 'default',
      table: 'events',
      previewSql: 'SELECT * FROM events LIMIT 100',
    });

    expect(result).toEqual({
      editable: false,
      reason: expect.stringContaining('ClickHouse'),
      key: null,
    });
  });

  it('rejects batch writes without attempting transactional execution', async () => {
    const result = await adapter.executeBatch?.([
      "ALTER TABLE events UPDATE name = 'alice' WHERE id = 1",
      'ALTER TABLE events DELETE WHERE id = 2',
    ]);

    expect(queryMock).not.toHaveBeenCalled();
    expect(commandMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      failedStatementIndex: 0,
      error: expect.stringContaining('ClickHouse'),
    });
  });
});
