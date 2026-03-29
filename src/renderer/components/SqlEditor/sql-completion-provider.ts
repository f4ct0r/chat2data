import { CompletionSchemaIndex, ConnectionConfig } from '../../../shared/types';
import { resolveSqlCompletionContext } from '../../../core/agent/sql-completion-context';
import {
  buildSqlCompletionSuggestions,
  SqlCompletionSuggestion,
} from '../../../core/agent/sql-completion-suggestions';

export interface SqlEditorCompletionContext {
  connectionId: string;
  dbType: ConnectionConfig['dbType'];
  database?: string;
  schema?: string;
}

const contextByModelUri = new Map<string, SqlEditorCompletionContext>();
let providerRegistered = false;

const TABLE_CLAUSES = new Set(['from', 'join', 'update']);

const toMonacoKind = (monaco: {
  languages: {
    CompletionItemKind: Record<string, number>;
  };
}, suggestion: SqlCompletionSuggestion) => {
  switch (suggestion.kind) {
    case 'table':
      return monaco.languages.CompletionItemKind.Class;
    case 'column':
      return monaco.languages.CompletionItemKind.Field;
    case 'function':
      return monaco.languages.CompletionItemKind.Function;
    case 'snippet':
      return monaco.languages.CompletionItemKind.Snippet;
    case 'keyword':
    default:
      return monaco.languages.CompletionItemKind.Keyword;
  }
};

const getPrefixFromModel = (
  model: {
    getWordUntilPosition: (position: { lineNumber: number; column: number }) => {
      word: string;
      startColumn: number;
      endColumn: number;
    };
  },
  position: { lineNumber: number; column: number }
) => model.getWordUntilPosition(position).word || '';

const getRangeFromModel = (
  model: {
    getWordUntilPosition: (position: { lineNumber: number; column: number }) => {
      word: string;
      startColumn: number;
      endColumn: number;
    };
  },
  position: { lineNumber: number; column: number }
) => {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
};

export const createSqlCompletionProvider = (
  monaco: {
    languages: {
      CompletionItemKind: Record<string, number>;
    };
  },
  getContext: (model?: { uri?: { toString: () => string } }) => SqlEditorCompletionContext | undefined
) => ({
  provideCompletionItems: async (
    model: {
      uri?: { toString: () => string };
      getValue: () => string;
      getOffsetAt: (position: { lineNumber: number; column: number }) => number;
      getWordUntilPosition: (position: { lineNumber: number; column: number }) => {
        word: string;
        startColumn: number;
        endColumn: number;
      };
    },
    position: { lineNumber: number; column: number }
  ) => {
    const editorContext = getContext(model);
    const sql = model.getValue();
    const prefix = getPrefixFromModel(model, position);
    const cursorOffset = model.getOffsetAt(position);
    const completionContext = resolveSqlCompletionContext(
      sql,
      cursorOffset,
      editorContext?.dbType || 'mysql'
    );
    let schemaIndex: CompletionSchemaIndex | null = null;

    if (editorContext) {
      const canLoadSchemaIndex = Boolean(editorContext.database);

      if (canLoadSchemaIndex) {
        try {
          schemaIndex = await window.api.db.getSchemaIndex(
            editorContext.connectionId,
            editorContext.database,
            editorContext.schema
          );
        } catch {
          schemaIndex = null;
        }
      }

      if (!schemaIndex && TABLE_CLAUSES.has(completionContext.clause)) {
        try {
          const tables = await window.api.db.getTables(
            editorContext.connectionId,
            editorContext.database,
            editorContext.schema
          );
          schemaIndex = {
            database: editorContext.database || '',
            schema: editorContext.schema,
            lastUpdated: Date.now(),
            tables: tables.map((tableName) => ({
              name: tableName,
              columns: [],
            })),
          };
        } catch {
          schemaIndex = null;
        }
      }
    }

    const suggestions = buildSqlCompletionSuggestions(completionContext, schemaIndex, prefix);
    const range = getRangeFromModel(model, position);

    return {
      suggestions: suggestions.map((suggestion) => ({
        label: suggestion.label,
        kind: toMonacoKind(monaco, suggestion),
        insertText: suggestion.insertText,
        detail: suggestion.detail,
        range,
      })),
    };
  },
});

export const registerSqlCompletionProvider = (monaco: {
  languages: {
    registerCompletionItemProvider: (
      language: string,
      provider: ReturnType<typeof createSqlCompletionProvider>
    ) => void;
    CompletionItemKind: Record<string, number>;
  };
}) => {
  if (providerRegistered) {
    return;
  }

  providerRegistered = true;
  monaco.languages.registerCompletionItemProvider(
    'sql',
    createSqlCompletionProvider(monaco, (model) => {
      const key = model?.uri?.toString();
      return key ? contextByModelUri.get(key) : undefined;
    })
  );
};

export const setSqlCompletionContext = (modelUri: string, context: SqlEditorCompletionContext) => {
  contextByModelUri.set(modelUri, context);
};

export const clearSqlCompletionContext = (modelUri: string) => {
  contextByModelUri.delete(modelUri);
};
