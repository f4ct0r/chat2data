import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from '../../../shared/types';
import DataGrid, {
  MIN_COLUMN_WIDTH,
  getInitialColumnWidths,
  resizeColumnWidth,
  shouldRemeasureViewport,
} from './DataGrid';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 36,
    getVirtualItems: () => [
      {
        index: 0,
        size: 36,
        start: 0,
      },
    ],
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
});
