import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SqlScript } from '../../../shared/sql-scripts';
import SqlScriptWorkspace, {
  buildSqlScriptSaveInput,
  createEmptyScriptDraft,
  formatSqlScriptValidationError,
  toScriptDraft,
} from './SqlScriptWorkspace';

vi.mock('../../store/tabStore', () => ({
  useTabStore: () => ({
    tabs: [
      {
        id: 'script-tab-1',
        title: 'Daily Summary',
        type: 'script',
        connectionId: 'conn-1',
        dbType: 'postgres',
        database: 'analytics',
        schema: 'public',
        scriptId: 'script-1',
        scriptDatabaseName: 'analytics',
      },
    ],
    updateTab: vi.fn(),
    addTab: vi.fn(),
  }),
}));

vi.mock('../SqlEditor', () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => <div data-sql-editor-value={value}>sql-editor</div>,
}));

const savedScript: SqlScript = {
  id: 'script-1',
  connectionId: 'conn-1',
  databaseName: 'analytics',
  name: 'Daily Summary',
  description: 'Recurring report',
  sql: 'SELECT * FROM users WHERE id = {{userId}}',
  tags: ['reporting', 'daily'],
  parameters: [
    {
      id: 'param-1',
      name: 'userId',
      label: 'User ID',
      type: 'number',
      required: true,
      defaultValue: '42',
      position: 0,
    },
  ],
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

describe('SqlScriptWorkspace layout', () => {
  it('renders the script workspace shell and action bar', () => {
    vi.stubGlobal('window', {
      api: {
        storage: {
          getSqlScript: vi.fn().mockResolvedValue(savedScript),
          saveSqlScript: vi.fn(),
        },
      },
    });

    const markup = renderToStaticMarkup(<SqlScriptWorkspace tabId="script-tab-1" />);

    expect(markup).toContain('加载到新编辑器');
    expect(markup).toContain('立即执行');
    expect(markup).toContain('data-testid="sql-script-editor"');
    vi.unstubAllGlobals();
  });
});

describe('SqlScriptWorkspace helpers', () => {
  it('creates an empty draft for unsaved script tabs', () => {
    expect(createEmptyScriptDraft()).toEqual({
      name: '',
      description: '',
      tagsText: '',
      sql: '',
      parameters: [],
    });
  });

  it('maps persisted scripts into editable draft state', () => {
    expect(toScriptDraft(savedScript)).toEqual({
      name: 'Daily Summary',
      description: 'Recurring report',
      tagsText: 'reporting, daily',
      sql: 'SELECT * FROM users WHERE id = {{userId}}',
      parameters: [
        {
          id: 'param-1',
          name: 'userId',
          label: 'User ID',
          type: 'number',
          required: true,
          defaultValue: '42',
          position: 0,
        },
      ],
    });
  });

  it('builds save input with trimmed tags and parameter positions', () => {
    expect(
      buildSqlScriptSaveInput('conn-1', 'analytics', 'script-1', {
        name: 'Daily Summary',
        description: 'Recurring report',
        tagsText: ' reporting, daily ',
        sql: 'SELECT * FROM users WHERE id = {{userId}}',
        parameters: [
          {
            name: 'userId',
            label: ' User ID ',
            type: 'number',
            required: true,
            defaultValue: ' 42 ',
            position: 99,
          },
        ],
      })
    ).toEqual({
      id: 'script-1',
      connectionId: 'conn-1',
      databaseName: 'analytics',
      name: 'Daily Summary',
      description: 'Recurring report',
      sql: 'SELECT * FROM users WHERE id = {{userId}}',
      tags: ['reporting', 'daily'],
      parameters: [
        {
          name: 'userId',
          label: 'User ID',
          type: 'number',
          required: true,
          defaultValue: '42',
          position: 0,
        },
      ],
    });
  });

  it('formats placeholder drift into a save error message', () => {
    expect(
      formatSqlScriptValidationError({
        ok: false,
        missingPlaceholders: ['userId'],
        extraParameters: ['unused'],
      })
    ).toBe('Missing parameter definitions: userId | Unused parameters: unused');
  });
});
