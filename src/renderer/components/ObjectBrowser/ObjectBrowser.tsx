import React, { useState, useEffect } from 'react';
import { Tree, Button, Tooltip, Typography, Spin, Empty } from 'antd';
import { 
  ReloadOutlined, 
  DatabaseOutlined, 
  FolderOutlined, 
  TableOutlined,
  ProfileOutlined,
  CodeOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { ConnectionConfig } from '../../../shared/types';
import { useI18n } from '../../i18n/i18n-context';
import type { TablePreviewRequest } from '../../features/table-preview';
import {
  buildRootNodes,
  buildSchemaNode,
  buildScriptFolderNode,
  buildScriptNode,
  buildTableNode,
  removeNodeFromTree,
  type BrowserNode,
} from './object-browser';

const { Text } = Typography;

interface ObjectBrowserProps {
  connectionId: string | null;
  connectionType?: ConnectionConfig['dbType'];
  connectionDatabase?: string;
  onPreviewTable?: (request: TablePreviewRequest) => void;
  onOpenScript?: (scriptId: string, databaseName: string, title: string) => void;
  onCreateScript?: (databaseName: string) => void;
  onDeleteScript?: (scriptId: string, databaseName: string) => void;
}

type NodeType = 'root' | 'database' | 'scriptFolder' | 'script' | 'schema' | 'table' | 'column';

const ObjectBrowser: React.FC<ObjectBrowserProps> = ({
  connectionId,
  connectionType,
  connectionDatabase,
  onPreviewTable,
  onOpenScript,
  onCreateScript,
  onDeleteScript,
}) => {
  const { t } = useI18n();
  const [treeData, setTreeData] = useState<BrowserNode[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRootNodes = async (refreshCompletionSchema: boolean = false) => {
    if (!connectionId) return;
    setLoading(true);
    try {
      if (refreshCompletionSchema) {
        await window.api.db.refreshSchemaIndex(connectionId);
      }

      // For some DBs we might want to start with databases, for others schemas
      const dbs = await window.api.db.getDatabases(connectionId);
      const rootNodes = await Promise.all(
        buildRootNodes(dbs, connectionDatabase).map(async (rootNode) => {
          const database = rootNode.database;

          if (!database) {
            return rootNode;
          }

          const schemas = await window.api.db.getSchemas(connectionId, database);

          const objectChildren =
            schemas.length === 0
              ? (await window.api.db.getTables(connectionId, database)).map((table) =>
                  buildTableNode(database, '', table)
                )
              : schemas.length === 1 && schemas[0] === database
                ? (await window.api.db.getTables(connectionId, database, database)).map((table) =>
                    buildTableNode(database, database, table)
                  )
                : schemas.map((schema) => buildSchemaNode(database, schema));

          return {
            ...rootNode,
            children: [buildScriptFolderNode(database), ...objectChildren],
          };
        })
      );
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
  }, [connectionDatabase, connectionId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLoadData = async (node: any) => {
    const { key, type, database, schema, table, children } = node as BrowserNode;
    if (type === 'script' || (children && children.length > 0)) {
      return;
    }

    if (!connectionId) return;

    try {
      let newChildren: BrowserNode[] = [];

      if (type === 'scriptFolder') {
        const scripts = await window.api.storage.listSqlScripts(connectionId, database ?? '');
        newChildren = scripts.map((script) =>
          buildScriptNode(database ?? '', script.id, script.name)
        );
      } else if (type === 'schema') {
        const tables = await window.api.db.getTables(connectionId, database, schema);
        newChildren = tables.map((tableName) =>
          buildTableNode(database ?? '', schema ?? '', tableName)
        );
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
        return <DatabaseOutlined className="text-[#FF5722]" />;
      case 'schema':
        return <FolderOutlined className="text-[#00ff00]" />;
      case 'scriptFolder':
        return <CodeOutlined className="text-[#FFB347]" />;
      case 'script':
        return <CodeOutlined className="text-[#FFB347]" />;
      case 'table':
        return <TableOutlined className="text-[#a3a3a3]" />;
      case 'column':
        return <ProfileOutlined className="text-[#737373]" />;
      default:
        return null;
    }
  };

  if (!connectionId) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <Empty description={<span className="text-[#737373]">{t('objectBrowser.noConnectionSelected')}</span>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-[#333333]">
      <div className="p-3 border-b border-[#333333] flex justify-between items-center bg-[#121212]">
        <Text strong className="!text-[#FF5722] tracking-wider text-xs">{t('objectBrowser.title').toUpperCase()}</Text>
        <Tooltip title={t('objectBrowser.refresh')}>
          <Button 
            type="text" 
            icon={<ReloadOutlined className="text-[#a3a3a3] hover:text-[#FF5722]" />} 
            size="small" 
            onClick={() => {
              void fetchRootNodes(true);
            }}
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
            className="!bg-transparent !text-[#a3a3a3]"
            loadData={onLoadData}
            treeData={treeData}
            showIcon
            blockNode
            onDoubleClick={(_, nodeData) => {
              const node = nodeData as BrowserNode;
              if (
                node.type === 'table' &&
                connectionId &&
                connectionType &&
                node.table
              ) {
                onPreviewTable?.({
                  connectionId,
                  dbType: connectionType,
                  database: node.database,
                  schema: node.schema,
                  table: node.table,
                });
              }

              if (node.type === 'script' && node.scriptId && node.database) {
                onOpenScript?.(node.scriptId, node.database, node.title);
              }
            }}
            titleRender={(nodeData) => {
              const node = nodeData as BrowserNode;
              return (
                <div className="flex items-center gap-2 hover:text-[#FF5722] transition-colors">
                  {renderIcon(node.type)}
                  <span className="text-sm truncate font-mono" title={node.title}>{node.title}</span>
                  {node.type === 'scriptFolder' && node.database ? (
                    <Button
                      size="small"
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateScript?.(node.database!);
                      }}
                    />
                  ) : null}
                  {node.type === 'script' && node.scriptId && node.database ? (
                    <Button
                      size="small"
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={async (event) => {
                        event.stopPropagation();
                        await window.api.storage.deleteSqlScript(node.scriptId!);
                        setTreeData((current) => removeNodeFromTree(current, node.key));
                        onDeleteScript?.(node.scriptId!, node.database!);
                      }}
                    />
                  ) : null}
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
