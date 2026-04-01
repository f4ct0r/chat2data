export type SqlScriptParameterType = 'text' | 'number' | 'date' | 'datetime' | 'rawSql';

export interface SqlScriptParameter {
  id: string;
  name: string;
  label: string;
  type: SqlScriptParameterType;
  required: boolean;
  defaultValue?: string;
  position: number;
}

export interface SqlScriptParameterInput {
  id?: string;
  name: string;
  label: string;
  type: SqlScriptParameterType;
  required: boolean;
  defaultValue?: string;
  position: number;
}

export interface SqlScriptTag {
  scriptId: string;
  tag: string;
}

export interface SqlScript {
  id: string;
  connectionId: string;
  databaseName: string;
  name: string;
  description?: string;
  sql: string;
  tags: string[];
  parameters: SqlScriptParameter[];
  createdAt: string;
  updatedAt: string;
}

export interface SqlScriptInput {
  id?: string;
  connectionId: string;
  databaseName: string;
  name: string;
  description?: string;
  sql: string;
  tags?: string[];
  parameters?: SqlScriptParameterInput[];
}

export type SqlScriptExecutionValue = string | number | null;
export type SqlScriptExecutionValues = Record<string, SqlScriptExecutionValue>;
