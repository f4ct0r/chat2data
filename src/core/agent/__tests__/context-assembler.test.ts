import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextAssembler } from '../context-assembler';
import { schemaIndexer } from '../schema-indexer';
import { SchemaIndex, TableMetadata } from '../types';

vi.mock('../schema-indexer', () => ({
  schemaIndexer: {
    getIndex: vi.fn(),
  }
}));

describe('ContextAssembler', () => {
  let assembler: ContextAssembler;

  const buildSchemaIndex = (tables: Map<string, TableMetadata>): SchemaIndex => ({
    database: 'test_db',
    tables,
    lastUpdated: Date.now()
  });

  beforeEach(() => {
    assembler = new ContextAssembler();
  });

  it('should assemble context based on keywords', () => {
    const mockTables = new Map([
      ['users', {
        name: 'users',
        comment: 'User accounts',
        columns: [
          { name: 'id', type: 'int', comment: 'Primary key' },
          { name: 'email', type: 'varchar', comment: 'User email' }
        ],
        ddl: 'CREATE TABLE users (id int, email varchar);'
      }],
      ['orders', {
        name: 'orders',
        comment: 'Customer orders',
        columns: [
          { name: 'id', type: 'int', comment: 'Order ID' },
          { name: 'user_id', type: 'int', comment: 'User ID' }
        ],
        ddl: 'CREATE TABLE orders (id int, user_id int);'
      }],
      ['products', {
        name: 'products',
        comment: 'Available products',
        columns: [
          { name: 'id', type: 'int', comment: 'Product ID' },
          { name: 'name', type: 'varchar', comment: 'Product name' }
        ],
        ddl: 'CREATE TABLE products (id int, name varchar);'
      }]
    ]);

    vi.mocked(schemaIndexer.getIndex).mockReturnValue(buildSchemaIndex(mockTables));

    const result = assembler.assembleContext('find users and their orders', 'conn1', 'test_db');

    // Expected to match "users" and "orders" highly
    expect(result.tablesUsed).toContain('users');
    expect(result.tablesUsed).toContain('orders');
    // "products" has no match so it might not be included or included last
    // Actually, "orders" score is high for "orders", "users" is high for "users"
    expect(result.context).toContain('CREATE TABLE users');
    expect(result.context).toContain('CREATE TABLE orders');
  });

  it('should return empty string if no index found', () => {
    vi.mocked(schemaIndexer.getIndex).mockReturnValue(undefined);

    const result = assembler.assembleContext('find users', 'conn1', 'test_db');
    expect(result.context).toBe('');
    expect(result.tablesUsed).toEqual([]);
  });

  it('should fallback to all tables if no keywords match', () => {
    const mockTables = new Map([
      ['users', {
        name: 'users',
        columns: [],
        ddl: 'CREATE TABLE users ();'
      }]
    ]);

    vi.mocked(schemaIndexer.getIndex).mockReturnValue(buildSchemaIndex(mockTables));

    const result = assembler.assembleContext('xyzabc123', 'conn1', 'test_db');
    expect(result.tablesUsed).toEqual(['users']);
    expect(result.context).toContain('CREATE TABLE users');
  });
});
