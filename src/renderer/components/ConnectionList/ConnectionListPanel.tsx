import React, { useState, useEffect } from 'react';
import { Button, List, Tooltip, Typography, Space, Popconfirm } from 'antd';
import { PlusOutlined, DatabaseOutlined, EditOutlined, DeleteOutlined, DisconnectOutlined } from '@ant-design/icons';
import { ConnectionConfig } from '../../../shared/types';
import ConnectionModal from './ConnectionModal';

const { Text } = Typography;

interface ConnectionListPanelProps {
  onSelect: (connection: ConnectionConfig | null) => void;
  selectedConnectionId: string | null;
}

const ConnectionListPanel: React.FC<ConnectionListPanelProps> = ({ onSelect, selectedConnectionId }) => {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Partial<ConnectionConfig> | undefined>(undefined);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const list = await window.api.storage.getConnections();
      setConnections(list);
    } catch (error) {
      console.error('Failed to get connections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleAddClick = () => {
    setEditingConnection(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (connection: ConnectionConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConnection(connection);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.api.storage.deleteConnection(id);
      if (selectedConnectionId === id) {
        onSelect(null); // deselect if deleting active connection
      }
      fetchConnections();
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  const handleSaveConnection = async (values: ConnectionConfig) => {
    try {
      await window.api.storage.saveConnection(values);
      setIsModalOpen(false);
      fetchConnections();
    } catch (error) {
      console.error('Failed to save connection:', error);
      throw error;
    }
  };

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <Text strong className="text-gray-700">Connections</Text>
        <Tooltip title="Add Connection">
          <Button 
            type="text" 
            icon={<PlusOutlined />} 
            size="small" 
            onClick={handleAddClick} 
          />
        </Tooltip>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <List
          loading={loading}
          dataSource={connections}
          renderItem={(item) => {
            const isSelected = selectedConnectionId === item.id;
            return (
              <List.Item
                className={`cursor-pointer transition-colors px-4 py-3 border-b border-gray-100
                  ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => onSelect(item)}
              >
                <div className="w-full flex justify-between items-center group">
                  <Space className="w-full overflow-hidden">
                    <DatabaseOutlined className={isSelected ? 'text-blue-600' : 'text-gray-400'} />
                    <div className="flex flex-col max-w-[130px]">
                      <Text 
                        ellipsis 
                        className={`text-sm ${isSelected ? 'font-medium text-blue-700' : 'text-gray-700'}`}
                        title={item.name}
                      >
                        {item.name}
                      </Text>
                      <Text type="secondary" className="text-xs" ellipsis>
                        {item.dbType}
                      </Text>
                    </div>
                  </Space>
                  
                  <Space className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" size={4}>
                    <Tooltip title="Edit">
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined className="text-gray-500" />} 
                        onClick={(e) => handleEditClick(item, e)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Delete connection"
                      description="Are you sure to delete this connection?"
                      onConfirm={(e) => e && handleDelete(item.id!, e as unknown as React.MouseEvent)}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Tooltip title="Delete">
                        <Button 
                          type="text" 
                          size="small" 
                          danger
                          icon={<DeleteOutlined />} 
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>
              </List.Item>
            );
          }}
        />
        {connections.length === 0 && !loading && (
          <div className="p-8 text-center flex flex-col items-center justify-center text-gray-400 h-full">
            <DisconnectOutlined className="text-4xl mb-4 text-gray-300" />
            <Text type="secondary" className="text-sm">No connections found</Text>
            <Button 
              type="link" 
              onClick={handleAddClick} 
              className="mt-2"
              icon={<PlusOutlined />}
            >
              Add Connection
            </Button>
          </div>
        )}
      </div>

      <ConnectionModal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSave={handleSaveConnection}
        initialValues={editingConnection}
      />
    </div>
  );
};

export default ConnectionListPanel;
