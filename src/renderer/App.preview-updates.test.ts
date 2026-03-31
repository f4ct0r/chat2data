import { describe, expect, it } from 'vitest';
import type { ConnectionConfig } from '../shared/types';
import { buildPreviewUpdates } from './features/preview-updates';
import type { ResolvedPreviewTarget } from './features/table-preview';

describe('buildPreviewUpdates', () => {
  const selectedConnection: ConnectionConfig = {
    id: 'conn-1',
    name: 'Primary DB',
    dbType: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'tester',
    database: 'analytics',
  };

  const target: ResolvedPreviewTarget = {
    createTab: false,
    targetTabId: 'sql-1',
    sql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
    requestId: 'preview:conn-1:users:1',
    previewTable: {
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
      table: 'users',
      previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
    },
  };

  it('keeps previewTable metadata when preparing updates for a reused sql tab', () => {
    expect(
      buildPreviewUpdates({
        target,
        request: {
          connectionId: 'conn-1',
          dbType: 'postgres',
          database: 'analytics',
          schema: 'public',
          table: 'users',
        },
        selectedConnection,
      })
    ).toMatchObject({
      content: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
      database: 'analytics',
      schema: 'public',
      pendingPreviewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
      pendingPreviewRequestId: 'preview:conn-1:users:1',
      previewTable: {
        table: 'users',
        previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
      },
    });
  });
});
