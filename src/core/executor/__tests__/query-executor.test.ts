import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryExecutor } from '../query-executor';
import { connectionManager } from '../../db/connection-manager';

// Mock connectionManager
vi.mock('../../db/connection-manager', () => ({
  connectionManager: {
    executeQuery: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    killQuery: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('QueryExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('injectLimit', () => {
    it('should inject LIMIT 1000 for simple SELECT queries', () => {
      const sql = 'SELECT * FROM users';
      expect(QueryExecutor.injectLimit(sql)).toBe('SELECT * FROM users LIMIT 1000');
    });

    it('should inject LIMIT 1000 before semicolon', () => {
      const sql = 'SELECT * FROM users;';
      expect(QueryExecutor.injectLimit(sql)).toBe('SELECT * FROM users LIMIT 1000;');
    });

    it('should not inject LIMIT if already present', () => {
      const sql = 'SELECT * FROM users LIMIT 10';
      expect(QueryExecutor.injectLimit(sql)).toBe('SELECT * FROM users LIMIT 10');
    });

    it('should not inject LIMIT for mssql TOP queries', () => {
      const sql = 'SELECT TOP 100 * FROM users';
      expect(QueryExecutor.injectLimit(sql)).toBe(sql);
    });

    it('should not inject LIMIT for INSERT queries', () => {
      const sql = 'INSERT INTO users (name) VALUES ("test")';
      expect(QueryExecutor.injectLimit(sql)).toBe(sql);
    });

    it('should not inject LIMIT for UPDATE queries', () => {
      const sql = 'UPDATE users SET name = "test"';
      expect(QueryExecutor.injectLimit(sql)).toBe(sql);
    });

    it('should not inject LIMIT for DELETE queries', () => {
      const sql = 'DELETE FROM users';
      expect(QueryExecutor.injectLimit(sql)).toBe(sql);
    });
  });

  describe('execute', () => {
    it('should inject limit and execute query', async () => {
      await QueryExecutor.execute('conn1', 'SELECT * FROM users');
      expect(connectionManager.executeQuery).toHaveBeenCalledWith('conn1', 'SELECT * FROM users LIMIT 1000');
    });

    it('should update execution status during execution', async () => {
      // Mock executeQuery to simulate long running task
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolveQuery: (value: any) => void;
      const queryPromise = new Promise((resolve) => {
        resolveQuery = resolve;
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(connectionManager.executeQuery).mockReturnValueOnce(queryPromise as any);

      expect(QueryExecutor.getStatus('conn2')).toBe('idle');
      
      const execPromise = QueryExecutor.execute('conn2', 'SELECT 1');
      expect(QueryExecutor.getStatus('conn2')).toBe('executing');

      resolveQuery!({ rows: [], rowCount: 0 });
      await execPromise;

      expect(QueryExecutor.getStatus('conn2')).toBe('idle');
    });
  });

  describe('cancel', () => {
    it('should call connectionManager.killQuery', async () => {
      await QueryExecutor.cancel('conn1');
      expect(connectionManager.killQuery).toHaveBeenCalledWith('conn1');
    });
  });
});
