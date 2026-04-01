import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { TabData } from '../../../shared/types';
import { createTableEditBuffer } from '../../features/table-edit-buffer';
import { generateTableEditSql } from '../../features/table-edit-sql';
import SqlWorkspace from './SqlWorkspace';
import {
  coerceEditablePreviewCellValue,
  getEditablePreviewApplyBuffer,
  getEditablePreviewApplyError,
} from './sql-workspace-utils';

const dataGridPropsState = vi.hoisted(() => ({
  editablePreviewPresent: false,
}));

const queryHistoryPropsState = vi.hoisted(() => ({
  onReplay: null as null | ((sql: string) => void),
}));

const editablePreviewViewState = vi.hoisted(() => ({
  current: {
    mode: 'hidden' as 'hidden' | 'editable' | 'read-only',
    showToolbar: false,
  } as {
    mode: 'hidden' | 'editable' | 'read-only';
    showToolbar: boolean;
    pendingChangeCount?: number;
    readOnlyReason?: string;
  },
}));

const tabsState = vi.hoisted(() => ({
  current: [
    {
      id: 'tab-1',
      type: 'sql',
      title: 'Users',
      connectionId: 'conn-1',
      dbType: 'postgres',
      content: 'select 1;',
      completionCacheStatus: 'idle',
    },
  ] as TabData[],
}));

const updateTabMock = vi.hoisted(() => vi.fn());
vi.mock('../SqlEditor', () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => <div data-sql-editor-value={value}>sql-editor</div>,
}));

vi.mock('../DataGrid/DataGrid', () => ({
  __esModule: true,
  default: ({ editablePreview }: { editablePreview?: unknown }) => {
    dataGridPropsState.editablePreviewPresent = Boolean(editablePreview);
    return (
      <div data-grid-editable-preview={editablePreview ? 'true' : 'false'}>
        data-grid
      </div>
    );
  },
}));

vi.mock('../QueryHistory/QueryHistory', () => ({
  __esModule: true,
  default: ({
    onReplay,
  }: {
    history: Array<{ id: string; sql: string }>;
    onReplay: (sql: string) => void;
  }) => {
    queryHistoryPropsState.onReplay = onReplay;
    return <div>query-history</div>;
  },
}));

vi.mock('@ant-design/icons', () => ({
  CaretRightOutlined: () => null,
  ExclamationCircleOutlined: () => null,
}));

vi.mock('antd', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Modal: { confirm: vi.fn() },
  Tabs: ({
    className,
    items,
  }: {
    className?: string;
    items: Array<{ key: string; label?: React.ReactNode; children: React.ReactNode }>;
  }) => (
    <div className={className}>
      <div className="ant-tabs-nav-list">
        {items.map((item) => (
          <div key={`${item.key}-label`} className="ant-tabs-tab">
            {item.label}
          </div>
        ))}
      </div>
      <div className="ant-tabs-content-holder">
        <div className="ant-tabs-content">
          {items.map((item) => (
            <div key={item.key} className="ant-tabs-tabpane">
              {item.children}
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
  Typography: {
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock('../../store/tabStore', () => ({
  useTabStore: () => ({
    tabs: tabsState.current,
    updateTab: updateTabMock,
  }),
}));

vi.mock('../../../core/security/sql-classifier', () => ({
  SqlClassifier: {
    classify: () => ({ level: 'ReadOnly', operation: 'SELECT' }),
  },
  SqlRiskLevel: {
    DANGEROUS: 'Dangerous',
  },
}));

vi.mock('../SqlEditor/sql-execution', () => ({
  resolveExecutableSql: () => 'select 1;',
}));

vi.mock('./sql-workspace-state', () => ({
  getExecutionDisplayState: () => ({
    kind: 'data',
    result: {
      columns: ['id'],
      rows: [{ id: 1 }],
      rowCount: 1,
      durationMs: 5,
    },
  }),
}));

vi.mock('./editable-preview-state', () => ({
  getEditablePreviewViewState: () => editablePreviewViewState.current,
  getPostApplyNotice: () => null,
}));

describe('SqlWorkspace layout', () => {
  beforeEach(() => {
    editablePreviewViewState.current = {
      mode: 'hidden',
      showToolbar: false,
    };
    tabsState.current = [
      {
        id: 'tab-1',
        type: 'sql',
        title: 'Users',
        connectionId: 'conn-1',
        dbType: 'postgres',
        content: 'select 1;',
        completionCacheStatus: 'idle',
      },
    ];
    dataGridPropsState.editablePreviewPresent = false;
    queryHistoryPropsState.onReplay = null;
    updateTabMock.mockReset();
    updateTabMock.mockImplementation((tabId: string, patch: Partial<TabData>) => {
      tabsState.current = tabsState.current.map((tab) =>
        tab.id === tabId ? { ...tab, ...patch } : tab
      );
    });
    vi.stubGlobal('window', {
      api: {
        db: {
          executeQuery: vi.fn().mockResolvedValue({
            columns: ['id'],
            rows: [{ id: 1 }],
            rowCount: 1,
            durationMs: 5,
          }),
          getTableEditMetadata: vi.fn(),
        },
      },
    });
  });

  it('keeps result and history panes shrinkable inside tabs', () => {
    const markup = renderToStaticMarkup(<SqlWorkspace tabId="tab-1" />);

    expect(markup).toContain('flex flex-col flex-1 min-h-0 w-full bg-[#0a0a0a]');
    expect(markup).toContain('flex flex-col flex-1 min-h-0 bg-[#0a0a0a] overflow-hidden');
    expect(markup).toContain('flex-1 min-h-0 p-3 overflow-hidden bg-[#050505] flex flex-col');
  });

  it('renders tab labels with dedicated spacing hooks', () => {
    const markup = renderToStaticMarkup(<SqlWorkspace tabId="tab-1" />);

    expect(markup).toContain('chat2data-sql-tab-label');
  });

  it('renders the editable preview shell and passes editable preview props into the grid', () => {
    editablePreviewViewState.current = {
      mode: 'editable',
      showToolbar: true,
      pendingChangeCount: 2,
    };
    tabsState.current = [
      {
        id: 'tab-1',
        type: 'sql',
        title: 'Users',
        connectionId: 'conn-1',
        dbType: 'postgres',
        content: 'select 1;',
        completionCacheStatus: 'idle',
        previewTable: {
          dbType: 'postgres',
          database: 'analytics',
          schema: 'public',
          table: 'users',
          previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
        },
      },
    ];

    const markup = renderToStaticMarkup(<SqlWorkspace tabId="tab-1" />);

    expect(markup).toContain('editable-preview-shell');
    expect(markup).toContain('data-grid-editable-preview="true"');
    expect(dataGridPropsState.editablePreviewPresent).toBe(true);
  });

  it('renders the read-only reason hook for non-editable preview tables', () => {
    editablePreviewViewState.current = {
      mode: 'read-only',
      showToolbar: false,
      readOnlyReason: 'No primary key.',
    };
    tabsState.current = [
      {
        id: 'tab-1',
        type: 'sql',
        title: 'Users',
        connectionId: 'conn-1',
        dbType: 'postgres',
        content: 'select 1;',
        completionCacheStatus: 'idle',
        previewTable: {
          dbType: 'postgres',
          database: 'analytics',
          schema: 'public',
          table: 'users',
          previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
        },
      },
    ];

    const markup = renderToStaticMarkup(<SqlWorkspace tabId="tab-1" />);

    expect(markup).toContain('editable-preview-shell');
    expect(markup).toContain('editable-preview-readonly-reason');
    expect(markup).toContain('No primary key.');
  });

  it('replays a history entry by updating the editor content and scheduling execution', () => {
    renderToStaticMarkup(<SqlWorkspace tabId="tab-1" />);

    expect(queryHistoryPropsState.onReplay).not.toBeNull();
    queryHistoryPropsState.onReplay?.('select 1;');

    expect(updateTabMock).toHaveBeenCalledWith('tab-1', {
      content: 'select 1;',
      pendingAutoExecute: {
        kind: 'query-history-replay',
      },
    });
    expect(tabsState.current[0]).toMatchObject({
      content: 'select 1;',
      pendingAutoExecute: {
        kind: 'query-history-replay',
      },
    });
  });
});

describe('getEditablePreviewApplyError', () => {
  it('returns the backend rejection message when executeBatch rejects', () => {
    expect(
      getEditablePreviewApplyError({
        batchExecutionError: new Error('Connection dropped'),
      })
    ).toBe('Connection dropped');
  });
});

describe('getEditablePreviewApplyBuffer', () => {
  const previewTable = {
    dbType: 'postgres' as const,
    database: 'analytics',
    schema: 'public',
    table: 'users',
    previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
  };

  it('flushes the active editing draft into the effective apply buffer', () => {
    const buffer = createTableEditBuffer([{ id: 1, name: 'Ada' }], ['id']);
    const rowId = buffer.rows[0].rowId;
    const effectiveBuffer = getEditablePreviewApplyBuffer({
      editBuffer: buffer,
      editingCell: {
        rowId,
        column: 'name',
      },
      editingValue: 'Mina',
    });

    const result = generateTableEditSql(effectiveBuffer, previewTable);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.batchStatements).toEqual([
      'UPDATE "analytics"."public"."users" SET "name" = \'Mina\' WHERE "id" = 1',
    ]);
  });
});

describe('coerceEditablePreviewCellValue', () => {
  it('does not coerce a blank numeric input to zero', () => {
    expect(coerceEditablePreviewCellValue('', 7)).toBe('');
  });

  it('keeps a blank numeric draft out of generated SQL zero-coercion', () => {
    const previewTable = {
      dbType: 'postgres' as const,
      database: 'analytics',
      schema: 'public',
      table: 'users',
      previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
    };
    const buffer = createTableEditBuffer([{ id: 1, score: 7 }], ['id']);
    const rowId = buffer.rows[0].rowId;
    const effectiveBuffer = getEditablePreviewApplyBuffer({
      editBuffer: buffer,
      editingCell: {
        rowId,
        column: 'score',
      },
      editingValue: '',
    });
    const result = generateTableEditSql(effectiveBuffer, previewTable);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.batchStatements).toEqual([
      'UPDATE "analytics"."public"."users" SET "score" = \'\' WHERE "id" = 1',
    ]);
  });
});
