import type {
  ConnectionConfig,
  PreviewTableRef,
} from '../../shared/types';

export interface TablePreviewRequest {
  connectionId: string;
  dbType: ConnectionConfig['dbType'];
  database?: string;
  schema?: string;
  table: string;
  limit?: number;
}

export interface PreviewTabCandidate {
  id: string;
  type: 'sql' | 'chat';
  connectionId: string;
  dbType?: ConnectionConfig['dbType'];
  database?: string;
  schema?: string;
}

export interface PreviewTabDraft {
  title: string;
  type: 'sql';
  connectionId: string;
  dbType?: ConnectionConfig['dbType'];
  database?: string;
  schema?: string;
  completionCacheStatus: 'idle';
  previewTable: PreviewTableRef;
}

interface ResolvePreviewTargetParams {
  tabs: PreviewTabCandidate[];
  activeTabId: string | null;
  request: TablePreviewRequest;
  selectedConnection: ConnectionConfig;
}

interface ResolvedExistingPreviewTarget {
  createTab: false;
  targetTabId: string;
  sql: string;
  requestId: string;
  previewTable: PreviewTableRef;
}

interface ResolvedNewPreviewTarget {
  createTab: true;
  newTab: PreviewTabDraft;
  sql: string;
  requestId: string;
  previewTable: PreviewTableRef;
}

export type ResolvedPreviewTarget =
  | ResolvedExistingPreviewTarget
  | ResolvedNewPreviewTarget;

const quoteIdentifier = (
  identifier: string,
  dbType: ConnectionConfig['dbType']
) => {
  switch (dbType) {
    case 'mysql':
    case 'clickhouse':
      return `\`${identifier.replace(/`/g, '``')}\``;
    case 'mssql':
      return `[${identifier.replace(/]/g, ']]')}]`;
    case 'postgres':
    default:
      return `"${identifier.replace(/"/g, '""')}"`;
  }
};

const getPreviewPath = (request: TablePreviewRequest) => {
  const segments = [request.database, request.schema, request.table].filter(
    (segment): segment is string => Boolean(segment)
  );

  if (
    (request.dbType === 'mysql' || request.dbType === 'clickhouse') &&
    request.database &&
    request.schema === request.database
  ) {
    return [request.database, request.table];
  }

  return segments;
};

const getDefaultSchemaForDbType = (
  dbType: ConnectionConfig['dbType'],
  database?: string
) => {
  switch (dbType) {
    case 'postgres':
      return 'public';
    case 'mssql':
      return 'dbo';
    case 'mysql':
    case 'clickhouse':
      return database;
    default:
      return undefined;
  }
};

const buildPreviewTableRef = (
  dbType: ConnectionConfig['dbType'],
  previewSql: string,
  table: string,
  database?: string,
  schema?: string
): PreviewTableRef => ({
  dbType,
  database,
  schema,
  table,
  previewSql,
});

export const buildPreviewTableSql = (request: TablePreviewRequest) => {
  const limit = request.limit ?? 100;
  const qualifiedTable = getPreviewPath(request)
    .map((segment) => quoteIdentifier(segment, request.dbType))
    .join('.');

  if (request.dbType === 'mssql') {
    return `SELECT TOP ${limit} * FROM ${qualifiedTable}`;
  }

  return `SELECT * FROM ${qualifiedTable} LIMIT ${limit}`;
};

export const resolvePreviewTarget = ({
  tabs,
  activeTabId,
  request,
  selectedConnection,
}: ResolvePreviewTargetParams): ResolvedPreviewTarget => {
  const sql = buildPreviewTableSql(request);
  const requestId = `preview:${request.connectionId}:${request.table}:${Date.now()}`;
  const database = request.database ?? selectedConnection.database;
  const schema =
    request.schema ??
    getDefaultSchemaForDbType(selectedConnection.dbType, database);
  const previewTable = buildPreviewTableRef(
    selectedConnection.dbType,
    sql,
    request.table,
    database,
    schema
  );
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  if (
    activeTab &&
    activeTab.type === 'sql' &&
    activeTab.connectionId === request.connectionId
  ) {
    return {
      createTab: false,
      targetTabId: activeTab.id,
      sql,
      requestId,
      previewTable,
    };
  }

  return {
    createTab: true,
    sql,
    requestId,
    previewTable,
    newTab: {
      title: request.table,
      type: 'sql',
      connectionId: request.connectionId,
      dbType: selectedConnection.dbType,
      database,
      schema,
      completionCacheStatus: 'idle',
      previewTable,
    },
  };
};
