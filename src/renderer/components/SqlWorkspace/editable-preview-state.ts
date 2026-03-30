import type {
  BatchExecutionResult,
  PreviewTableRef,
  TableEditMetadata,
} from '../../../shared/types';

interface EditablePreviewViewStateInput {
  previewTable?: PreviewTableRef;
  isPreviewResult?: boolean;
  editMetadata: TableEditMetadata | null;
  pendingChangeCount: number;
  isApplying: boolean;
  inactiveReason?: string | null;
  metadataErrorReason?: string | null;
  refreshLockReason?: string | null;
}

type EditablePreviewHiddenState = {
  mode: 'hidden';
  showToolbar: false;
};

type EditablePreviewReadOnlyState = {
  mode: 'read-only';
  readOnlyReason: string;
  showToolbar: false;
};

type EditablePreviewEditableState = {
  mode: 'editable';
  showToolbar: boolean;
  pendingChangeCount: number;
};

export type EditablePreviewViewState =
  | EditablePreviewHiddenState
  | EditablePreviewReadOnlyState
  | EditablePreviewEditableState;

interface PostApplyNoticeInput {
  batchResult: BatchExecutionResult;
  refreshError: Error | null;
  refreshFailureMessage?: string;
}

export interface EditablePreviewNotice {
  tone: 'warning';
  message: string;
}

const DEFAULT_REFRESH_FAILURE_MESSAGE =
  'Changes were applied, but the preview could not be refreshed.';

export const shouldLoadEditablePreviewMetadata = ({
  connectionId,
  previewTable,
}: {
  connectionId?: string | null;
  previewTable?: PreviewTableRef;
}) => Boolean(connectionId && previewTable);

export const getEditablePreviewViewState = ({
  previewTable,
  isPreviewResult = true,
  editMetadata,
  pendingChangeCount,
  inactiveReason,
  metadataErrorReason,
  refreshLockReason,
}: EditablePreviewViewStateInput): EditablePreviewViewState => {
  if (!previewTable) {
    return {
      mode: 'hidden',
      showToolbar: false,
    };
  }

  if (!isPreviewResult) {
    return {
      mode: 'read-only',
      readOnlyReason: inactiveReason ?? '',
      showToolbar: false,
    };
  }

  if (refreshLockReason) {
    return {
      mode: 'read-only',
      readOnlyReason: refreshLockReason,
      showToolbar: false,
    };
  }

  if (metadataErrorReason) {
    return {
      mode: 'read-only',
      readOnlyReason: metadataErrorReason,
      showToolbar: false,
    };
  }

  if (!editMetadata) {
    return {
      mode: 'read-only',
      readOnlyReason: '',
      showToolbar: false,
    };
  }

  if (!editMetadata.editable) {
    return {
      mode: 'read-only',
      readOnlyReason: editMetadata.reason ?? '',
      showToolbar: false,
    };
  }

  return {
    mode: 'editable',
    showToolbar: pendingChangeCount > 0,
    pendingChangeCount,
  };
};

export const getPostApplyNotice = ({
  batchResult,
  refreshError,
  refreshFailureMessage = DEFAULT_REFRESH_FAILURE_MESSAGE,
}: PostApplyNoticeInput): EditablePreviewNotice | null => {
  if (!batchResult.ok || !refreshError) {
    return null;
  }

  return {
    tone: 'warning',
    message: refreshFailureMessage,
  };
};
