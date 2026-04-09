# Connection List Collapse Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-collapse the connection list after a successful connection while keeping the object browser visible and manually toggleable.

**Architecture:** Add a small pure helper for collapse-state transitions and a focused renderer component that owns the connection-list/object-browser split layout. `App.tsx` keeps the state and passes it into the new layout component.

**Tech Stack:** React, TypeScript, Vitest, server-rendered component tests

---

## Chunk 1: Collapse Rules

### Task 1: Add failing tests for collapse-state transitions

**Files:**
- Create: `src/renderer/features/connection-list-collapse.test.ts`
- Create: `src/renderer/features/connection-list-collapse.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Add failing tests for the sidebar split layout

**Files:**
- Create: `src/renderer/components/ConnectionList/ConnectionWorkspaceSidebar.test.tsx`
- Create: `src/renderer/components/ConnectionList/ConnectionWorkspaceSidebar.tsx`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

## Chunk 2: App Wiring

### Task 3: Wire collapse state into the renderer app

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add the failing integration assertions if needed**
- [ ] **Step 2: Implement `isConnectionListCollapsed` state and successful-connect auto-collapse**
- [ ] **Step 3: Force the list open when no connection is selected**
- [ ] **Step 4: Run targeted tests**

### Task 4: Add copy for the collapse control

**Files:**
- Modify: `src/renderer/i18n/messages.ts`

- [ ] **Step 1: Add labels for expand/collapse affordances**
- [ ] **Step 2: Run targeted tests**

## Chunk 3: Verification

### Task 5: Verify the feature and regressions

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/ConnectionList/ConnectionWorkspaceSidebar.tsx`
- Modify: `src/renderer/features/connection-list-collapse.ts`

- [ ] **Step 1: Run targeted tests for the new collapse behavior**
- [ ] **Step 2: Run `npx eslint` on changed files**
- [ ] **Step 3: Run `npx tsc --noEmit`**
- [ ] **Step 4: Run full `npm test`**
