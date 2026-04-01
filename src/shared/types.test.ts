import { describe, expect, it, expectTypeOf } from 'vitest';
import { IpcChannels } from './ipc-channels';
import type { TabData, TabType } from './types';

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
});
