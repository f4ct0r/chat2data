import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { sqliteService } from './sqlite-service';
import {
  SqlScript,
  SqlScriptInput,
  SqlScriptParameter,
  SqlScriptParameterInput,
} from '../../shared/sql-scripts';

type SqliteDb = Database.Database;

interface SqlScriptRow {
  id: string;
  connection_id: string;
  database_name: string;
  name: string;
  description: string | null;
  sql: string;
  created_at: string;
  updated_at: string;
}

interface SqlScriptTagRow {
  tag: string;
}

interface SqlScriptParameterRow {
  id: string;
  name: string;
  label: string | null;
  type: string;
  required: number;
  default_value: string | null;
  position: number;
}

const trimOrUndefined = (value: string | undefined | null): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeTags = (tags: string[] = []): string[] => {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
};

const normalizeParameters = (parameters: SqlScriptParameterInput[] = []): SqlScriptParameterInput[] => {
  const seenNames = new Set<string>();

  return [...parameters]
    .map((parameter) => ({
      ...parameter,
      name: parameter.name.trim(),
      label: parameter.label.trim(),
      defaultValue: trimOrUndefined(parameter.defaultValue),
    }))
    .filter((parameter) => parameter.name.length > 0)
    .map((parameter) => {
      if (seenNames.has(parameter.name)) {
        throw new Error(`Duplicate SQL script parameter name: ${parameter.name}`);
      }
      seenNames.add(parameter.name);
      return parameter;
    })
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));
};

const toBoolean = (value: number): boolean => value !== 0;

export class SqlScriptStore {
  constructor(private readonly dbProvider: () => SqliteDb = () => sqliteService.getDb()) {}

  private getDb(): SqliteDb {
    return this.dbProvider();
  }

  private hydrateScript(db: SqliteDb, row: SqlScriptRow): SqlScript {
    const tagRows = db
      .prepare('SELECT tag FROM sql_script_tags WHERE script_id = ? ORDER BY tag ASC')
      .all(row.id) as SqlScriptTagRow[];

    const parameterRows = db
      .prepare(`
        SELECT id, name, label, type, required, default_value, position
        FROM sql_script_parameters
        WHERE script_id = ?
        ORDER BY position ASC, name ASC
      `)
      .all(row.id) as SqlScriptParameterRow[];

    return {
      id: row.id,
      connectionId: row.connection_id,
      databaseName: row.database_name,
      name: row.name,
      description: row.description ?? undefined,
      sql: row.sql,
      tags: tagRows.map((tagRow) => tagRow.tag),
      parameters: parameterRows.map((parameterRow) => ({
        id: parameterRow.id,
        name: parameterRow.name,
        label: parameterRow.label ?? '',
        type: parameterRow.type as SqlScriptParameter['type'],
        required: toBoolean(parameterRow.required),
        defaultValue: parameterRow.default_value ?? undefined,
        position: parameterRow.position,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  list(connectionId: string, databaseName: string): SqlScript[] {
    const db = this.getDb();
    const rows = db
      .prepare(`
        SELECT id, connection_id, database_name, name, description, sql, created_at, updated_at
        FROM sql_scripts
        WHERE connection_id = ? AND database_name = ?
        ORDER BY name COLLATE NOCASE ASC, created_at ASC
      `)
      .all(connectionId, databaseName) as SqlScriptRow[];

    return rows.map((row) => this.hydrateScript(db, row));
  }

  get(scriptId: string): SqlScript | null {
    const db = this.getDb();
    const row = db
      .prepare(`
        SELECT id, connection_id, database_name, name, description, sql, created_at, updated_at
        FROM sql_scripts
        WHERE id = ?
      `)
      .get(scriptId) as SqlScriptRow | undefined;

    return row ? this.hydrateScript(db, row) : null;
  }

  save(input: SqlScriptInput): SqlScript {
    const db = this.getDb();
    const scriptId = input.id ?? randomUUID();
    const connectionId = input.connectionId.trim();
    const databaseName = input.databaseName.trim();
    const name = input.name.trim();
    const sql = input.sql;
    const description = trimOrUndefined(input.description) ?? null;
    const tags = normalizeTags(input.tags);
    const parameters = normalizeParameters(input.parameters);

    if (!connectionId) {
      throw new Error('connectionId is required');
    }

    if (!databaseName) {
      throw new Error('databaseName is required');
    }

    if (!name) {
      throw new Error('name is required');
    }

    if (!sql.trim()) {
      throw new Error('sql is required');
    }

    const insertScript = db.prepare(`
      INSERT INTO sql_scripts (
        id, connection_id, database_name, name, description, sql, created_at, updated_at
      )
      VALUES (
        @id, @connectionId, @databaseName, @name, @description, @sql, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        connection_id = excluded.connection_id,
        database_name = excluded.database_name,
        name = excluded.name,
        description = excluded.description,
        sql = excluded.sql,
        updated_at = CURRENT_TIMESTAMP
    `);

    const deleteTags = db.prepare('DELETE FROM sql_script_tags WHERE script_id = ?');
    const deleteParameters = db.prepare('DELETE FROM sql_script_parameters WHERE script_id = ?');
    const insertTag = db.prepare('INSERT INTO sql_script_tags (script_id, tag) VALUES (?, ?)');
    const insertParameter = db.prepare(`
      INSERT INTO sql_script_parameters (
        id, script_id, name, label, type, required, default_value, position
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertScript.run({
        id: scriptId,
        connectionId,
        databaseName,
        name,
        description,
        sql,
      });

      deleteTags.run(scriptId);
      deleteParameters.run(scriptId);

      for (const tag of tags) {
        insertTag.run(scriptId, tag);
      }

      for (const parameter of parameters) {
        insertParameter.run(
          parameter.id ?? randomUUID(),
          scriptId,
          parameter.name,
          parameter.label,
          parameter.type,
          parameter.required ? 1 : 0,
          parameter.defaultValue ?? null,
          parameter.position
        );
      }
    });

    transaction();

    const saved = this.get(scriptId);
    if (!saved) {
      throw new Error(`Failed to load SQL script ${scriptId} after save`);
    }

    return saved;
  }

  delete(scriptId: string): void {
    const db = this.getDb();
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM sql_script_tags WHERE script_id = ?').run(scriptId);
      db.prepare('DELETE FROM sql_script_parameters WHERE script_id = ?').run(scriptId);
      db.prepare('DELETE FROM sql_scripts WHERE id = ?').run(scriptId);
    });

    transaction();
  }
}

export const sqlScriptStore = new SqlScriptStore();
