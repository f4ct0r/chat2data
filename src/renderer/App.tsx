import React, { useState } from 'react';
import { ConnectionConfig } from '../shared/types';
import Layout from './components/Layout';
import ConnectionListPanel from './components/ConnectionList/ConnectionListPanel';
import { Button, Card, Typography, Space } from 'antd';
import { PlusOutlined, SafetyCertificateOutlined, ApiOutlined, CodeOutlined, MessageOutlined } from '@ant-design/icons';
import ObjectBrowser from './components/ObjectBrowser/ObjectBrowser';
import WorkspaceTabs from './components/Tabs/WorkspaceTabs';
import { useTabStore } from './store/tabStore';

const { Title, Text } = Typography;

const App: React.FC = () => {
  const [pingResponse, setPingResponse] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [verifyResult, setVerifyResult] = useState<any[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | null>(null);
  
  const { tabs, addTab } = useTabStore();

  const handleSelectConnection = async (conn: ConnectionConfig | null) => {
    if (conn) {
      try {
        await window.api.db.connect(conn.id);
        setSelectedConnectionId(conn.id);
        setSelectedConnection(conn);
      } catch (error) {
        console.error('Failed to connect:', error);
        // Could show a notification here
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
    }
  };

  const handleOpenChatTab = () => {
    if (selectedConnectionId && selectedConnection) {
      addTab({
        title: `Chat - ${selectedConnection.name}`,
        type: 'chat',
        connectionId: selectedConnectionId,
      });
    }
  };

  const renderDashboard = () => (
    <div className="p-8 h-full overflow-y-auto bg-gray-50/50">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="mb-8">
          <Title level={2} className="!mb-1">Chat2Data Workspace</Title>
          <Text type="secondary">Select a connection from the left panel to begin.</Text>
        </header>

        <Card title="Quick Actions" className="shadow-sm border-gray-100">
          <Space wrap size="middle">
            <Button type="primary" icon={<ApiOutlined />} onClick={handlePing}>
              Ping Main Process
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleCreateTestConnection}>
              Create Test Connection
            </Button>
            <Button icon={<SafetyCertificateOutlined />} onClick={handleVerifyStorage}>
              Verify Storage
            </Button>
          </Space>
        </Card>

        {pingResponse && (
          <Card size="small" className="bg-green-50 border-green-200">
            <Text type="success" strong>Response: {pingResponse}</Text>
          </Card>
        )}

        {verifyResult.length > 0 && (
          <Card title="Storage Verification Result" className="shadow-sm border-gray-100">
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm border border-gray-200">
              {JSON.stringify(verifyResult, null, 2)}
            </pre>
          </Card>
        )}

        {selectedConnection && (
          <Card 
            title={`Active Connection: ${selectedConnection.name}`} 
            className="shadow-sm border-gray-100"
            extra={
              <Space>
                <Button type="primary" icon={<CodeOutlined />} onClick={handleOpenSqlTab}>
                  New SQL Editor
                </Button>
                <Button icon={<MessageOutlined />} onClick={handleOpenChatTab}>
                  New Chat Agent
                </Button>
              </Space>
            }
          >
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm border border-gray-200">
              {JSON.stringify(selectedConnection, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );

  return (
    <Layout 
      sidebarPanel={
        <div className="flex h-full">
          <ConnectionListPanel 
            selectedConnectionId={selectedConnectionId}
            onSelect={handleSelectConnection} 
          />
          {selectedConnectionId && (
            <div className="w-64 border-r border-gray-200">
              <ObjectBrowser 
                connectionId={selectedConnectionId} 
                connectionType={selectedConnection?.dbType} 
              />
            </div>
          )}
        </div>
      }
    >
      {tabs.length > 0 ? <WorkspaceTabs /> : renderDashboard()}
    </Layout>
  );
};

export default App;
