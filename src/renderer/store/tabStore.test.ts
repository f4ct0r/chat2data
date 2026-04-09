import { beforeEach, describe, expect, it } from 'vitest';
import { getDefaultSchemaForDbType, useTabStore } from './tabStore';

describe('tabStore completion context', () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
    });
  });

  it('stores sql tab completion context fields', () => {
    const tabId = useTabStore.getState().addTab({
      title: 'SQL - Analytics',
      type: 'sql',
      connectionId: 'conn-1',
      database: 'analytics',
      schema: 'public',
      completionCacheStatus: 'idle',
      previewTable: {
        dbType: 'postgres',
        database: 'analytics',
        schema: 'public',
        table: 'users',
        previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
      },
    });

    const tab = useTabStore.getState().tabs.find((entry) => entry.id === tabId);

    expect(tab).toMatchObject({
      database: 'analytics',
      schema: 'public',
      completionCacheStatus: 'idle',
      previewTable: {
        table: 'users',
        previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
      },
    });
  });

  it('returns db-specific default schemas for completion context', () => {
    expect(getDefaultSchemaForDbType('postgres', 'analytics')).toBe('public');
    expect(getDefaultSchemaForDbType('mssql', 'reporting')).toBe('dbo');
    expect(getDefaultSchemaForDbType('mysql', 'warehouse')).toBe('warehouse');
    expect(getDefaultSchemaForDbType('clickhouse', 'warehouse')).toBe('warehouse');
    expect(getDefaultSchemaForDbType('sqlite', '/tmp/warehouse.sqlite')).toBeUndefined();
  });
});
