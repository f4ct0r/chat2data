import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatAgent, AgentContext } from '../chat-agent';
import { CredentialService } from '../../security/credential-service';
import { sqliteService } from '../../storage/sqlite-service';
import { LlmProvider } from '../../../shared/types';

vi.mock('../../security/credential-service', () => ({
  CredentialService: {
    getApiKey: vi.fn(),
  }
}));

vi.mock('../../storage/sqlite-service', () => ({
  sqliteService: {
    getSetting: vi.fn(),
  }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ChatAgent', () => {
  const mockContext: AgentContext = {
    dbType: 'postgres',
    schemaDDL: 'CREATE TABLE users (id INT, name VARCHAR);'
  };

  const mockProviders: LlmProvider[] = [
    { id: '1', name: 'My OpenAI', provider: 'openai', model: 'gpt-4o-mini' },
    { id: '2', name: 'My Anthropic', provider: 'anthropic', model: 'claude-3-haiku-20240307' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CredentialService.getApiKey).mockReturnValue('fake-api-key');
    vi.mocked(sqliteService.getSetting).mockImplementation((key: string) => {
      if (key === 'llm_providers') return JSON.stringify(mockProviders);
      if (key === 'active_llm_provider') return '1'; // default to openai
      return null;
    });
  });

  describe('System Prompt Generation', () => {
    it('should include dbType and schemaDDL in the prompt', async () => {
      // We will spy on fetch to capture the request payload and verify the prompt
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"sql":"SELECT * FROM users","explanation":"test","riskLevel":"ReadOnly"}' } }]
        })
      });

      await ChatAgent.generateSql('Get all users', mockContext, '1');

      const fetchCallArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCallArgs[1].body);
      const systemPrompt = requestBody.messages[0].content;

      expect(systemPrompt).toContain('Target Database Dialect: postgres');
      expect(systemPrompt).toContain('CREATE TABLE users (id INT, name VARCHAR);');
    });
  });

  describe('OpenAI Integration', () => {
    it('should call OpenAI-compatible API without forcing json_object response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"sql":"SELECT * FROM users","explanation":"Gets all users","riskLevel":"ReadOnly"}' } }]
        })
      });

      const response = await ChatAgent.generateSql('Get all users', mockContext, '1');

      expect(mockFetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-api-key'
        }
      }));

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model).toBe('gpt-4o-mini');
      expect(requestBody).not.toHaveProperty('response_format');

      expect(response).toEqual({
        sql: 'SELECT * FROM users',
        explanation: 'Gets all users',
        riskLevel: 'ReadOnly'
      });
    });

    it('should handle OpenAI API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      await expect(ChatAgent.generateSql('Get all users', mockContext, '1'))
        .rejects.toThrow('OpenAI API error: 401 Unauthorized');
    });
  });

  describe('Anthropic Integration', () => {
    it('should call Anthropic API correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: '{"sql":"SELECT * FROM users","explanation":"Gets all users","riskLevel":"ReadOnly"}' }]
        })
      });

      const response = await ChatAgent.generateSql('Get all users', mockContext, '2');

      expect(mockFetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fake-api-key',
          'anthropic-version': '2023-06-01'
        }
      }));

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model).toBe('claude-3-haiku-20240307');
      expect(requestBody.system).toContain('You are a database expert and SQL assistant.');
      expect(requestBody.messages).toEqual([{ role: 'user', content: 'Get all users' }]);

      expect(response).toEqual({
        sql: 'SELECT * FROM users',
        explanation: 'Gets all users',
        riskLevel: 'ReadOnly'
      });
    });

    it('should handle Anthropic API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      });

      await expect(ChatAgent.generateSql('Get all users', mockContext, '2'))
        .rejects.toThrow('Anthropic API error: 400 Bad Request');
    });
  });

  describe('Response Parsing', () => {
    it('should parse markdown-wrapped JSON correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '```json\n{"sql":"SELECT 1","explanation":"test","riskLevel":"ReadOnly"}\n```' } }]
        })
      });

      const response = await ChatAgent.generateSql('test', mockContext, '1');
      expect(response.sql).toBe('SELECT 1');
    });

    it('should throw an error if JSON is completely invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This is not json' } }]
        })
      });

      await expect(ChatAgent.generateSql('test', mockContext, '1'))
        .rejects.toThrow(/Failed to parse agent response as JSON/);
    });
  });
});
