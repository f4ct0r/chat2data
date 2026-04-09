import { connectionManager } from '../db/connection-manager';
import { CompletionSchemaIndex, ConnectionConfig } from '../../shared/types';
import { schemaIndexer } from './schema-indexer';
import { SchemaIndex } from './types';

const DEFAULT_SCHEMA_BY_DB_TYPE: Record<ConnectionConfig['dbType'], string | undefined> = {
  mysql: undefined,
  postgres: 'public',
  mssql: 'dbo',
  clickhouse: undefined,
  sqlite: undefined,
};

class CompletionSchemaService {
  private resolveContext(connectionId: string, database?: string, schema?: string) {
    const config = connectionManager.getConfigFromStorage(connectionId);
    const resolvedDatabase = database || config.database;

    if (!resolvedDatabase) {
      throw new Error('Database is required for completion schema indexing');
    }

    const defaultSchema = DEFAULT_SCHEMA_BY_DB_TYPE[config.dbType];
    const resolvedSchema =
      schema ||
      (config.dbType === 'mysql' || config.dbType === 'clickhouse'
        ? resolvedDatabase
        : defaultSchema);

    return {
      config,
      database: resolvedDatabase,
      schema: resolvedSchema,
    };
  }

  private serializeIndex(index: SchemaIndex): CompletionSchemaIndex {
    return {
      database: index.database,
      schema: index.schema,
      lastUpdated: index.lastUpdated,
      tables: Array.from(index.tables.values()).map((table) => ({
        name: table.name,
        comment: table.comment,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          comment: column.comment,
        })),
      })),
    };
  }

  public async buildSchemaIndex(connectionId: string, database?: string, schema?: string): Promise<CompletionSchemaIndex | null> {
    const resolved = this.resolveContext(connectionId, database, schema);
    await schemaIndexer.buildIndex(connectionId, resolved.database, resolved.schema);
    return this.getSchemaIndex(connectionId, resolved.database, resolved.schema, false);
  }

  public async refreshSchemaIndex(connectionId: string, database?: string, schema?: string): Promise<CompletionSchemaIndex | null> {
    return this.buildSchemaIndex(connectionId, database, schema);
  }

  public async getSchemaIndex(
    connectionId: string,
    database?: string,
    schema?: string,
    autoBuild: boolean = true
  ): Promise<CompletionSchemaIndex | null> {
    const resolved = this.resolveContext(connectionId, database, schema);
    let index = schemaIndexer.getIndex(connectionId, resolved.database, resolved.schema);

    if (!index && autoBuild) {
      await schemaIndexer.buildIndex(connectionId, resolved.database, resolved.schema);
      index = schemaIndexer.getIndex(connectionId, resolved.database, resolved.schema);
    }

    return index ? this.serializeIndex(index) : null;
  }
}

export const completionSchemaService = new CompletionSchemaService();
