import { describe, expect, it } from 'vitest';
import {
  getEditablePreviewViewState,
  getPostApplyNotice,
  shouldLoadEditablePreviewMetadata,
} from './editable-preview-state';

const previewTable = {
  dbType: 'postgres' as const,
  database: 'analytics',
  schema: 'public',
  table: 'users',
  previewSql: 'SELECT * FROM "analytics"."public"."users" LIMIT 100',
};

describe('editable preview state', () => {
  it('returns editable mode with a compact toolbar when pending changes exist', () => {
    expect(
      getEditablePreviewViewState({
        previewTable,
        editMetadata: {
          editable: true,
          key: {
            type: 'primary',
            columns: ['id'],
          },
        },
        pendingChangeCount: 2,
        isApplying: false,
      })
    ).toEqual({
      mode: 'editable',
      showToolbar: true,
      pendingChangeCount: 2,
    });
  });

  it('returns read-only mode with the backend reason when editing is disabled', () => {
    expect(
      getEditablePreviewViewState({
        previewTable,
        editMetadata: {
          editable: false,
          reason: 'No primary key.',
          key: null,
        },
        pendingChangeCount: 0,
        isApplying: false,
      })
    ).toEqual({
      mode: 'read-only',
      readOnlyReason: 'No primary key.',
      showToolbar: false,
    });
  });

  it('returns a warning notice when refresh fails after a successful batch apply', () => {
    expect(
      getPostApplyNotice({
        batchResult: { ok: true },
        refreshError: new Error('Timed out'),
      })
    ).toEqual({
      tone: 'warning',
      message: 'Changes were applied, but the preview could not be refreshed.',
    });
  });

  it('only requests editable metadata when a preview table and connection are available', () => {
    expect(
      shouldLoadEditablePreviewMetadata({
        connectionId: 'conn-1',
        previewTable,
      })
    ).toBe(true);

    expect(
      shouldLoadEditablePreviewMetadata({
        connectionId: 'conn-1',
        previewTable: undefined,
      })
    ).toBe(false);

    expect(
      shouldLoadEditablePreviewMetadata({
        connectionId: '',
        previewTable,
      })
    ).toBe(false);
  });
});
