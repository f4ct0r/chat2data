import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionSchemaIndex } from '../../../shared/types';

const loaderConfig = vi.fn();
const bundledMonaco = {
  __bundled: true,
  editor: {},
  languages: {},
};

class MockEditorWorker {}
class MockJsonWorker {}
class MockCssWorker {}
class MockHtmlWorker {}
class MockTsWorker {}

vi.mock('@monaco-editor/react', async () => {
  const React = await import('react');

  return {
    __esModule: true,
    default: () => React.createElement('div'),
    loader: {
      config: loaderConfig,
    },
    useMonaco: () => null,
  };
});

vi.mock('monaco-editor', () => ({
  __esModule: true,
  ...bundledMonaco,
}));

vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({
  __esModule: true,
  default: MockEditorWorker,
}));

vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({
  __esModule: true,
  default: MockJsonWorker,
}));

vi.mock('monaco-editor/esm/vs/language/css/css.worker?worker', () => ({
  __esModule: true,
  default: MockCssWorker,
}));

vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({
  __esModule: true,
  default: MockHtmlWorker,
}));

vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({
  __esModule: true,
  default: MockTsWorker,
}));

describe('SqlEditor Monaco bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    loaderConfig.mockClear();
    delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment;
  });

  it('configures the Monaco loader to use the bundled monaco module instead of CDN paths', async () => {
    await import('./SqlEditor');

    expect(loaderConfig).toHaveBeenCalledTimes(1);
    expect(loaderConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        monaco: expect.objectContaining({
          __bundled: true,
        }),
      })
    );
    expect(loaderConfig.mock.calls[0][0]).not.toHaveProperty('paths');
  });

  it('installs a MonacoEnvironment worker router for bundled language workers', async () => {
    await import('./SqlEditor');

    const monacoEnvironment = (
      globalThis as typeof globalThis & {
        MonacoEnvironment?: {
          getWorker: (_moduleId: string, label: string) => unknown;
        };
      }
    ).MonacoEnvironment;

    expect(monacoEnvironment).toBeDefined();
    expect(monacoEnvironment?.getWorker('', 'json')).toBeInstanceOf(MockJsonWorker);
    expect(monacoEnvironment?.getWorker('', 'css')).toBeInstanceOf(MockCssWorker);
    expect(monacoEnvironment?.getWorker('', 'html')).toBeInstanceOf(MockHtmlWorker);
    expect(monacoEnvironment?.getWorker('', 'javascript')).toBeInstanceOf(MockTsWorker);
    expect(monacoEnvironment?.getWorker('', 'sql')).toBeInstanceOf(MockEditorWorker);
  });
});

describe('sql execute shortcut detection', () => {
  it('matches Command+Enter on macOS', async () => {
    const { isSqlExecuteShortcut } = await import('./sql-shortcuts');

    expect(
      isSqlExecuteShortcut({
        platform: 'MacIntel',
        key: 'Enter',
        metaKey: true,
        ctrlKey: false,
      })
    ).toBe(true);
  });

  it('matches Control+Enter on Windows', async () => {
    const { isSqlExecuteShortcut } = await import('./sql-shortcuts');

    expect(
      isSqlExecuteShortcut({
        platform: 'Win32',
        key: 'Enter',
        metaKey: false,
        ctrlKey: true,
      })
    ).toBe(true);
  });

  it('does not match Control+Enter on macOS', async () => {
    const { isSqlExecuteShortcut } = await import('./sql-shortcuts');

    expect(
      isSqlExecuteShortcut({
        platform: 'MacIntel',
        key: 'Enter',
        metaKey: false,
        ctrlKey: true,
      })
    ).toBe(false);
  });
});

describe('sql completion provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const windowObject = globalThis as typeof globalThis & Window;
    windowObject.window = windowObject;
    windowObject.api = {
      db: {
        getSchemaIndex: vi.fn(),
        getTables: vi.fn(),
      },
    } as unknown as Window['api'];
  });

  it('returns table suggestions after FROM', async () => {
    const schemaIndex: CompletionSchemaIndex = {
      database: 'analytics',
      schema: 'public',
      lastUpdated: 1,
      tables: [{ name: 'users', columns: [{ name: 'id', type: 'uuid' }] }],
    };

    vi.mocked(window.api.db.getSchemaIndex).mockResolvedValue(schemaIndex);

    const { createSqlCompletionProvider } = await import('./sql-completion-provider');

    const provider = createSqlCompletionProvider({
      languages: {
        CompletionItemKind: {
          Keyword: 14,
          Snippet: 27,
          Field: 5,
          Function: 1,
          Class: 6,
        },
      },
    } as never, () => ({
      connectionId: 'conn-1',
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
    }));

    const result = await provider.provideCompletionItems(
      {
        getValue: () => 'SELECT * FROM us',
        getOffsetAt: () => 'SELECT * FROM us'.length,
        getWordUntilPosition: () => ({
          word: 'us',
          startColumn: 15,
          endColumn: 17,
        }),
      } as never,
      { lineNumber: 1, column: 'SELECT * FROM us'.length + 1 } as never
    );

    expect(result.suggestions[0]).toMatchObject({
      label: 'users',
    });
  });

  it('returns alias scoped column suggestions after member access', async () => {
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
      ],
    };

    vi.mocked(window.api.db.getSchemaIndex).mockResolvedValue(schemaIndex);

    const { createSqlCompletionProvider } = await import('./sql-completion-provider');

    const provider = createSqlCompletionProvider({
      languages: {
        CompletionItemKind: {
          Keyword: 14,
          Snippet: 27,
          Field: 5,
          Function: 1,
          Class: 6,
        },
      },
    } as never, () => ({
      connectionId: 'conn-1',
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
    }));

    const result = await provider.provideCompletionItems(
      {
        getValue: () => 'SELECT * FROM users u WHERE u.',
        getOffsetAt: () => 'SELECT * FROM users u WHERE u.'.length,
        getWordUntilPosition: () => ({
          word: '',
          startColumn: 31,
          endColumn: 31,
        }),
      } as never,
      { lineNumber: 1, column: 'SELECT * FROM users u WHERE u.'.length + 1 } as never
    );

    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'id' }),
        expect.objectContaining({ label: 'email' }),
      ])
    );
  });

  it('falls back to keyword suggestions when schema lookup fails', async () => {
    vi.mocked(window.api.db.getSchemaIndex).mockRejectedValue(new Error('boom'));

    const { createSqlCompletionProvider } = await import('./sql-completion-provider');

    const provider = createSqlCompletionProvider({
      languages: {
        CompletionItemKind: {
          Keyword: 14,
          Snippet: 27,
          Field: 5,
          Function: 1,
          Class: 6,
        },
      },
    } as never, () => ({
      connectionId: 'conn-1',
      dbType: 'postgres',
      database: 'analytics',
      schema: 'public',
    }));

    const result = await provider.provideCompletionItems(
      {
        getValue: () => 'SEL',
        getOffsetAt: () => 3,
        getWordUntilPosition: () => ({
          word: 'SEL',
          startColumn: 1,
          endColumn: 4,
        }),
      } as never,
      { lineNumber: 1, column: 4 } as never
    );

    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'SELECT' }),
      ])
    );
  });

  it('falls back to table listing when schema indexing has no database context', async () => {
    vi.mocked(window.api.db.getTables).mockResolvedValue(['users', 'user_events']);

    const { createSqlCompletionProvider } = await import('./sql-completion-provider');

    const provider = createSqlCompletionProvider({
      languages: {
        CompletionItemKind: {
          Keyword: 14,
          Snippet: 27,
          Field: 5,
          Function: 1,
          Class: 6,
        },
      },
    } as never, () => ({
      connectionId: 'conn-1',
      dbType: 'postgres',
      schema: 'public',
    }));

    const result = await provider.provideCompletionItems(
      {
        getValue: () => 'SELECT * FROM us',
        getOffsetAt: () => 'SELECT * FROM us'.length,
        getWordUntilPosition: () => ({
          word: 'us',
          startColumn: 15,
          endColumn: 17,
        }),
      } as never,
      { lineNumber: 1, column: 'SELECT * FROM us'.length + 1 } as never
    );

    expect(window.api.db.getSchemaIndex).not.toHaveBeenCalled();
    expect(window.api.db.getTables).toHaveBeenCalledWith('conn-1', undefined, 'public');
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'users' }),
        expect.objectContaining({ label: 'user_events' }),
      ])
    );
  });
});
