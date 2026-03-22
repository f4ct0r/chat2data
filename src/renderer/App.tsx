import React, { useState } from 'react';
import { ConnectionConfig } from '../shared/types';

const App: React.FC = () => {
  const [pingResponse, setPingResponse] = useState<string>('');
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [verifyResult, setVerifyResult] = useState<any[]>([]);

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
      
      // Refresh the list
      await handleGetConnections();
    } catch (error) {
      console.error('Failed to create test connection:', error);
    }
  };

  const handleGetConnections = async () => {
    try {
      const list = await window.api.storage.getConnections();
      setConnections(list);
    } catch (error) {
      console.error('Failed to get connections:', error);
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

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Chat2Data</h1>
      <p>Electron + React + TypeScript + Vite Setup Complete!</p>
      
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button onClick={handlePing} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Ping Main Process
        </button>
        
        <button onClick={handleCreateTestConnection} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          创建一条测试连接
        </button>
        
        <button onClick={handleGetConnections} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          读取所有连接
        </button>

        <button onClick={handleVerifyStorage} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          验证加密存储
        </button>
      </div>

      {pingResponse && (
        <p style={{ marginTop: '10px', color: 'green', fontWeight: 'bold' }}>
          Response: {pingResponse}
        </p>
      )}

      {verifyResult.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Storage Verification Result:</h2>
          <pre style={{ background: '#e6f7ff', padding: '10px', borderRadius: '4px' }}>
            {JSON.stringify(verifyResult, null, 2)}
          </pre>
        </div>
      )}

      {connections.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Connection List (Decoupled & Sanitized):</h2>
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
            {JSON.stringify(connections, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default App;
