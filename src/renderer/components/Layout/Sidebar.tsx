import React from 'react';
import { Database, MessageSquare, Settings, LayoutDashboard } from 'lucide-react';
import { Button, Tooltip } from 'antd';
import { useI18n } from '../../i18n/I18nProvider';

export type SidebarView = 'dashboard' | 'chat' | 'connections';

interface SidebarProps {
  activeView?: SidebarView;
  onViewChange?: (view: SidebarView) => void;
  onOpenSettings?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView = 'connections', onViewChange, onOpenSettings }) => {
  const { t } = useI18n();

  return (
    <aside className="flex h-screen w-16 flex-shrink-0 flex-col items-center border-r border-[#333333] bg-[#050505] py-4">
      {/* App Logo */}
      <div className="flex items-center justify-center mb-8">
        <div className="w-8 h-8 rounded border border-[#FF5722] bg-[#FF5722]/10 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(255,87,34,0.4)]">
          <Database className="w-5 h-5 text-[#FF5722]" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2 px-2 w-full">
        <NavItem 
          icon={<LayoutDashboard />} 
          label={t('sidebar.dashboard')} 
          active={activeView === 'dashboard'} 
          onClick={() => onViewChange?.('dashboard')} 
        />
        <NavItem 
          icon={<MessageSquare />} 
          label={t('sidebar.chat')} 
          active={activeView === 'chat'} 
          onClick={() => onViewChange?.('chat')} 
        />
        <NavItem 
          icon={<Database />} 
          label={t('sidebar.connections')} 
          active={activeView === 'connections'} 
          onClick={() => onViewChange?.('connections')} 
        />
      </nav>

      {/* Bottom Actions */}
      <div className="px-2 mt-auto w-full">
        <NavItem icon={<Settings />} label={t('sidebar.settings')} onClick={onOpenSettings} />
      </div>
    </aside>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => {
  const btnClass = `w-full flex items-center justify-center border-none shadow-none transition-all duration-200 !bg-transparent ${
    active 
      ? '!text-[#FF5722] !bg-[#FF5722]/20 border-l-2 border-[#FF5722]' 
      : '!text-[#737373] hover:!bg-[#FF5722]/10 hover:!text-[#FF5722]'
  }`;

  return (
    <Tooltip title={label} placement="right">
      <Button
        className={btnClass}
        icon={<span className="text-lg flex items-center">{icon}</span>}
        size="large"
        onClick={onClick}
      />
    </Tooltip>
  );
};

export default Sidebar;
