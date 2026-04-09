import { describe, expect, it } from 'vitest';
import { resolveConnectionListCollapsedState } from './connection-list-collapse';

describe('resolveConnectionListCollapsedState', () => {
  it('auto-collapses after a successful connection while the connections view is active', () => {
    expect(
      resolveConnectionListCollapsedState({
        currentCollapsed: false,
        activeView: 'connections',
        selectedConnectionId: 'conn-1',
      })
    ).toBe(true);
  });

  it('preserves the manual collapse state outside the connections view', () => {
    expect(
      resolveConnectionListCollapsedState({
        currentCollapsed: false,
        activeView: 'dashboard',
        selectedConnectionId: 'conn-1',
      })
    ).toBe(false);
  });

  it('forces the connection list open when there is no selected connection', () => {
    expect(
      resolveConnectionListCollapsedState({
        currentCollapsed: true,
        activeView: 'connections',
        selectedConnectionId: null,
      })
    ).toBe(false);
  });
});
