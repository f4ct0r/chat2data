import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

class SqliteService {
  private db: Database.Database | null = null;

  init() {
    if (this.db) return;

    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'chat2data.sqlite');
    
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath, {
      // verbose: console.log
    });

    this.db.pragma('foreign_keys = ON');

    this.initTables();
  }

  private initTables() {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        db_type TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT NOT NULL,
        database TEXT,
        encrypted_password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sql_scripts (
        id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        database_name TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        sql TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sql_script_tags (
        script_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (script_id, tag),
        FOREIGN KEY (script_id) REFERENCES sql_scripts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sql_script_parameters (
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
    `;

    this.db.exec(query);
  }

  getSetting(key: string): string | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setSetting(key: string, value: string): void {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value);
  }

  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }
}

export const sqliteService = new SqliteService();
