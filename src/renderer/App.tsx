import React, { useState } from 'react';
import { Typography, Button, Card, Space } from 'antd';
import { ConnectionConfig, StorageVerificationResult } from '../shared/types';
import Layout from './components/Layout';
import ConnectionListPanel from './components/ConnectionList/ConnectionListPanel';
import ConnectionWorkspaceSidebar from './components/ConnectionList/ConnectionWorkspaceSidebar';
import { PlusOutlined, SafetyCertificateOutlined, ApiOutlined, CodeOutlined, MessageOutlined } from '@ant-design/icons';
import ObjectBrowser from './components/ObjectBrowser/ObjectBrowser';
import SettingsModal from './components/Settings/SettingsModal';
import { getDefaultSchemaForDbType, useTabStore } from './store/tabStore';
import WorkspaceTabs from './components/Tabs/WorkspaceTabs';
import { SidebarView } from './components/Layout/Sidebar';
import PrivacyConsentDialog from './components/Settings/PrivacyConsentDialog';
import { emitGlobalError } from './utils/errorBus';
import { useI18n } from './i18n/i18n-context';
import {
  resolvePreviewTarget,
  type PreviewTabCandidate,
  type TablePreviewRequest,
} from './features/table-preview';
import { buildPreviewUpdates } from './features/preview-updates';
import {
  buildScriptTabDraft,
  findOpenScriptTab,
} from './features/sql-scripts/script-tab-routing';
import { resolveConnectionListCollapsedState } from './features/connection-list-collapse';

const { Title, Text } = Typography;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const App: React.FC = () => {
  const { t } = useI18n();
  const [pingResponse, setPingResponse] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<StorageVerificationResult[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | null>(null);
  const [isConnectionListCollapsed, setIsConnectionListCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState<SidebarView>('connections');
  
  const { tabs, activeTabId, addTab, setActiveTab, updateTab } = useTabStore();

  const handleSelectConnection = async (conn: ConnectionConfig | null) => {
    if (conn) {
      try {
        await window.api.db.connect(conn.id);
        setSelectedConnectionId(conn.id);
        setSelectedConnection(conn);
        setIsConnectionListCollapsed((currentCollapsed) =>
          resolveConnectionListCollapsedState({
            currentCollapsed,
            activeView,
            selectedConnectionId: conn.id,
          })
        );
      } catch (error) {
        console.error('Failed to connect:', error);
        emitGlobalError({
          title: t('app.error.databaseConnectionFailed'),
          message: getErrorMessage(error),
          type: 'db_connection',
        });
      }
    } else {
      if (selectedConnectionId) {
        try {
          await window.api.db.disconnect(selectedConnectionId);
        } catch (e) {
          console.error('Failed to disconnect:', e);
        }
      }
      setSelectedConnectionId(null);
      setSelectedConnection(null);
      setIsConnectionListCollapsed(false);
    }
  };

  const handlePing = async () => {
    try {
      const response = await window.api.system.ping();
      setPingResponse(response);
    } catch (error) {
      console.error('Ping failed:', error);
      setPingResponse(t('app.error.pingFailed'));
    }
  };

  const handleCreateTestConnection = async () => {
    try {
      const config: ConnectionConfig = {
        id: '', // Empty string to let backend generate UUID
        name: `${t('app.testConnectionName')} ${Date.now()}`,
        dbType: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'supersecretpassword', // plaintext password
      };
      
      const newId = await window.api.storage.saveConnection(config);
      console.log('Created test connection with ID:', newId);
    } catch (error) {
      console.error('Failed to create test connection:', error);
    }
  };

  const handleVerifyStorage = async () => {
    try {
      const result = await window.api.system.verifyStorage();
      setVerifyResult(result);
    } catch (error) {
      console.error('Failed to verify storage:', error);
    }
  };

  const handleOpenSqlTab = () => {
    if (selectedConnectionId && selectedConnection) {
      addTab({
        title: t('app.sqlTabTitle', { name: selectedConnection.name }),
        type: 'sql',
        connectionId: selectedConnectionId,
        dbType: selectedConnection.dbType,
        database: selectedConnection.database,
        schema: getDefaultSchemaForDbType(selectedConnection.dbType, selectedConnection.database),
        completionCacheStatus: 'idle',
      });
      setActiveView('connections');
    }
  };

  const handleOpenChatTab = () => {
    if (selectedConnectionId && selectedConnection) {
      // Find if there's already a chat tab for this connection
      const existingChatTab = tabs.find(t => t.type === 'chat' && t.connectionId === selectedConnectionId);
      if (existingChatTab) {
        setActiveTab(existingChatTab.id);
      } else {
        addTab({
          title: t('app.chatTabTitle', { name: selectedConnection.name }),
          type: 'chat',
          connectionId: selectedConnectionId,
          dbType: selectedConnection.dbType,
          database: selectedConnection.database,
          schema: getDefaultSchemaForDbType(selectedConnection.dbType, selectedConnection.database),
        });
      }
      // Switch view to dashboard or connections to ensure tabs are visible
      setActiveView('connections');
    } else {
      emitGlobalError({
        title: t('app.error.actionRequired'),
        message: t('app.error.selectConnectionFirst'),
        type: 'agent_error',
      });
      setActiveView('connections');
    }
  };

  const handleOpenScriptTab = (scriptId: string, databaseName: string, title: string) => {
    if (!selectedConnection) {
      return;
    }

    const existingScriptTab = findOpenScriptTab(tabs, scriptId);
    if (existingScriptTab) {
      setActiveTab(existingScriptTab.id);
      setActiveView('connections');
      return;
    }

    addTab(
      buildScriptTabDraft({
        selectedConnection,
        databaseName,
        title,
        scriptId,
      })
    );
    setActiveView('connections');
  };

  const handleCreateScriptTab = (databaseName: string) => {
    if (!selectedConnection) {
      return;
    }

    addTab(
      buildScriptTabDraft({
        selectedConnection,
        databaseName,
        title: `New Script (${databaseName})`,
      })
    );
    setActiveView('connections');
  };

  const handlePreviewTable = (request: TablePreviewRequest) => {
    if (!selectedConnection || selectedConnection.id !== request.connectionId) {
      return;
    }

    const target = resolvePreviewTarget({
      tabs: tabs.flatMap<PreviewTabCandidate>((tab) => {
        if (tab.type !== 'sql' && tab.type !== 'chat') {
          return [];
        }

        return [
          {
            id: tab.id,
            type: tab.type,
            connectionId: tab.connectionId,
            dbType: tab.dbType,
            database: tab.database,
            schema: tab.schema,
          },
        ];
      }),
      activeTabId,
      request,
      selectedConnection,
    });

    const previewUpdates = buildPreviewUpdates({
      target,
      request,
      selectedConnection,
    });

    if (target.createTab) {
      addTab({
        ...target.newTab,
        ...previewUpdates,
      });
    } else {
      updateTab(target.targetTabId, previewUpdates);
      setActiveTab(target.targetTabId);
    }

    setActiveView('connections');
  };

  const renderDashboard = () => (
    <div className="h-full min-h-0 flex-1 overflow-y-auto bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="mb-8">
          <Title level={2} className="!mb-1 !text-[#FF5722] drop-shadow-[0_0_8px_rgba(255,87,34,0.6)] font-bold tracking-widest">
            CHAT2DATA WORKSPACE
          </Title>
          <Text className="!text-[#a3a3a3]">{t('app.dashboard.subtitle')}</Text>
        </header>

        <Card title={t('app.quickActions')} className="shadow-sm border-[#333333] bg-[#121212]">
          <Space wrap size="middle">
            <Button type="primary" icon={<ApiOutlined />} onClick={handlePing}>
              {t('app.pingMainProcess')}
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleCreateTestConnection} className="border-[#333333] text-[#a3a3a3] hover:text-[#FF5722] hover:border-[#FF5722]">
              {t('app.createTestConnection')}
            </Button>
            <Button icon={<SafetyCertificateOutlined />} onClick={handleVerifyStorage} className="border-[#333333] text-[#a3a3a3] hover:text-[#FF5722] hover:border-[#FF5722]">
              {t('app.verifyStorage')}
            </Button>
          </Space>
        </Card>

        {pingResponse && (
          <Card size="small" className="bg-[#1a1a1a] border-[#00ff00]">
            <Text className="!text-[#00ff00] drop-shadow-[0_0_5px_rgba(0,255,0,0.5)]">{t('app.response')}: {pingResponse}</Text>
          </Card>
        )}

        {verifyResult.length > 0 && (
          <Card title={t('app.storageVerificationResult')} className="shadow-sm border-[#333333] bg-[#121212]">
            <pre className="bg-[#050505] p-4 rounded-lg overflow-x-auto text-sm border border-[#333333] text-[#00ff00]">
              {JSON.stringify(verifyResult, null, 2)}
            </pre>
          </Card>
        )}

        {selectedConnection && (
          <Card 
            title={t('app.activeConnection', { name: selectedConnection.name })} 
            className="shadow-sm border-[#333333] bg-[#121212]"
            extra={
              <Space>
                <Button type="primary" icon={<CodeOutlined />} onClick={handleOpenSqlTab}>
                  {t('app.newSqlEditor')}
                </Button>
                <Button icon={<MessageOutlined />} onClick={handleOpenChatTab} className="border-[#333333] text-[#a3a3a3] hover:text-[#FF5722] hover:border-[#FF5722]">
                  {t('app.newChatAgent')}
                </Button>
              </Space>
            }
          >
            <pre className="bg-[#050505] p-4 rounded-lg overflow-x-auto text-sm border border-[#333333] text-[#a3a3a3]">
              {JSON.stringify(selectedConnection, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0a] text-[#a3a3a3]">
      <Layout 
        activeView={activeView}
        onViewChange={(view) => {
          if (view === 'chat') {
            handleOpenChatTab();
          } else {
            setActiveView(view);
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        sidebarPanel={
          activeView === 'connections' ? (
            <ConnectionWorkspaceSidebar
              selectedConnectionId={selectedConnectionId}
              isConnectionListCollapsed={isConnectionListCollapsed}
              onToggleConnectionList={() =>
                setIsConnectionListCollapsed((collapsed) => !collapsed)
              }
              collapseButtonLabel={t('connectionList.collapse')}
              expandButtonLabel={t('connectionList.expand')}
              connectionList={
                <ConnectionListPanel
                  selectedConnectionId={selectedConnectionId}
                  onSelect={handleSelectConnection}
                />
              }
              objectBrowser={
                selectedConnectionId ? (
                  <ObjectBrowser
                    connectionId={selectedConnectionId}
                    connectionType={selectedConnection?.dbType}
                    connectionDatabase={selectedConnection?.database}
                    onPreviewTable={handlePreviewTable}
                    onOpenScript={handleOpenScriptTab}
                    onCreateScript={handleCreateScriptTab}
                  />
                ) : null
              }
            />
          ) : null
        }
      >
        {activeView === 'dashboard' ? renderDashboard() : (tabs.length > 0 ? <WorkspaceTabs /> : renderDashboard())}
      </Layout>
      <SettingsModal 
        open={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      <PrivacyConsentDialog />
    </div>
  );
};

export default App;
