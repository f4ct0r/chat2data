import { describe, expect, it } from 'vitest';
import type { SqlScriptParameterInput } from '../../../shared/sql-scripts';
import {
  extractSqlScriptPlaceholders,
  renderSqlScriptPlaceholders,
  validateSqlScriptDefinition,
} from './sql-script-placeholders';

const makeParameter = (
  overrides: Partial<SqlScriptParameterInput> & Pick<SqlScriptParameterInput, 'name' | 'type' | 'position'>
): SqlScriptParameterInput => ({
  label: overrides.label ?? overrides.name,
  required: overrides.required ?? true,
  ...overrides,
} as SqlScriptParameterInput);

describe('extractSqlScriptPlaceholders', () => {
  it('extracts unique placeholder names from sql', () => {
    expect(
      extractSqlScriptPlaceholders(
        'SELECT * FROM users WHERE id = {{id}} OR parent_id = {{id}} AND name = {{name}}'
      )
    ).toEqual(['id', 'name']);
  });
});

describe('validateSqlScriptDefinition', () => {
  it('rejects definitions missing from sql', () => {
    expect(
      validateSqlScriptDefinition('SELECT * FROM users WHERE id = {{id}}', [
        makeParameter({ name: 'id', type: 'text', position: 0 }),
        makeParameter({ name: 'name', type: 'text', position: 1 }),
      ])
    ).toEqual({
      ok: false,
      missingPlaceholders: [],
      extraParameters: ['name'],
    });
  });

  it('rejects sql placeholders missing definitions', () => {
    expect(
      validateSqlScriptDefinition('SELECT * FROM users WHERE id = {{id}} AND name = {{name}}', [
        makeParameter({ name: 'id', type: 'text', position: 0 }),
      ])
    ).toEqual({
      ok: false,
      missingPlaceholders: ['name'],
      extraParameters: [],
    });
  });
});

describe('renderSqlScriptPlaceholders', () => {
  it('renders text values as escaped quoted literals', () => {
    expect(
      renderSqlScriptPlaceholders(
        'SELECT * FROM users WHERE name = {{name}}',
        [makeParameter({ name: 'name', type: 'text', position: 0 })],
        { name: "O'Reilly" }
      )
    ).toEqual({
      ok: true,
      sql: "SELECT * FROM users WHERE name = 'O''Reilly'",
    });
  });

  it('renders numbers without quotes', () => {
    expect(
      renderSqlScriptPlaceholders(
        'SELECT * FROM users WHERE score >= {{score}}',
        [makeParameter({ name: 'score', type: 'number', position: 0 })],
        { score: 42 }
      )
    ).toEqual({
      ok: true,
      sql: 'SELECT * FROM users WHERE score >= 42',
    });
  });

  it('passes rawSql values through unchanged', () => {
    expect(
      renderSqlScriptPlaceholders(
        'SELECT * FROM users ORDER BY {{orderBy}}',
        [makeParameter({ name: 'orderBy', type: 'rawSql', position: 0 })],
        { orderBy: 'created_at DESC' }
      )
    ).toEqual({
      ok: true,
      sql: 'SELECT * FROM users ORDER BY created_at DESC',
    });
  });

  it('renders date and datetime values as quoted literals', () => {
    expect(
      renderSqlScriptPlaceholders(
        'SELECT * FROM events WHERE event_date = {{eventDate}} AND created_at >= {{createdAt}}',
        [
          makeParameter({ name: 'eventDate', type: 'date', position: 0 }),
          makeParameter({ name: 'createdAt', type: 'datetime', position: 1 }),
        ],
        {
          eventDate: '2026-04-01',
          createdAt: '2026-04-01 12:34:56',
        }
      )
    ).toEqual({
      ok: true,
      sql: "SELECT * FROM events WHERE event_date = '2026-04-01' AND created_at >= '2026-04-01 12:34:56'",
    });
  });

  it('rejects required empty values and renders optional empty values as NULL', () => {
    const requiredResult = renderSqlScriptPlaceholders(
      'SELECT * FROM users WHERE name = {{name}}',
      [makeParameter({ name: 'name', type: 'text', position: 0, required: true })],
      { name: '' }
    );

    expect(requiredResult).toEqual({
      ok: false,
      reason: 'required-parameter-empty',
      parameter: 'name',
    });

    expect(
      renderSqlScriptPlaceholders(
        'SELECT * FROM users WHERE nickname = {{nickname}}',
        [makeParameter({ name: 'nickname', type: 'text', position: 0, required: false })],
        { nickname: '' }
      )
    ).toEqual({
      ok: true,
      sql: 'SELECT * FROM users WHERE nickname = NULL',
    });
  });

  it('rejects non-numeric number values', () => {
    expect(
      renderSqlScriptPlaceholders(
        'SELECT * FROM users WHERE score >= {{score}}',
        [makeParameter({ name: 'score', type: 'number', position: 0 })],
        { score: '42' }
      )
    ).toEqual({
      ok: false,
      reason: 'invalid-number',
      parameter: 'score',
    });
  });
});
