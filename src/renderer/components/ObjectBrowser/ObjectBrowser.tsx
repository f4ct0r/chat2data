import React, { useState, useEffect } from 'react';
import { Tree, Button, Tooltip, Typography, Spin, Empty } from 'antd';
import { 
  ReloadOutlined, 
  DatabaseOutlined, 
  FolderOutlined, 
  TableOutlined, 
  ProfileOutlined 
} from '@ant-design/icons';
import { ConnectionConfig } from '../../../shared/types';

const { Text } = Typography;

interface ObjectBrowserProps {
  connectionId: string | null;
  connectionType?: ConnectionConfig['dbType'];
}

type NodeType = 'root' | 'database' | 'schema' | 'table' | 'column';

interface BrowserNode {
  key: string;
  title: string;
  type: NodeType;
  database?: string;
  schema?: string;
  table?: string;
  isLeaf?: boolean;
  children?: BrowserNode[];
}

const ObjectBrowser: React.FC<ObjectBrowserProps> = ({ connectionId }) => {
  const [treeData, setTreeData] = useState<BrowserNode[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRootNodes = async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      // For some DBs we might want to start with databases, for others schemas
      const dbs = await window.api.db.getDatabases(connectionId);
      const rootNodes: BrowserNode[] = dbs.map(db => ({
        key: `db:${db}`,
        title: db,
        type: 'database',
        database: db,
        isLeaf: false,
      }));
      setTreeData(rootNodes);
    } catch (error) {
      console.error('Failed to load root nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connectionId) {
      fetchRootNodes();
    } else {
      setTreeData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLoadData = async (node: any) => {
    const { key, type, database, schema, table, children } = node as BrowserNode;
    if (children && children.length > 0) {
      return;
    }

    if (!connectionId) return;

    try {
      let newChildren: BrowserNode[] = [];

      if (type === 'database') {
        const schemas = await window.api.db.getSchemas(connectionId, database);
        
        // Handle case where schemas are same as database (MySQL, ClickHouse)
        if (schemas.length === 1 && schemas[0] === database) {
          // Skip schema level and load tables directly
          const tables = await window.api.db.getTables(connectionId, database, database);
          newChildren = tables.map(t => ({
            key: `table:${database}:${database}:${t}`,
            title: t,
            type: 'table',
            database,
            schema: database,
            table: t,
            isLeaf: false,
          }));
        } else {
          newChildren = schemas.map(s => ({
            key: `schema:${database}:${s}`,
            title: s,
            type: 'schema',
            database,
            schema: s,
            isLeaf: false,
          }));
        }
      } else if (type === 'schema') {
        const tables = await window.api.db.getTables(connectionId, database, schema);
        newChildren = tables.map(t => ({
          key: `table:${database}:${schema}:${t}`,
          title: t,
          type: 'table',
          database,
          schema,
          table: t,
          isLeaf: false,
        }));
      } else if (type === 'table') {
        const columns = await window.api.db.getColumns(connectionId, database, schema, table);
        newChildren = columns.map(c => ({
          key: `col:${database}:${schema}:${table}:${c.name}`,
          title: `${c.name} (${c.type})`,
          type: 'column',
          database,
          schema,
          table,
          isLeaf: true,
        }));
      }

      setTreeData(origin =>
        updateTreeData(origin, key, newChildren)
      );
    } catch (error) {
      console.error(`Failed to load data for node ${key}:`, error);
    }
  };

  const updateTreeData = (list: BrowserNode[], key: React.Key, children: BrowserNode[]): BrowserNode[] => {
    return list.map(node => {
      if (node.key === key) {
        return {
          ...node,
          children,
        };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children),
        };
      }
      return node;
    });
  };

  const renderIcon = (type: NodeType) => {
    switch (type) {
      case 'database':
        return <DatabaseOutlined className="text-blue-500" />;
      case 'schema':
        return <FolderOutlined className="text-yellow-500" />;
      case 'table':
        return <TableOutlined className="text-green-500" />;
      case 'column':
        return <ProfileOutlined className="text-gray-400" />;
      default:
        return null;
    }
  };

  if (!connectionId) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Empty description="No connection selected" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <Text strong className="text-gray-700">Object Browser</Text>
        <Tooltip title="Refresh">
          <Button 
            type="text" 
            icon={<ReloadOutlined />} 
            size="small" 
            onClick={fetchRootNodes}
            loading={loading}
          />
        </Tooltip>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {loading && treeData.length === 0 ? (
          <div className="flex justify-center p-8">
            <Spin />
          </div>
        ) : (
          <Tree
            loadData={onLoadData}
            treeData={treeData}
            showIcon
            blockNode
            titleRender={(nodeData) => {
              const node = nodeData as BrowserNode;
              return (
                <div className="flex items-center gap-2">
                  {renderIcon(node.type)}
                  <span className="text-sm truncate" title={node.title}>{node.title}</span>
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ObjectBrowser;