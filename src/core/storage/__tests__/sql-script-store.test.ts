import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqlScriptStore as SqlScriptStoreClass } from '../sql-script-store';

vi.mock('../sqlite-service', () => ({
  sqliteService: {
    getDb: vi.fn(),
  },
}));

const createDb = () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE sql_scripts (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      database_name TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sql TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE sql_script_tags (
      script_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (script_id, tag),
      FOREIGN KEY (script_id) REFERENCES sql_scripts(id) ON DELETE CASCADE
    );
    CREATE TABLE sql_script_parameters (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      name TEXT NOT NULL,
      label TEXT,
      type TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      default_value TEXT,
      position INTEGER NOT NULL,
      FOREIGN KEY (script_id) REFERENCES sql_scripts(id) ON DELETE CASCADE,
      UNIQUE (script_id, name)
    );
  `);
  return db;
};

describe('SqlScriptStore', () => {
  let db: Database.Database;
  let store: SqlScriptStoreClass;
  let SqlScriptStore: typeof import('../sql-script-store').SqlScriptStore;

  beforeEach(async () => {
    ({ SqlScriptStore } = await import('../sql-script-store'));
    db = createDb();
    store = new SqlScriptStore(() => db);
  });

  afterEach(() => {
    db.close();
  });

  it('lists only scripts for one connection and database', () => {
    const insert = db.prepare(`
      INSERT INTO sql_scripts (id, connection_id, database_name, name, sql)
      VALUES (?, ?, ?, ?, ?)
    `);
    insert.run('script-1', 'conn-a', 'db-a', 'Alpha', 'SELECT 1');
    insert.run('script-2', 'conn-a', 'db-b', 'Beta', 'SELECT 2');
    insert.run('script-3', 'conn-b', 'db-a', 'Gamma', 'SELECT 3');

    const results = store.list('conn-a', 'db-a');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'script-1',
      connectionId: 'conn-a',
      databaseName: 'db-a',
      name: 'Alpha',
      sql: 'SELECT 1',
      tags: [],
      parameters: [],
    });
  });

  it('persists tags and parameters with the script', () => {
    const saved = store.save({
      connectionId: 'conn-a',
      databaseName: 'db-a',
      name: '  Daily Summary  ',
      description: '  report  ',
      sql: 'SELECT {{startDate}} AS start_date, {{limit}} AS limit_value',
      tags: ['  finance ', 'ops', 'finance', ''],
      parameters: [
        {
          name: 'limit',
          label: 'Limit',
          type: 'number',
          required: true,
          defaultValue: '100',
          position: 2,
        },
        {
          name: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: true,
          position: 1,
        },
      ],
    });

    expect(saved).toMatchObject({
      connectionId: 'conn-a',
      databaseName: 'db-a',
      name: 'Daily Summary',
      description: 'report',
      sql: 'SELECT {{startDate}} AS start_date, {{limit}} AS limit_value',
      tags: ['finance', 'ops'],
    });
    expect(saved.parameters.map((parameter) => parameter.name)).toEqual(['startDate', 'limit']);
    expect(saved.parameters[0]).toMatchObject({
      name: 'startDate',
      label: 'Start Date',
      type: 'date',
      required: true,
      position: 1,
    });
    expect(saved.parameters[1]).toMatchObject({
      name: 'limit',
      label: 'Limit',
      type: 'number',
      required: true,
      defaultValue: '100',
      position: 2,
    });

    expect(store.get(saved.id)).toEqual(saved);
  });

  it('replaces tags and parameters on update', () => {
    const created = store.save({
      connectionId: 'conn-a',
      databaseName: 'db-a',
      name: 'Script',
      sql: 'SELECT {{name}}',
      tags: ['alpha', 'beta'],
      parameters: [
        {
          name: 'name',
          label: 'Name',
          type: 'text',
          required: true,
          position: 1,
        },
      ],
    });

    const updated = store.save({
      id: created.id,
      connectionId: 'conn-a',
      databaseName: 'db-a',
      name: 'Script',
      sql: 'SELECT 1',
      tags: ['gamma', ' gamma ', 'delta'],
      parameters: [
        {
          name: 'limit',
          label: 'Limit',
          type: 'number',
          required: false,
          position: 2,
        },
        {
          name: 'offset',
          label: 'Offset',
          type: 'number',
          required: false,
          position: 1,
        },
      ],
    });

    expect(updated.tags).toEqual(['delta', 'gamma']);
    expect(updated.parameters.map((parameter) => parameter.name)).toEqual(['offset', 'limit']);
    expect(store.get(created.id)).toEqual(updated);

    const tagCount = db.prepare('SELECT COUNT(*) AS count FROM sql_script_tags WHERE script_id = ?').get(created.id) as { count: number };
    const parameterCount = db.prepare('SELECT COUNT(*) AS count FROM sql_script_parameters WHERE script_id = ?').get(created.id) as { count: number };
    expect(tagCount.count).toBe(2);
    expect(parameterCount.count).toBe(2);
  });

  it('deletes child rows when a script is removed', () => {
    const created = store.save({
      connectionId: 'conn-a',
      databaseName: 'db-a',
      name: 'Script',
      sql: 'SELECT {{name}}',
      tags: ['alpha'],
      parameters: [
        {
          name: 'name',
          label: 'Name',
          type: 'text',
          required: true,
          position: 1,
        },
      ],
    });

    store.delete(created.id);

    expect(store.get(created.id)).toBeNull();

    const tagCount = db.prepare('SELECT COUNT(*) AS count FROM sql_script_tags WHERE script_id = ?').get(created.id) as { count: number };
    const parameterCount = db.prepare('SELECT COUNT(*) AS count FROM sql_script_parameters WHERE script_id = ?').get(created.id) as { count: number };
    expect(tagCount.count).toBe(0);
    expect(parameterCount.count).toBe(0);
  });
});
