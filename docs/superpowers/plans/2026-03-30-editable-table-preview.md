# Editable Table Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement editable Object Browser table previews with buffered cell updates and row deletes, SQL preview, transactional batch execution, and automatic refresh after success.

**Architecture:** Extend preview tabs with physical table identity and editability metadata, add pure renderer modules for buffered row editing and SQL generation, teach `DataGrid` and `SqlWorkspace` to surface the editable workflow, and add transactional batch execution plus key metadata lookup in the database layer for MySQL, PostgreSQL, and SQL Server while keeping ClickHouse read-only.

**Tech Stack:** TypeScript, React, Electron IPC, Zustand, Ant Design, Vitest, `mysql2`, `pg`, `mssql`

---

## File Map

- Modify: `src/shared/types.ts`
  Add shared types for table preview identity, edit metadata, batch execution, and new preload API methods.
- Modify: `src/shared/ipc-channels.ts`
  Add channels for table edit metadata lookup and batch execution.
- Modify: `src/renderer/store/tabStore.ts`
  Persist preview table metadata on SQL tabs.
- Test: `src/renderer/store/tabStore.test.ts`
  Assert SQL tabs retain preview metadata alongside existing completion context.
- Modify: `src/renderer/features/table-preview.ts`
  Attach preview table identity and refresh SQL to reused/new SQL tabs.
- Test: `src/renderer/features/table-preview.test.ts`
  Assert preview targets include stable table metadata for refresh and editing.
- Create: `src/renderer/features/table-edit-buffer.ts`
  Pure row-buffer logic: row identity, repeated edits, delete markers, pending counts.
- Test: `src/renderer/features/table-edit-buffer.test.ts`
  Cover merge rules, delete precedence, and reset behavior.
- Create: `src/renderer/features/table-edit-sql.ts`
  Pure SQL generator for `UPDATE`/`DELETE` preview text and executable statement arrays.
- Test: `src/renderer/features/table-edit-sql.test.ts`
  Cover key-column updates, `NULL` serialization, and deterministic ordering.
- Create: `src/renderer/components/DataGrid/data-grid-editing-state.ts`
  Pure selection/edit shortcut logic so keyboard and row-selection rules are testable without DOM-heavy tooling.
- Test: `src/renderer/components/DataGrid/data-grid-editing-state.test.ts`
  Cover row-selection precedence, `Delete` vs `NULL`, range selection, and deleted-row guards.
- Modify: `src/renderer/components/DataGrid/DataGrid.tsx`
  Render editable mode, selected rows/cells, inline editor, deleted rows, and pending-value display.
- Test: `src/renderer/components/DataGrid/DataGrid.test.tsx`
  Keep existing layout coverage and add markup assertions for editable affordances.
- Create: `src/renderer/components/SqlWorkspace/editable-preview-state.ts`
  Pure workspace view-state helpers for toolbar visibility, read-only messaging, and post-apply notices.
- Test: `src/renderer/components/SqlWorkspace/editable-preview-state.test.ts`
  Cover editable vs read-only state and write-success/refresh-failure messaging.
- Modify: `src/renderer/components/SqlWorkspace/SqlWorkspace.tsx`
  Fetch edit metadata, own the edit buffer, render change toolbar/confirmation modal, execute batch, and refresh preview.
- Test: `src/renderer/components/SqlWorkspace/SqlWorkspace.test.tsx`
  Keep layout coverage and add markup assertions for editable-preview container hooks.
- Modify: `src/preload/index.ts`
  Expose `getTableEditMetadata` and `executeBatch`.
- Modify: `src/main/main.ts`
  Register IPC handlers for metadata lookup and batch execution.
- Modify: `src/core/db/types.ts`
  Extend driver contracts with metadata lookup and batch execution.
- Modify: `src/core/db/connection-manager.ts`
  Forward metadata and batch requests to active drivers.
- Test: `src/core/db/__tests__/connection-manager.test.ts`
  Assert forwarding behavior and unsupported-driver handling.
- Modify: `src/core/db/adapters/mysql.ts`
  Implement key metadata lookup and transactional batch execution.
- Test: `src/core/db/__tests__/mysql.test.ts`
  Cover key metadata query handling and transaction commit/rollback behavior.
- Modify: `src/core/db/adapters/postgresql.ts`
  Implement key metadata lookup and transactional batch execution.
- Create: `src/core/db/__tests__/postgresql.test.ts`
  Cover PostgreSQL key metadata extraction and `BEGIN`/`COMMIT`/`ROLLBACK` flow.
- Modify: `src/core/db/adapters/mssql.ts`
  Implement key metadata lookup and transactional batch execution.
- Create: `src/core/db/__tests__/mssql.test.ts`
  Cover SQL Server key metadata lookup and transaction rollback behavior.
- Modify: `src/core/db/adapters/clickhouse.ts`
  Return read-only edit metadata and reject batch writes cleanly.
- Modify: `src/core/db/__tests__/clickhouse.test.ts`
  Assert ClickHouse remains non-editable in v1.

## Task 1: Shared Contracts And Preview Metadata

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/renderer/store/tabStore.ts`
- Modify: `src/renderer/features/table-preview.ts`
- Test: `src/renderer/store/tabStore.test.ts`
- Test: `src/renderer/features/table-preview.test.ts`

- [ ] **Step 1: Write the failing preview metadata tests**

```ts
expect(resolvePreviewTarget(...)).toMatchObject({
  createTab: true,
  newTab: {
    previewTable: {
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
      table: 'users',
      previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
    },
  },
});

expect(tab).toMatchObject({
  previewTable: {
    table: 'users',
    previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
  },
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- src/renderer/features/table-preview.test.ts src/renderer/store/tabStore.test.ts`

Expected: FAIL with missing `previewTable` fields on `TabData` or `ResolvedPreviewTarget`.

- [ ] **Step 3: Add the shared contracts and wire preview metadata through the tab model**

```ts
export interface PreviewTableRef {
  dbType: ConnectionConfig['dbType'];
  database?: string;
  schema?: string;
  table: string;
  previewSql: string;
}

export interface TableEditKey {
  type: 'primary' | 'unique';
  columns: string[];
}

export interface TableEditMetadata {
  editable: boolean;
  reason?: string;
  key: TableEditKey | null;
}

export interface BatchExecutionResult {
  ok: boolean;
  failedStatementIndex?: number;
  error?: string;
}
```

Implementation notes:

- extend `TabData` with `previewTable?: PreviewTableRef`
- have `resolvePreviewTarget(...)` populate `previewTable.previewSql` for both reused and new SQL tabs
- add IPC channel constants now so later tasks can wire the new methods without reopening the shared contract

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/renderer/features/table-preview.test.ts src/renderer/store/tabStore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the shared-contracts slice**

```bash
git add src/shared/types.ts src/shared/ipc-channels.ts src/renderer/store/tabStore.ts src/renderer/store/tabStore.test.ts src/renderer/features/table-preview.ts src/renderer/features/table-preview.test.ts
git commit -m "feat: add editable preview tab metadata"
```

## Task 2: Core Contracts, IPC, And Connection Manager Entry Points

**Files:**
- Modify: `src/core/db/types.ts`
- Modify: `src/core/db/connection-manager.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/main.ts`
- Test: `src/core/db/__tests__/connection-manager.test.ts`

- [ ] **Step 1: Write the failing connection-manager tests for metadata lookup and batch execution**

```ts
expect(await connectionManager.getTableEditMetadata('conn-id', {
  dbType: 'postgres',
  database: 'analytics',
  schema: 'public',
  table: 'users',
  previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
})).toEqual({
  editable: true,
  key: { type: 'primary', columns: ['id'] },
});

await connectionManager.executeBatch('conn-id', ['UPDATE ...', 'DELETE ...']);
expect(driver.executeBatch).toHaveBeenCalledWith(['UPDATE ...', 'DELETE ...']);
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- src/core/db/__tests__/connection-manager.test.ts`

Expected: FAIL because `DatabaseDriver` and `ConnectionManager` do not expose the new methods yet.

- [ ] **Step 3: Extend the driver contract and wire the preload/main/manager APIs**

```ts
export interface DatabaseDriver {
  executeQuery(sql: string): Promise<QueryResult>;
  getTableEditMetadata?(table: PreviewTableRef): Promise<TableEditMetadata>;
  executeBatch?(statements: string[]): Promise<BatchExecutionResult>;
}

public async getTableEditMetadata(id: string, table: PreviewTableRef) {
  const driver = this.getConnection(id);
  if (!driver.getTableEditMetadata) {
    return { editable: false, reason: 'Editing is not supported for this database.', key: null };
  }
  return await driver.getTableEditMetadata(table);
}
```

Implementation notes:

- add `window.api.db.getTableEditMetadata(...)`
- add `window.api.db.executeBatch(...)`
- register `ipcMain.handle(...)` handlers in `src/main/main.ts`
- keep IPC payloads typed via the shared interfaces from Task 1

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/core/db/__tests__/connection-manager.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the core-entry-point slice**

```bash
git add src/core/db/types.ts src/core/db/connection-manager.ts src/core/db/__tests__/connection-manager.test.ts src/preload/index.ts src/main/main.ts
git commit -m "feat: add editable preview db entry points"
```

## Task 3: Adapter Metadata Lookup And Transactional Batch Execution

**Files:**
- Modify: `src/core/db/adapters/mysql.ts`
- Modify: `src/core/db/adapters/postgresql.ts`
- Modify: `src/core/db/adapters/mssql.ts`
- Modify: `src/core/db/adapters/clickhouse.ts`
- Test: `src/core/db/__tests__/mysql.test.ts`
- Create: `src/core/db/__tests__/postgresql.test.ts`
- Create: `src/core/db/__tests__/mssql.test.ts`
- Modify: `src/core/db/__tests__/clickhouse.test.ts`

- [ ] **Step 1: Write the failing adapter tests**

```ts
expect(await adapter.getTableEditMetadata({
  dbType: 'mysql',
  database: 'analytics',
  schema: 'analytics',
  table: 'users',
  previewSql: 'SELECT * FROM `analytics`.`users` LIMIT 100',
})).toEqual({
  editable: true,
  key: { type: 'primary', columns: ['id'] },
});

const result = await adapter.executeBatch(['UPDATE users SET name = \'A\' WHERE id = 1']);
expect(result).toEqual({ ok: true });
expect(mockConn.beginTransaction).toHaveBeenCalled();
expect(mockConn.commit).toHaveBeenCalled();
```

For ClickHouse:

```ts
expect(await adapter.getTableEditMetadata(tableRef)).toEqual({
  editable: false,
  reason: expect.stringContaining('not supported'),
  key: null,
});
```

- [ ] **Step 2: Run the focused adapter tests to verify they fail**

Run: `npm test -- src/core/db/__tests__/mysql.test.ts src/core/db/__tests__/postgresql.test.ts src/core/db/__tests__/mssql.test.ts src/core/db/__tests__/clickhouse.test.ts`

Expected: FAIL with missing methods and missing test files.

- [ ] **Step 3: Implement metadata lookup and batch execution per adapter**

Representative approach:

```ts
async getTableEditMetadata(table: PreviewTableRef): Promise<TableEditMetadata> {
  const rows = await this.connection.query(`
    SELECT tc.constraint_type, kcu.column_name, kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = ? AND tc.table_name = ?
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    ORDER BY
      CASE tc.constraint_type WHEN 'PRIMARY KEY' THEN 0 ELSE 1 END,
      tc.constraint_name,
      kcu.ordinal_position
  `, [schemaName, table.table]);

  return pickFirstSupportedKey(rows);
}

async executeBatch(statements: string[]): Promise<BatchExecutionResult> {
  let failedStatementIndex: number | undefined;
  try {
    await this.connection.beginTransaction();
    for (const [index, statement] of statements.entries()) {
      failedStatementIndex = index;
      await this.connection.query(statement);
    }
    await this.connection.commit();
    return { ok: true };
  } catch (error) {
    await this.connection.rollback();
    return {
      ok: false,
      failedStatementIndex,
      error: getErrorMessage(error),
    };
  }
}
```

Adapter-specific notes:

- MySQL: use `beginTransaction` / `commit` / `rollback`
- PostgreSQL: issue `BEGIN`, run statements, `COMMIT`, `ROLLBACK` on failure
- SQL Server: use `sql.Transaction` plus `sql.Request(transaction)` for the batch
- ClickHouse: return read-only metadata and reject batch writes without trying to emulate transactions

- [ ] **Step 4: Run the focused adapter tests to verify they pass**

Run: `npm test -- src/core/db/__tests__/mysql.test.ts src/core/db/__tests__/postgresql.test.ts src/core/db/__tests__/mssql.test.ts src/core/db/__tests__/clickhouse.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the adapter slice**

```bash
git add src/core/db/adapters/mysql.ts src/core/db/adapters/postgresql.ts src/core/db/adapters/mssql.ts src/core/db/adapters/clickhouse.ts src/core/db/__tests__/mysql.test.ts src/core/db/__tests__/postgresql.test.ts src/core/db/__tests__/mssql.test.ts src/core/db/__tests__/clickhouse.test.ts
git commit -m "feat: add editable preview batch db support"
```

## Task 4: Pure Edit Buffer And SQL Generation

**Files:**
- Create: `src/renderer/features/table-edit-buffer.ts`
- Test: `src/renderer/features/table-edit-buffer.test.ts`
- Create: `src/renderer/features/table-edit-sql.ts`
- Test: `src/renderer/features/table-edit-sql.test.ts`

- [ ] **Step 1: Write the failing pure-logic tests**

```ts
expect(applyCellEdit(session, '1', 'name', 'Alice')).toMatchObject({
  rowsById: {
    '1': {
      changedColumns: ['name'],
      pendingRow: { id: 1, name: 'Alice' },
    },
  },
});

expect(markRowsDeleted(session, ['1']).rowsById['1'].deleted).toBe(true);

expect(buildTableEditSql(session, metadata)).toEqual({
  statements: [
    'UPDATE "analytics"."public"."users" SET "name" = \'Alice\' WHERE "id" = 1',
    'DELETE FROM "analytics"."public"."users" WHERE "id" = 2',
  ],
  previewSql: 'UPDATE ...;\n\nDELETE ...;',
});
```

- [ ] **Step 2: Run the focused pure-logic tests to verify they fail**

Run: `npm test -- src/renderer/features/table-edit-buffer.test.ts src/renderer/features/table-edit-sql.test.ts`

Expected: FAIL because the new feature modules do not exist yet.

- [ ] **Step 3: Implement the edit buffer and SQL generator**

```ts
export interface TableEditRowState {
  rowId: string;
  originalRow: QueryRow;
  pendingRow: QueryRow;
  changedColumns: string[];
  deleted: boolean;
}

export const applyCellEdit = (
  session: TableEditSession,
  rowId: string,
  column: string,
  nextValue: unknown
) => { /* update pendingRow and recompute changedColumns */ };

export const buildTableEditSql = (
  session: TableEditSession,
  table: PreviewTableRef,
  metadata: TableEditMetadata
) => { /* return deterministic statements + previewSql */ };
```

Implementation notes:

- row identity must be derived from original key values, not mutable pending values
- repeated edits to the same cell collapse to the final pending value
- deleted rows suppress pending `UPDATE` statements
- serialize `null` as `NULL`
- quote identifiers using the same db-type-specific style as `src/renderer/features/table-preview.ts`

- [ ] **Step 4: Run the focused pure-logic tests to verify they pass**

Run: `npm test -- src/renderer/features/table-edit-buffer.test.ts src/renderer/features/table-edit-sql.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the pure-logic slice**

```bash
git add src/renderer/features/table-edit-buffer.ts src/renderer/features/table-edit-buffer.test.ts src/renderer/features/table-edit-sql.ts src/renderer/features/table-edit-sql.test.ts
git commit -m "feat: add editable preview sql generation"
```

## Task 5: DataGrid Editing State And UI Wiring

**Files:**
- Create: `src/renderer/components/DataGrid/data-grid-editing-state.ts`
- Test: `src/renderer/components/DataGrid/data-grid-editing-state.test.ts`
- Modify: `src/renderer/components/DataGrid/DataGrid.tsx`
- Modify: `src/renderer/components/DataGrid/DataGrid.test.tsx`

- [ ] **Step 1: Write the failing state and markup tests**

```ts
expect(resolveGridDeleteAction({
  selectedRowIds: ['row-1'],
  selectedCell: { rowId: 'row-1', column: 'name' },
  isEditingCell: false,
  platform: 'MacIntel',
  key: 'Backspace',
  metaKey: true,
})).toEqual({
  type: 'deleteRows',
  rowIds: ['row-1'],
});

expect(resolveGridDeleteAction({
  selectedRowIds: [],
  selectedCell: { rowId: 'row-1', column: 'name' },
  isEditingCell: false,
  key: 'Delete',
})).toEqual({
  type: 'setCellNull',
  cell: { rowId: 'row-1', column: 'name' },
});
```

Markup expectation:

```ts
expect(markup).toContain('data-grid-editable');
expect(markup).toContain('data-pending-delete="true"');
expect(markup).toContain('data-cell-dirty="true"');
```

- [ ] **Step 2: Run the focused DataGrid tests to verify they fail**

Run: `npm test -- src/renderer/components/DataGrid/data-grid-editing-state.test.ts src/renderer/components/DataGrid/DataGrid.test.tsx`

Expected: FAIL because the pure grid state helpers and editable markup hooks do not exist.

- [ ] **Step 3: Implement the grid state helpers and wire editable rendering into `DataGrid`**

```ts
export interface GridSelectionState {
  selectedRowIds: string[];
  selectedCell: { rowId: string; column: string } | null;
  anchorRowId: string | null;
}

export const resolveGridDeleteAction = (...) => {
  if (selectedRowIds.length > 0) {
    return { type: 'deleteRows', rowIds: selectedRowIds };
  }
  if (selectedCell) {
    return { type: 'setCellNull', cell: selectedCell };
  }
  return { type: 'none' };
};
```

Implementation notes:

- keep selection/editing shortcut rules in the pure helper file
- keep DOM event handlers in `DataGrid.tsx` thin: translate browser events into helper calls
- render deleted rows as read-only with a visible pending-delete marker
- render pending values from the edit session instead of the raw `result.rows` value when editable mode is active

- [ ] **Step 4: Run the focused DataGrid tests to verify they pass**

Run: `npm test -- src/renderer/components/DataGrid/data-grid-editing-state.test.ts src/renderer/components/DataGrid/DataGrid.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the DataGrid slice**

```bash
git add src/renderer/components/DataGrid/data-grid-editing-state.ts src/renderer/components/DataGrid/data-grid-editing-state.test.ts src/renderer/components/DataGrid/DataGrid.tsx src/renderer/components/DataGrid/DataGrid.test.tsx
git commit -m "feat: add editable table grid interactions"
```

## Task 6: SqlWorkspace Integration And Apply Flow

**Files:**
- Create: `src/renderer/components/SqlWorkspace/editable-preview-state.ts`
- Test: `src/renderer/components/SqlWorkspace/editable-preview-state.test.ts`
- Modify: `src/renderer/components/SqlWorkspace/SqlWorkspace.tsx`
- Modify: `src/renderer/components/SqlWorkspace/SqlWorkspace.test.tsx`

- [ ] **Step 1: Write the failing workspace-state and markup tests**

```ts
expect(getEditablePreviewViewState({
  previewTable,
  editMetadata: { editable: true, key: { type: 'primary', columns: ['id'] } },
  pendingChangeCount: 2,
  isApplying: false,
})).toEqual({
  mode: 'editable',
  showToolbar: true,
  pendingChangeCount: 2,
});

expect(getPostApplyNotice({
  batchResult: { ok: true },
  refreshError: new Error('Timed out'),
})).toEqual({
  tone: 'warning',
  message: 'Changes were applied, but the preview could not be refreshed.',
});

expect(markup).toContain('editable-preview-shell');
expect(markup).toContain('editable-preview-readonly-reason');
```

- [ ] **Step 2: Run the focused workspace tests to verify they fail**

Run: `npm test -- src/renderer/components/SqlWorkspace/editable-preview-state.test.ts src/renderer/components/SqlWorkspace/SqlWorkspace.test.tsx`

Expected: FAIL because the new workspace helper module and editable-preview hooks do not exist yet.

- [ ] **Step 3: Integrate editable preview state into the workspace**

```ts
const previewTable = tab.previewTable;
const [editMetadata, setEditMetadata] = useState<TableEditMetadata | null>(null);
const [editSession, setEditSession] = useState<TableEditSession | null>(null);

useEffect(() => {
  if (!previewTable || !tab.connectionId) return;
  void window.api.db.getTableEditMetadata(tab.connectionId, previewTable).then(setEditMetadata);
}, [previewTable, tab.connectionId]);

const handleApplyChanges = async () => {
  const batch = buildTableEditSql(editSession, previewTable, editMetadata);
  const result = await window.api.db.executeBatch(tab.connectionId, batch.statements);
  if (result.ok) {
    await performExecution(previewTable.previewSql);
    setEditSession(resetTableEditSession(nextResult, editMetadata));
  }
};
```

Implementation notes:

- centralize toolbar/read-only/post-apply messaging decisions in `editable-preview-state.ts`
- fetch metadata only for tabs with `previewTable`
- initialize the edit session from the current result rows after preview execution
- show a compact toolbar only when there are pending changes
- on failure, keep the edit session intact and surface the backend error
- on success, refresh using `previewTable.previewSql`
- if refresh fails after a successful write, clear the edit session and surface a “changes applied but refresh failed” message

- [ ] **Step 4: Run the focused workspace tests to verify they pass**

Run: `npm test -- src/renderer/components/SqlWorkspace/editable-preview-state.test.ts src/renderer/components/SqlWorkspace/SqlWorkspace.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the workspace slice**

```bash
git add src/renderer/components/SqlWorkspace/editable-preview-state.ts src/renderer/components/SqlWorkspace/editable-preview-state.test.ts src/renderer/components/SqlWorkspace/SqlWorkspace.tsx src/renderer/components/SqlWorkspace/SqlWorkspace.test.tsx
git commit -m "feat: add editable preview apply flow"
```

## Task 7: Full Verification And Cleanup

**Files:**
- Verify: `src/shared/types.ts`
- Verify: `src/renderer/features/table-preview.ts`
- Verify: `src/renderer/features/table-edit-buffer.ts`
- Verify: `src/renderer/features/table-edit-sql.ts`
- Verify: `src/renderer/components/DataGrid/data-grid-editing-state.ts`
- Verify: `src/renderer/components/DataGrid/DataGrid.tsx`
- Verify: `src/renderer/components/SqlWorkspace/SqlWorkspace.tsx`
- Verify: `src/core/db/types.ts`
- Verify: `src/core/db/connection-manager.ts`
- Verify: `src/core/db/adapters/mysql.ts`
- Verify: `src/core/db/adapters/postgresql.ts`
- Verify: `src/core/db/adapters/mssql.ts`
- Verify: `src/core/db/adapters/clickhouse.ts`

- [ ] **Step 1: Run the targeted feature test suite**

Run: `npm test -- src/renderer/features/table-preview.test.ts src/renderer/store/tabStore.test.ts src/core/db/__tests__/connection-manager.test.ts src/core/db/__tests__/mysql.test.ts src/core/db/__tests__/postgresql.test.ts src/core/db/__tests__/mssql.test.ts src/core/db/__tests__/clickhouse.test.ts src/renderer/features/table-edit-buffer.test.ts src/renderer/features/table-edit-sql.test.ts src/renderer/components/DataGrid/data-grid-editing-state.test.ts src/renderer/components/DataGrid/DataGrid.test.tsx src/renderer/components/SqlWorkspace/editable-preview-state.test.ts src/renderer/components/SqlWorkspace/SqlWorkspace.test.tsx`

Expected: PASS

- [ ] **Step 2: Run the full repository test suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 3: Run lint to catch type and unused-import regressions**

Run: `npm run lint`

Expected: PASS

- [ ] **Step 4: Review the generated SQL and failure messages manually in the app**

Manual check:

- preview a table with a primary key
- change one cell twice and confirm only the final value is emitted
- set one selected cell to `NULL`
- delete one selected row
- verify the confirmation dialog shows one `UPDATE` and one `DELETE`
- verify success refreshes the table and failure preserves buffered changes

- [ ] **Step 5: Commit only if verification uncovered follow-up fixes**

```bash
git status --short
# If verification changed files, add only those files and create a follow-up fix commit.
# If the working tree is clean, skip this step.
```
