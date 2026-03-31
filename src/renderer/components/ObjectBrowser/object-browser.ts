type NodeType = 'root' | 'database' | 'schema' | 'table' | 'column';

export interface BrowserNode {
  key: string;
  title: string;
  type: NodeType;
  database?: string;
  schema?: string;
  table?: string;
  isLeaf?: boolean;
  children?: BrowserNode[];
}

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
  }));
};

