import type { ConnectionConfig, TabData } from '../../../shared/types';
import { getDefaultSchemaForDbType } from '../../store/tabStore';

type ScriptTabConnectionContext = Pick<ConnectionConfig, 'id' | 'dbType' | 'database'>;

interface BuildScriptTabDraftParams {
  selectedConnection: ScriptTabConnectionContext;
  databaseName: string;
  title: string;
  scriptId?: string;
}

interface BuildSqlTabFromScriptParams {
  selectedConnection: ScriptTabConnectionContext;
  databaseName: string;
  title: string;
  sql: string;
  executeNow?: boolean;
}

export const findOpenScriptTab = (tabs: TabData[], scriptId: string) =>
  tabs.find((tab) => tab.type === 'script' && tab.scriptId === scriptId);

export const buildScriptTabDraft = ({
  selectedConnection,
  databaseName,
  title,
  scriptId,
}: BuildScriptTabDraftParams): Omit<TabData, 'id'> => ({
  title,
  type: 'script',
  connectionId: selectedConnection.id,
  dbType: selectedConnection.dbType,
  database: databaseName,
  schema: getDefaultSchemaForDbType(selectedConnection.dbType, databaseName),
  scriptId,
  scriptDatabaseName: databaseName,
});

export const buildSqlTabFromScript = ({
  selectedConnection,
  databaseName,
  title,
  sql,
  executeNow = false,
}: BuildSqlTabFromScriptParams): Omit<TabData, 'id'> => ({
  title,
  type: 'sql',
  connectionId: selectedConnection.id,
  dbType: selectedConnection.dbType,
  content: sql,
  database: databaseName,
  schema: getDefaultSchemaForDbType(selectedConnection.dbType, databaseName),
  completionCacheStatus: 'idle',
  pendingAutoExecute: executeNow,
});
