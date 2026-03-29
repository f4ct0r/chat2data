import { Parser } from 'node-sql-parser';
import { ConnectionConfig } from '../../shared/types';

export type SqlCompletionClause =
  | 'select'
  | 'from'
  | 'join'
  | 'where'
  | 'on'
  | 'having'
  | 'group_by'
  | 'order_by'
  | 'insert'
  | 'update'
  | 'delete'
  | 'unknown';

export interface SqlCompletionAlias {
  tableName: string;
  schemaName?: string;
}

export interface SqlCompletionContext {
  source: 'ast' | 'heuristic';
  clause: SqlCompletionClause;
  memberAccess?: string;
  aliases: Record<string, SqlCompletionAlias>;
}

const parser = new Parser();

const CLAUSE_PATTERNS: Array<{ clause: SqlCompletionClause; pattern: RegExp }> = [
  { clause: 'group_by', pattern: /\bgroup\s+by\b/gi },
  { clause: 'order_by', pattern: /\border\s+by\b/gi },
  { clause: 'select', pattern: /\bselect\b/gi },
  { clause: 'from', pattern: /\bfrom\b/gi },
  { clause: 'join', pattern: /\bjoin\b/gi },
  { clause: 'where', pattern: /\bwhere\b/gi },
  { clause: 'on', pattern: /\bon\b/gi },
  { clause: 'having', pattern: /\bhaving\b/gi },
  { clause: 'insert', pattern: /\binsert\b/gi },
  { clause: 'update', pattern: /\bupdate\b/gi },
  { clause: 'delete', pattern: /\bdelete\b/gi },
];

const getParserDialect = (dbType: ConnectionConfig['dbType']): string => {
  switch (dbType) {
    case 'postgres':
      return 'postgresql';
    case 'mssql':
      return 'transactsql';
    default:
      return dbType;
  }
};

const getMemberAccess = (sqlBeforeCursor: string): string | undefined => {
  const match = sqlBeforeCursor.match(/([A-Za-z_][\w$]*)\.\s*$/);
  return match?.[1];
};

const getClause = (sqlBeforeCursor: string): SqlCompletionClause => {
  const lower = sqlBeforeCursor.toLowerCase();
  let matchedClause: SqlCompletionClause = 'unknown';
  let matchedIndex = -1;

  for (const { clause, pattern } of CLAUSE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(lower);
    while (match) {
      if (match.index >= matchedIndex) {
        matchedIndex = match.index;
        matchedClause = clause;
      }
      match = pattern.exec(lower);
    }
  }

  return matchedClause;
};

const extractAliasesHeuristically = (sql: string): Record<string, SqlCompletionAlias> => {
  const aliases: Record<string, SqlCompletionAlias> = {};
  const pattern =
    /\b(?:from|join)\s+((?:[A-Za-z_][\w$]*\.)?[A-Za-z_][\w$]*)(?:\s+(?:as\s+)?([A-Za-z_][\w$]*))?/gi;

  let match: RegExpExecArray | null = pattern.exec(sql);
  while (match) {
    const [, qualifiedName, alias] = match;
    const [schemaName, tableName] = qualifiedName.includes('.')
      ? qualifiedName.split('.', 2)
      : [undefined, qualifiedName];

    const resolvedTableName = tableName ?? qualifiedName;
    const resolvedAlias = alias || resolvedTableName;

    aliases[resolvedAlias] = {
      tableName: resolvedTableName,
      schemaName,
    };

    match = pattern.exec(sql);
  }

  return aliases;
};

const extractAliasesFromAst = (ast: unknown): Record<string, SqlCompletionAlias> => {
  const aliases: Record<string, SqlCompletionAlias> = {};
  const statement = Array.isArray(ast) ? ast[0] : ast;

  if (!statement || typeof statement !== 'object' || !('from' in statement)) {
    return aliases;
  }

  const fromEntries = (statement as { from?: Array<{ table?: string; db?: string | null; as?: string | null }> }).from || [];
  for (const entry of fromEntries) {
    if (!entry.table) {
      continue;
    }

    const alias = entry.as || entry.table;
    aliases[alias] = {
      tableName: entry.table,
      schemaName: entry.db || undefined,
    };
  }

  return aliases;
};

export const resolveSqlCompletionContext = (
  sql: string,
  cursorOffset: number,
  dbType: ConnectionConfig['dbType']
): SqlCompletionContext => {
  const sqlBeforeCursor = sql.slice(0, cursorOffset);
  const heuristicContext: SqlCompletionContext = {
    source: 'heuristic',
    clause: getClause(sqlBeforeCursor),
    memberAccess: getMemberAccess(sqlBeforeCursor),
    aliases: extractAliasesHeuristically(sql),
  };

  try {
    const ast = parser.astify(sql, {
      database: getParserDialect(dbType),
    });

    return {
      ...heuristicContext,
      source: 'ast',
      aliases: {
        ...heuristicContext.aliases,
        ...extractAliasesFromAst(ast),
      },
    };
  } catch {
    return heuristicContext;
  }
};
