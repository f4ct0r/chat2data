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
  // Test interface
  system: {
    ping: () => Promise<string>;
    verifyStorage: () => Promise<any>;
  };
}
