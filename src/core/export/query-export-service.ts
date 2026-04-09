import { rename, rm } from 'node:fs/promises';
import { connectionManager } from '../db/connection-manager';
import { DatabaseDriver } from '../db/types';
import {
  QueryExportFormat,
  QueryExportJobSnapshot,
} from '../../shared/types';
import { validateQueryExportSql } from '../../shared/query-export';
import { createQueryExportWriter } from './export-format-writers';

interface StartQueryExportInput {
  connectionId: string;
  sql: string;
  format: QueryExportFormat;
  filePath: string;
}

interface QueryExportServiceOptions {
  createDetachedDriver?: (connectionId: string) => Promise<DatabaseDriver>;
  now?: () => number;
  createJobId?: () => string;
  xlsxMaxRowsPerSheet?: number;
}

interface QueryExportJobRecord {
  snapshot: QueryExportJobSnapshot;
  abortController: AbortController;
  driver: DatabaseDriver | null;
}

const createAbortError = () => {
  const error = new Error('Export cancelled');
  error.name = 'AbortError';
  return error;
};

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';

const createTempFilePath = (filePath: string, jobId: string) =>
  `${filePath}.part-${jobId}`;

export class QueryExportService {
  private readonly jobs = new Map<string, QueryExportJobRecord>();

  private readonly createDetachedDriver: (connectionId: string) => Promise<DatabaseDriver>;

  private readonly now: () => number;

  private readonly createJobId: () => string;

  private readonly xlsxMaxRowsPerSheet: number;

  constructor({
    createDetachedDriver = (connectionId: string) =>
      connectionManager.createDetachedDriver(connectionId),
    now = () => Date.now(),
    createJobId = () => globalThis.crypto.randomUUID(),
    xlsxMaxRowsPerSheet,
  }: QueryExportServiceOptions = {}) {
    this.createDetachedDriver = createDetachedDriver;
    this.now = now;
    this.createJobId = createJobId;
    this.xlsxMaxRowsPerSheet = xlsxMaxRowsPerSheet ?? 1_048_575;
  }

  public getQueryExportStatus(jobId: string): QueryExportJobSnapshot | null {
    const record = this.jobs.get(jobId);
    if (!record) {
      return null;
    }

    return {
      ...record.snapshot,
    };
  }

  public async startQueryExport({
    connectionId,
    sql,
    format,
    filePath,
  }: StartQueryExportInput): Promise<QueryExportJobSnapshot> {
    const validation = validateQueryExportSql(sql);
    if (!validation.ok) {
      if (validation.code === 'notReadOnly') {
        throw new Error(`Export only supports read-only SQL. Received ${validation.operation ?? 'UNKNOWN'}.`);
      }

      if (validation.code === 'multipleStatements') {
        throw new Error('Export only supports a single SQL statement.');
      }

      throw new Error('Export SQL cannot be empty.');
    }

    const jobId = this.createJobId();
    const startedAt = this.now();
    const snapshot: QueryExportJobSnapshot = {
      id: jobId,
      connectionId,
      format,
      state: 'running',
      phase: 'preparing',
      filePath,
      writtenRows: 0,
      writtenBytes: 0,
      sheetCount: format === 'xlsx' ? 0 : 1,
      cancellationRequested: false,
      startedAt,
      updatedAt: startedAt,
    };
    const record: QueryExportJobRecord = {
      snapshot,
      abortController: new AbortController(),
      driver: null,
    };

    this.jobs.set(jobId, record);
    void this.runQueryExportJob(record, validation.statementSql);

    return {
      ...snapshot,
    };
  }

  public async cancelQueryExport(jobId: string): Promise<QueryExportJobSnapshot | null> {
    const record = this.jobs.get(jobId);
    if (!record) {
      return null;
    }

    if (record.snapshot.state !== 'running') {
      return {
        ...record.snapshot,
      };
    }

    record.snapshot.cancellationRequested = true;
    record.snapshot.updatedAt = this.now();
    record.abortController.abort(createAbortError());

    try {
      await record.driver?.killQuery?.();
    } catch {
      // ignore cancellation errors, final job status handles the outcome
    }

    return {
      ...record.snapshot,
    };
  }

  private async runQueryExportJob(
    record: QueryExportJobRecord,
    statementSql: string
  ) {
    const tempFilePath = createTempFilePath(record.snapshot.filePath, record.snapshot.id);
    const writer = createQueryExportWriter({
      filePath: tempFilePath,
      format: record.snapshot.format,
      xlsxMaxRowsPerSheet: this.xlsxMaxRowsPerSheet,
    });

    try {
      record.driver = await this.createDetachedDriver(record.snapshot.connectionId);

      if (!record.driver.streamQuery) {
        throw new Error('This database driver does not support streaming exports.');
      }

      record.snapshot.phase = 'streaming';
      record.snapshot.updatedAt = this.now();

      await record.driver.streamQuery(
        statementSql,
        {
          onColumns: async (columns) => {
            await writer.onColumns(columns);
            this.syncWriterMetrics(record, writer);
          },
          onRows: async (rows) => {
            if (record.abortController.signal.aborted) {
              throw createAbortError();
            }

            await writer.onRows(rows);
            this.syncWriterMetrics(record, writer);
          },
        },
        {
          signal: record.abortController.signal,
        }
      );

      if (record.abortController.signal.aborted) {
        throw createAbortError();
      }

      record.snapshot.phase = 'finalizing';
      record.snapshot.updatedAt = this.now();

      await writer.close();
      this.syncWriterMetrics(record, writer);
      await rename(tempFilePath, record.snapshot.filePath);
      this.markTerminalState(record, 'completed');
    } catch (error) {
      await writer.abort();
      await rm(tempFilePath, { force: true });

      if (isAbortError(error) || record.abortController.signal.aborted) {
        this.markTerminalState(record, 'cancelled');
      } else {
        record.snapshot.error = error instanceof Error ? error.message : String(error);
        this.markTerminalState(record, 'failed');
      }
    } finally {
      await record.driver?.disconnect().catch(() => undefined);
      record.driver = null;
    }
  }

  private syncWriterMetrics(
    record: QueryExportJobRecord,
    writer: ReturnType<typeof createQueryExportWriter>
  ) {
    const metrics = writer.getMetrics();
    record.snapshot.writtenRows = metrics.writtenRows;
    record.snapshot.writtenBytes = metrics.writtenBytes;
    record.snapshot.sheetCount = metrics.sheetCount;
    record.snapshot.updatedAt = this.now();
  }

  private markTerminalState(
    record: QueryExportJobRecord,
    state: QueryExportJobSnapshot['state']
  ) {
    const completedAt = this.now();
    record.snapshot.state = state;
    record.snapshot.completedAt = completedAt;
    record.snapshot.updatedAt = completedAt;
  }
}
