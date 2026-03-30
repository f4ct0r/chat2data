import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import QueryHistory from './QueryHistory';

vi.mock('@ant-design/icons', () => ({
  PlayCircleOutlined: () => null,
  CheckCircleOutlined: () => null,
  CloseCircleOutlined: () => null,
}));

vi.mock('antd', () => {
  const ListItem = ({
    className,
    children,
    actions,
  }: {
    className?: string;
    children: React.ReactNode;
    actions?: React.ReactNode[];
  }) => (
    <div className={className}>
      <div>{children}</div>
      <div>{actions}</div>
    </div>
  );

  const ListItemWithMeta = ListItem as typeof ListItem & {
    Meta: ({ title, description }: { title: React.ReactNode; description: React.ReactNode }) => React.JSX.Element;
  };

  ListItemWithMeta.Meta = ({ title, description }: { title: React.ReactNode; description: React.ReactNode }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  );

  const List = (({
    className,
    dataSource,
    renderItem,
  }: {
    className?: string;
    dataSource: Array<{ id: string }>;
    renderItem: (item: { id: string }) => React.ReactNode;
  }) => (
    <div className={className}>
      {dataSource.map((item) => (
        <div key={item.id}>{renderItem(item)}</div>
      ))}
    </div>
  )) as ((props: {
    className?: string;
    dataSource: Array<{ id: string }>;
    renderItem: (item: { id: string }) => React.ReactNode;
  }) => React.JSX.Element) & {
    Item: typeof ListItemWithMeta;
  };

  List.Item = ListItemWithMeta;

  return {
    Button: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <button className={className}>{children}</button>,
    List,
    Tag: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <span className={className}>{children}</span>
    ),
  };
});

describe('QueryHistory layout', () => {
  it('keeps the history list container shrinkable and scrollable', () => {
    const markup = renderToStaticMarkup(
      <QueryHistory
        history={[
          {
            id: '1',
            sql: 'select 1',
            durationMs: 8,
            timestamp: 1,
            status: 'success',
          },
        ]}
        onReplay={() => undefined}
      />
    );

    expect(markup).toContain('h-full min-h-0 overflow-auto');
  });

  it('adds spacing hooks for the meta row and replay action alignment', () => {
    const markup = renderToStaticMarkup(
      <QueryHistory
        history={[
          {
            id: '1',
            sql: 'select 1',
            durationMs: 8,
            timestamp: 1,
            status: 'success',
          },
        ]}
        onReplay={() => undefined}
      />
    );

    expect(markup).toContain('query-history-meta-head');
    expect(markup).toContain('query-history-replay-button');
  });

  it('renders the SQL text and inline error row for failed queries', () => {
    const markup = renderToStaticMarkup(
      <QueryHistory
        history={[
          {
            id: '1',
            sql: 'select * from missing_table',
            durationMs: 12,
            timestamp: 1,
            status: 'error',
            error: 'Table not found',
          },
        ]}
        onReplay={() => undefined}
      />
    );

    expect(markup).toContain('select * from missing_table');
    expect(markup).toContain('Table not found');
  });
});
