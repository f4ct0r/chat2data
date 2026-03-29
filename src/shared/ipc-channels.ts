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
  DB_KILL_QUERY = 'db:killQuery',
  DB_GET_EXECUTION_STATUS = 'db:getExecutionStatus',
  DB_GET_DATABASES = 'db:getDatabases',
  DB_GET_SCHEMAS = 'db:getSchemas',
  DB_GET_TABLES = 'db:getTables',
  DB_GET_COLUMNS = 'db:getColumns',
  DB_BUILD_SCHEMA_INDEX = 'db:buildSchemaIndex',
  DB_GET_SCHEMA_INDEX = 'db:getSchemaIndex',
  DB_REFRESH_SCHEMA_INDEX = 'db:refreshSchemaIndex',

  // Settings & Security
  SETTINGS_SAVE_API_KEY = 'settings:saveApiKey',
  SETTINGS_GET_API_KEY = 'settings:getApiKey',
  SETTINGS_SAVE_PRIVACY_CONSENT = 'settings:savePrivacyConsent',
  SETTINGS_GET_PRIVACY_CONSENT = 'settings:getPrivacyConsent',
  SETTINGS_GET_APP_LANGUAGE = 'settings:getAppLanguage',
  SETTINGS_SET_APP_LANGUAGE = 'settings:setAppLanguage',
  SETTINGS_GET_LLM_PROVIDERS = 'settings:getLlmProviders',
  SETTINGS_SAVE_LLM_PROVIDERS = 'settings:saveLlmProviders',
  SETTINGS_GET_ACTIVE_LLM_PROVIDER = 'settings:getActiveLlmProvider',
  SETTINGS_SET_ACTIVE_LLM_PROVIDER = 'settings:setActiveLlmProvider',

  // Agent
  AGENT_GENERATE_SQL = 'agent:generateSql',

  // System Test
  SYSTEM_PING = 'system:ping',
  SYSTEM_VERIFY_STORAGE = 'system:verifyStorage',
}
