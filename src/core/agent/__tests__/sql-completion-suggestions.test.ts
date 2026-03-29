import { describe, expect, it } from 'vitest';
import { CompletionSchemaIndex } from '../../../shared/types';
import { SqlCompletionContext } from '../sql-completion-context';

const schemaIndex: CompletionSchemaIndex = {
  database: 'analytics',
  schema: 'public',
  lastUpdated: 1,
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid' },
        { name: 'email', type: 'text' },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid' },
        { name: 'user_id', type: 'uuid' },
      ],
    },
  ],
};

describe('buildSqlCompletionSuggestions', () => {
  it('returns fallback keyword suggestions without schema metadata', async () => {
    const { buildSqlCompletionSuggestions } = await import('../sql-completion-suggestions');

    const suggestions = buildSqlCompletionSuggestions(
      {
        source: 'heuristic',
        clause: 'select',
        aliases: {},
      },
      null,
      ''
    );

    expect(suggestions.some((item) => item.label === 'SELECT')).toBe(true);
    expect(suggestions.some((item) => item.kind === 'keyword')).toBe(true);
  });

  it('returns table suggestions after FROM', async () => {
    const { buildSqlCompletionSuggestions } = await import('../sql-completion-suggestions');

    const context: SqlCompletionContext = {
      source: 'heuristic',
      clause: 'from',
      aliases: {},
    };

    const suggestions = buildSqlCompletionSuggestions(context, schemaIndex, 'us');

    expect(suggestions[0]).toMatchObject({
      label: 'users',
      kind: 'table',
    });
  });

  it('returns alias-scoped column suggestions and decorates ambiguous columns', async () => {
    const { buildSqlCompletionSuggestions } = await import('../sql-completion-suggestions');

    const context: SqlCompletionContext = {
      source: 'heuristic',
      clause: 'where',
      memberAccess: 'u',
      aliases: {
        u: { tableName: 'users' },
        o: { tableName: 'orders' },
      },
    };

    const suggestions = buildSqlCompletionSuggestions(context, schemaIndex, 'i');

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'id',
          kind: 'column',
          detail: 'users.id',
        }),
      ])
    );
    expect(suggestions.some((item) => item.detail === 'orders.id')).toBe(false);
  });
});
