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
  };
  // Database capabilities
  db: {
    testConnection: (config: ConnectionConfig | { id: string }) => Promise<boolean>;
    connect: (id: string) => Promise<void>;
    disconnect: (id: string) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executeQuery: (id: string, sql: string) => Promise<any>;
    getDatabases: (id: string) => Promise<string[]>;
    getSchemas: (id: string, database?: string) => Promise<string[]>;
    getTables: (id: string, database?: string, schema?: string) => Promise<string[]>;
    getColumns: (id: string, database?: string, schema?: string, table?: string) => Promise<{name: string, type: string}[]>;
  };
  // Test interface
  system: {
    ping: () => Promise<string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verifyStorage: () => Promise<any[]>;
  };
}
