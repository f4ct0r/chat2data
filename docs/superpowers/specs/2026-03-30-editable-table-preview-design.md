# Editable Table Preview Design

**Date:** 2026-03-30

## Summary

Add editable table preview support for SQL workspace result grids that originate from Object Browser table previews. Users can:

- double-click a cell to edit its value
- press `Backspace` or `Delete` on a selected cell to set it to `NULL`
- select one or more rows and press `Cmd+Backspace` or `Delete` to mark rows for deletion
- make multiple edits before execution
- preview the generated `UPDATE` and `DELETE` SQL
- confirm and execute the full batch in one action

The first version is intentionally limited to single-table preview results opened from the Object Browser. Editable mode is enabled only when the app can identify a primary key or unique key for the table.

## Goals

- Let users edit previewed table data directly from the result grid.
- Keep all edits local until the user explicitly applies them.
- Generate deterministic SQL from the final buffered state.
- Execute the full change set as one confirmed batch.
- Refresh the preview automatically after successful execution.

## Non-Goals

- Editing arbitrary `SELECT` results
- Editing join, aggregate, computed, or derived result sets
- Supporting editable results without a primary key or unique key
- Inline auto-save to the database
- Complex value editing for JSON, arrays, binary values, or other driver-specific types
- ClickHouse editable support in v1

## User Experience

### Entry Conditions

Editable mode is available only when all of the following are true:

- the active SQL tab was opened from Object Browser table preview
- the preview resolves to one physical table
- table metadata includes at least one usable primary key or unique key
- the active connection type is MySQL, PostgreSQL, or SQL Server

If any condition fails, the grid remains read-only and the UI explains why editing is unavailable.

### Grid Interaction

- Single-click a cell: select that cell
- Single-click a row number: select that row
- `Cmd/Ctrl` plus row click: add or remove a row from the current selection
- `Shift` plus row click: extend the row selection as a range
- Double-click a cell: enter edit mode
- `Enter` in edit mode: commit the edited value
- `Esc` in edit mode: cancel the current cell edit
- `Backspace` or `Delete` on a selected cell while not editing text: set that cell to `NULL`
- `Cmd+Backspace` or `Delete` with selected rows while not editing text: mark selected rows for deletion

Rows marked for deletion become read-only until the deletion mark is removed.

### Change Toolbar

When buffered changes exist, the result pane shows a compact toolbar with:

- total pending change count
- `Discard changes`
- `Apply changes`

`Apply changes` opens a confirmation dialog. The dialog shows:

- number of generated `UPDATE` statements
- number of generated `DELETE` statements
- the generated SQL preview
- final confirmation action

### Visual Feedback

- modified cells are highlighted
- cells set to `NULL` render as `NULL` with distinct styling
- deleted rows are visibly dimmed and labeled as pending deletion
- the toolbar becomes visually emphasized while unsaved changes exist

## Architecture

The feature adds an editable preview layer on top of the current Object Browser -> preview SQL -> SQL workspace result flow.

The implementation has four major parts:

1. Preview metadata propagation
2. Table edit session state in the renderer
3. SQL generation from buffered row changes
4. Batch execution support in preload/main/core

### Preview Metadata Propagation

Current preview tabs only carry the generated SQL statement. Editable preview requires stable table identity and key metadata.

The preview flow should attach table context to the SQL tab:

- database type
- database
- schema
- table
- preview SQL used for refresh

The app should also fetch edit metadata for the table:

- supported editing flag
- reason when editing is disabled
- key columns used to identify a row
- key type: primary or unique

This metadata should be stored with the tab or result state so the renderer can decide whether the active result grid is editable.

### Renderer Edit Session State

The grid must not generate SQL incrementally per keystroke. Instead, it should keep a local edit session that represents the final intended state.

Suggested concepts:

- `tableRef`: identifies the physical table
- `editableMetadata`: key columns and editing eligibility
- `rowIdentity`: stable identifier derived from original key-column values
- `originalRow`: untouched row values returned by preview query
- `pendingRow`: current row values after local edits
- `changedColumns`: columns with final pending changes
- `deleted`: whether the row is marked for deletion

Key behavior:

- editing a cell updates only the pending state
- editing the same cell multiple times keeps only the final value
- deleting a row suppresses any pending updates for that row in generated SQL
- clearing all changes resets the edit session back to the original result state

### SQL Generation

SQL generation should live in a dedicated utility module rather than inside React event handlers.

Generation rules:

- one row with pending edits produces at most one `UPDATE`
- one deleted row produces one `DELETE`
- `UPDATE SET` includes only changed columns
- `WHERE` always uses the original key values, never edited key values
- if a key column is edited, the row is still located by the original key and updated with the new key value
- if a row is deleted, only the `DELETE` is generated for that row

Statement ordering should be deterministic:

1. all `UPDATE` statements in row order
2. all `DELETE` statements in row order

The same generator should produce:

- the preview SQL text shown to the user
- the executable batch statement list used by the backend

### Batch Execution

The current app executes one SQL string at a time through `window.api.db.executeQuery(...)`. This feature needs a dedicated batch path because driver behavior differs across databases for multi-statement execution.

Add a new batch execution IPC flow that accepts an ordered list of SQL statements. The backend should:

- execute the statements in order
- wrap execution in a transaction for MySQL, PostgreSQL, and SQL Server
- roll back the full batch if any statement fails
- return structured success or failure details

The renderer should:

- show the generated SQL preview before execution
- call the batch API only after explicit confirmation
- keep the local edit buffer on failure
- automatically re-run the original preview SQL on success
- clear buffered changes after a successful refresh

## Component and Module Changes

### Renderer

- `src/renderer/features/table-preview.ts`
  - extend preview target resolution to attach physical table reference metadata
- `src/renderer/store/tabStore.ts`
  - store preview table metadata required for editable mode and refresh
- `src/renderer/components/SqlWorkspace/SqlWorkspace.tsx`
  - own editable preview state
  - show change toolbar and confirmation modal
  - trigger batch execution and post-success refresh
- `src/renderer/components/DataGrid/DataGrid.tsx`
  - add selection, edit mode, deletion marking, and visual state handling
- new renderer utility module for edit buffering and SQL generation

### Shared / IPC

- `src/shared/types.ts`
  - add table preview metadata, editable metadata, and batch execution request/response types
- `src/shared/ipc-channels.ts`
  - add channels for batch execution and preview edit metadata lookup

### Main / Core

- `src/preload/index.ts`
  - expose the new database APIs
- `src/main/main.ts`
  - register IPC handlers for metadata lookup and batch execution
- `src/core/db/connection-manager.ts`
  - expose table metadata lookup and batch execution
- `src/core/db/types.ts`
  - extend driver contract for table edit metadata and transactional batch execution
- database adapters
  - implement metadata lookup for primary or unique keys
  - implement transactional batch execution for supported databases

## Metadata and Safety Rules

Editing is enabled only when the backend can return one usable key definition.

Selection priority:

1. primary key
2. first unique key whose columns all appear in the preview result

If no suitable key exists, editing remains disabled.

The first version should not allow editing of complex or ambiguous values, including:

- JSON objects
- arrays
- binary/blob values
- values that cannot be serialized safely by the SQL generator

Those cells should render normally but reject edit mode with a clear explanation, or the entire grid should remain read-only if the implementation cannot support mixed behavior cleanly.

## Error Handling

### Metadata Failures

- if key metadata lookup fails, show the preview result as read-only
- do not block normal data preview
- surface a compact explanation that editing could not be enabled

### Batch Execution Failures

- keep pending changes intact
- do not refresh the result set
- show which statement index failed
- show the original database error message
- allow the user to discard changes or retry after adjustments

### Refresh Failures After Successful Write

If the write succeeds but the follow-up refresh fails:

- report that data changes were applied successfully
- keep the grid out of editable mode until refresh succeeds or the user reruns preview
- clear the local change buffer because the database has already changed

## Testing Strategy

### Pure Logic Tests

- row identity derivation
- change merging across repeated edits
- delete overriding update
- key-column update generation
- `NULL` serialization
- deterministic statement ordering

### Renderer Tests

- editable vs read-only mode switching
- cell selection and edit state transitions
- `Backspace/Delete` setting cell value to `NULL`
- row multi-select with `Cmd/Ctrl` and range select with `Shift`
- row deletion marking
- toolbar visibility and apply/discard actions
- confirmation modal rendering with generated SQL

### Workspace Tests

- preview tabs carry editable metadata correctly
- successful apply triggers refresh and clears buffered changes
- failed apply preserves buffered changes and shows error state

### Core / Adapter Tests

- key metadata lookup per supported database
- transactional batch success path
- rollback on statement failure
- structured error reporting for failed statement execution

## Rollout Plan

Deliver the first version behind the existing table preview path only.

Supported in v1:

- MySQL
- PostgreSQL
- SQL Server

Read-only in v1:

- ClickHouse
- non-preview result sets
- preview tables without primary or unique keys

## Open Decisions Resolved

The following product decisions are fixed for v1:

- scope is limited to Object Browser single-table preview tabs
- execution uses an `Apply changes` confirmation flow, not direct editor injection
- repeated edits collapse to the final value per row and column
- `Backspace/Delete` on a selected cell sets the value to `NULL`
- row deletion uses row selection plus `Cmd+Backspace` or `Delete`
- successful execution automatically refreshes the preview result

## Implementation Readiness

This spec is ready for implementation planning. The work is a single feature slice with clear boundaries:

- preview metadata
- renderer edit state
- SQL generation
- batch execution
- tests
