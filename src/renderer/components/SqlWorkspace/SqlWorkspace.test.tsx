import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SqlWorkspace from './SqlWorkspace';

vi.mock('../SqlEditor', () => ({
  __esModule: true,
  default: () => <div>sql-editor</div>,
}));

vi.mock('../DataGrid/DataGrid', () => ({
  __esModule: true,
  default: () => <div>data-grid</div>,
}));

vi.mock('../QueryHistory/QueryHistory', () => ({
  __esModule: true,
  default: () => <div>query-history</div>,
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
    tabs: [
      {
        id: 'tab-1',
        type: 'sql',
        connectionId: 'conn-1',
        dbType: 'postgres',
        database: 'analytics',
        schema: 'public',
        content: 'select 1;',
        completionCacheStatus: 'idle',
      },
    ],
    updateTab: vi.fn(),
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

describe('SqlWorkspace layout', () => {
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
});
