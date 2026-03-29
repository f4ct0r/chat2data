import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceTabs from './WorkspaceTabs';

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
    tabs: [
      {
        id: 'tab-1',
        title: 'sql',
        type: 'sql',
        connectionId: 'conn-1',
      },
    ],
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

describe('WorkspaceTabs layout', () => {
  it('keeps the active workspace tab shrinkable through the wrapper chain', () => {
    const markup = renderToStaticMarkup(<WorkspaceTabs />);

    expect(markup).toContain('h-full min-h-0 flex flex-col');
    expect(markup).toContain('h-full min-h-0 workspace-tabs');
    expect(markup).toContain(
      'flex-1 min-h-0 flex flex-col overflow-hidden bg-[#050505] rounded-b-sm border-x border-b border-[#333333]'
    );
  });
});
