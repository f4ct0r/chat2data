import { describe, expect, it } from 'vitest';
import { buildRootNodes } from './object-browser';

describe('ObjectBrowser root node selection', () => {
  it('restricts root nodes to the configured connection database when one is provided', () => {
    expect(buildRootNodes(['analytics', 'warehouse'], 'analytics')).toEqual([
      {
        key: 'db:analytics',
        title: 'analytics',
        type: 'database',
        database: 'analytics',
        isLeaf: false,
      },
    ]);
  });

  it('shows all discovered databases when the connection has no configured default database', () => {
    expect(buildRootNodes(['analytics', 'warehouse'], undefined)).toEqual([
      {
        key: 'db:analytics',
        title: 'analytics',
        type: 'database',
        database: 'analytics',
        isLeaf: false,
      },
      {
        key: 'db:warehouse',
        title: 'warehouse',
        type: 'database',
        database: 'warehouse',
        isLeaf: false,
      },
    ]);
  });

  it('returns an empty root node list when the configured database is not in the discovered database list', () => {
    expect(buildRootNodes(['postgres', 'template1'], 'flywheel')).toEqual([]);
  });
});
