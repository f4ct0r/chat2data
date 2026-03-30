import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from '../../../shared/types';
import {
  createTableEditBuffer,
  markTableEditRowDeleted,
  updateTableEditCell,
} from '../../features/table-edit-buffer';
import DataGrid, {
  MIN_COLUMN_WIDTH,
  getInitialColumnWidths,
  resizeColumnWidth,
  shouldRemeasureViewport,
} from './DataGrid';

const virtualizerState = vi.hoisted(() => ({
  items: [
    {
      index: 0,
      size: 36,
      start: 0,
    },
  ],
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => virtualizerState.items.reduce((total, item) => total + item.size, 0),
    getVirtualItems: () => virtualizerState.items,
  }),
}));

describe('DataGrid column sizing', () => {
  it('keeps existing widths and derives defaults for new columns', () => {
    expect(
      getInitialColumnWidths(['id', 'very_long_column_name'], {
        id: 220,
      })
    ).toEqual({
      id: 220,
      very_long_column_name: 242,
    });
  });

  it('clamps resized widths to the minimum width', () => {
    expect(resizeColumnWidth(180, -500)).toBe(MIN_COLUMN_WIDTH);
    expect(resizeColumnWidth(180, 24)).toBe(204);
  });
});

describe('DataGrid viewport sync', () => {
  it('remeasures when the viewport becomes visible after starting hidden', () => {
    expect(
      shouldRemeasureViewport(
        { width: 0, height: 0 },
        { width: 720, height: 360 }
      )
    ).toBe(true);
  });

  it('remeasures when the viewport size changes while visible', () => {
    expect(
      shouldRemeasureViewport(
        { width: 720, height: 360 },
        { width: 720, height: 420 }
      )
    ).toBe(true);
  });

  it('does not remeasure when the viewport size stays the same', () => {
    expect(
      shouldRemeasureViewport(
        { width: 720, height: 360 },
        { width: 720, height: 360 }
      )
    ).toBe(false);
  });
});

describe('DataGrid layout', () => {
  it('renders a non-collapsed scroll viewport and resize handles for each data column', () => {
    const result: QueryResult = {
      columns: ['id', 'email'],
      rows: [{ id: 1, email: 'a@example.com' }],
      rowCount: 1,
      durationMs: 12,
    };

    const markup = renderToStaticMarkup(<DataGrid result={result} />);

    expect(markup).toContain('flex-1 min-h-0 w-full flex flex-col overflow-hidden');
    expect(markup).toContain('flex-1 min-h-0 overflow-auto relative custom-scrollbar');
    expect(markup).not.toContain('flex-1 h-0 min-h-0 overflow-auto');
    expect(markup).toContain('data-column-resize-handle="id"');
    expect(markup).toContain('data-column-resize-handle="email"');
  });

  it('renders editable preview values, dirty cells, and pending delete markers', () => {
    virtualizerState.items = [
      {
        index: 0,
        size: 36,
        start: 0,
      },
      {
        index: 1,
        size: 36,
        start: 36,
      },
    ];

    const result: QueryResult = {
      columns: ['id', 'email'],
      rows: [
        { id: 1, email: 'a@example.com' },
        { id: 2, email: 'b@example.com' },
      ],
      rowCount: 2,
      durationMs: 12,
    };

    const buffer = createTableEditBuffer(result.rows, ['id']);
    const editedBuffer = updateTableEditCell(
      buffer,
      buffer.rows[0].rowId,
      'email',
      'pending@example.com'
    );
    const deletedBuffer = markTableEditRowDeleted(editedBuffer, buffer.rows[1].rowId);

    const markup = renderToStaticMarkup(
      <DataGrid
        result={result}
        editablePreview={{
          buffer: deletedBuffer,
          selection: {
            selectedRowIds: [buffer.rows[0].rowId],
            selectedCell: {
              rowId: buffer.rows[0].rowId,
              column: 'email',
            },
            anchorRowId: buffer.rows[0].rowId,
          },
          editingCell: null,
        }}
      />
    );

    expect(markup).toContain('data-grid-editable="true"');
    expect(markup).toContain('data-pending-delete="true"');
    expect(markup).toContain('data-cell-dirty="true"');
    expect(markup).toContain('pending@example.com');
    expect(markup).toContain('Pending delete');
  });
});
