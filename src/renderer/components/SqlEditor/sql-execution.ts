export interface SqlExecutionTarget {
  startLineNumber: number;
  endLineNumber: number;
  hasSelection: boolean;
}

export interface SqlStatementRange {
  sql: string;
  startLineNumber: number;
  endLineNumber: number;
}

export type SqlExecutionMode = 'editor-targeted' | 'full-content';

const getTrimmedLineRange = (segment: string, startLineNumber: number) => {
  const lines = segment.split('\n');
  let firstContentLineIndex = -1;
  let lastContentLineIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim()) {
      firstContentLineIndex = index;
      break;
    }
  }

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim()) {
      lastContentLineIndex = index;
      break;
    }
  }

  if (firstContentLineIndex === -1 || lastContentLineIndex === -1) {
    return null;
  }

  return {
    startLineNumber: startLineNumber + firstContentLineIndex,
    endLineNumber: startLineNumber + lastContentLineIndex,
  };
};

const matchDollarQuoteTag = (content: string, index: number) => {
  const remainder = content.slice(index);
  const match = remainder.match(/^\$[A-Za-z0-9_]*\$/);

  return match?.[0] ?? null;
};

export const splitSqlStatements = (content: string): SqlStatementRange[] => {
  const statements: SqlStatementRange[] = [];
  let currentStartIndex = 0;
  let currentStartLineNumber = 1;
  let currentLineNumber = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktickQuote = false;
  let inBracketIdentifier = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarQuoteTag: string | null = null;

  const pushStatement = (endIndexExclusive: number) => {
    const segment = content.slice(currentStartIndex, endIndexExclusive);
    const sql = segment.trim();
    const range = getTrimmedLineRange(segment, currentStartLineNumber);

    if (sql && range) {
      statements.push({
        sql,
        startLineNumber: range.startLineNumber,
        endLineNumber: range.endLineNumber,
      });
    }
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (inLineComment) {
      if (character === '\n') {
        inLineComment = false;
        currentLineNumber += 1;
        if (currentStartIndex === index + 1) {
          currentStartLineNumber = currentLineNumber;
        }
      }
      continue;
    }

    if (inBlockComment) {
      if (character === '\n') {
        currentLineNumber += 1;
      }

      if (character === '*' && nextCharacter === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (dollarQuoteTag) {
      const closingTag = dollarQuoteTag;

      if (content.startsWith(closingTag, index)) {
        dollarQuoteTag = null;
        index += closingTag.length - 1;
        continue;
      }

      if (character === '\n') {
        currentLineNumber += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      if (character === '\n') {
        currentLineNumber += 1;
      }

      if (character === '\'' && nextCharacter === '\'') {
        index += 1;
        continue;
      }

      if (character === '\'') {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (character === '\n') {
        currentLineNumber += 1;
      }

      if (character === '"' && nextCharacter === '"') {
        index += 1;
        continue;
      }

      if (character === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inBacktickQuote) {
      if (character === '\n') {
        currentLineNumber += 1;
      }

      if (character === '`' && nextCharacter === '`') {
        index += 1;
        continue;
      }

      if (character === '`') {
        inBacktickQuote = false;
      }
      continue;
    }

    if (inBracketIdentifier) {
      if (character === '\n') {
        currentLineNumber += 1;
      }

      if (character === ']' && nextCharacter === ']') {
        index += 1;
        continue;
      }

      if (character === ']') {
        inBracketIdentifier = false;
      }
      continue;
    }

    if (character === '-' && nextCharacter === '-') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    const matchedDollarQuoteTag = character === '$' ? matchDollarQuoteTag(content, index) : null;
    if (matchedDollarQuoteTag) {
      dollarQuoteTag = matchedDollarQuoteTag;
      index += matchedDollarQuoteTag.length - 1;
      continue;
    }

    if (character === '\'') {
      inSingleQuote = true;
      continue;
    }

    if (character === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (character === '`') {
      inBacktickQuote = true;
      continue;
    }

    if (character === '[') {
      inBracketIdentifier = true;
      continue;
    }

    if (character === ';') {
      pushStatement(index + 1);
      currentStartIndex = index + 1;
      currentStartLineNumber = currentLineNumber;
    }

    if (character === '\n') {
      currentLineNumber += 1;
      if (currentStartIndex === index + 1) {
        currentStartLineNumber = currentLineNumber;
      }
    }
  }

  pushStatement(content.length);

  return statements;
};

const getNearestStatement = (statements: SqlStatementRange[], lineNumber: number) => {
  return statements.reduce<SqlStatementRange | null>((closestStatement, statement) => {
    const distance = statement.startLineNumber > lineNumber
      ? statement.startLineNumber - lineNumber
      : lineNumber > statement.endLineNumber
        ? lineNumber - statement.endLineNumber
        : 0;

    if (!closestStatement) {
      return statement;
    }

    const closestDistance = closestStatement.startLineNumber > lineNumber
      ? closestStatement.startLineNumber - lineNumber
      : lineNumber > closestStatement.endLineNumber
        ? lineNumber - closestStatement.endLineNumber
        : 0;

    return distance < closestDistance ? statement : closestStatement;
  }, null);
};

export const resolveExecutableSql = (
  content: string,
  target: SqlExecutionTarget | null,
  mode: SqlExecutionMode = 'editor-targeted'
) => {
  if (mode === 'full-content') {
    return content.trim();
  }

  const statements = splitSqlStatements(content);

  if (!target) {
    return content.trim();
  }

  if (statements.length === 0) {
    return content.trim();
  }

  if (target.hasSelection) {
    const matchedStatements = statements.filter(
      (statement) =>
        statement.startLineNumber <= target.endLineNumber &&
        statement.endLineNumber >= target.startLineNumber
    );

    return matchedStatements.map((statement) => statement.sql).join('\n\n').trim();
  }

  const currentStatement = statements.find(
    (statement) =>
      target.startLineNumber >= statement.startLineNumber &&
      target.startLineNumber <= statement.endLineNumber
  ) ?? getNearestStatement(statements, target.startLineNumber);

  return currentStatement?.sql.trim() || '';
};
