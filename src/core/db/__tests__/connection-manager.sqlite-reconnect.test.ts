import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionManager } from '../connection-manager';
import { sqliteService } from '../../storage/sqlite-service';

vi.mock('../../storage/sqlite-service', () => ({
  sqliteService: {
    getDb: vi.fn(),
  },
}));

vi.mock('../../security/credential-service', () => ({
  CredentialService: {
    decrypt: vi.fn(),
  },
}));

const createSqliteFixture = (
  databasePath: string,
  tableName: string,
  label: string
) => {
  const db = new Database(databasePath);
  db.exec(`
    CREATE TABLE "${tableName}" (
      id INTEGER PRIMARY KEY,
      label TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO "${tableName}" (label) VALUES (?)`).run(label);
  db.close();
};

describe('ConnectionManager sqlite reconnection', () => {
  const connectionId = 'sqlite-conn';
  const storageDb = {
    prepare: vi.fn(),
  };

  let manager: ConnectionManager;
  let tempDir: string;
  let databasePath: string;

  beforeEach(() => {
    vi.clearAllMocks();

    manager = new ConnectionManager();
    tempDir = mkdtempSync(join(tmpdir(), 'chat2data-sqlite-'));
    databasePath = join(tempDir, 'workspace.sqlite');

    createSqliteFixture(databasePath, 'legacy_items', 'legacy row');

    storageDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: connectionId,
        name: 'Workspace SQLite',
        db_type: 'sqlite',
        host: '',
        port: 0,
        username: '',
        database: databasePath,
        encrypted_password: null,
      }),
    });

    vi.mocked(sqliteService.getDb).mockReturnValue(
      storageDb as unknown as Database.Database
    );
  });

  afterEach(async () => {
    await manager.disconnect(connectionId).catch(() => undefined);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reconnects when the sqlite file is recreated at the same path', async () => {
    await manager.connect(connectionId);

    expect(await manager.getTables(connectionId)).toEqual(['legacy_items']);

    unlinkSync(databasePath);
    createSqliteFixture(databasePath, 'fresh_items', 'fresh row');

    await expect(manager.getTables(connectionId)).resolves.toEqual([
      'fresh_items',
    ]);

    await expect(
      manager.executeQuery(connectionId, 'SELECT label FROM "fresh_items"')
    ).resolves.toMatchObject({
      rowCount: 1,
      rows: [{ label: 'fresh row' }],
    });
  });
});
