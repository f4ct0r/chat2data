import React from 'react';
import { Database, MessageSquare, Settings, LayoutDashboard } from 'lucide-react';
import { Button, Tooltip } from 'antd';

const Sidebar: React.FC = () => {
  return (
    <aside className="w-16 bg-gray-50 flex flex-col items-center py-4 border-r border-transparent">
      {/* App Logo */}
      <div className="flex items-center justify-center mb-8">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2 px-2 w-full">
        <NavItem icon={<LayoutDashboard />} label="Dashboard" active />
        <NavItem icon={<MessageSquare />} label="Chat" />
        <NavItem icon={<Database />} label="Connections" />
      </nav>

      {/* Bottom Actions */}
      <div className="px-2 mt-auto w-full">
        <NavItem icon={<Settings />} label="Settings" />
      </div>
    </aside>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active }) => {
  const btnClass = `w-full flex items-center justify-center border-none shadow-none ${
    active ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800'
  }`;

  return (
    <Tooltip title={label} placement="right">
      <Button
        className={btnClass}
        icon={<span className="text-lg flex items-center">{icon}</span>}
        size="large"
      />
    </Tooltip>
  );
};

export default Sidebar;
