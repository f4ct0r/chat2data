import { createWriteStream, WriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import ExcelJS from 'exceljs';
import { QueryExportFormat, QueryRow } from '../../shared/types';

const EXCEL_MAX_DATA_ROWS_PER_SHEET = 1_048_575;

export interface QueryExportWriterMetrics {
  writtenRows: number;
  writtenBytes: number;
  sheetCount: number;
}

export interface QueryExportWriter {
  onColumns(columns: string[]): Promise<void>;
  onRows(rows: QueryRow[]): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
  getMetrics(): QueryExportWriterMetrics;
}

interface CreateQueryExportWriterOptions {
  filePath: string;
  format: QueryExportFormat;
  xlsxMaxRowsPerSheet?: number;
}

const createAbortError = () => {
  const error = new Error('Export cancelled');
  error.name = 'AbortError';
  return error;
};

const writeChunk = async (stream: WriteStream, chunk: string) =>
  new Promise<void>((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const normalizeJsonValue = (value: unknown): unknown => {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        normalizeJsonValue(entryValue),
      ])
    );
  }

  return value;
};

const normalizeTabularValue = (value: unknown) => {
  const normalized = normalizeJsonValue(value);

  if (normalized === null) {
    return null;
  }

  if (typeof normalized === 'object') {
    return JSON.stringify(normalized);
  }

  return normalized;
};

const escapeDelimitedValue = (value: unknown, delimiter: string) => {
  const normalized = normalizeTabularValue(value);
  if (normalized === null) {
    return '';
  }

  const text = String(normalized);
  if (
    text.includes(delimiter)
    || text.includes('"')
    || text.includes('\n')
    || text.includes('\r')
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
};

class DelimitedExportWriter implements QueryExportWriter {
  private readonly stream: WriteStream;

  private columns: string[] | null = null;

  private writtenRows = 0;

  constructor(
    filePath: string,
    private readonly delimiter: string
  ) {
    this.stream = createWriteStream(filePath, { encoding: 'utf8' });
  }

  async onColumns(columns: string[]): Promise<void> {
    this.columns = columns;
    await writeChunk(
      this.stream,
      `${columns.map((column) => escapeDelimitedValue(column, this.delimiter)).join(this.delimiter)}\n`
    );
  }

  async onRows(rows: QueryRow[]): Promise<void> {
    if (!this.columns) {
      throw new Error('Cannot write rows before columns are defined');
    }

    const lines = rows
      .map((row) =>
        this.columns!
          .map((column) => escapeDelimitedValue(row[column], this.delimiter))
          .join(this.delimiter)
      )
      .join('\n');

    if (!lines) {
      return;
    }

    await writeChunk(this.stream, `${lines}\n`);
    this.writtenRows += rows.length;
  }

  async close(): Promise<void> {
    this.stream.end();
    await finished(this.stream);
  }

  async abort(): Promise<void> {
    this.stream.destroy(createAbortError());

    try {
      await finished(this.stream);
    } catch {
      // ignore
    }
  }

  getMetrics(): QueryExportWriterMetrics {
    return {
      writtenRows: this.writtenRows,
      writtenBytes: this.stream.bytesWritten,
      sheetCount: 1,
    };
  }
}

class JsonExportWriter implements QueryExportWriter {
  private readonly stream: WriteStream;

  private columns: string[] | null = null;

  private isFirstRow = true;

  private writtenRows = 0;

  constructor(filePath: string) {
    this.stream = createWriteStream(filePath, { encoding: 'utf8' });
  }

  async onColumns(columns: string[]): Promise<void> {
    this.columns = columns;
    await writeChunk(this.stream, '[');
  }

  async onRows(rows: QueryRow[]): Promise<void> {
    if (!this.columns) {
      throw new Error('Cannot write rows before columns are defined');
    }

    for (const row of rows) {
      const normalizedRow = Object.fromEntries(
        this.columns.map((column) => [column, normalizeJsonValue(row[column])])
      );
      const prefix = this.isFirstRow ? '' : ',';
      await writeChunk(this.stream, `${prefix}${JSON.stringify(normalizedRow)}`);
      this.isFirstRow = false;
      this.writtenRows += 1;
    }
  }

  async close(): Promise<void> {
    if (!this.columns) {
      await writeChunk(this.stream, '[');
    }

    await writeChunk(this.stream, ']');
    this.stream.end();
    await finished(this.stream);
  }

  async abort(): Promise<void> {
    this.stream.destroy(createAbortError());

    try {
      await finished(this.stream);
    } catch {
      // ignore
    }
  }

  getMetrics(): QueryExportWriterMetrics {
    return {
      writtenRows: this.writtenRows,
      writtenBytes: this.stream.bytesWritten,
      sheetCount: 1,
    };
  }
}

class XlsxExportWriter implements QueryExportWriter {
  private readonly stream: WriteStream;

  private readonly workbook: ExcelJS.stream.xlsx.WorkbookWriter;

  private columns: string[] = [];

  private worksheet: ExcelJS.Worksheet | null = null;

  private dataRowsInSheet = 0;

  private writtenRows = 0;

  private sheetCount = 0;

  constructor(
    filePath: string,
    private readonly maxRowsPerSheet: number
  ) {
    this.stream = createWriteStream(filePath);
    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: this.stream,
      useSharedStrings: false,
      useStyles: false,
    });
  }

  private openWorksheet() {
    if (this.worksheet) {
      this.worksheet.commit();
    }

    this.sheetCount += 1;
    this.worksheet = this.workbook.addWorksheet(`Results ${this.sheetCount}`);
    this.worksheet.addRow(this.columns).commit();
    this.dataRowsInSheet = 0;
  }

  async onColumns(columns: string[]): Promise<void> {
    this.columns = columns;
    this.openWorksheet();
  }

  async onRows(rows: QueryRow[]): Promise<void> {
    if (!this.worksheet) {
      throw new Error('Cannot write rows before columns are defined');
    }

    for (const row of rows) {
      if (this.dataRowsInSheet >= this.maxRowsPerSheet) {
        this.openWorksheet();
      }

      this.worksheet.addRow(
        this.columns.map((column) => normalizeTabularValue(row[column]))
      ).commit();
      this.dataRowsInSheet += 1;
      this.writtenRows += 1;
    }
  }

  async close(): Promise<void> {
    if (this.worksheet) {
      this.worksheet.commit();
    }

    await this.workbook.commit();
    await finished(this.stream);
  }

  async abort(): Promise<void> {
    this.stream.destroy(createAbortError());

    try {
      await finished(this.stream);
    } catch {
      // ignore
    }
  }

  getMetrics(): QueryExportWriterMetrics {
    return {
      writtenRows: this.writtenRows,
      writtenBytes: this.stream.bytesWritten,
      sheetCount: this.sheetCount,
    };
  }
}

export const createQueryExportWriter = ({
  filePath,
  format,
  xlsxMaxRowsPerSheet = EXCEL_MAX_DATA_ROWS_PER_SHEET,
}: CreateQueryExportWriterOptions): QueryExportWriter => {
  switch (format) {
    case 'csv':
      return new DelimitedExportWriter(filePath, ',');
    case 'tsv':
      return new DelimitedExportWriter(filePath, '\t');
    case 'json':
      return new JsonExportWriter(filePath);
    case 'xlsx':
      return new XlsxExportWriter(filePath, xlsxMaxRowsPerSheet);
    default:
      throw new Error(`Unsupported export format: ${format satisfies never}`);
  }
};
