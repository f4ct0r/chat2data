import { describe, expect, it } from 'vitest';
import { buildRootNodes, buildScriptNode, removeNodeFromTree } from './object-browser';

describe('ObjectBrowser root node selection', () => {
  it('restricts root nodes to the configured connection database when one is provided', () => {
    expect(buildRootNodes(['analytics', 'warehouse'], 'analytics')).toEqual([
      {
        key: 'db:analytics',
        title: 'analytics',
        type: 'database',
        database: 'analytics',
        isLeaf: false,
        children: [
          {
            key: 'script-folder:analytics',
            title: 'Scripts',
            type: 'scriptFolder',
            database: 'analytics',
            isLeaf: false,
          },
        ],
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
        children: [
          {
            key: 'script-folder:analytics',
            title: 'Scripts',
            type: 'scriptFolder',
            database: 'analytics',
            isLeaf: false,
          },
        ],
      },
      {
        key: 'db:warehouse',
        title: 'warehouse',
        type: 'database',
        database: 'warehouse',
        isLeaf: false,
        children: [
          {
            key: 'script-folder:warehouse',
            title: 'Scripts',
            type: 'scriptFolder',
            database: 'warehouse',
            isLeaf: false,
          },
        ],
      },
    ]);
  });

  it('returns an empty root node list when the configured database is not in the discovered database list', () => {
    expect(buildRootNodes(['postgres', 'template1'], 'flywheel')).toEqual([]);
  });

  it('creates dedicated script item nodes that stay distinct from schema and table nodes', () => {
    expect(buildScriptNode('analytics', 'script-1', 'Daily Summary')).toEqual({
      key: 'script:analytics:script-1',
      title: 'Daily Summary',
      type: 'script',
      database: 'analytics',
      scriptId: 'script-1',
      isLeaf: true,
    });
  });

  it('removes deleted script nodes without disturbing sibling database children', () => {
    expect(
      removeNodeFromTree(
        [
          {
            key: 'db:analytics',
            title: 'analytics',
            type: 'database',
            database: 'analytics',
            isLeaf: false,
            children: [
              {
                key: 'script-folder:analytics',
                title: 'Scripts',
                type: 'scriptFolder',
                database: 'analytics',
                isLeaf: false,
                children: [
                  buildScriptNode('analytics', 'script-1', 'Daily Summary'),
                  buildScriptNode('analytics', 'script-2', 'Weekly Summary'),
                ],
              },
              {
                key: 'schema:analytics:public',
                title: 'public',
                type: 'schema',
                database: 'analytics',
                schema: 'public',
                isLeaf: false,
              },
            ],
          },
        ],
        'script:analytics:script-1'
      )
    ).toEqual([
      {
        key: 'db:analytics',
        title: 'analytics',
        type: 'database',
        database: 'analytics',
        isLeaf: false,
        children: [
          {
            key: 'script-folder:analytics',
            title: 'Scripts',
            type: 'scriptFolder',
            database: 'analytics',
            isLeaf: false,
            children: [buildScriptNode('analytics', 'script-2', 'Weekly Summary')],
          },
          {
            key: 'schema:analytics:public',
            title: 'public',
            type: 'schema',
            database: 'analytics',
            schema: 'public',
            isLeaf: false,
          },
        ],
      },
    ]);
  });
});
