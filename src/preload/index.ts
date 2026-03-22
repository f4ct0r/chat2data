import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import { ConnectionConfig, ElectronAPI } from '../shared/types';

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
    getDatabases: (id: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_DATABASES, id),
    getSchemas: (id: string, database?: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_SCHEMAS, id, database),
    getTables: (id: string, database?: string, schema?: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_TABLES, id, database, schema),
    getColumns: (id: string, database?: string, schema?: string, table?: string) => 
      ipcRenderer.invoke(IpcChannels.DB_GET_COLUMNS, id, database, schema, table),
  },
  system: {
    ping: () => ipcRenderer.invoke(IpcChannels.SYSTEM_PING),
    verifyStorage: () => ipcRenderer.invoke(IpcChannels.SYSTEM_VERIFY_STORAGE),
  },
};

contextBridge.exposeInMainWorld('api', api);
