import { connectionManager } from '../db/connection-manager';
import { SchemaIndex, TableMetadata } from './types';

export class SchemaIndexer {
  // In-memory index: connectionId -> schemaKey -> SchemaIndex
  private indices: Map<string, Map<string, SchemaIndex>> = new Map();

  /**
   * Generates a unique key for the database/schema combination
   */
  private getSchemaKey(database: string, schema?: string): string {
    return schema ? `${database}.${schema}` : database;
  }

  /**
   * Builds the DDL representation of a table for LLM context
   */
  private buildTableDDL(table: TableMetadata): string {
    let ddl = `CREATE TABLE ${table.name} (\n`;
    const colDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (col.comment) {
        // Sanitize comment to avoid breaking DDL
        const safeComment = col.comment.replace(/'/g, "''").replace(/\n/g, ' ');
        def += ` COMMENT '${safeComment}'`;
      }
      return def;
    });
    ddl += colDefs.join(',\n');
    ddl += '\n)';
    if (table.comment) {
      const safeComment = table.comment.replace(/'/g, "''").replace(/\n/g, ' ');
      ddl += ` COMMENT='${safeComment}'`;
    }
    ddl += ';';
    return ddl;
  }

  /**
   * Fetches metadata and builds the local search index
   */
  public async buildIndex(connectionId: string, database: string, schema?: string): Promise<void> {
    const config = connectionManager.getConfigFromStorage(connectionId);
    const dbType = config.dbType;
    
    // Ensure we are connected
    const driver = connectionManager.getConnection(connectionId);
    
    const targetDb = database || config.database;
    if (!targetDb) {
      throw new Error('Database is required for indexing');
    }

    const tables = new Map<string, TableMetadata>();

    // Escape helper for basic SQL injection prevention in metadata queries
    const escapeStr = (str: string) => str.replace(/'/g, "''");
    const getString = (value: unknown) => typeof value === 'string' ? value : String(value ?? '');
    const getOptionalString = (value: unknown) => value == null ? undefined : getString(value);

    try {
      if (dbType === 'mysql') {
        // Fetch tables
        const tableSql = `
          SELECT table_name as tableName, table_comment as tableComment
          FROM information_schema.tables 
          WHERE table_schema = '${escapeStr(targetDb)}'
        `;
        const tableRes = await driver.executeQuery(tableSql);
        for (const row of tableRes.rows) {
          const tableName = getString(row.tableName);
          tables.set(tableName, {
            name: tableName,
            comment: getOptionalString(row.tableComment),
            columns: []
          });
        }

        // Fetch columns
        const colSql = `
          SELECT table_name as tableName, column_name as columnName, data_type as dataType, column_comment as columnComment
          FROM information_schema.columns 
          WHERE table_schema = '${escapeStr(targetDb)}'
          ORDER BY ordinal_position
        `;
        const colRes = await driver.executeQuery(colSql);
        for (const row of colRes.rows) {
          const table = tables.get(getString(row.tableName));
          if (table) {
            table.columns.push({
              name: getString(row.columnName),
              type: getString(row.dataType),
              comment: getOptionalString(row.columnComment)
            });
          }
        }
      } else if (dbType === 'postgres') {
        const targetSchema = schema || 'public';
        
        // Fetch tables
        const tableSql = `
          SELECT c.relname as tableName, obj_description(c.oid) as tableComment
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r', 'v', 'p') AND n.nspname = '${escapeStr(targetSchema)}'
        `;
        const tableRes = await driver.executeQuery(tableSql);
        for (const row of tableRes.rows) {
          const tableName = getString(row.tablename);
          tables.set(tableName, {
            name: tableName,
            comment: getOptionalString(row.tablecomment),
            columns: []
          });
        }

        // Fetch columns
        const colSql = `
          SELECT c.relname as tableName, a.attname as columnName, 
                 pg_catalog.format_type(a.atttypid, a.atttypmod) as dataType, 
                 col_description(a.attrelid, a.attnum) as columnComment
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE a.attnum > 0 AND NOT a.attisdropped 
            AND c.relkind IN ('r', 'v', 'p') 
            AND n.nspname = '${escapeStr(targetSchema)}'
          ORDER BY a.attnum
        `;
        const colRes = await driver.executeQuery(colSql);
        for (const row of colRes.rows) {
          const table = tables.get(getString(row.tablename));
          if (table) {
            table.columns.push({
              name: getString(row.columnname),
              type: getString(row.datatype),
              comment: getOptionalString(row.columncomment)
            });
          }
        }
      } else if (dbType === 'clickhouse') {
        const tableSql = `
          SELECT name as tableName, comment as tableComment
          FROM system.tables
          WHERE database = '${escapeStr(targetDb)}'
        `;
        const tableRes = await driver.executeQuery(tableSql);
        for (const row of tableRes.rows) {
          const tableName = getString(row.tableName);
          tables.set(tableName, {
            name: tableName,
            comment: getOptionalString(row.tableComment),
            columns: []
          });
        }

        const colSql = `
          SELECT table as tableName, name as columnName, type as dataType, comment as columnComment
          FROM system.columns
          WHERE database = '${escapeStr(targetDb)}'
        `;
        const colRes = await driver.executeQuery(colSql);
        for (const row of colRes.rows) {
          const table = tables.get(getString(row.tableName));
          if (table) {
            table.columns.push({
              name: getString(row.columnName),
              type: getString(row.dataType),
              comment: getOptionalString(row.columnComment)
            });
          }
        }
      } else if (dbType === 'mssql') {
        const targetSchema = schema || 'dbo';
        const tableSql = `
          SELECT t.name as tableName, CAST(ep.value AS NVARCHAR(MAX)) as tableComment
          FROM sys.tables t
          JOIN sys.schemas s ON s.schema_id = t.schema_id
          LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
          WHERE s.name = '${escapeStr(targetSchema)}'
        `;
        const tableRes = await driver.executeQuery(tableSql);
        for (const row of tableRes.rows) {
          const tableName = getString(row.tableName);
          tables.set(tableName, {
            name: tableName,
            comment: getOptionalString(row.tableComment),
            columns: []
          });
        }

        const colSql = `
          SELECT tbl.name as tableName, c.name as columnName, ty.name as dataType, CAST(ep.value AS NVARCHAR(MAX)) as columnComment
          FROM sys.columns c
          JOIN sys.tables tbl ON tbl.object_id = c.object_id
          JOIN sys.schemas s ON s.schema_id = tbl.schema_id
          JOIN sys.types ty ON ty.user_type_id = c.user_type_id
          LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
          WHERE s.name = '${escapeStr(targetSchema)}'
          ORDER BY c.column_id
        `;
        const colRes = await driver.executeQuery(colSql);
        for (const row of colRes.rows) {
          const table = tables.get(getString(row.tableName));
          if (table) {
            table.columns.push({
              name: getString(row.columnName),
              type: getString(row.dataType),
              comment: getOptionalString(row.columnComment)
            });
          }
        }
      } else if (dbType === 'sqlite') {
        const tableNames = await driver.getTables(targetDb);

        for (const tableName of tableNames) {
          tables.set(tableName, {
            name: tableName,
            columns: []
          });
        }

        for (const tableName of tableNames) {
          const columnRows = await driver.getColumns(targetDb, undefined, tableName);
          const table = tables.get(tableName);
          if (!table) {
            continue;
          }

          for (const column of columnRows) {
            table.columns.push({
              name: getString(column.name),
              type: getString(column.type),
            });
          }
        }
      }

      // Build DDL for each table
      for (const [, tableData] of tables.entries()) {
        tableData.ddl = this.buildTableDDL(tableData);
      }

      const schemaKey = this.getSchemaKey(targetDb, schema);
      let connIndices = this.indices.get(connectionId);
      if (!connIndices) {
        connIndices = new Map();
        this.indices.set(connectionId, connIndices);
      }

      connIndices.set(schemaKey, {
        database: targetDb,
        schema,
        tables,
        lastUpdated: Date.now()
      });
      
      console.log(`Indexed ${tables.size} tables for ${schemaKey}`);
    } catch (error) {
      console.error(`Failed to build schema index for ${targetDb}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves the indexed schema for a connection
   */
  public getIndex(connectionId: string, database: string, schema?: string): SchemaIndex | undefined {
    const connIndices = this.indices.get(connectionId);
    if (!connIndices) return undefined;
    return connIndices.get(this.getSchemaKey(database, schema));
  }
}

export const schemaIndexer = new SchemaIndexer();
