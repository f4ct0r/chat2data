# Grid Selection Clipboard Design

## Goal

Upgrade the result grid so users can select rectangular cell ranges like a spreadsheet and use copy, paste, and delete without leaving the data workspace.

## Scope

- Support rectangular cell selection across rows and columns in the result grid
- Keep row-header selection for row delete workflows in editable table preview mode
- Allow copy from both read-only query results and editable table previews
- Allow paste and batch delete only in editable table preview mode
- Reuse the existing pending-change buffer plus `Apply / Discard` confirmation flow
- Limit paste to currently loaded rows and existing columns only

## Out of Scope

- Inserting rows or columns from paste
- Autofill handles, formulas, undo stack, or spreadsheet-style fill series
- Editing arbitrary query results that are not backed by editable table preview metadata
- Clipboard support for binary-rich or styled formats beyond plain text

## Interaction

1. Click a cell to activate it
2. Shift-click another cell or drag across cells to create a rectangular range
3. Press `Cmd/Ctrl+C` to copy the selected cell range as plain-text TSV
4. In editable table preview mode, press `Cmd/Ctrl+V` to paste from the active cell outward
5. In editable table preview mode, press `Delete/Backspace` to clear the selected cells, or use the existing row-delete shortcut on selected rows
6. Persist pasted and deleted values in the edit buffer until the user explicitly applies or discards changes

## Behavior Rules

- Read-only query results:
  - Support cell selection and copy
  - Do not allow paste or delete
- Editable table preview:
  - Support cell selection, copy, paste, and delete
  - Keep row-header selection semantics for row deletion
- Paste never creates rows or columns
- Paste ignores overflow outside the loaded preview window
- Double-click still opens the inline single-cell editor for precise edits

## Architecture

- Extend grid selection state with an anchor cell plus a rectangular range
- Add clipboard helpers to serialize selections to TSV and parse pasted TSV text
- Keep paste application in `SqlWorkspace` so type coercion and edit-buffer updates stay close to existing editable-preview logic
- Let `DataGrid` own local selection state for read-only results while remaining controlled by `SqlWorkspace` in editable preview mode

## Testing

- Selection-state tests for range selection and batch delete resolution
- Clipboard helper tests for TSV serialization/parsing
- Editable-preview paste tests for truncation and type coercion
- DataGrid rendering tests for range markup and read-only keyboard focus
