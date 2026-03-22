import React from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  sidebarPanel?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children, sidebarPanel }) => {
  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      <Sidebar />
      {sidebarPanel && (
        <div className="flex-shrink-0 bg-white">
          {sidebarPanel}
        </div>
      )}
      <main className="flex-1 flex flex-col min-w-0 bg-white shadow-sm rounded-l-2xl border-l border-gray-200 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
