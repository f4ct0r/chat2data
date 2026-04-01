import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.fn();
const appOn = vi.fn();
const appQuit = vi.fn();
const appendSwitch = vi.fn();
const browserWindowLoadURL = vi.fn();
const browserWindowLoadFile = vi.fn();
const browserWindowOpenDevTools = vi.fn();
const browserWindowConsoleOn = vi.fn();

class MockBrowserWindow {
  static getAllWindows = vi.fn(() => []);

  webContents = {
    on: browserWindowConsoleOn,
    openDevTools: browserWindowOpenDevTools,
  };

  loadURL = browserWindowLoadURL;

  loadFile = browserWindowLoadFile;
}

vi.mock('electron', () => ({
  app: {
    commandLine: {
      appendSwitch,
    },
    whenReady: vi.fn(() => Promise.resolve()),
    on: appOn,
    quit: appQuit,
  },
  BrowserWindow: MockBrowserWindow,
  ipcMain: {
    handle,
  },
}));

const init = vi.fn();

vi.mock('../core/storage/sqlite-service', () => ({
  sqliteService: {
    init,
    getDb: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
  },
}));

vi.mock('../core/security/credential-service', () => ({
  CredentialService: {
    decrypt: vi.fn(),
    encrypt: vi.fn(),
    saveApiKey: vi.fn(),
    getApiKey: vi.fn(),
    savePrivacyConsent: vi.fn(),
    getPrivacyConsent: vi.fn(),
    saveAppLanguage: vi.fn(),
    getAppLanguage: vi.fn(),
  },
}));

vi.mock('../core/db/connection-manager', () => ({
  connectionManager: {
    testConnection: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getDatabases: vi.fn(),
    getSchemas: vi.fn(),
    getTables: vi.fn(),
    getColumns: vi.fn(),
    getTableEditMetadata: vi.fn(),
    executeBatch: vi.fn(),
  },
}));

vi.mock('../core/executor/query-executor', () => ({
  QueryExecutor: {
    execute: vi.fn(),
    cancel: vi.fn(),
    getStatus: vi.fn(),
  },
}));

vi.mock('../core/agent/chat-agent', () => ({
  ChatAgent: {
    generateSql: vi.fn(),
  },
}));

vi.mock('../core/agent/completion-schema-service', () => ({
  completionSchemaService: {
    buildSchemaIndex: vi.fn(),
    getSchemaIndex: vi.fn(),
    refreshSchemaIndex: vi.fn(),
  },
}));

vi.mock('../core/storage/sql-script-store', () => ({
  sqlScriptStore: {
    list: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('main bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('quits the app instead of registering IPC handlers when sqlite initialization fails', async () => {
    init.mockImplementationOnce(() => {
      throw new Error('native module mismatch');
    });

    await import('./main');
    await Promise.resolve();

    expect(init).toHaveBeenCalledTimes(1);
    expect(appQuit).toHaveBeenCalledTimes(1);
    expect(handle).not.toHaveBeenCalled();
    expect(browserWindowLoadURL).not.toHaveBeenCalled();
    expect(browserWindowLoadFile).not.toHaveBeenCalled();
  });
});
