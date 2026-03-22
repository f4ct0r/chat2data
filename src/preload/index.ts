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
  system: {
    ping: () => ipcRenderer.invoke(IpcChannels.SYSTEM_PING),
    verifyStorage: () => ipcRenderer.invoke(IpcChannels.SYSTEM_VERIFY_STORAGE),
  },
};

contextBridge.exposeInMainWorld('api', api);
