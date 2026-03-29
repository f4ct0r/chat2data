import { describe, expect, it } from 'vitest';
import type { ConnectionConfig } from '../../shared/types';
import type { TabData } from '../store/tabStore';
import {
  buildPreviewTableSql,
  resolvePreviewTarget,
  type TablePreviewRequest,
} from './table-preview';

const baseRequest: TablePreviewRequest = {
  connectionId: 'conn-1',
  dbType: 'postgres',
  database: 'analytics',
  schema: 'public',
  table: 'users',
};

describe('buildPreviewTableSql', () => {
  it('builds a postgres preview query with quoted identifiers and LIMIT 100', () => {
    expect(buildPreviewTableSql(baseRequest)).toBe(
      'SELECT * FROM "analytics"."public"."users" LIMIT 100'
    );
  });

  it('deduplicates mysql database and schema names', () => {
    expect(
      buildPreviewTableSql({
        ...baseRequest,
        dbType: 'mysql',
        schema: 'analytics',
      })
    ).toBe('SELECT * FROM `analytics`.`users` LIMIT 100');
  });

  it('builds an mssql preview query with TOP 100', () => {
    expect(
      buildPreviewTableSql({
        ...baseRequest,
        dbType: 'mssql',
        database: 'sales',
        schema: 'dbo',
        table: 'order details',
      })
    ).toBe('SELECT TOP 100 * FROM [sales].[dbo].[order details]');
  });

  it('escapes embedded identifier quotes', () => {
    expect(
      buildPreviewTableSql({
        ...baseRequest,
        table: 'user"name',
      })
    ).toBe('SELECT * FROM "analytics"."public"."user""name" LIMIT 100');
  });
});

describe('resolvePreviewTarget', () => {
  const selectedConnection: ConnectionConfig = {
    id: 'conn-1',
    name: 'Primary DB',
    dbType: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'tester',
    database: 'analytics',
  };

  const tabs: TabData[] = [
    {
      id: 'sql-1',
      title: 'SQL 1',
      type: 'sql',
      connectionId: 'conn-1',
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
    },
    {
      id: 'chat-1',
      title: 'Chat 1',
      type: 'chat',
      connectionId: 'conn-1',
    },
  ];

  it('reuses the active sql tab for the same connection', () => {
    expect(
      resolvePreviewTarget({
        activeTabId: 'sql-1',
        tabs,
        request: baseRequest,
        selectedConnection,
      })
    ).toMatchObject({
      targetTabId: 'sql-1',
      createTab: false,
    });
  });

  it('creates a new sql tab when the active tab is not a sql workspace', () => {
    expect(
      resolvePreviewTarget({
        activeTabId: 'chat-1',
        tabs,
        request: baseRequest,
        selectedConnection,
      })
    ).toMatchObject({
      createTab: true,
      newTab: {
        type: 'sql',
        connectionId: 'conn-1',
        dbType: 'postgres',
        database: 'analytics',
        schema: 'public',
      },
    });
  });

  it('creates a new sql tab when the active sql tab belongs to another connection', () => {
    expect(
      resolvePreviewTarget({
        activeTabId: 'sql-other',
        tabs: [
          ...tabs,
          {
            id: 'sql-other',
            title: 'Other',
            type: 'sql',
            connectionId: 'conn-2',
            dbType: 'postgres',
          },
        ],
        request: baseRequest,
        selectedConnection,
      })
    ).toMatchObject({
      createTab: true,
    });
  });
});
