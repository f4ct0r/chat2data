import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ConnectionWorkspaceSidebar from './ConnectionWorkspaceSidebar';

describe('ConnectionWorkspaceSidebar', () => {
  it('shows the connection list and collapse control when a connection is selected and the list is expanded', () => {
    const markup = renderToStaticMarkup(
      <ConnectionWorkspaceSidebar
        selectedConnectionId="conn-1"
        isConnectionListCollapsed={false}
        onToggleConnectionList={() => undefined}
        collapseButtonLabel="Collapse connection list"
        expandButtonLabel="Expand connection list"
        connectionList={<div>connection-list-panel</div>}
        objectBrowser={<div>object-browser-panel</div>}
      />
    );

    expect(markup).toContain('connection-list-panel');
    expect(markup).toContain('object-browser-panel');
    expect(markup).toContain('aria-label="Collapse connection list"');
  });

  it('hides only the connection list when collapsed and keeps the object browser visible', () => {
    const markup = renderToStaticMarkup(
      <ConnectionWorkspaceSidebar
        selectedConnectionId="conn-1"
        isConnectionListCollapsed
        onToggleConnectionList={() => undefined}
        collapseButtonLabel="Collapse connection list"
        expandButtonLabel="Expand connection list"
        connectionList={<div>connection-list-panel</div>}
        objectBrowser={<div>object-browser-panel</div>}
      />
    );

    expect(markup).not.toContain('connection-list-panel');
    expect(markup).toContain('object-browser-panel');
    expect(markup).toContain('aria-label="Expand connection list"');
  });

  it('forces the connection list visible and removes the toggle when no connection is selected', () => {
    const markup = renderToStaticMarkup(
      <ConnectionWorkspaceSidebar
        selectedConnectionId={null}
        isConnectionListCollapsed
        onToggleConnectionList={() => undefined}
        collapseButtonLabel="Collapse connection list"
        expandButtonLabel="Expand connection list"
        connectionList={<div>connection-list-panel</div>}
        objectBrowser={null}
      />
    );

    expect(markup).toContain('connection-list-panel');
    expect(markup).not.toContain('aria-label="Collapse connection list"');
    expect(markup).not.toContain('aria-label="Expand connection list"');
  });
});
