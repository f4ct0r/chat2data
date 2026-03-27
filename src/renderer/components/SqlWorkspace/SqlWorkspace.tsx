import React, { useState } from 'react';
import SqlEditor from '../SqlEditor';
import DataGrid from '../DataGrid/DataGrid';
import QueryHistory from '../QueryHistory/QueryHistory';
import { Button, Tabs, Modal, Typography } from 'antd';
import { CaretRightOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { QueryResult } from '../../../shared/types';
import { useTabStore } from '../../store/tabStore';
import { SqlClassifier, SqlRiskLevel } from '../../../core/security/sql-classifier';
import { emitGlobalError } from '../../utils/errorBus';
import { resolveExecutableSql, SqlExecutionTarget } from '../SqlEditor/sql-execution';

interface SqlWorkspaceProps {
  tabId: string;
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  durationMs: number;
  timestamp: number;
  status: 'success' | 'error';
  error?: string;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const { Text } = Typography;

const SqlWorkspace: React.FC<SqlWorkspaceProps> = ({ tabId }) => {
  const { tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === tabId);

  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [executionTarget, setExecutionTarget] = useState<SqlExecutionTarget | null>(null);

  if (!tab) return null;

  const executableSql = resolveExecutableSql(tab.content || '', executionTarget);
  const hasLineSelection = Boolean(executionTarget?.hasSelection);

  const handleExecute = async () => {
    if (!executableSql) return;

    const classification = SqlClassifier.classify(executableSql);
    
    if (classification.level === SqlRiskLevel.DANGEROUS) {
      Modal.confirm({
        title: 'Dangerous Operation Detected',
        icon: <ExclamationCircleOutlined className="text-red-500" />,
        content: `You are about to execute a potentially dangerous query (${classification.operation}). Are you sure you want to proceed?`,
        okText: 'Yes, Execute',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: () => performExecution(executableSql),
      });
    } else {
      performExecution(executableSql);
    }
  };

  const performExecution = async (sql: string) => {
    if (!sql.trim()) return;
    
    setExecuting(true);
    setError(null);
    const startTime = Date.now();
    try {
      const res = await window.api.db.executeQuery(tab.connectionId, sql);
      setResult(res);
      setHistory(prev => [{
        id: Date.now().toString(),
        sql,
        durationMs: res.durationMs,
        timestamp: Date.now(),
        status: 'success'
      }, ...prev]);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      // Emit global error for SQL syntax or execution failure
      emitGlobalError({
        title: 'SQL Execution Error',
        message: errorMessage,
        type: 'sql_syntax',
      });

      setResult(null);
      setHistory(prev => [{
        id: Date.now().toString(),
        sql,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        status: 'error',
        error: errorMessage
      }, ...prev]);
    } finally {
      setExecuting(false);
    }
  };

  const handleReplay = (sql: string) => {
    updateTab(tab.id, { content: sql });
    // setTimeout to allow state update before execute, or just rely on the user to click execute
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a]">
      <div className="border-b border-[#333333] bg-[#050505] flex flex-col" style={{ height: '300px', minHeight: '150px' }}>
        <div className="flex items-center justify-between gap-3 border-b border-[#333333] bg-[#121212] px-3 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              icon={<CaretRightOutlined />}
              onClick={handleExecute}
              loading={executing}
              disabled={executing || !executableSql}
              className="min-w-[240px] font-mono tracking-wider"
            >
              {hasLineSelection ? '> EXEC SELECTED' : '> EXEC CURRENT'}
            </Button>
            {executing && (
              <Button
                danger
                className="font-mono tracking-wider"
                onClick={async () => {
                  try {
                    await window.api.db.killQuery(tab.connectionId);
                  } catch (err) {
                    console.error('Failed to kill query', err);
                  }
                }}
              >
                [ ABORT ]
              </Button>
            )}
          </div>
          <Text className="text-xs !text-[#737373] font-mono">
            {hasLineSelection
              ? 'Matched selection. Click or Cmd/Ctrl+Enter to exec.'
              : 'No selection. Executing statement at cursor.'}
          </Text>
        </div>
        <div className="p-3 bg-[#0a0a0a] flex-1 min-h-0 flex flex-col">
          <SqlEditor
            value={tab.content || ''}
            onChange={(val) => updateTab(tab.id, { content: val })}
            onExecute={handleExecute}
            onExecutionTargetChange={setExecutionTarget}
            height="100%"
          />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 bg-[#0a0a0a] overflow-hidden">
        <Tabs
          defaultActiveKey="results"
          className="h-full chat2data-sql-tabs"
          tabBarStyle={{ paddingLeft: '16px', paddingRight: '16px', marginBottom: 0 }}
          items={[
            {
              key: 'results',
              label: 'RESULTS',
              className: 'h-full',
              children: (
                <div className="h-full p-3 overflow-hidden bg-[#050505]">
                  {error ? (
                    <div className="text-[#ff0000] font-mono text-sm p-4 bg-[#ff0000]/10 border border-[#ff0000]/30 rounded h-full overflow-auto">
                      <div className="mb-2">&gt; [ERROR] Query execution failed:</div>
                      {error}
                    </div>
                  ) : result ? (
                    <DataGrid result={result} />
                  ) : (
                    <div className="text-[#737373] flex items-center justify-center h-full font-mono text-xs">
                      &gt; [WAITING] Ready for input...
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'history',
              label: 'QUERY HISTORY',
              className: 'h-full',
              children: (
                <div className="h-full p-3 overflow-hidden bg-[#050505]">
                  <QueryHistory history={history} onReplay={handleReplay} />
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default SqlWorkspace;
