import { CredentialService } from '../security/credential-service';
import { SqlClassifier, SqlRiskLevel } from '../security/sql-classifier';
import { sqliteService } from '../storage/sqlite-service';
import { LlmProvider } from '../../shared/types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  sql: string | null;
  explanation: string;
  riskLevel: 'ReadOnly' | 'Dangerous';
}

export interface AgentContext {
  dbType: string;
  schemaDDL: string;
}

interface OpenAICompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface AnthropicMessageResponse {
  content: Array<{
    text: string;
  }>;
}

interface ParsedAgentPayload {
  sql?: string | null;
  explanation?: string;
}

export class ChatAgent {
  private static getSystemPrompt(context: AgentContext): string {
    return `You are a database expert and SQL assistant.
Your task is to generate an executable SQL query based on the user's natural language request.

Target Database Dialect: ${context.dbType}

Here is the relevant schema DDL for context:
${context.schemaDDL}

Rules:
1. Only generate Read-Only queries (SELECT) by default.
2. If the user explicitly asks for write/delete/update, you may generate it, but mark it as Dangerous.
3. Your output MUST be strictly a valid JSON object without markdown formatting or code blocks.
4. The JSON object must have exactly three fields:
   - "sql": the generated SQL query as a string, or null if no valid SQL can be generated.
   - "explanation": a brief explanation of what the query does or why it cannot be generated.
   - "riskLevel": either "ReadOnly" or "Dangerous".

Example JSON output:
{
  "sql": "SELECT * FROM users LIMIT 10;",
  "explanation": "Retrieves the first 10 users from the table.",
  "riskLevel": "ReadOnly"
}`;
  }

  public static async generateSql(
    prompt: string,
    context: AgentContext,
    providerId?: string
  ): Promise<AgentResponse> {
    const data = sqliteService.getSetting('llm_providers');
    let providers: LlmProvider[] = [];
    if (data) {
      try {
        providers = JSON.parse(data);
      } catch (e) {
        // ignore
      }
    }

    let providerConfig: LlmProvider | undefined;
    
    if (providerId) {
      providerConfig = providers.find(p => p.id === providerId);
    } else {
      const activeId = sqliteService.getSetting('active_llm_provider');
      if (activeId) {
        providerConfig = providers.find(p => p.id === activeId);
      } else if (providers.length > 0) {
        providerConfig = providers[0];
      }
    }

    if (!providerConfig) {
      throw new Error('No LLM provider configured. Please configure an LLM provider in settings.');
    }

    const apiKey = CredentialService.getApiKey(`llm_${providerConfig.id}`);
    if (!apiKey) {
      throw new Error(`API Key for provider '${providerConfig.name}' is not configured.`);
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: this.getSystemPrompt(context) },
      { role: 'user', content: prompt }
    ];

    if (providerConfig.provider === 'openai') {
      return this.callOpenAI(messages, apiKey, providerConfig);
    } else if (providerConfig.provider === 'anthropic') {
      return this.callAnthropic(messages, apiKey, providerConfig);
    } else {
      throw new Error(`Unsupported provider type: ${providerConfig.provider}`);
    }
  }

  private static async callOpenAI(messages: ChatMessage[], apiKey: string, config: LlmProvider): Promise<AgentResponse> {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const endpoint = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as OpenAICompletionResponse;
    const content = data.choices[0].message.content;
    return this.parseAgentResponse(content);
  }

  private static async callAnthropic(messages: ChatMessage[], apiKey: string, config: LlmProvider): Promise<AgentResponse> {
    // Anthropic separates system prompt
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    const endpoint = baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-haiku-20240307', // or another available model
        system: systemMessage,
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 1024,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as AnthropicMessageResponse;
    const content = data.content[0].text;
    return this.parseAgentResponse(content);
  }

  private static parseAgentResponse(rawText: string): AgentResponse {
    try {
      // Sometimes LLMs still wrap json in markdown block even if told not to.
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '');
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.replace(/```$/, '');
      }
      
      const parsed = JSON.parse(cleaned) as ParsedAgentPayload;
      const sql = parsed.sql || null;
      
      let riskLevel: 'ReadOnly' | 'Dangerous' = 'Dangerous';
      
      if (sql) {
        const classification = SqlClassifier.classify(sql);
        riskLevel = classification.level === SqlRiskLevel.SAFE ? 'ReadOnly' : 'Dangerous';
      }
      
      return {
        sql,
        explanation: parsed.explanation || '',
        riskLevel
      };
    } catch (err) {
      throw new Error(`Failed to parse agent response as JSON. Raw text: ${rawText}`);
    }
  }
}
