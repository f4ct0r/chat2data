import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { IpcChannels } from '../shared/ipc-channels';
import { sqliteService } from '../core/storage/sqlite-service';
import { CredentialService } from '../core/security/credential-service';
import { ConnectionConfig } from '../shared/types';
import { randomUUID } from 'crypto';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize SQLite Database
  try {
    sqliteService.init();
    console.log('SQLite database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize SQLite database:', err);
  }

  ipcMain.handle(IpcChannels.SYSTEM_PING, () => {
    console.log('Main process received system.ping');
    return 'Pong from Main Process!';
  });

  ipcMain.handle(IpcChannels.SYSTEM_VERIFY_STORAGE, async () => {
    const db = sqliteService.getDb();
    const rows = db.prepare('SELECT id, name, encrypted_password FROM connections').all() as any[];
    
    // Check if passwords are encrypted
    const verificationResults = rows.map(row => {
      const isEncrypted = row.encrypted_password && row.encrypted_password.length > 0;
      // Also try decrypting it just to prove it works
      let decrypted = null;
      if (isEncrypted) {
        decrypted = CredentialService.decrypt(row.encrypted_password);
      }
      return {
        id: row.id,
        name: row.name,
        hasEncryptedField: isEncrypted,
        encryptedValuePreview: isEncrypted ? row.encrypted_password.substring(0, 10) + '...' : null,
        decryptedValuePreview: decrypted ? (decrypted === 'supersecretpassword' ? 'MATCH' : 'MISMATCH') : null
      };
    });

    return verificationResults;
  });

  ipcMain.handle(IpcChannels.STORAGE_SAVE_CONNECTION, async (event, config: ConnectionConfig) => {
    const db = sqliteService.getDb();
    const id = config.id || randomUUID();
    
    let encryptedPassword = null;
    if (config.password) {
      encryptedPassword = CredentialService.encrypt(config.password);
    }

    const stmt = db.prepare(`
      INSERT INTO connections (id, name, db_type, host, port, username, database, encrypted_password)
      VALUES (@id, @name, @dbType, @host, @port, @username, @database, @encryptedPassword)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        db_type = excluded.db_type,
        host = excluded.host,
        port = excluded.port,
        username = excluded.username,
        database = excluded.database,
        encrypted_password = COALESCE(excluded.encrypted_password, connections.encrypted_password),
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run({
      id,
      name: config.name,
      dbType: config.dbType,
      host: config.host,
      port: config.port,
      username: config.username,
      database: config.database || null,
      encryptedPassword: encryptedPassword,
    });

    return id;
  });

  ipcMain.handle(IpcChannels.STORAGE_GET_CONNECTIONS, async () => {
    const db = sqliteService.getDb();
    const rows = db.prepare('SELECT * FROM connections').all() as any[];
    
    return rows.map(row => {
      const config: ConnectionConfig = {
        id: row.id,
        name: row.name,
        dbType: row.db_type,
        host: row.host,
        port: row.port,
        username: row.username,
        database: row.database || undefined,
        hasPassword: !!row.encrypted_password,
      };
      return config;
    });
  });

  ipcMain.handle(IpcChannels.STORAGE_DELETE_CONNECTION, async (event, id: string) => {
    const db = sqliteService.getDb();
    db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
