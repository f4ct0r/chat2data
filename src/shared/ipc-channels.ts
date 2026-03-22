export enum IpcChannels {
  // System and Window
  WINDOW_MINIMIZE = 'window:minimize',
  WINDOW_MAXIMIZE = 'window:maximize',
  WINDOW_CLOSE = 'window:close',

  // Storage
  STORAGE_SAVE_CONNECTION = 'storage:saveConnection',
  STORAGE_GET_CONNECTIONS = 'storage:getConnections',
  STORAGE_DELETE_CONNECTION = 'storage:deleteConnection',

  // System Test
  SYSTEM_PING = 'system:ping',
  SYSTEM_VERIFY_STORAGE = 'system:verifyStorage',
}
