import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
const api = {
    window: {
        minimize: () => ipcRenderer.send(IpcChannels.WINDOW_MINIMIZE),
        maximize: () => ipcRenderer.send(IpcChannels.WINDOW_MAXIMIZE),
        close: () => ipcRenderer.send(IpcChannels.WINDOW_CLOSE),
    },
    storage: {
        saveConnection: (config) => ipcRenderer.invoke(IpcChannels.STORAGE_SAVE_CONNECTION, config),
        getConnections: () => ipcRenderer.invoke(IpcChannels.STORAGE_GET_CONNECTIONS),
        deleteConnection: (id) => ipcRenderer.invoke(IpcChannels.STORAGE_DELETE_CONNECTION, id),
    },
    system: {
        ping: () => ipcRenderer.invoke(IpcChannels.SYSTEM_PING),
    },
};
contextBridge.exposeInMainWorld('api', api);
