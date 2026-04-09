# Query Export Design

## Goal

Allow users to export a single read-only query result set as a complete dataset, without the existing `LIMIT 1000` protection, while keeping memory usage bounded and exposing progress plus cancellation.

## Scope

- Export from the current SQL execution target in `SqlWorkspace`
- Support `xlsx`, `csv`, `json`, and `tsv`
- Re-run the export query through a dedicated export connection instead of reusing the preview grid result
- Stream rows from the database to disk to avoid buffering the full result set in memory
- Show export progress, current phase, written row count, and allow cancellation
- Split oversized Excel exports across multiple worksheets automatically

## Out of Scope

- Exporting multiple statements or multiple result sets in one operation
- Exporting dangerous or write SQL
- Reusing the current interactive connection for background exports
- Rich Excel styling, formulas, charts, or templated report generation
- Persisting export history

## Constraints

- The interactive query path currently injects `LIMIT 1000` for `SELECT`; export must bypass that path entirely
- Export cancellation must not kill the user's foreground query
- Export must not accumulate the full result set in renderer or main-process memory
- `xlsx` requires streaming writes and automatic sheet rollover past Excel's row limit

## Interaction

1. User clicks export in `SqlWorkspace`
2. The renderer validates that the selected SQL resolves to exactly one read-only statement
3. Main process prompts for target file path and starts a background export job
4. The job opens a dedicated database connection, streams rows, and writes them incrementally to a temp file
5. Renderer polls job status to show progress and offer cancellation
6. On success, the temp file is finalized to the selected path; on failure or cancellation, partial output is cleaned up

## Architecture

- Add a shared export contract for formats, job status, and IPC payloads
- Add a main-process export service that owns job lifecycle, temp files, progress snapshots, and cancellation
- Extend database adapters with a streaming export interface that emits columns once and rows in bounded batches
- Keep export writers format-specific but behind one narrow interface so the service can stay format-agnostic
- Use a detached connection per export job to isolate cancellation and long-running reads from interactive work

## Data Flow

- Renderer resolves the current executable SQL and calls `startQueryExport`
- Main process validates the request, opens a save dialog, creates a job, and starts export work asynchronously
- The export service creates a temporary driver from stored connection config
- The driver streams columns and rows into a writer:
  - `csv` / `tsv`: escaped line writer
  - `json`: streaming array writer
  - `xlsx`: ExcelJS streaming workbook writer with sheet rollover
- The service updates a lightweight in-memory snapshot that the renderer polls

## Error Handling

- Reject empty SQL, multi-statement SQL, or dangerous SQL before any file work starts
- Surface save-dialog cancellation as a no-op instead of an error
- Mark jobs as `failed` with a user-facing message when the driver, writer, or filesystem fails
- Abort the detached driver and remove temp files on cancellation
- Keep export status available after terminal completion so the renderer can show the final result

## Testing

- Shared contract tests for IPC channels and export SQL validation
- Export service tests with fake streaming drivers covering success, cancellation, JSON/CSV/TSV output, and XLSX sheet rollover
- Main/preload contract tests for the new IPC surface
- Renderer tests for export controls and progress display state
