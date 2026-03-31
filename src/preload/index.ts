import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import {
  AppLanguage,
  BatchExecutionResult,
  ConnectionConfig,
  ElectronAPI,
  LlmProvider,
  PreviewTableRef,
  TableEditMetadata,
} from '../shared/types';

const api: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.send(IpcChannels.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IpcChannels.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IpcChannels.WINDOW_CLOSE),
  },
  storage: {
    saveConnection: (config: ConnectionConfig) => 
      ipcRenderer.invoke(IpcChannels.STORAGE_SAVE_CONNECTION, config),
    getConnections: () => 
      ipcRenderer.invoke(IpcChannels.STORAGE_GET_CONNECTIONS),
    deleteConnection: (id: string) => 
      ipcRenderer.invoke(IpcChannels.STORAGE_DELETE_CONNECTION, id),
  },
  db: {
    testConnection: (config: ConnectionConfig | { id: string }) => 
      ipcRenderer.invoke(IpcChannels.DB_TEST_CONNECTION, config),
    connect: (id: string) => 
      ipcRenderer.invoke(IpcChannels.DB_CONNECT, id),
    disconnect: (id: string) => 
      ipcRenderer.invoke(IpcChannels.DB_DISCONNECT, id),
    executeQuery: (id: string, sql: string) => 
      ipcRenderer.invoke(IpcChannels.DB_EXECUTE_QUERY, id, sql),
    getTableEditMetadata: (id: string, table: PreviewTableRef) =>
      ipcRenderer.invoke(IpcChannels.DB_GET_TABLE_EDIT_METADATA, id, table) as Promise<TableEditMetadata>,
    executeBatch: (id: string, statements: string[]) =>
      ipcRenderer.invoke(IpcChannels.DB_EXECUTE_BATCH, id, statements) as Promise<BatchExecutionResult>,
    killQuery: (id: string) => 
      ipcRenderer.invoke(IpcChannels.DB_KILL_QUERY, id),
    getExecutionStatus: (id: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_EXECUTION_STATUS, id),
    getDatabases: (id: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_DATABASES, id),
    getSchemas: (id: string, database?: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_SCHEMAS, id, database),
    getTables: (id: string, database?: string, schema?: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_TABLES, id, database, schema),
    getColumns: (id: string, database?: string, schema?: string, table?: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_COLUMNS, id, database, schema, table),
    buildSchemaIndex: (id: string, database?: string, schema?: string) =>
      ipcRenderer.invoke(IpcChannels.DB_BUILD_SCHEMA_INDEX, id, database, schema),
    getSchemaIndex: (id: string, database?: string, schema?: string) =>
      ipcRenderer.invoke(IpcChannels.DB_GET_SCHEMA_INDEX, id, database, schema),
    refreshSchemaIndex: (id: string, database?: string, schema?: string) =>
      ipcRenderer.invoke(IpcChannels.DB_REFRESH_SCHEMA_INDEX, id, database, schema),
  },
  system: {
    ping: () => ipcRenderer.invoke(IpcChannels.SYSTEM_PING),
    verifyStorage: () => ipcRenderer.invoke(IpcChannels.SYSTEM_VERIFY_STORAGE),
  },
  settings: {
    saveApiKey: (provider: string, apiKey: string) => 
      ipcRenderer.invoke(IpcChannels.SETTINGS_SAVE_API_KEY, provider, apiKey),
    getApiKey: (provider: string) => 
      ipcRenderer.invoke(IpcChannels.SETTINGS_GET_API_KEY, provider),
    savePrivacyConsent: (consented: boolean) => 
      ipcRenderer.invoke(IpcChannels.SETTINGS_SAVE_PRIVACY_CONSENT, consented),
    getPrivacyConsent: () => 
      ipcRenderer.invoke(IpcChannels.SETTINGS_GET_PRIVACY_CONSENT),
    getAppLanguage: () =>
      ipcRenderer.invoke(IpcChannels.SETTINGS_GET_APP_LANGUAGE),
    setAppLanguage: (language: AppLanguage) =>
      ipcRenderer.invoke(IpcChannels.SETTINGS_SET_APP_LANGUAGE, language),
    getLlmProviders: () => 
      ipcRenderer.invoke(IpcChannels.SETTINGS_GET_LLM_PROVIDERS),
    saveLlmProviders: (providers: LlmProvider[]) => 
      ipcRenderer.invoke(IpcChannels.SETTINGS_SAVE_LLM_PROVIDERS, providers),
    getActiveLlmProvider: () => 
      ipcRenderer.invoke(IpcChannels.SETTINGS_GET_ACTIVE_LLM_PROVIDER),
    setActiveLlmProvider: (id: string) => 
      ipcRenderer.invoke(IpcChannels.SETTINGS_SET_ACTIVE_LLM_PROVIDER, id),
  },
  agent: {
    generateSql: (prompt: string, context: { dbType: string, schemaDDL: string }, providerId?: string) => 
      ipcRenderer.invoke(IpcChannels.AGENT_GENERATE_SQL, prompt, context, providerId),
  },
};

contextBridge.exposeInMainWorld('api', api);
