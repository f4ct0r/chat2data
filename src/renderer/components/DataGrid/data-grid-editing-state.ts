import { getCellsForGridSelection } from './data-grid-clipboard';

export interface GridCellSelection {
  rowId: string;
  column: string;
}

export interface GridCellRange {
  anchor: GridCellSelection;
  focus: GridCellSelection;
}

export interface GridSelectionState {
  selectedRowIds: string[];
  selectedCell: GridCellSelection | null;
  selectedRange: GridCellRange | null;
  anchorRowId: string | null;
  anchorCell: GridCellSelection | null;
}

export interface ResolveGridRowSelectionInput extends GridSelectionState {
  rowId: string;
  rowOrder: string[];
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  platform: string;
  deletedRowIds?: readonly string[];
}

export interface ResolveGridCellSelectionInput extends GridSelectionState {
  cell: GridCellSelection;
  rowOrder: string[];
  columnOrder: string[];
  shiftKey: boolean;
  deletedRowIds?: readonly string[];
}

export interface ResolveGridDeleteActionInput {
  selectedRowIds: string[];
  selectedCell: GridCellSelection | null;
  selectedRange: GridCellRange | null;
  isEditingCell: boolean;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  platform: string;
  rowOrder: string[];
  columnOrder: string[];
  deletedRowIds?: readonly string[];
}

export type GridDeleteAction =
  | {
      type: 'deleteRows';
      rowIds: string[];
    }
  | {
      type: 'clearCells';
      cells: GridCellSelection[];
    }
  | {
      type: 'none';
    };

export type GridEscapeAction =
  | {
      type: 'restoreDeletedRows';
      rowIds: string[];
    }
  | {
      type: 'none';
    };

export interface GridSelectionRequestResult {
  selection: GridSelectionState;
  shouldFocusGrid: boolean;
}

export interface GridEditStartRequestResult {
  cell: GridCellSelection | null;
  shouldFocusGrid: boolean;
}

export interface GridDeleteKeyboardInteractionResult {
  action: GridDeleteAction;
  shouldPreventDefault: boolean;
}

export interface GridEscapeKeyboardInteractionResult {
  action: GridEscapeAction;
  shouldPreventDefault: boolean;
}

export interface ResolveGridDeleteKeyboardInteractionInput
  extends ResolveGridDeleteActionInput {
  canHandleDeleteAction: boolean;
}

export interface ResolveGridEscapeKeyboardInteractionInput {
  isEditingCell: boolean;
  key: string;
  restorableDeletedRowIds: string[];
  canHandleEscapeAction: boolean;
}

const isMacPlatform = (platform: string) => /mac/i.test(platform);

const isDeletedRow = (rowId: string, deletedRowIds: readonly string[]) =>
  deletedRowIds.includes(rowId);

const isRowDeleteShortcut = ({
  key,
  metaKey,
  platform,
}: Pick<ResolveGridDeleteActionInput, 'key' | 'metaKey' | 'platform'>) =>
  key === 'Delete' || (isMacPlatform(platform) && key === 'Backspace' && metaKey);

const isCellNullShortcut = ({
  key,
  metaKey,
  ctrlKey,
}: Pick<ResolveGridDeleteActionInput, 'key' | 'metaKey' | 'ctrlKey'>) =>
  (key === 'Delete' || key === 'Backspace') && !metaKey && !ctrlKey;

const getFilteredSelectedRowIds = (
  rowOrder: string[],
  selectedRowIds: string[],
  deletedRowIds: readonly string[]
) => {
  const selectedSet = new Set(selectedRowIds);

  return rowOrder.filter((rowId) => selectedSet.has(rowId) && !isDeletedRow(rowId, deletedRowIds));
};

const getRangeRowIds = (
  rowOrder: string[],
  startRowId: string,
  endRowId: string,
  deletedRowIds: readonly string[]
) => {
  const startIndex = rowOrder.indexOf(startRowId);
  const endIndex = rowOrder.indexOf(endRowId);

  if (startIndex === -1 || endIndex === -1) {
    return null;
  }

  const [fromIndex, toIndex] =
    startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

  return rowOrder
    .slice(fromIndex, toIndex + 1)
    .filter((rowId) => !isDeletedRow(rowId, deletedRowIds));
};

const isValidCellAnchor = (
  cell: GridCellSelection | null,
  rowOrder: string[],
  columnOrder: string[],
  deletedRowIds: readonly string[]
) =>
  Boolean(
    cell &&
      rowOrder.includes(cell.rowId) &&
      columnOrder.includes(cell.column) &&
      !isDeletedRow(cell.rowId, deletedRowIds)
  );

const getRangeAnchorRowId = (
  anchorRowId: string | null,
  selectedRowIds: string[],
  selectedCell: GridCellSelection | null,
  rowOrder: string[],
  deletedRowIds: readonly string[]
) => {
  const fallbackAnchorRowId = anchorRowId ?? selectedRowIds[0] ?? selectedCell?.rowId ?? null;

  if (
    fallbackAnchorRowId &&
    rowOrder.includes(fallbackAnchorRowId) &&
    !isDeletedRow(fallbackAnchorRowId, deletedRowIds)
  ) {
    return fallbackAnchorRowId;
  }

  return null;
};

const getCellRangeAnchor = ({
  anchorCell,
  selectedCell,
  cell,
  rowOrder,
  columnOrder,
  deletedRowIds,
}: {
  anchorCell: GridCellSelection | null;
  selectedCell: GridCellSelection | null;
  cell: GridCellSelection;
  rowOrder: string[];
  columnOrder: string[];
  deletedRowIds: readonly string[];
}): GridCellSelection => {
  if (isValidCellAnchor(anchorCell, rowOrder, columnOrder, deletedRowIds)) {
    return anchorCell as GridCellSelection;
  }

  if (isValidCellAnchor(selectedCell, rowOrder, columnOrder, deletedRowIds)) {
    return selectedCell as GridCellSelection;
  }

  return cell;
};

export const resolveGridCellSelection = ({
  selectedRowIds,
  selectedCell,
  selectedRange,
  anchorRowId,
  anchorCell,
  cell,
  rowOrder,
  columnOrder,
  shiftKey,
  deletedRowIds = [],
}: ResolveGridCellSelectionInput): GridSelectionState => {
  if (isDeletedRow(cell.rowId, deletedRowIds) || !columnOrder.includes(cell.column)) {
    return {
      selectedRowIds,
      selectedCell,
      selectedRange,
      anchorRowId,
      anchorCell,
    };
  }

  if (shiftKey) {
    const resolvedAnchorCell = getCellRangeAnchor({
      anchorCell,
      selectedCell,
      cell,
      rowOrder,
      columnOrder,
      deletedRowIds,
    });

    return {
      selectedRowIds: [],
      selectedCell: cell,
      selectedRange: {
        anchor: resolvedAnchorCell,
        focus: cell,
      },
      anchorRowId: resolvedAnchorCell.rowId,
      anchorCell: resolvedAnchorCell,
    };
  }

  return {
    selectedRowIds: [],
    selectedCell: cell,
    selectedRange: {
      anchor: cell,
      focus: cell,
    },
    anchorRowId: cell.rowId,
    anchorCell: cell,
  };
};

export const resolveGridRowSelectionRequest = (
  input: ResolveGridRowSelectionInput
): GridSelectionRequestResult => ({
  selection: resolveGridRowSelection(input),
  shouldFocusGrid: true,
});

export const resolveGridCellSelectionRequest = (
  input: ResolveGridCellSelectionInput
): GridSelectionRequestResult => ({
  selection: resolveGridCellSelection(input),
  shouldFocusGrid: true,
});

export const resolveGridEditStartRequest = ({
  cell,
  deletedRowIds = [],
}: {
  cell: GridCellSelection;
  deletedRowIds?: readonly string[];
}): GridEditStartRequestResult => {
  if (isDeletedRow(cell.rowId, deletedRowIds)) {
    return {
      cell: null,
      shouldFocusGrid: false,
    };
  }

  return {
    cell,
    shouldFocusGrid: true,
  };
};

export const resolveGridRowSelection = ({
  selectedRowIds,
  selectedCell,
  anchorRowId,
  rowId,
  rowOrder,
  shiftKey,
  metaKey,
  ctrlKey,
  platform,
  deletedRowIds = [],
}: ResolveGridRowSelectionInput): GridSelectionState => {
  if (isDeletedRow(rowId, deletedRowIds)) {
    return {
      selectedRowIds: getFilteredSelectedRowIds(rowOrder, selectedRowIds, deletedRowIds),
      selectedCell,
      selectedRange: null,
      anchorRowId,
      anchorCell: null,
    };
  }

  const nextAnchorRowId = getRangeAnchorRowId(
    anchorRowId,
    selectedRowIds,
    selectedCell,
    rowOrder,
    deletedRowIds
  );

  if (shiftKey) {
    const rangeRowIds = getRangeRowIds(
      rowOrder,
      nextAnchorRowId ?? rowId,
      rowId,
      deletedRowIds
    );

    if (!rangeRowIds) {
      return {
        selectedRowIds: getFilteredSelectedRowIds(rowOrder, selectedRowIds, deletedRowIds),
        selectedCell: null,
        selectedRange: null,
        anchorRowId: nextAnchorRowId ?? rowId,
        anchorCell: null,
      };
    }

    return {
      selectedRowIds: rangeRowIds,
      selectedCell: null,
      selectedRange: null,
      anchorRowId: nextAnchorRowId ?? rowId,
      anchorCell: null,
    };
  }

  const supportsAdditiveSelection = isMacPlatform(platform) ? metaKey : ctrlKey;

  if (supportsAdditiveSelection) {
    const selectedSet = new Set(
      getFilteredSelectedRowIds(rowOrder, selectedRowIds, deletedRowIds)
    );

    if (selectedSet.has(rowId)) {
      selectedSet.delete(rowId);
    } else {
      selectedSet.add(rowId);
    }

    const nextSelectedRowIds = rowOrder.filter((candidateRowId) => selectedSet.has(candidateRowId));
    const nextAnchorCandidate =
      nextAnchorRowId && nextSelectedRowIds.includes(nextAnchorRowId)
        ? nextAnchorRowId
        : nextSelectedRowIds[0] ?? null;

    return {
      selectedRowIds: nextSelectedRowIds,
      selectedCell: null,
      selectedRange: null,
      anchorRowId: nextAnchorCandidate,
      anchorCell: null,
    };
  }

  return {
    selectedRowIds: [rowId],
    selectedCell: null,
    selectedRange: null,
    anchorRowId: rowId,
    anchorCell: null,
  };
};

export const resolveGridDeleteAction = ({
  selectedRowIds,
  selectedCell,
  selectedRange,
  isEditingCell,
  key,
  metaKey,
  ctrlKey,
  platform,
  rowOrder,
  columnOrder,
  deletedRowIds = [],
}: ResolveGridDeleteActionInput): GridDeleteAction => {
  if (isEditingCell) {
    return { type: 'none' };
  }

  const activeRowIds = selectedRowIds.filter((rowId) => !isDeletedRow(rowId, deletedRowIds));

  if (activeRowIds.length > 0 && isRowDeleteShortcut({ key, metaKey, platform })) {
    return {
      type: 'deleteRows',
      rowIds: activeRowIds,
    };
  }

  if (activeRowIds.length === 0 && isCellNullShortcut({ key, metaKey, ctrlKey })) {
    const cells = getCellsForGridSelection({
      selection: {
        selectedRowIds,
        selectedCell,
        selectedRange,
        anchorRowId: null,
        anchorCell: null,
      },
      rowOrder,
      columnOrder,
      deletedRowIds,
    });

    if (cells.length > 0) {
      return {
        type: 'clearCells',
        cells,
      };
    }
  }

  return { type: 'none' };
};

export const resolveGridDeleteKeyboardInteraction = ({
  canHandleDeleteAction,
  ...input
}: ResolveGridDeleteKeyboardInteractionInput): GridDeleteKeyboardInteractionResult => {
  const action = resolveGridDeleteAction(input);

  if (!canHandleDeleteAction || action.type === 'none') {
    return {
      action: { type: 'none' },
      shouldPreventDefault: false,
    };
  }

  return {
    action,
    shouldPreventDefault: true,
  };
};

export const resolveGridEscapeKeyboardInteraction = ({
  isEditingCell,
  key,
  restorableDeletedRowIds,
  canHandleEscapeAction,
}: ResolveGridEscapeKeyboardInteractionInput): GridEscapeKeyboardInteractionResult => {
  if (
    key !== 'Escape' ||
    isEditingCell ||
    !canHandleEscapeAction ||
    restorableDeletedRowIds.length === 0
  ) {
    return {
      action: { type: 'none' },
      shouldPreventDefault: false,
    };
  }

  return {
    action: {
      type: 'restoreDeletedRows',
      rowIds: restorableDeletedRowIds,
    },
    shouldPreventDefault: true,
  };
};
