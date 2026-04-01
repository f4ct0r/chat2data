type NodeType = 'root' | 'database' | 'scriptFolder' | 'script' | 'schema' | 'table' | 'column';

export interface BrowserNode {
  key: string;
  title: string;
  type: NodeType;
  database?: string;
  schema?: string;
  table?: string;
  scriptId?: string;
  isLeaf?: boolean;
  children?: BrowserNode[];
}

export const buildScriptFolderNode = (database: string): BrowserNode => ({
  key: `script-folder:${database}`,
  title: 'Scripts',
  type: 'scriptFolder',
  database,
  isLeaf: false,
});

export const buildScriptNode = (
  database: string,
  scriptId: string,
  title: string
): BrowserNode => ({
  key: `script:${database}:${scriptId}`,
  title,
  type: 'script',
  database,
  scriptId,
  isLeaf: true,
});

export const buildSchemaNode = (database: string, schema: string): BrowserNode => ({
  key: `schema:${database}:${schema}`,
  title: schema,
  type: 'schema',
  database,
  schema,
  isLeaf: false,
});

export const buildTableNode = (
  database: string,
  schema: string,
  table: string
): BrowserNode => ({
  key: `table:${database}:${schema}:${table}`,
  title: table,
  type: 'table',
  database,
  schema,
  table,
  isLeaf: false,
});

export const buildRootNodes = (
  databases: string[],
  connectionDatabase?: string
): BrowserNode[] => {
  const visibleDatabases = connectionDatabase
    ? databases.filter((database) => database === connectionDatabase)
    : databases;

  return visibleDatabases.map((database) => ({
    key: `db:${database}`,
    title: database,
    type: 'database',
    database,
    isLeaf: false,
    children: [buildScriptFolderNode(database)],
  }));
};

export const removeNodeFromTree = (
  nodes: BrowserNode[],
  targetKey: string
): BrowserNode[] =>
  nodes
    .filter((node) => node.key !== targetKey)
    .map((node) => ({
      ...node,
      children: node.children ? removeNodeFromTree(node.children, targetKey) : node.children,
    }));
