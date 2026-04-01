import React, { useEffect } from 'react';
import { Tabs } from 'antd';
import { useTabStore } from '../../store/tabStore';
import { CodeOutlined, MessageOutlined } from '@ant-design/icons';
import SqlWorkspace from '../SqlWorkspace/SqlWorkspace';
import ChatPanel from '../Chat/ChatPanel';
import SqlScriptWorkspace from '../SqlScripts/SqlScriptWorkspace';
import { useI18n } from '../../i18n/i18n-context';

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

const WorkspaceTabs: React.FC = () => {
  const { t } = useI18n();
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useTabStore();

  useEffect(() => {
    // Cleanup function to prevent memory leaks when WorkspaceTabs unmounts
    return () => {
      // Clear any global listeners or timers if added in the future
      // Also helps garbage collect by breaking potential circular references
    };
  }, []);

  const handleEdit = (
    targetKey: TargetKey,
    action: 'add' | 'remove'
  ) => {
    if (action === 'remove' && typeof targetKey === 'string') {
      closeTab(targetKey);
    } else if (action === 'add') {
      // Create a default SQL tab for the first available connection or empty if none
      // Ideally we get the active connection from somewhere, but for now we can just use the connection of the current active tab
      const currentTab = tabs.find(t => t.id === activeTabId);
      if (currentTab) {
        addTab({
          title: t('workspace.newSql'),
          type: 'sql',
          connectionId: currentTab.connectionId,
          dbType: currentTab.dbType,
          database: currentTab.database,
          schema: currentTab.schema,
          completionCacheStatus: 'idle',
        });
      }
    }
  };

  const handleChange = (newActiveKey: string) => {
    setActiveTab(newActiveKey);
  };

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#737373] bg-[#0a0a0a]">
        <p>{t('workspace.empty')}</p>
      </div>
    );
  }

  const tabItems = tabs.map(tab => {
    const icon =
      tab.type === 'chat'
        ? <MessageOutlined className="text-[#FF5722]" />
        : <CodeOutlined className={tab.type === 'script' ? 'text-[#FFB347]' : 'text-[#00ff00]'} />;
    return {
      label: (
        <span className="font-mono text-xs tracking-wider">
          {icon} {tab.title.toUpperCase()}
        </span>
      ),
      key: tab.id,
      children: (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#050505] rounded-b-sm border-x border-b border-[#333333] shadow-[0_0_10px_rgba(0,0,0,0.8)]">
          {tab.type === 'sql' ? (
            <SqlWorkspace tabId={tab.id} />
          ) : tab.type === 'script' ? (
            <SqlScriptWorkspace tabId={tab.id} />
          ) : (
            <ChatPanel tabId={tab.id} />
          )}
        </div>
      ),
    };
  });

  return (
    <div className="h-full min-h-0 flex flex-col">
      <Tabs
        type="editable-card"
        onChange={handleChange}
        activeKey={activeTabId || undefined}
        onEdit={handleEdit}
        items={tabItems}
        className="h-full min-h-0 workspace-tabs"
      />
    </div>
  );
};

export default WorkspaceTabs;
