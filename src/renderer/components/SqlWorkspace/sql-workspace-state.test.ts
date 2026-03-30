import { describe, expect, it } from 'vitest';
import type { QueryResult } from '../../../shared/types';
import { getExecutionDisplayState } from './sql-workspace-state';

describe('getExecutionDisplayState', () => {
  it('treats adapter-level error payloads as failures', () => {
    const result: QueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 5,
      error: 'Syntax error',
    };

    expect(getExecutionDisplayState(result)).toEqual({
      kind: 'error',
      message: 'Syntax error',
    });
  });

  it('treats empty successful results as an explicit success state', () => {
    const result: QueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 5,
    };

    expect(getExecutionDisplayState(result)).toEqual({
      kind: 'success-empty',
    });
  });

  it('keeps tabular results in the data state', () => {
    const result: QueryResult = {
      columns: ['id'],
      rows: [{ id: 1 }],
      rowCount: 1,
      durationMs: 5,
    };

    expect(getExecutionDisplayState(result)).toEqual({
      kind: 'data',
      result,
    });
  });
});
