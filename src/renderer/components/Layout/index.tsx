import React from 'react';
import Sidebar, { SidebarView } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  sidebarPanel?: React.ReactNode;
  activeView?: SidebarView;
  onViewChange?: (view: SidebarView) => void;
  onOpenSettings?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, sidebarPanel, activeView, onViewChange, onOpenSettings }) => {
  return (
    <div className="flex min-h-screen w-full flex-1 items-stretch overflow-hidden bg-[#0a0a0a]">
      <Sidebar activeView={activeView} onViewChange={onViewChange} onOpenSettings={onOpenSettings} />
      {sidebarPanel && (
        <div className="flex h-full min-h-screen flex-shrink-0 bg-[#0a0a0a]">
          {sidebarPanel}
        </div>
      )}
      <main className="flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden border-l border-[#333333] bg-[#0a0a0a]">
        {children}
      </main>
    </div>
  );
};

export default Layout;
