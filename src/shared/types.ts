import type {
  SqlScript,
  SqlScriptInput,
} from './sql-scripts';

export interface ConnectionConfig {
  id: string;
  name: string;
  dbType: 'mysql' | 'postgres' | 'mssql' | 'clickhouse';
  host: string;
  port: number;
  username: string;
  database?: string;
  password?: string;
  hasPassword?: boolean;
}

export interface DecryptedConnectionConfig extends ConnectionConfig {
  password?: string; // Explicitly decrypted password for core/db layers
}

export type QueryRow = Record<string, unknown>;

export interface QueryResult {
  columns: string[];
  rows: QueryRow[];
  rowCount: number;
  durationMs: number;
  warnings?: string[];
  error?: string;
}

export interface CompletionColumn {
  name: string;
  type: string;
  comment?: string;
}

export interface CompletionTable {
  name: string;
  comment?: string;
  columns: CompletionColumn[];
}

export interface CompletionSchemaIndex {
  database: string;
  schema?: string;
  tables: CompletionTable[];
  lastUpdated: number;
}

export type CompletionCacheStatus = 'idle' | 'loading' | 'ready' | 'error';
export type TabType = 'sql' | 'chat' | 'script';

export interface PendingAutoExecuteRequest {
  kind: 'script-execute-now' | 'query-history-replay';
}

export interface PreviewTableRef {
  dbType: ConnectionConfig['dbType'];
  database?: string;
  schema?: string;
  table: string;
  previewSql: string;
}

export interface TableEditKey {
  type: 'primary' | 'unique';
  columns: string[];
}

export interface TableEditMetadata {
  editable: boolean;
  reason?: string;
  key: TableEditKey | null;
}

export interface BatchExecutionResult {
  ok: boolean;
  failedStatementIndex?: number;
  error?: string;
}

export interface TabData {
  id: string;
  title: string;
  type: TabType;
  connectionId: string;
  dbType?: ConnectionConfig['dbType'];
  content?: string;
  database?: string;
  schema?: string;
  previewTable?: PreviewTableRef;
  completionCacheStatus?: CompletionCacheStatus;
  pendingPreviewSql?: string;
  pendingPreviewRequestId?: string;
  scriptId?: string;
  scriptDatabaseName?: string;
  pendingAutoExecute?: PendingAutoExecuteRequest | null;
}

export interface StorageVerificationResult {
  id: string;
  name: string;
  hasEncryptedField: boolean;
  encryptedValuePreview: string | null;
  decryptedValuePreview: string | null;
}

export interface LlmProvider {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic';
  baseUrl?: string;
  model: string;
  apiKey?: string; // used for frontend transfer, not saved in sqlite
}

export type AppLanguage = 'zh-CN' | 'en-US';

export interface ElectronAPI {
  // System and Window capabilities
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  // Storage and config capabilities
  storage: {
    saveConnection: (config: ConnectionConfig) => Promise<string>;
    getConnections: () => Promise<ConnectionConfig[]>;
    deleteConnection: (id: string) => Promise<void>;
    listSqlScripts: (connectionId: string, databaseName: string) => Promise<SqlScript[]>;
    getSqlScript: (scriptId: string) => Promise<SqlScript | null>;
    saveSqlScript: (input: SqlScriptInput) => Promise<SqlScript>;
    deleteSqlScript: (scriptId: string) => Promise<void>;
  };
  // Database capabilities
  db: {
    testConnection: (config: ConnectionConfig | { id: string }) => Promise<boolean>;
    connect: (id: string) => Promise<void>;
    disconnect: (id: string) => Promise<void>;
    executeQuery: (id: string, sql: string) => Promise<QueryResult>;
    getTableEditMetadata: (id: string, table: PreviewTableRef) => Promise<TableEditMetadata>;
    executeBatch: (id: string, statements: string[]) => Promise<BatchExecutionResult>;
    killQuery: (id: string) => Promise<void>;
    getExecutionStatus: (id: string) => Promise<'idle' | 'executing'>;
    getDatabases: (id: string) => Promise<string[]>;
    getSchemas: (id: string, database?: string) => Promise<string[]>;
    getTables: (id: string, database?: string, schema?: string) => Promise<string[]>;
    getColumns: (id: string, database?: string, schema?: string, table?: string) => Promise<{name: string, type: string}[]>;
    buildSchemaIndex: (id: string, database?: string, schema?: string) => Promise<CompletionSchemaIndex | null>;
    getSchemaIndex: (id: string, database?: string, schema?: string) => Promise<CompletionSchemaIndex | null>;
    refreshSchemaIndex: (id: string, database?: string, schema?: string) => Promise<CompletionSchemaIndex | null>;
  };
  // Test interface
  system: {
    ping: () => Promise<string>;
    verifyStorage: () => Promise<StorageVerificationResult[]>;
  };
  // Settings capabilities
  settings: {
    saveApiKey: (provider: string, apiKey: string) => Promise<void>;
    getApiKey: (provider: string) => Promise<string | null>;
    savePrivacyConsent: (consented: boolean) => Promise<void>;
    getPrivacyConsent: () => Promise<boolean>;
    getAppLanguage: () => Promise<AppLanguage>;
    setAppLanguage: (language: AppLanguage) => Promise<void>;
    getLlmProviders: () => Promise<LlmProvider[]>;
    saveLlmProviders: (providers: LlmProvider[]) => Promise<void>;
    getActiveLlmProvider: () => Promise<string | null>;
    setActiveLlmProvider: (id: string) => Promise<void>;
  };
  // Agent capabilities
  agent: {
    generateSql: (prompt: string, context: { dbType: string, schemaDDL: string }, providerId?: string) => Promise<{ sql: string | null; explanation: string; riskLevel: 'ReadOnly' | 'Dangerous' }>;
  };
}
