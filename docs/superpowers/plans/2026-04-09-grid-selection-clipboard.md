# Grid Selection Clipboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spreadsheet-like rectangular cell selection plus copy/paste/delete operations to the result grid while preserving the current editable-preview save flow.

**Architecture:** Extend the existing grid selection model with range semantics, keep clipboard serialization/parsing in focused grid helpers, and apply pasted values through the existing editable-preview buffer in `SqlWorkspace`. Read-only grids get copy-only behavior with local selection state; editable previews remain controlled by workspace state.

**Tech Stack:** React, TypeScript, Vitest, Electron renderer clipboard events, existing table edit buffer utilities

---

## Chunk 1: Model And Clipboard Helpers

### Task 1: Extend selection state for rectangular ranges

**Files:**
- Modify: `src/renderer/components/DataGrid/data-grid-editing-state.ts`
- Test: `src/renderer/components/DataGrid/data-grid-editing-state.test.ts`

- [ ] Step 1: Write failing tests for range selection and multi-cell delete resolution
- [ ] Step 2: Run `npm test -- src/renderer/components/DataGrid/data-grid-editing-state.test.ts` and verify the new tests fail for the missing range behavior
- [ ] Step 3: Implement anchor-cell and rectangular-range selection support plus batch cell-clear delete actions
- [ ] Step 4: Re-run `npm test -- src/renderer/components/DataGrid/data-grid-editing-state.test.ts`

### Task 2: Add grid clipboard helpers

**Files:**
- Create: `src/renderer/components/DataGrid/data-grid-clipboard.ts`
- Test: `src/renderer/components/DataGrid/data-grid-clipboard.test.ts`

- [ ] Step 1: Write failing tests for TSV serialization, parsing, and range membership
- [ ] Step 2: Run `npm test -- src/renderer/components/DataGrid/data-grid-clipboard.test.ts` and verify failure
- [ ] Step 3: Implement clipboard serialization/parsing helpers
- [ ] Step 4: Re-run `npm test -- src/renderer/components/DataGrid/data-grid-clipboard.test.ts`

## Chunk 2: Editable Preview Paste Application

### Task 3: Apply pasted grids into the edit buffer

**Files:**
- Modify: `src/renderer/components/SqlWorkspace/sql-workspace-utils.ts`
- Create: `src/renderer/components/SqlWorkspace/sql-workspace-utils.test.ts`

- [ ] Step 1: Write failing tests for bounded paste overlays and type coercion
- [ ] Step 2: Run `npm test -- src/renderer/components/SqlWorkspace/sql-workspace-utils.test.ts` and verify failure
- [ ] Step 3: Implement buffered paste application that only touches loaded cells
- [ ] Step 4: Re-run `npm test -- src/renderer/components/SqlWorkspace/sql-workspace-utils.test.ts`

## Chunk 3: Grid Wiring

### Task 4: Wire DataGrid selection and clipboard events

**Files:**
- Modify: `src/renderer/components/DataGrid/DataGrid.tsx`
- Test: `src/renderer/components/DataGrid/DataGrid.test.tsx`

- [ ] Step 1: Write or update failing tests for read-only focusability and range markup
- [ ] Step 2: Run `npm test -- src/renderer/components/DataGrid/DataGrid.test.tsx` and verify failure
- [ ] Step 3: Implement local read-only selection, drag range selection, copy handling, and editable paste hooks
- [ ] Step 4: Re-run `npm test -- src/renderer/components/DataGrid/DataGrid.test.tsx`

### Task 5: Connect paste/delete behavior in SqlWorkspace

**Files:**
- Modify: `src/renderer/components/SqlWorkspace/SqlWorkspace.tsx`
- Modify: `src/renderer/i18n/messages.ts`

- [ ] Step 1: Wire batch clear and paste results into the edit buffer plus inline feedback
- [ ] Step 2: Run targeted renderer tests covering the changed utilities/components
- [ ] Step 3: Run `npm test`, `npm run lint`, and `npm run build`

Plan complete and saved to `docs/superpowers/plans/2026-04-09-grid-selection-clipboard.md`. Ready to execute.
