import { describe, expect, it } from 'vitest';
import type { ConnectionConfig, TabData } from '../../../shared/types';
import {
  buildScriptTabDraft,
  buildSqlTabFromScript,
  findOpenScriptTab,
} from './script-tab-routing';

describe('script tab routing', () => {
  const selectedConnection: ConnectionConfig = {
    id: 'conn-1',
    name: 'Analytics',
    dbType: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'tester',
    database: 'analytics',
  };

  it('finds an already open saved script tab by script id', () => {
    const tabs: TabData[] = [
      {
        id: 'sql-1',
        title: 'SQL',
        type: 'sql',
        connectionId: 'conn-1',
      },
      {
        id: 'script-1',
        title: 'Daily Summary',
        type: 'script',
        connectionId: 'conn-1',
        scriptId: 'saved-script-1',
        scriptDatabaseName: 'analytics',
      },
    ];

    expect(findOpenScriptTab(tabs, 'saved-script-1')).toMatchObject({
      id: 'script-1',
      scriptId: 'saved-script-1',
    });
  });

  it('builds script tabs with database-scoped context', () => {
    expect(
      buildScriptTabDraft({
        selectedConnection,
        databaseName: 'analytics',
        title: 'Daily Summary',
        scriptId: 'script-1',
      })
    ).toMatchObject({
      title: 'Daily Summary',
      type: 'script',
      connectionId: 'conn-1',
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
      scriptId: 'script-1',
      scriptDatabaseName: 'analytics',
    });
  });

  it('builds SQL tabs from rendered scripts and marks execute-now requests', () => {
    expect(
      buildSqlTabFromScript({
        selectedConnection,
        databaseName: 'analytics',
        title: 'Rendered Script',
        sql: 'SELECT * FROM users',
        executeNow: true,
      })
    ).toMatchObject({
      title: 'Rendered Script',
      type: 'sql',
      connectionId: 'conn-1',
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
      content: 'SELECT * FROM users',
      completionCacheStatus: 'idle',
      pendingAutoExecute: {
        kind: 'script-execute-now',
      },
    });
  });
});
