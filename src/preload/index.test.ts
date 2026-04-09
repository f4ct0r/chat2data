import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const exposeInMainWorld = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld,
  },
  ipcRenderer: {
    invoke,
  },
}));

describe('preload bridge', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    await import('./index');
  });

  it('exposes SQL script storage methods', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith('api', expect.any(Object));
    const api = exposeInMainWorld.mock.calls[0][1] as {
      storage: {
        listSqlScripts: (connectionId: string, databaseName: string) => Promise<unknown>;
        getSqlScript: (scriptId: string) => Promise<unknown>;
        saveSqlScript: (input: unknown) => Promise<unknown>;
        deleteSqlScript: (scriptId: string) => Promise<unknown>;
      };
    };

    void api.storage.listSqlScripts('conn-1', 'db-1');
    void api.storage.getSqlScript('script-1');
    void api.storage.saveSqlScript({ id: 'script-1' });
    void api.storage.deleteSqlScript('script-1');

    expect(invoke).toHaveBeenNthCalledWith(1, 'storage:listSqlScripts', 'conn-1', 'db-1');
    expect(invoke).toHaveBeenNthCalledWith(2, 'storage:getSqlScript', 'script-1');
    expect(invoke).toHaveBeenNthCalledWith(3, 'storage:saveSqlScript', { id: 'script-1' });
    expect(invoke).toHaveBeenNthCalledWith(4, 'storage:deleteSqlScript', 'script-1');
  });

  it('exposes query export methods', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith('api', expect.any(Object));
    const api = exposeInMainWorld.mock.calls[0][1] as {
      exports: {
        startQueryExport: (
          connectionId: string,
          sql: string,
          format: string
        ) => Promise<unknown>;
        getQueryExportStatus: (jobId: string) => Promise<unknown>;
        cancelQueryExport: (jobId: string) => Promise<unknown>;
      };
    };

    void api.exports.startQueryExport('conn-1', 'SELECT 1;', 'csv');
    void api.exports.getQueryExportStatus('job-1');
    void api.exports.cancelQueryExport('job-1');

    expect(invoke).toHaveBeenNthCalledWith(1, 'export:startQuery', 'conn-1', 'SELECT 1;', 'csv');
    expect(invoke).toHaveBeenNthCalledWith(2, 'export:getQueryStatus', 'job-1');
    expect(invoke).toHaveBeenNthCalledWith(3, 'export:cancelQuery', 'job-1');
  });
});
