import React, { useState } from 'react';
import { Typography, Button, Card, Space } from 'antd';
import { ConnectionConfig, StorageVerificationResult } from '../shared/types';
import Layout from './components/Layout';
import ConnectionListPanel from './components/ConnectionList/ConnectionListPanel';
import { PlusOutlined, SafetyCertificateOutlined, ApiOutlined, CodeOutlined, MessageOutlined } from '@ant-design/icons';
import ObjectBrowser from './components/ObjectBrowser/ObjectBrowser';
import SettingsModal from './components/Settings/SettingsModal';
import { useTabStore } from './store/tabStore';
import WorkspaceTabs from './components/Tabs/WorkspaceTabs';
import { SidebarView } from './components/Layout/Sidebar';
import PrivacyConsentDialog from './components/Settings/PrivacyConsentDialog';
import { emitGlobalError } from './utils/errorBus';

const { Title, Text } = Typography;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const App: React.FC = () => {
  const [pingResponse, setPingResponse] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<StorageVerificationResult[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState<SidebarView>('connections');
  
  const { tabs, addTab, setActiveTab } = useTabStore();

  const handleSelectConnection = async (conn: ConnectionConfig | null) => {
    if (conn) {
      try {
        await window.api.db.connect(conn.id);
        setSelectedConnectionId(conn.id);
        setSelectedConnection(conn);
      } catch (error) {
        console.error('Failed to connect:', error);
        emitGlobalError({
          title: 'Database Connection Failed',
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
    }
  };

  const handlePing = async () => {
    try {
      const response = await window.api.system.ping();
      setPingResponse(response);
    } catch (error) {
      console.error('Ping failed:', error);
      setPingResponse('Error: Failed to ping main process');
    }
  };

  const handleCreateTestConnection = async () => {
    try {
      const config: ConnectionConfig = {
        id: '', // Empty string to let backend generate UUID
        name: `Test DB ${Date.now()}`,
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
        title: `SQL - ${selectedConnection.name}`,
        type: 'sql',
        connectionId: selectedConnectionId,
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
          title: `Chat - ${selectedConnection.name}`,
          type: 'chat',
          connectionId: selectedConnectionId,
        });
      }
      // Switch view to dashboard or connections to ensure tabs are visible
      setActiveView('connections');
    } else {
      emitGlobalError({
        title: 'Action Required',
        message: 'Please select a connection first to start a chat.',
        type: 'agent_error',
      });
      setActiveView('connections');
    }
  };

  const renderDashboard = () => (
    <div className="h-full min-h-0 flex-1 overflow-y-auto bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="mb-8">
          <Title level={2} className="!mb-1 !text-[#FF5722] drop-shadow-[0_0_8px_rgba(255,87,34,0.6)] font-bold tracking-widest">
            CHAT2DATA WORKSPACE
          </Title>
          <Text className="!text-[#a3a3a3]">Select a connection from the left panel to begin.</Text>
        </header>

        <Card title="Quick Actions" className="shadow-sm border-[#333333] bg-[#121212]">
          <Space wrap size="middle">
            <Button type="primary" icon={<ApiOutlined />} onClick={handlePing}>
              Ping Main Process
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleCreateTestConnection} className="border-[#333333] text-[#a3a3a3] hover:text-[#FF5722] hover:border-[#FF5722]">
              Create Test Connection
            </Button>
            <Button icon={<SafetyCertificateOutlined />} onClick={handleVerifyStorage} className="border-[#333333] text-[#a3a3a3] hover:text-[#FF5722] hover:border-[#FF5722]">
              Verify Storage
            </Button>
          </Space>
        </Card>

        {pingResponse && (
          <Card size="small" className="bg-[#1a1a1a] border-[#00ff00]">
            <Text className="!text-[#00ff00] drop-shadow-[0_0_5px_rgba(0,255,0,0.5)]">Response: {pingResponse}</Text>
          </Card>
        )}

        {verifyResult.length > 0 && (
          <Card title="Storage Verification Result" className="shadow-sm border-[#333333] bg-[#121212]">
            <pre className="bg-[#050505] p-4 rounded-lg overflow-x-auto text-sm border border-[#333333] text-[#00ff00]">
              {JSON.stringify(verifyResult, null, 2)}
            </pre>
          </Card>
        )}

        {selectedConnection && (
          <Card 
            title={`Active Connection: ${selectedConnection.name}`} 
            className="shadow-sm border-[#333333] bg-[#121212]"
            extra={
              <Space>
                <Button type="primary" icon={<CodeOutlined />} onClick={handleOpenSqlTab}>
                  New SQL Editor
                </Button>
                <Button icon={<MessageOutlined />} onClick={handleOpenChatTab} className="border-[#333333] text-[#a3a3a3] hover:text-[#FF5722] hover:border-[#FF5722]">
                  New Chat Agent
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
    <div className="flex min-h-screen w-full overflow-hidden bg-[#0a0a0a] text-[#a3a3a3]">
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
            <div className="flex h-full min-h-0 border-r border-[#333333]">
              <ConnectionListPanel 
                selectedConnectionId={selectedConnectionId}
                onSelect={handleSelectConnection} 
              />
              {selectedConnectionId && (
                <div className="h-full w-64 border-l border-[#333333] bg-[#121212]">
                  <ObjectBrowser 
                    connectionId={selectedConnectionId} 
                    connectionType={selectedConnection?.dbType} 
                  />
                </div>
              )}
            </div>
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
