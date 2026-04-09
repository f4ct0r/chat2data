import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteAdapter } from '../adapters/sqlite';
import { DatabaseDriver } from '../types';

const closeMock = vi.fn();
const pragmaMock = vi.fn();
const prepareMock = vi.fn();

vi.mock('better-sqlite3', () => ({
  default: vi.fn(function MockDatabase() {
    return {
      close: closeMock,
      pragma: pragmaMock,
      prepare: prepareMock,
    };
  }),
}));

describe('SqliteAdapter', () => {
  let adapter: DatabaseDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SqliteAdapter();
  });

  it('tests connectivity against an existing sqlite file path', async () => {
    const getMock = vi.fn().mockReturnValue({ ok: 1 });
    prepareMock.mockReturnValue({
      get: getMock,
    });

    const result = await adapter.testConnection({
      id: 'sqlite-1',
      name: 'SQLite',
      dbType: 'sqlite',
      host: '',
      port: 0,
      username: '',
      database: '/tmp/analytics.sqlite',
    });

    expect(result).toBe(true);
    expect(prepareMock).toHaveBeenCalledWith('SELECT 1 AS ok');
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('lists user tables without surfacing sqlite internal tables', async () => {
    const allMock = vi.fn().mockReturnValue([
      { name: 'users' },
      { name: 'events_view' },
    ]);
    prepareMock.mockReturnValue({
      all: allMock,
    });

    await adapter.connect({
      id: 'sqlite-1',
      name: 'SQLite',
      dbType: 'sqlite',
      host: '',
      port: 0,
      username: '',
      database: '/tmp/analytics.sqlite',
    });

    const tables = await adapter.getTables();

    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('sqlite_master'));
    expect(tables).toEqual(['users', 'events_view']);
  });

  it('reads columns through PRAGMA table_info', async () => {
    const allMock = vi.fn().mockReturnValue([
      { name: 'id', type: 'INTEGER' },
      { name: 'email', type: 'TEXT' },
    ]);
    prepareMock.mockReturnValue({
      all: allMock,
    });

    await adapter.connect({
      id: 'sqlite-1',
      name: 'SQLite',
      dbType: 'sqlite',
      host: '',
      port: 0,
      username: '',
      database: '/tmp/analytics.sqlite',
    });

    const columns = await adapter.getColumns(undefined, undefined, 'users');

    expect(prepareMock).toHaveBeenCalledWith('PRAGMA table_info("users")');
    expect(columns).toEqual([
      { name: 'id', type: 'INTEGER' },
      { name: 'email', type: 'TEXT' },
    ]);
  });

  it('returns editable metadata from a primary key declared in PRAGMA table_info', async () => {
    prepareMock.mockImplementation((sql: string) => {
      if (sql === 'PRAGMA table_info("users")') {
        return {
          all: vi.fn().mockReturnValue([
            { name: 'id', pk: 1 },
            { name: 'workspace_id', pk: 2 },
            { name: 'email', pk: 0 },
          ]),
        };
      }

      return {
        all: vi.fn().mockReturnValue([]),
      };
    });

    await adapter.connect({
      id: 'sqlite-1',
      name: 'SQLite',
      dbType: 'sqlite',
      host: '',
      port: 0,
      username: '',
      database: '/tmp/analytics.sqlite',
    });

    const result = await adapter.getTableEditMetadata?.({
      dbType: 'sqlite',
      table: 'users',
      previewSql: 'SELECT * FROM "users" LIMIT 100',
    });

    expect(result).toEqual({
      editable: true,
      key: {
        type: 'primary',
        columns: ['id', 'workspace_id'],
      },
    });
  });
});
