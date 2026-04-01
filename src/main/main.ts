import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { IpcChannels } from '../shared/ipc-channels';
import { sqliteService } from '../core/storage/sqlite-service';
import { CredentialService } from '../core/security/credential-service';
import { connectionManager } from '../core/db/connection-manager';
import { QueryExecutor } from '../core/executor/query-executor';
import { ChatAgent, AgentContext } from '../core/agent/chat-agent';
import { AppLanguage, ConnectionConfig, LlmProvider, PreviewTableRef } from '../shared/types';
import { SqlScriptInput } from '../shared/sql-scripts';
import { randomUUID } from 'crypto';
import { completionSchemaService } from '../core/agent/completion-schema-service';
import { sqlScriptStore } from '../core/storage/sql-script-store';

const shouldOpenDevTools = process.env.CHAT2DATA_OPEN_DEVTOOLS === 'true';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Temporarily disable DevTools in dev mode completely for the moment or suppress this error differently
    },
  });

  // Suppress specific devtools error
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (message.includes('Autofill.enable')) {
      event.preventDefault();
      return;
    }
    console.log(`[Renderer Console] ${level} ${message} (${sourceId}:${line})`);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('Loading DEV server URL:', process.env.VITE_DEV_SERVER_URL);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../index.html'));
  }
}

// Ignore autofill errors
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');

app.whenReady().then(() => {
  sqliteService.init();
  console.log('SQLite database initialized successfully');

  ipcMain.handle(IpcChannels.SYSTEM_PING, () => {
    console.log('Main process received system.ping');
    return 'Pong from Main Process!';
  });

  ipcMain.handle(IpcChannels.SYSTEM_VERIFY_STORAGE, async () => {
    const db = sqliteService.getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  ipcMain.handle(IpcChannels.STORAGE_SAVE_CONNECTION, async (_event, config: ConnectionConfig) => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  ipcMain.handle(IpcChannels.STORAGE_DELETE_CONNECTION, async (_event, id: string) => {
    const db = sqliteService.getDb();
    db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  });

  ipcMain.handle(IpcChannels.STORAGE_LIST_SQL_SCRIPTS, async (_event, connectionId: string, databaseName: string) => {
    return sqlScriptStore.list(connectionId, databaseName);
  });

  ipcMain.handle(IpcChannels.STORAGE_GET_SQL_SCRIPT, async (_event, scriptId: string) => {
    return sqlScriptStore.get(scriptId);
  });

  ipcMain.handle(IpcChannels.STORAGE_SAVE_SQL_SCRIPT, async (_event, input: SqlScriptInput) => {
    return sqlScriptStore.save(input);
  });

  ipcMain.handle(IpcChannels.STORAGE_DELETE_SQL_SCRIPT, async (_event, scriptId: string) => {
    sqlScriptStore.delete(scriptId);
  });

  // Database Handlers
  ipcMain.handle(IpcChannels.DB_TEST_CONNECTION, async (_event, config: ConnectionConfig | { id: string }) => {
    return await connectionManager.testConnection(config);
  });

  ipcMain.handle(IpcChannels.DB_CONNECT, async (_event, id: string) => {
    await connectionManager.connect(id);
  });

  ipcMain.handle(IpcChannels.DB_DISCONNECT, async (_event, id: string) => {
    await connectionManager.disconnect(id);
  });

  ipcMain.handle(IpcChannels.DB_EXECUTE_QUERY, async (_event, id: string, sql: string) => {
    return await QueryExecutor.execute(id, sql);
  });

  ipcMain.handle(IpcChannels.DB_KILL_QUERY, async (_event, id: string) => {
    await QueryExecutor.cancel(id);
  });

  ipcMain.handle(IpcChannels.DB_GET_EXECUTION_STATUS, async (_event, id: string) => {
    return QueryExecutor.getStatus(id);
  });

  ipcMain.handle(IpcChannels.DB_GET_DATABASES, async (_event, id: string) => {
    return await connectionManager.getDatabases(id);
  });

  ipcMain.handle(IpcChannels.DB_GET_SCHEMAS, async (_event, id: string, database?: string) => {
    return await connectionManager.getSchemas(id, database);
  });

  ipcMain.handle(IpcChannels.DB_GET_TABLES, async (_event, id: string, database?: string, schema?: string) => {
    return await connectionManager.getTables(id, database, schema);
  });

  ipcMain.handle(IpcChannels.DB_GET_COLUMNS, async (_event, id: string, database?: string, schema?: string, table?: string) => {
    return await connectionManager.getColumns(id, database, schema, table);
  });

  ipcMain.handle(IpcChannels.DB_GET_TABLE_EDIT_METADATA, async (_event, id: string, table: PreviewTableRef) => {
    return await connectionManager.getTableEditMetadata(id, table);
  });

  ipcMain.handle(IpcChannels.DB_EXECUTE_BATCH, async (_event, id: string, statements: string[]) => {
    return await connectionManager.executeBatch(id, statements);
  });

  ipcMain.handle(IpcChannels.DB_BUILD_SCHEMA_INDEX, async (_event, id: string, database?: string, schema?: string) => {
    return await completionSchemaService.buildSchemaIndex(id, database, schema);
  });

  ipcMain.handle(IpcChannels.DB_GET_SCHEMA_INDEX, async (_event, id: string, database?: string, schema?: string) => {
    return await completionSchemaService.getSchemaIndex(id, database, schema);
  });

  ipcMain.handle(IpcChannels.DB_REFRESH_SCHEMA_INDEX, async (_event, id: string, database?: string, schema?: string) => {
    return await completionSchemaService.refreshSchemaIndex(id, database, schema);
  });

  // Settings & Security Handlers
  ipcMain.handle(IpcChannels.SETTINGS_SAVE_API_KEY, async (_event, provider: string, apiKey: string) => {
    CredentialService.saveApiKey(provider, apiKey);
  });

  ipcMain.handle(IpcChannels.SETTINGS_GET_API_KEY, async (_event, provider: string) => {
    return CredentialService.getApiKey(provider);
  });

  ipcMain.handle(IpcChannels.SETTINGS_SAVE_PRIVACY_CONSENT, async (_event, consented: boolean) => {
    CredentialService.savePrivacyConsent(consented);
  });

  ipcMain.handle(IpcChannels.SETTINGS_GET_PRIVACY_CONSENT, async () => {
    return CredentialService.getPrivacyConsent();
  });

  ipcMain.handle(IpcChannels.SETTINGS_GET_APP_LANGUAGE, async () => {
    return CredentialService.getAppLanguage();
  });

  ipcMain.handle(IpcChannels.SETTINGS_SET_APP_LANGUAGE, async (_event, language: AppLanguage) => {
    CredentialService.saveAppLanguage(language);
  });

  ipcMain.handle(IpcChannels.SETTINGS_GET_LLM_PROVIDERS, async () => {
    const data = sqliteService.getSetting('llm_providers');
    if (!data) return [];
    try {
      const providers = JSON.parse(data) as LlmProvider[];
      for (const p of providers) {
        // Do not send actual API keys back to renderer, except maybe a placeholder if it exists
        const key = CredentialService.getApiKey(`llm_${p.id}`);
        p.apiKey = key ? '********' : '';
      }
      return providers;
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle(IpcChannels.SETTINGS_SAVE_LLM_PROVIDERS, async (_event, providers: LlmProvider[]) => {
    const toSave = providers.map(p => {
      const providerId = p.id || randomUUID();
      // If the user provided a new api key (not the mask), save it
      if (p.apiKey !== undefined && p.apiKey !== '' && p.apiKey !== '********') {
        CredentialService.saveApiKey(`llm_${providerId}`, p.apiKey);
      }
      return {
        id: providerId,
        name: p.name.trim(),
        provider: p.provider,
        baseUrl: p.baseUrl?.trim() || undefined,
        model: p.model.trim(),
      };
    });
    sqliteService.setSetting('llm_providers', JSON.stringify(toSave));
  });

  ipcMain.handle(IpcChannels.SETTINGS_GET_ACTIVE_LLM_PROVIDER, async () => {
    return sqliteService.getSetting('active_llm_provider');
  });

  ipcMain.handle(IpcChannels.SETTINGS_SET_ACTIVE_LLM_PROVIDER, async (_event, id: string) => {
    sqliteService.setSetting('active_llm_provider', id);
  });

  // Agent Handlers
  ipcMain.handle(IpcChannels.AGENT_GENERATE_SQL, async (_event, prompt: string, context: AgentContext, providerId?: string) => {
    return await ChatAgent.generateSql(prompt, context, providerId);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  console.error('Failed to initialize SQLite database:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
