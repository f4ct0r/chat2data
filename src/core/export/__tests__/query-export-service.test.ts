import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseDriver, QueryStreamResult } from '../../db/types';
import { QueryExportService } from '../query-export-service';

const createAbortError = () => {
  const error = new Error('Export cancelled');
  error.name = 'AbortError';
  return error;
};

const waitForTerminalJob = async (
  service: QueryExportService,
  jobId: string
) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const snapshot = service.getQueryExportStatus(jobId);
    if (snapshot && snapshot.state !== 'running') {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Timed out waiting for export job ${jobId}`);
};

const createStreamingDriver = (
  rows: Array<Record<string, unknown>>,
  options: {
    columns?: string[];
    delayMs?: number;
  } = {}
) => {
  const columns = options.columns ?? Object.keys(rows[0] ?? {});

  const driver: DatabaseDriver = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue(true),
    executeQuery: vi.fn(),
    getDatabases: vi.fn().mockResolvedValue([]),
    getSchemas: vi.fn().mockResolvedValue([]),
    getTables: vi.fn().mockResolvedValue([]),
    getColumns: vi.fn().mockResolvedValue([]),
    streamQuery: vi.fn(async (_sql, sink, streamOptions): Promise<QueryStreamResult> => {
      await sink.onColumns(columns);

      for (const row of rows) {
        if (streamOptions?.signal?.aborted) {
          throw createAbortError();
        }

        await sink.onRows([row]);

        if (options.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }
      }

      return {
        rowCount: rows.length,
      };
    }),
  };

  return driver;
};

describe('QueryExportService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'chat2data-export-'));
  });

  it('streams csv exports to disk', async () => {
    const driver = createStreamingDriver([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    const service = new QueryExportService({
      createDetachedDriver: vi.fn().mockResolvedValue(driver),
    });
    const filePath = join(tempDir, 'users.csv');

    const job = await service.startQueryExport({
      connectionId: 'conn-1',
      sql: 'SELECT id, name FROM users;',
      format: 'csv',
      filePath,
    });
    const completedJob = await waitForTerminalJob(service, job.id);

    expect(completedJob.state).toBe('completed');
    expect(completedJob.writtenRows).toBe(2);
    expect(await readFile(filePath, 'utf8')).toBe('id,name\n1,Alice\n2,Bob\n');
    expect(driver.disconnect).toHaveBeenCalledTimes(1);
  });

  it('streams json exports as an array payload', async () => {
    const driver = createStreamingDriver([
      { id: 1, active: true },
      { id: 2, active: false },
    ]);
    const service = new QueryExportService({
      createDetachedDriver: vi.fn().mockResolvedValue(driver),
    });
    const filePath = join(tempDir, 'users.json');

    const job = await service.startQueryExport({
      connectionId: 'conn-2',
      sql: 'SELECT id, active FROM users;',
      format: 'json',
      filePath,
    });
    const completedJob = await waitForTerminalJob(service, job.id);

    expect(completedJob.state).toBe('completed');
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual([
      { id: 1, active: true },
      { id: 2, active: false },
    ]);
  });

  it('cleans partial files when a running export is cancelled', async () => {
    const driver = createStreamingDriver(
      Array.from({ length: 5 }, (_, index) => ({ id: index + 1 })),
      { delayMs: 20 }
    );
    const service = new QueryExportService({
      createDetachedDriver: vi.fn().mockResolvedValue(driver),
    });
    const filePath = join(tempDir, 'large.tsv');

    const job = await service.startQueryExport({
      connectionId: 'conn-3',
      sql: 'SELECT id FROM large_table;',
      format: 'tsv',
      filePath,
    });

    await service.cancelQueryExport(job.id);
    const cancelledJob = await waitForTerminalJob(service, job.id);

    expect(cancelledJob.state).toBe('cancelled');
    await expect(access(filePath)).rejects.toThrow();
  });

  it('rolls over xlsx exports into multiple sheets when the row limit is exceeded', async () => {
    const driver = createStreamingDriver([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ]);
    const service = new QueryExportService({
      createDetachedDriver: vi.fn().mockResolvedValue(driver),
      xlsxMaxRowsPerSheet: 2,
    });
    const filePath = join(tempDir, 'users.xlsx');

    const job = await service.startQueryExport({
      connectionId: 'conn-4',
      sql: 'SELECT id FROM users;',
      format: 'xlsx',
      filePath,
    });
    const completedJob = await waitForTerminalJob(service, job.id);

    expect(completedJob.state).toBe('completed');
    expect(completedJob.sheetCount).toBe(3);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Results 1',
      'Results 2',
      'Results 3',
    ]);
    expect(workbook.worksheets[0].getCell('A2').value).toBe(1);
    expect(workbook.worksheets[1].getCell('A2').value).toBe(3);
    expect(workbook.worksheets[2].getCell('A2').value).toBe(5);
  });
});
