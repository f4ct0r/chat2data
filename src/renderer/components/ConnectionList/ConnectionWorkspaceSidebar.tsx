import React from 'react';

interface ConnectionWorkspaceSidebarProps {
  selectedConnectionId: string | null;
  isConnectionListCollapsed: boolean;
  onToggleConnectionList: () => void;
  collapseButtonLabel: string;
  expandButtonLabel: string;
  connectionList: React.ReactNode;
  objectBrowser: React.ReactNode | null;
}

const ConnectionWorkspaceSidebar: React.FC<ConnectionWorkspaceSidebarProps> = ({
  selectedConnectionId,
  isConnectionListCollapsed,
  onToggleConnectionList,
  collapseButtonLabel,
  expandButtonLabel,
  connectionList,
  objectBrowser,
}) => {
  const hasSelectedConnection = Boolean(selectedConnectionId && objectBrowser);
  const shouldCollapseConnectionList = hasSelectedConnection
    ? isConnectionListCollapsed
    : false;

  return (
    <div className="flex h-full min-h-0 border-r border-[#333333]">
      {!shouldCollapseConnectionList ? (
        <div className="flex h-full min-h-0 flex-shrink-0">
          {connectionList}
        </div>
      ) : null}

      {hasSelectedConnection ? (
        <button
          type="button"
          aria-label={shouldCollapseConnectionList ? expandButtonLabel : collapseButtonLabel}
          title={shouldCollapseConnectionList ? expandButtonLabel : collapseButtonLabel}
          onClick={onToggleConnectionList}
          className="flex h-full w-6 flex-shrink-0 items-center justify-center border-l border-r border-[#333333] bg-[#101010] text-[#737373] transition-colors hover:bg-[#1a1a1a] hover:text-[#FF5722]"
        >
          <span className="text-xs font-mono">
            {shouldCollapseConnectionList ? '>' : '<'}
          </span>
        </button>
      ) : null}

      {hasSelectedConnection ? (
        <div className="h-full w-64 bg-[#121212]">
          {objectBrowser}
        </div>
      ) : null}
    </div>
  );
};

export default ConnectionWorkspaceSidebar;
