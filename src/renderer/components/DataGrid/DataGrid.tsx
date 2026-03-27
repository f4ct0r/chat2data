import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { QueryResult } from '../../../shared/types';

interface DataGridProps {
  result: QueryResult;
}

export const DataGrid: React.FC<DataGridProps> = ({ result }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const { columns, rows } = result;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // default row height
    overscan: 10,
  });

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No data to display.
      </div>
    );
  }

  // Calculate rough column widths based on header length and some min width
  const colWidths = columns.map((col) => Math.max(col.length * 10 + 32, 100));
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + 48; // 48 is for the # column

  return (
    <div className="h-full w-full flex flex-col overflow-hidden border border-[#333333] rounded-sm bg-[#050505] font-mono text-[#a3a3a3]">
      {/* Scrollable Container */}
      <div
        ref={parentRef}
        className="flex-auto overflow-auto relative custom-scrollbar"
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
                className="flex-none px-4 py-2 border-r border-[#333333] truncate"
                style={{ width: colWidths[idx] }}
                title={col}
              >
                {col}
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
        <span>{result.rowCount} ROWS</span>
        <span>{result.durationMs} MS</span>
      </div>
    </div>
  );
};

export default DataGrid;
