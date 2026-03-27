export type ErrorType = 'db_connection' | 'sql_syntax' | 'network' | 'agent_error' | 'unknown';

export interface GlobalErrorPayload {
  title: string;
  message: string;
  type: ErrorType;
}

export const emitGlobalError = (payload: GlobalErrorPayload) => {
  window.dispatchEvent(new CustomEvent('global-error', { detail: payload }));
};
