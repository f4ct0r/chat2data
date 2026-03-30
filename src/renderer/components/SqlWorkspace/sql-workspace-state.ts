import type { QueryResult } from '../../../shared/types';

export type ExecutionDisplayState =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'success-empty' }
  | { kind: 'data'; result: QueryResult };

export const getExecutionDisplayState = (
  result: QueryResult | null,
  error: string | null = null
): ExecutionDisplayState => {
  if (error) {
    return { kind: 'error', message: error };
  }

  if (!result) {
    return { kind: 'idle' };
  }

  if (result.error) {
    return { kind: 'error', message: result.error };
  }

  if (result.columns.length === 0) {
    return { kind: 'success-empty' };
  }

  return { kind: 'data', result };
};
