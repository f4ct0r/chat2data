import type {
  SqlScriptExecutionValues,
  SqlScriptParameterInput,
  SqlScriptParameterType,
} from '../../../shared/sql-scripts';

const PLACEHOLDER_PATTERN = /\{\{([^{}]+)\}\}/g;

export interface SqlScriptPlaceholderValidationSuccess {
  ok: true;
}

export interface SqlScriptPlaceholderValidationFailure {
  ok: false;
  missingPlaceholders: string[];
  extraParameters: string[];
}

export type SqlScriptPlaceholderValidationResult =
  | SqlScriptPlaceholderValidationSuccess
  | SqlScriptPlaceholderValidationFailure;

export interface SqlScriptPlaceholderRenderSuccess {
  ok: true;
  sql: string;
}

export interface SqlScriptPlaceholderRenderFailure {
  ok: false;
  reason: 'required-parameter-empty' | 'invalid-number';
  parameter: string;
}

export type SqlScriptPlaceholderRenderResult =
  | SqlScriptPlaceholderRenderSuccess
  | SqlScriptPlaceholderRenderFailure;

const unique = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
};

const isEmptyValue = (value: unknown) => value === undefined || value === null || value === '';

const escapeSqlString = (value: string) => value.replace(/'/g, "''");

const renderQuotedLiteral = (value: string) => `'${escapeSqlString(value)}'`;

const renderNumberLiteral = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return String(value);
};

const renderParameterValue = (
  parameter: SqlScriptParameterInput,
  value: SqlScriptExecutionValues[string]
): { ok: true; sql: string } | { ok: false; reason: SqlScriptPlaceholderRenderFailure['reason'] } => {
  if (isEmptyValue(value)) {
    if (parameter.required) {
      return { ok: false, reason: 'required-parameter-empty' };
    }

    return { ok: true, sql: 'NULL' };
  }

  switch (parameter.type as SqlScriptParameterType) {
    case 'number': {
      const renderedNumber = renderNumberLiteral(value);
      if (renderedNumber === null) {
        return { ok: false, reason: 'invalid-number' };
      }

      return { ok: true, sql: renderedNumber };
    }
    case 'rawSql':
      return { ok: true, sql: String(value) };
    case 'text':
    case 'date':
    case 'datetime':
      return { ok: true, sql: renderQuotedLiteral(String(value)) };
    default:
      return { ok: true, sql: renderQuotedLiteral(String(value)) };
  }
};

export const extractSqlScriptPlaceholders = (sql: string): string[] => {
  if (!sql) {
    return [];
  }

  const names: string[] = [];
  for (const match of sql.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1].trim();
    if (name) {
      names.push(name);
    }
  }

  return unique(names);
};

export const validateSqlScriptDefinition = (
  sql: string,
  parameters: SqlScriptParameterInput[]
): SqlScriptPlaceholderValidationResult => {
  const placeholders = extractSqlScriptPlaceholders(sql);
  const parameterNames = unique(parameters.map((parameter) => parameter.name.trim()).filter(Boolean));

  const placeholderSet = new Set(placeholders);
  const parameterSet = new Set(parameterNames);

  const missingPlaceholders = placeholders.filter((name) => !parameterSet.has(name));
  const extraParameters = parameterNames.filter((name) => !placeholderSet.has(name));

  if (missingPlaceholders.length > 0 || extraParameters.length > 0) {
    return {
      ok: false,
      missingPlaceholders,
      extraParameters,
    };
  }

  return { ok: true };
};

export const renderSqlScriptPlaceholders = (
  sql: string,
  parameters: SqlScriptParameterInput[],
  values: SqlScriptExecutionValues
): SqlScriptPlaceholderRenderResult => {
  const parameterByName = new Map(parameters.map((parameter) => [parameter.name.trim(), parameter]));

  for (const placeholderName of extractSqlScriptPlaceholders(sql)) {
    const parameter = parameterByName.get(placeholderName);
    if (!parameter) {
      return {
        ok: false,
        reason: 'required-parameter-empty',
        parameter: placeholderName,
      };
    }

    const rendered = renderParameterValue(parameter, values[placeholderName]);
    if (!rendered.ok) {
      return {
        ok: false,
        reason: rendered.reason,
        parameter: placeholderName,
      };
    }
  }

  const renderedSql = sql.replace(PLACEHOLDER_PATTERN, (_match, rawName: string) => {
    const name = rawName.trim();
    const parameter = parameterByName.get(name);
    if (!parameter) {
      return '';
    }

    const rendered = renderParameterValue(parameter, values[name]);
    if (!rendered.ok) {
      return '';
    }

    return rendered.sql;
  });

  return {
    ok: true,
    sql: renderedSql,
  };
};
