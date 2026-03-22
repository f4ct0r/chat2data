import React from 'react';
import { Tabs } from 'antd';
import { useTabStore } from '../../store/tabStore';
import { CodeOutlined, MessageOutlined } from '@ant-design/icons';

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

const WorkspaceTabs: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useTabStore();

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
          title: `New SQL`,
          type: 'sql',
          connectionId: currentTab.connectionId,
        });
      }
    }
  };

  const handleChange = (newActiveKey: string) => {
    setActiveTab(newActiveKey);
  };

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>No open tabs. Select a connection or click '+' to start.</p>
      </div>
    );
  }

  const tabItems = tabs.map(tab => {
    const icon = tab.type === 'sql' ? <CodeOutlined /> : <MessageOutlined />;
    return {
      label: (
        <span>
          {icon} {tab.title}
        </span>
      ),
      key: tab.id,
      children: (
        <div className="p-4 h-full overflow-auto bg-white rounded-b-lg border-x border-b border-gray-200 shadow-sm">
          {/* Placeholder for tab content */}
          <h2 className="text-xl font-semibold mb-4">{tab.title}</h2>
          <div className="text-gray-600 mb-2">
            <span className="font-medium">Type:</span> {tab.type}
          </div>
          <div className="text-gray-600 mb-2">
            <span className="font-medium">Bound Connection ID:</span> {tab.connectionId}
          </div>
          <div className="text-gray-600">
            <span className="font-medium">Tab ID:</span> {tab.id}
          </div>
          {/* Here we will render SqlEditor or ChatAgent based on tab.type */}
        </div>
      ),
    };
  });

  return (
    <div className="h-full flex flex-col">
      <Tabs
        type="editable-card"
        onChange={handleChange}
        activeKey={activeTabId || undefined}
        onEdit={handleEdit}
        items={tabItems}
        className="h-full workspace-tabs"
      />
    </div>
  );
};

export default WorkspaceTabs;
