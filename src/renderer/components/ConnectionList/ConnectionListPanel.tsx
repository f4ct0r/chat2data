import React, { useState, useEffect } from 'react';
import { Button, List, Tooltip, Typography, Space, Popconfirm } from 'antd';
import { PlusOutlined, DatabaseOutlined, EditOutlined, DeleteOutlined, DisconnectOutlined } from '@ant-design/icons';
import { ConnectionConfig } from '../../../shared/types';
import ConnectionModal from './ConnectionModal';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

interface ConnectionListPanelProps {
  onSelect: (connection: ConnectionConfig | null) => void;
  selectedConnectionId: string | null;
}

const ConnectionListPanel: React.FC<ConnectionListPanelProps> = ({ onSelect, selectedConnectionId }) => {
  const { t } = useI18n();
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
    <div className="w-64 h-full bg-[#0a0a0a] border-r border-[#333333] flex flex-col">
      <div className="p-4 border-b border-[#333333] flex justify-between items-center bg-[#121212]">
        <Text strong className="!text-[#FF5722] tracking-wider">{t('connectionList.title').toUpperCase()}</Text>
        <Tooltip title={t('connectionList.add')}>
          <Button 
            type="text" 
            icon={<PlusOutlined className="text-[#a3a3a3] hover:text-[#FF5722]" />} 
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
                className={`cursor-pointer transition-colors !px-4 py-3 border-b border-[#1a1a1a]
                  ${isSelected ? 'bg-[#FF5722]/10 border-l-2 !border-l-[#FF5722]' : 'hover:bg-[#1a1a1a]'}`}
                onClick={() => onSelect(item)}
              >
                <div className="w-full flex justify-between items-center group ml-1">
                  <Space className="w-full overflow-hidden" size={12}>
                    <DatabaseOutlined className={isSelected ? 'text-[#FF5722]' : 'text-[#737373]'} />
                    <div className="flex flex-col max-w-[130px]">
                      <Text 
                        ellipsis 
                        className={`text-sm ${isSelected ? 'font-medium !text-[#FF5722]' : '!text-[#a3a3a3]'}`}
                        title={item.name}
                      >
                        {item.name}
                      </Text>
                      <Text className="text-xs !text-[#737373]" ellipsis>
                        {item.dbType}
                      </Text>
                    </div>
                  </Space>
                  
                  <Space className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" size={4}>
                    <Tooltip title={t('connectionList.edit')}>
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined className="text-[#a3a3a3] hover:text-[#FF5722]" />} 
                        onClick={(e) => handleEditClick(item, e)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={t('connectionList.deleteTitle')}
                      description={t('connectionList.deleteDescription')}
                      onConfirm={(e) => e && handleDelete(item.id!, e as unknown as React.MouseEvent)}
                      onCancel={(e) => e?.stopPropagation()}
                      okText={t('common.yes')}
                      cancelText={t('common.no')}
                    >
                      <Tooltip title={t('connectionList.delete')}>
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
          <div className="p-8 text-center flex flex-col items-center justify-center text-[#737373] h-full">
            <DisconnectOutlined className="text-4xl mb-4 text-[#333333]" />
            <Text className="text-sm !text-[#737373]">{t('connectionList.noConnections')}</Text>
            <Button 
              type="link" 
              onClick={handleAddClick} 
              className="mt-2 text-[#FF5722] hover:text-[#E64A19]"
              icon={<PlusOutlined />}
            >
              {t('connectionList.add')}
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
