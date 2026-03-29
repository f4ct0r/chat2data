import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Typography, Spin, Space, Card, Tag, Tooltip } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, CopyOutlined, PlayCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useTabStore } from '../../store/tabStore';
import { ConnectionConfig, QueryResult } from '../../../shared/types';
import DataGrid from '../DataGrid/DataGrid';
import { emitGlobalError } from '../../utils/errorBus';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

interface ChatPanelProps {
  tabId: string;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  sql?: string | null;
  explanation?: string;
  riskLevel?: 'ReadOnly' | 'Dangerous';
  result?: QueryResult | null;
  error?: string;
  isGenerationError?: boolean;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const ChatPanel: React.FC<ChatPanelProps> = ({ tabId }) => {
  const { t } = useI18n();
  const { tabs, addTab } = useTabStore();
  const tab = tabs.find((t) => t.id === tabId);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: t('chat.welcome'),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    if (tab?.connectionId) {
      void window.api.storage.getConnections()
        .then((conns) => {
          if (cancelled) {
            return;
          }

          const conn = conns.find((item) => item.id === tab.connectionId) ?? null;
          setConnection(conn);
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          console.error('Failed to load chat connection:', error);
          setConnection(null);
        });
    } else {
      setConnection(null);
    }

    return () => {
      cancelled = true;
    };
  }, [tab?.connectionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const buildSchemaDDL = async (): Promise<string> => {
    if (!tab?.connectionId) return '';
    let ddl = '';
    try {
      const tables = await window.api.db.getTables(tab.connectionId);
      // To prevent taking too long, let's limit the number of tables we fetch columns for
      const targetTables = tables.slice(0, 50); 
      for (const table of targetTables) {
        const cols = await window.api.db.getColumns(tab.connectionId, undefined, undefined, table);
        ddl += `CREATE TABLE ${table} (\n`;
        ddl += cols.map(c => `  ${c.name} ${c.type}`).join(',\n');
        ddl += '\n);\n\n';
      }
    } catch (e) {
      console.warn('Failed to build schema DDL', e);
    }
    return ddl;
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !tab?.connectionId || !connection) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const schemaDDL = await buildSchemaDDL();
      const context = {
        dbType: connection.dbType,
        schemaDDL,
      };

      const result = await window.api.agent.generateSql(userMessage.content, context);

      let queryResult: QueryResult | null = null;
      let queryError: string | undefined = undefined;

      // Auto-execute if ReadOnly
      if (result.sql && result.riskLevel === 'ReadOnly' && tab.connectionId) {
        try {
          queryResult = await window.api.db.executeQuery(tab.connectionId, result.sql);
        } catch (err) {
          queryError = getErrorMessage(err);
          emitGlobalError({
            title: t('errors.sqlExecution'),
            message: queryError,
            type: 'sql_syntax',
          });
        }
      }

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: result.explanation,
        sql: result.sql,
        explanation: result.explanation,
        riskLevel: result.riskLevel,
        result: queryResult,
        error: queryError,
      };
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: t('chat.agentFailed', { error: errorMessage }),
        isGenerationError: true,
      }]);

      if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch') || errorMessage.toLowerCase().includes('timeout')) {
        emitGlobalError({
          title: t('errors.network'),
          message: errorMessage,
          type: 'network',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExecuteSql = (sql: string) => {
    if (!tab?.connectionId) return;
    addTab({
      title: t('chat.queryFromChat'),
      type: 'sql',
      connectionId: tab.connectionId,
      content: sql,
    });
  };

  const handleSwitchToEditor = () => {
    if (!tab?.connectionId) return;
    addTab({
      title: t('chat.manualQuery'),
      type: 'sql',
      connectionId: tab.connectionId,
      content: t('chat.manualQueryTemplate'),
    });
  };

  if (!tab) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] overflow-hidden text-[#a3a3a3] font-mono">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                msg.role === 'user' ? 'bg-[#FF5722]/20 border-[#FF5722] text-[#FF5722]' : 'bg-[#00ff00]/20 border-[#00ff00] text-[#00ff00]'
              }`}>
                {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              </div>

              {/* Message Bubble */}
              <div className="flex flex-col gap-2">
                {msg.isGenerationError ? (
                  <div className="bg-[#ff0000]/10 border border-[#ff0000]/30 shadow-[0_0_8px_rgba(255,0,0,0.3)] rounded-sm p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-2 text-[#ff0000]">
                      <ExclamationCircleOutlined className="mt-1" />
                      <Text strong className="!text-[#ff0000] tracking-wider">{t('chat.generationFailed')}</Text>
                    </div>
                    <Text className="!text-[#ff0000]/80">{msg.content}</Text>
                    <div className="mt-2">
                      <Button danger onClick={handleSwitchToEditor} className="font-mono text-xs">
                        {t('chat.switchToManualSql')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-3 rounded-sm border ${
                    msg.role === 'user' 
                      ? 'bg-[#FF5722]/10 border-[#FF5722]/30 text-[#FF5722]' 
                      : 'bg-[#121212] border-[#333333] shadow-[0_0_5px_rgba(0,255,0,0.1)] text-[#00ff00]'
                  }`}>
                    <Text className={`font-mono ${msg.role === 'user' ? '!text-[#FF5722]' : '!text-[#00ff00]'}`} style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.role === 'agent' ? '> ' : ''}{msg.content}
                    </Text>
                  </div>
                )}

                {/* Agent SQL Output */}
                {msg.role === 'agent' && msg.sql && (
                  <Card 
                    size="small" 
                    className="shadow-sm border-[#333333] bg-[#050505] mt-1 flex flex-col"
                    styles={{ body: { padding: 0 } }}
                    title={
                      <Space>
                        <Text strong className="!text-[#a3a3a3] font-mono tracking-wider">{t('chat.generatedSql')}</Text>
                        {msg.riskLevel === 'ReadOnly' ? (
                          <Tag color="green" className="font-mono bg-[#00ff00]/10 border-[#00ff00]/30 text-[#00ff00]">{t('chat.risk.readOnly')}</Tag>
                        ) : msg.riskLevel === 'Dangerous' ? (
                          <Tag color="red" className="font-mono bg-[#ff0000]/10 border-[#ff0000]/30 text-[#ff0000]">{t('chat.risk.dangerous')}</Tag>
                        ) : null}
                      </Space>
                    }
                    extra={
                      <Space>
                        <Tooltip title={t('chat.copySql')}>
                          <Button 
                            type="text" 
                            icon={<CopyOutlined className="text-[#737373] hover:text-[#FF5722]" />} 
                            size="small"
                            onClick={() => navigator.clipboard.writeText(msg.sql || '')}
                          />
                        </Tooltip>
                        <Tooltip title={t('chat.openInEditor')}>
                          <Button 
                            type="primary" 
                            icon={<PlayCircleOutlined />} 
                            size="small"
                            className="font-mono text-xs"
                            onClick={() => handleExecuteSql(msg.sql!)}
                          >
                            {t('chat.run')}
                          </Button>
                        </Tooltip>
                      </Space>
                    }
                  >
                    <div className="p-3">
                      <pre className="bg-[#000000] p-3 rounded-sm text-sm overflow-x-auto m-0 font-mono text-[#00ff00] border border-[#333333]">
                        {msg.sql}
                      </pre>
                    </div>
                    {msg.result && (
                      <div className="border-t border-[#333333] h-48">
                        <DataGrid result={msg.result} />
                      </div>
                    )}
                    {msg.error && (
                      <div className="p-3 bg-[#ff0000]/10 border-t border-[#ff0000]/30">
                        <Text className="!text-[#ff0000] font-mono text-xs">&gt; [ERROR] {msg.error}</Text>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex flex-row gap-3">
              <div className="w-8 h-8 rounded-full border border-[#00ff00] bg-[#00ff00]/20 text-[#00ff00] flex items-center justify-center shrink-0">
                <RobotOutlined />
              </div>
              <div className="p-3 bg-[#121212] border border-[#333333] shadow-sm rounded-sm flex items-center gap-2">
                <Spin size="small" />
                <Text className="!text-[#00ff00] font-mono animate-pulse">{t('chat.processing')}</Text>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#121212] border-t border-[#333333]">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.inputPlaceholder')}
            autoSize={{ minRows: 1, maxRows: 5 }}
            className="flex-1 font-mono bg-[#050505] text-[#00ff00] border-[#333333] focus:border-[#FF5722]"
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim() || loading}
            className="h-auto px-6 font-mono tracking-wider"
          >
            {t('chat.exec')}
          </Button>
        </div>
        <div className="text-center mt-2">
          <Text className="text-xs !text-[#737373] font-mono">
            {t('chat.inputHint')}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
