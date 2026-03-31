export interface GridKeyboardTarget {
  focus: (options?: FocusOptions) => void;
}

export const MIN_COLUMN_WIDTH = 100;

export const getDefaultColumnWidth = (column: string) =>
  Math.max(column.length * 10 + 32, MIN_COLUMN_WIDTH);

export const getInitialColumnWidths = (
  columns: string[],
  existingWidths: Record<string, number> = {}
) =>
  columns.reduce<Record<string, number>>((widths, column) => {
    widths[column] = existingWidths[column] ?? getDefaultColumnWidth(column);
    return widths;
  }, {});

export const resizeColumnWidth = (currentWidth: number, deltaX: number) =>
  Math.max(MIN_COLUMN_WIDTH, currentWidth + deltaX);

type ViewportSize = {
  width: number;
  height: number;
};

export const shouldRemeasureViewport = (
  previous: ViewportSize | null,
  next: ViewportSize
) => {
  if (next.width <= 0 || next.height <= 0) {
    return false;
  }

  if (!previous) {
    return true;
  }

  return previous.width !== next.width || previous.height !== next.height;
};

export const focusGridKeyboardTarget = (
  target: GridKeyboardTarget | null | undefined
) => {
  target?.focus({ preventScroll: true });
};
