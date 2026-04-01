import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceTabs from './WorkspaceTabs';

const tabsState = vi.hoisted(() => ({
  current: [
    {
      id: 'tab-1',
      title: 'sql',
      type: 'sql' as const,
      connectionId: 'conn-1',
    },
  ] as Array<{
    id: string;
    title: string;
    type: 'sql' | 'chat' | 'script';
    connectionId: string;
    database?: string;
    scriptId?: string;
  }>,
}));

vi.mock('@ant-design/icons', () => ({
  CodeOutlined: () => null,
  MessageOutlined: () => null,
}));

vi.mock('antd', () => ({
  Tabs: ({
    className,
    items,
  }: {
    className?: string;
    items: Array<{ key: string; children: React.ReactNode }>;
  }) => (
    <div className={className}>
      <div className="ant-tabs-content-holder">
        <div className="ant-tabs-content">
          {items.map((item, index) => (
            <div
              key={item.key}
              className={index === 0 ? 'ant-tabs-tabpane ant-tabs-tabpane-active' : 'ant-tabs-tabpane'}
            >
              {item.children}
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
}));

vi.mock('../../store/tabStore', () => ({
  useTabStore: () => ({
    tabs: tabsState.current,
    activeTabId: 'tab-1',
    setActiveTab: vi.fn(),
    closeTab: vi.fn(),
    addTab: vi.fn(),
  }),
}));

vi.mock('../SqlWorkspace/SqlWorkspace', () => ({
  __esModule: true,
  default: () => <div>sql-workspace</div>,
}));

vi.mock('../Chat/ChatPanel', () => ({
  __esModule: true,
  default: () => <div>chat-panel</div>,
}));

vi.mock('../SqlScripts/SqlScriptWorkspace', () => ({
  __esModule: true,
  default: () => <div>sql-script-workspace</div>,
}));

describe('WorkspaceTabs layout', () => {
  it('keeps the active workspace tab shrinkable through the wrapper chain', () => {
    const markup = renderToStaticMarkup(<WorkspaceTabs />);

    expect(markup).toContain('h-full min-h-0 flex flex-col');
    expect(markup).toContain('h-full min-h-0 workspace-tabs');
    expect(markup).toContain(
      'flex-1 min-h-0 flex flex-col overflow-hidden bg-[#050505] rounded-b-sm border-x border-b border-[#333333]'
    );
  });

  it('routes script tabs into the SQL script workspace', () => {
    tabsState.current = [
      {
        id: 'script-1',
        title: 'daily-summary',
        type: 'script',
        connectionId: 'conn-1',
        database: 'analytics',
        scriptId: 'script-1',
      },
    ];

    const markup = renderToStaticMarkup(<WorkspaceTabs />);

    expect(markup).toContain('sql-script-workspace');
    expect(markup).not.toContain('chat-panel');
  });
});
