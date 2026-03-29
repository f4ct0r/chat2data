import { CompletionSchemaIndex } from '../../shared/types';
import { SqlCompletionContext } from './sql-completion-context';

export interface SqlCompletionSuggestion {
  label: string;
  kind: 'keyword' | 'snippet' | 'table' | 'column' | 'function';
  insertText: string;
  detail?: string;
}

const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT'];

const SNIPPETS: SqlCompletionSuggestion[] = [
  { label: 'SELECT * FROM', kind: 'snippet', insertText: 'SELECT * FROM ' },
  { label: 'JOIN ... ON', kind: 'snippet', insertText: 'JOIN ${1:table} ON ${2:left} = ${3:right}' },
];

const FUNCTIONS: SqlCompletionSuggestion[] = [
  { label: 'COUNT', kind: 'function', insertText: 'COUNT(*)' },
  { label: 'SUM', kind: 'function', insertText: 'SUM(${1:column})' },
];

const matchesPrefix = (value: string, prefix: string): boolean => {
  if (!prefix) {
    return true;
  }

  return value.toLowerCase().startsWith(prefix.toLowerCase());
};

const sortSuggestions = (suggestions: SqlCompletionSuggestion[], prefix: string) => {
  return suggestions.sort((left, right) => {
    const leftExact = matchesPrefix(left.label, prefix) ? 0 : 1;
    const rightExact = matchesPrefix(right.label, prefix) ? 0 : 1;

    if (leftExact !== rightExact) {
      return leftExact - rightExact;
    }

    const kindRank = (suggestion: SqlCompletionSuggestion) => {
      switch (suggestion.kind) {
        case 'table':
          return 0;
        case 'column':
          return 1;
        case 'snippet':
          return 2;
        case 'function':
          return 3;
        case 'keyword':
        default:
          return 4;
      }
    };

    const rankDiff = kindRank(left) - kindRank(right);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return left.label.localeCompare(right.label);
  });
};

export const buildSqlCompletionSuggestions = (
  context: SqlCompletionContext,
  schemaIndex: CompletionSchemaIndex | null,
  prefix: string
): SqlCompletionSuggestion[] => {
  const suggestions: SqlCompletionSuggestion[] = [];

  if (context.clause === 'from' || context.clause === 'join' || context.clause === 'update') {
    for (const table of schemaIndex?.tables || []) {
      if (matchesPrefix(table.name, prefix)) {
        suggestions.push({
          label: table.name,
          kind: 'table',
          insertText: table.name,
          detail: schemaIndex?.schema ? `${schemaIndex.schema}.${table.name}` : table.name,
        });
      }
    }
  } else if (schemaIndex) {
    if (context.memberAccess) {
      const scopedTable = context.aliases[context.memberAccess]?.tableName;
      const table = schemaIndex.tables.find((entry) => entry.name === scopedTable);
      for (const column of table?.columns || []) {
        if (matchesPrefix(column.name, prefix)) {
          suggestions.push({
            label: column.name,
            kind: 'column',
            insertText: column.name,
            detail: `${table?.name}.${column.name}`,
          });
        }
      }
    } else if (['select', 'where', 'on', 'having', 'group_by', 'order_by'].includes(context.clause)) {
      for (const table of schemaIndex.tables) {
        for (const column of table.columns) {
          if (matchesPrefix(column.name, prefix)) {
            suggestions.push({
              label: column.name,
              kind: 'column',
              insertText: column.name,
              detail: `${table.name}.${column.name}`,
            });
          }
        }
      }
    }
  }

  for (const snippet of SNIPPETS) {
    if (matchesPrefix(snippet.label, prefix)) {
      suggestions.push(snippet);
    }
  }

  for (const fn of FUNCTIONS) {
    if (matchesPrefix(fn.label, prefix)) {
      suggestions.push(fn);
    }
  }

  for (const keyword of KEYWORDS) {
    if (matchesPrefix(keyword, prefix)) {
      suggestions.push({
        label: keyword,
        kind: 'keyword',
        insertText: `${keyword} `,
      });
    }
  }

  return sortSuggestions(suggestions, prefix);
};
