# Query Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete-result export for a single read-only query with streaming writes, progress, cancellation, and bounded memory usage.

**Architecture:** Introduce a detached export job service in the main process, a shared export contract for IPC and status snapshots, and adapter-level streaming readers that feed format writers. The renderer stays thin: it validates exportable SQL, starts jobs, polls status, and renders progress.

**Tech Stack:** Electron IPC, TypeScript, Vitest, Node streams, ExcelJS streaming workbook writer

---

## Chunk 1: Shared Export Contract

### Task 1: Add failing shared-contract tests

**Files:**
- Modify: `src/shared/types.test.ts`
- Create: `src/shared/query-export.ts`

- [ ] **Step 1: Write failing tests for export SQL validation and shared export types**
- [ ] **Step 2: Run the targeted test to verify it fails**
- [ ] **Step 3: Add the minimal shared export helpers and types**
- [ ] **Step 4: Run the targeted test again**

### Task 2: Add failing IPC contract tests

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.test.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Extend tests to expect export IPC channels and preload methods**
- [ ] **Step 2: Run the targeted test to verify it fails**
- [ ] **Step 3: Add the IPC channel constants and preload/shared API types**
- [ ] **Step 4: Run the targeted test again**

## Chunk 2: Main-Process Export Service

### Task 3: Add failing export service tests

**Files:**
- Create: `src/core/export/__tests__/query-export-service.test.ts`
- Create: `src/core/export/query-export-service.ts`
- Create: `src/core/export/export-format-writers.ts`

- [ ] **Step 1: Write failing tests for streamed CSV/TSV/JSON export, cancellation cleanup, and XLSX sheet rollover**
- [ ] **Step 2: Run the targeted export-service test to verify it fails**
- [ ] **Step 3: Implement the minimal export job service and file writers**
- [ ] **Step 4: Run the targeted export-service test again**

### Task 4: Add detached-driver support in the DB layer

**Files:**
- Modify: `src/core/db/types.ts`
- Modify: `src/core/db/connection-manager.ts`
- Modify: `src/core/db/__tests__/connection-manager.test.ts`

- [ ] **Step 1: Write failing tests for creating a detached export driver**
- [ ] **Step 2: Run the targeted connection-manager test to verify it fails**
- [ ] **Step 3: Implement detached driver creation and export streaming interfaces**
- [ ] **Step 4: Run the targeted connection-manager test again**

### Task 5: Implement adapter streaming readers

**Files:**
- Modify: `src/core/db/adapters/postgresql.ts`
- Modify: `src/core/db/adapters/mysql.ts`
- Modify: `src/core/db/adapters/mssql.ts`
- Modify: `src/core/db/adapters/clickhouse.ts`
- Modify: `src/core/db/adapters/sqlite.ts`

- [ ] **Step 1: Add one adapter test or service-level regression per missing reader behavior if needed**
- [ ] **Step 2: Implement bounded streaming for each supported database**
- [ ] **Step 3: Ensure cancellation closes the active reader/query cleanly**
- [ ] **Step 4: Run the targeted DB/export tests**

### Task 6: Wire export IPC handlers in the main process

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/main.test.ts`

- [ ] **Step 1: Add failing tests for export IPC registration if needed**
- [ ] **Step 2: Register start/status/cancel handlers and save-dialog flow**
- [ ] **Step 3: Run the targeted main-process test**

## Chunk 3: Renderer Export Flow

### Task 7: Add failing renderer tests for export controls

**Files:**
- Modify: `src/renderer/components/SqlWorkspace/SqlWorkspace.test.tsx`
- Modify: `src/renderer/i18n/messages.ts`

- [ ] **Step 1: Add failing tests for export controls, validation copy, and progress state**
- [ ] **Step 2: Run the targeted renderer test to verify it fails**
- [ ] **Step 3: Add the new export copy**
- [ ] **Step 4: Run the targeted renderer test again**

### Task 8: Wire export job state into `SqlWorkspace`

**Files:**
- Modify: `src/renderer/components/SqlWorkspace/SqlWorkspace.tsx`

- [ ] **Step 1: Add export format selection and start/cancel actions**
- [ ] **Step 2: Poll export status while a job is active**
- [ ] **Step 3: Render progress, final success, and failure states**
- [ ] **Step 4: Run the targeted renderer test again**

## Chunk 4: Verification

### Task 9: Run verification for the full feature

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: all touched source files

- [ ] **Step 1: Install `exceljs`**
- [ ] **Step 2: Run targeted export, preload, main, and renderer tests**
- [ ] **Step 3: Run `npm run lint`**
- [ ] **Step 4: Run `npx tsc --noEmit`**
- [ ] **Step 5: Run full `npm test`**
