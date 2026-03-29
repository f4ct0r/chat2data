import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { QueryResult } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nProvider';

interface DataGridProps {
  result: QueryResult;
}

export const MIN_COLUMN_WIDTH = 100;

const getDefaultColumnWidth = (column: string) =>
  Math.max(column.length * 10 + 32, MIN_COLUMN_WIDTH);

export const getInitialColumnWidths = (
  columns: string[],
  existingWidths: Record<string, number> = {}
) =>
  columns.reduce<Record<string, number>>((widths, column) => {
    widths[column] = existingWidths[column] ?? getDefaultColumnWidth(column);
    return widths;
  }, {});

export const resizeColumnWidth = (currentWidth: number, deltaX: number) =>
  Math.max(MIN_COLUMN_WIDTH, currentWidth + deltaX);

type ViewportSize = {
  width: number;
  height: number;
};

export const shouldRemeasureViewport = (
  previous: ViewportSize | null,
  next: ViewportSize
) => {
  if (next.width <= 0 || next.height <= 0) {
    return false;
  }

  if (!previous) {
    return true;
  }

  return previous.width !== next.width || previous.height !== next.height;
};

export const DataGrid: React.FC<DataGridProps> = ({ result }) => {
  const { t } = useI18n();
  const parentRef = useRef<HTMLDivElement>(null);
  const viewportSizeRef = useRef<ViewportSize | null>(null);
  const resizeStateRef = useRef<{
    column: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const { columns, rows } = result;
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    getInitialColumnWidths(columns)
  );

  useEffect(() => {
    setColumnWidths((currentWidths) => getInitialColumnWidths(columns, currentWidths));
  }, [columns]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const nextWidth = resizeColumnWidth(
        resizeState.startWidth,
        event.clientX - resizeState.startX
      );

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [resizeState.column]: nextWidth,
      }));
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // default row height
    overscan: 10,
  });

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) {
      return;
    }

    let frameId: number | null = null;

    const readViewportSize = (): ViewportSize => ({
      width: parent.clientWidth,
      height: parent.clientHeight,
    });

    const syncViewport = () => {
      const nextSize = readViewportSize();
      const shouldMeasure = shouldRemeasureViewport(viewportSizeRef.current, nextSize);
      viewportSizeRef.current = nextSize;

      if (shouldMeasure) {
        rowVirtualizer.measure();
      }
    };

    const scheduleSync = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        syncViewport();
      });
    };

    scheduleSync();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleSync);

      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }

        window.removeEventListener('resize', scheduleSync);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });

    resizeObserver.observe(parent);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();
    };
  }, [columns, rows.length, rowVirtualizer]);

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('dataGrid.noData')}
      </div>
    );
  }

  const colWidths = columns.map((col) => columnWidths[col] ?? getDefaultColumnWidth(col));
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + 48; // 48 is for the # column

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden border border-[#333333] rounded-sm bg-[#050505] font-mono text-[#a3a3a3]">
      {/* Scrollable Container */}
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-auto relative custom-scrollbar"
      >
        <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
          {/* Sticky Header */}
          <div 
            className="flex bg-[#121212] border-b border-[#333333] font-semibold text-sm sticky top-0 z-10 text-[#FF5722]"
          >
            {/* Row Number Header */}
            <div className="flex-none w-12 border-r border-[#333333] px-2 py-2 text-center text-[#737373] bg-[#121212] sticky left-0 z-20">
              #
            </div>
            {columns.map((col, idx) => (
              <div
                key={col}
                className="relative flex-none border-r border-[#333333] truncate"
                style={{ width: colWidths[idx] }}
                title={col}
              >
                <div className="px-4 py-2 pr-5">{col}</div>
                <button
                  type="button"
                  aria-label={`Resize ${col} column`}
                  data-column-resize-handle={col}
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize border-l border-[#333333] bg-[#121212] hover:bg-[#FF5722]/20"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    resizeStateRef.current = {
                      column: col,
                      startX: event.clientX,
                      startWidth: colWidths[idx],
                    };
                  }}
                />
              </div>
            ))}
          </div>

          {/* Virtualized Body */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index] ?? {};
              return (
                <div
                  key={virtualRow.index}
                  className={`absolute top-0 left-0 flex text-sm border-b border-[#1a1a1a] hover:bg-[#FF5722]/10 hover:text-[#00ff00] transition-colors ${
                    virtualRow.index % 2 === 0 ? 'bg-[#0a0a0a]' : 'bg-[#050505]'
                  }`}
                  style={{
                    height: `${virtualRow.size}px`,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {/* Row Number */}
                  <div className="flex-none w-12 border-r border-[#1a1a1a] px-2 py-2 text-center text-[#737373] bg-[#050505] sticky left-0 z-10">
                    {virtualRow.index + 1}
                  </div>
                  {columns.map((col, colIdx) => {
                    const val = row[col];
                    const displayVal = val === null ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                    return (
                      <div
                        key={colIdx}
                        className={`flex-none px-4 py-2 border-r border-[#1a1a1a] truncate ${
                          val === null ? 'text-[#737373] italic' : ''
                        }`}
                        style={{ width: colWidths[colIdx] }}
                        title={displayVal}
                      >
                        {displayVal}
                      </div>
                    );
                  })}
              </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="bg-[#121212] border-t border-[#333333] px-4 py-1 flex-none text-xs text-[#00ff00] flex justify-between tracking-wider">
        <span>{t('dataGrid.rows', { count: result.rowCount })}</span>
        <span>{t('dataGrid.ms', { count: result.durationMs })}</span>
      </div>
    </div>
  );
};

export default DataGrid;
