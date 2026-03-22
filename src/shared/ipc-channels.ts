export enum IpcChannels {
  // System and Window
  WINDOW_MINIMIZE = 'window:minimize',
  WINDOW_MAXIMIZE = 'window:maximize',
  WINDOW_CLOSE = 'window:close',

  // Storage
  STORAGE_SAVE_CONNECTION = 'storage:saveConnection',
  STORAGE_GET_CONNECTIONS = 'storage:getConnections',
  STORAGE_DELETE_CONNECTION = 'storage:deleteConnection',

  // Database
  DB_TEST_CONNECTION = 'db:testConnection',
  DB_CONNECT = 'db:connect',
  DB_DISCONNECT = 'db:disconnect',
  DB_EXECUTE_QUERY = 'db:executeQuery',
  DB_GET_DATABASES = 'db:getDatabases',
  DB_GET_SCHEMAS = 'db:getSchemas',
  DB_GET_TABLES = 'db:getTables',
  DB_GET_COLUMNS = 'db:getColumns',

  // System Test
  SYSTEM_PING = 'system:ping',
  SYSTEM_VERIFY_STORAGE = 'system:verifyStorage',
}
