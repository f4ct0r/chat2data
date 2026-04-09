import { describe, expect, it, expectTypeOf } from 'vitest';
import { IpcChannels } from './ipc-channels';
import type {
  QueryExportFormat,
  QueryExportJobSnapshot,
  TabData,
  TabType,
} from './types';

describe('shared tab and IPC contracts', () => {
  it('supports script tabs in the shared tab type', () => {
    expectTypeOf<TabType>().toEqualTypeOf<'sql' | 'chat' | 'script'>();
  });

  it('supports script identifiers on shared tab data', () => {
    expectTypeOf<TabData>().toMatchTypeOf<{
      scriptId?: string;
      scriptDatabaseName?: string;
    }>();
  });

  it('exposes SQL script storage IPC channels', () => {
    expect(IpcChannels.STORAGE_LIST_SQL_SCRIPTS).toBe('storage:listSqlScripts');
    expect(IpcChannels.STORAGE_GET_SQL_SCRIPT).toBe('storage:getSqlScript');
    expect(IpcChannels.STORAGE_SAVE_SQL_SCRIPT).toBe('storage:saveSqlScript');
    expect(IpcChannels.STORAGE_DELETE_SQL_SCRIPT).toBe('storage:deleteSqlScript');
  });

  it('exposes query export IPC channels', () => {
    expect(IpcChannels.EXPORT_START_QUERY).toBe('export:startQuery');
    expect(IpcChannels.EXPORT_GET_QUERY_STATUS).toBe('export:getQueryStatus');
    expect(IpcChannels.EXPORT_CANCEL_QUERY).toBe('export:cancelQuery');
  });

  it('supports query export contracts', () => {
    expectTypeOf<QueryExportFormat>().toEqualTypeOf<'xlsx' | 'csv' | 'json' | 'tsv'>();
    expectTypeOf<QueryExportJobSnapshot>().toMatchTypeOf<{
      id: string;
      state: 'running' | 'completed' | 'failed' | 'cancelled';
      format: QueryExportFormat;
      writtenRows: number;
      writtenBytes: number;
      sheetCount: number;
      filePath: string;
      cancellationRequested: boolean;
    }>();
  });
});
