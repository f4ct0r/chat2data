import type { SidebarView } from '../components/Layout/Sidebar';

interface ResolveConnectionListCollapsedStateParams {
  currentCollapsed: boolean;
  activeView: SidebarView;
  selectedConnectionId: string | null;
}

export const resolveConnectionListCollapsedState = ({
  currentCollapsed,
  activeView,
  selectedConnectionId,
}: ResolveConnectionListCollapsedStateParams): boolean => {
  if (!selectedConnectionId) {
    return false;
  }

  if (activeView === 'connections') {
    return true;
  }

  return currentCollapsed;
};
