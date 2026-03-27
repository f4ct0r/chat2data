export interface ColumnMetadata {
  name: string;
  type: string;
  comment?: string;
}

export interface TableMetadata {
  name: string;
  comment?: string;
  columns: ColumnMetadata[];
  // For context building, we can store a pre-formatted DDL or description
  ddl?: string;
}

export interface SchemaIndex {
  database: string;
  schema?: string;
  tables: Map<string, TableMetadata>;
  lastUpdated: number;
}
