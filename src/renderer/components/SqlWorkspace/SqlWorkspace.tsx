import React, { useEffect, useRef, useState } from 'react';
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
import { useI18n } from '../../i18n/I18nProvider';

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
  const { t } = useI18n();
  const { tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === tabId);

  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [executionTarget, setExecutionTarget] = useState<SqlExecutionTarget | null>(null);
  const handledPreviewRequestRef = useRef<string | null>(null);
  const tabType = tab?.type;
  const tabConnectionId = tab?.connectionId;
  const tabDatabase = tab?.database;
  const tabSchema = tab?.schema;
  const completionCacheStatus = tab?.completionCacheStatus;
  const tabRecordId = tab?.id;
  const pendingPreviewSql = tab?.pendingPreviewSql;
  const pendingPreviewRequestId = tab?.pendingPreviewRequestId;

  useEffect(() => {
    if (!tabRecordId || !tabConnectionId || tabType !== 'sql' || !tabDatabase) {
      return;
    }

    let cancelled = false;

    const loadSchemaIndex = async () => {
      if (completionCacheStatus === 'loading') {
        return;
      }

      updateTab(tabRecordId, { completionCacheStatus: 'loading' });

      try {
        await window.api.db.buildSchemaIndex(tabConnectionId, tabDatabase, tabSchema);
        if (!cancelled) {
          updateTab(tabRecordId, { completionCacheStatus: 'ready' });
        }
      } catch (err) {
        console.error('Failed to build completion schema index', err);
        if (!cancelled) {
          updateTab(tabRecordId, { completionCacheStatus: 'error' });
        }
      }
    };

    void loadSchemaIndex();

    return () => {
      cancelled = true;
    };
  }, [completionCacheStatus, tabConnectionId, tabDatabase, tabRecordId, tabSchema, tabType, updateTab]);

  if (!tab) return null;

  const executableSql = resolveExecutableSql(tab.content || '', executionTarget);
  const hasLineSelection = Boolean(executionTarget?.hasSelection);

  async function performExecution(sql: string) {
    if (!sql.trim() || !tabConnectionId) return;
    
    setExecuting(true);
    setError(null);
    const startTime = Date.now();
    try {
      const res = await window.api.db.executeQuery(tabConnectionId, sql);
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
        title: t('errors.sqlExecution'),
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
  }

  useEffect(() => {
    if (
      !tabRecordId ||
      tabType !== 'sql' ||
      !pendingPreviewSql ||
      !pendingPreviewRequestId
    ) {
      return;
    }

    if (handledPreviewRequestRef.current === pendingPreviewRequestId) {
      return;
    }

    handledPreviewRequestRef.current = pendingPreviewRequestId;

    void performExecution(pendingPreviewSql).finally(() => {
      updateTab(tabRecordId, {
        pendingPreviewSql: undefined,
        pendingPreviewRequestId: undefined,
      });
    });
  }, [
    pendingPreviewRequestId,
    pendingPreviewSql,
    tabRecordId,
    tabType,
    updateTab,
  ]);

  const handleExecute = async () => {
    if (!executableSql) return;

    const classification = SqlClassifier.classify(executableSql);
    
    if (classification.level === SqlRiskLevel.DANGEROUS) {
      Modal.confirm({
        title: t('sql.dangerousTitle'),
        icon: <ExclamationCircleOutlined className="text-red-500" />,
        content: t('sql.dangerousContent', { operation: classification.operation }),
        okText: t('sql.confirmExecute'),
        okType: 'danger',
        cancelText: t('common.cancel'),
        onOk: () => performExecution(executableSql),
      });
    } else {
      performExecution(executableSql);
    }
  };

  const handleReplay = (sql: string) => {
    updateTab(tab.id, { content: sql });
    // setTimeout to allow state update before execute, or just rely on the user to click execute
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-[#0a0a0a]">
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
              {hasLineSelection ? t('sql.executeSelected') : t('sql.executeCurrent')}
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
                {t('sql.abort')}
              </Button>
            )}
          </div>
          <Text className="text-xs !text-[#737373] font-mono">
            {hasLineSelection
              ? t('sql.selectionHint')
              : t('sql.currentHint')}
          </Text>
        </div>
        <div className="p-3 bg-[#0a0a0a] flex-1 min-h-0 flex flex-col">
          <SqlEditor
            value={tab.content || ''}
            onChange={(val) => updateTab(tab.id, { content: val })}
            onExecute={handleExecute}
            onExecutionTargetChange={setExecutionTarget}
            connectionId={tab.connectionId}
            dbType={tab.dbType}
            database={tab.database}
            schema={tab.schema}
            height="100%"
          />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 bg-[#0a0a0a] overflow-hidden">
        <Tabs
          defaultActiveKey="results"
          className="h-full min-h-0 chat2data-sql-tabs"
          tabBarStyle={{ paddingLeft: '16px', paddingRight: '16px', marginBottom: 0 }}
          items={[
            {
              key: 'results',
              label: <span className="chat2data-sql-tab-label">{t('sql.results')}</span>,
              className: 'h-full min-h-0 flex flex-col',
              children: (
                <div className="flex-1 min-h-0 p-3 overflow-hidden bg-[#050505] flex flex-col">
                  {error ? (
                    <div className="text-[#ff0000] font-mono text-sm p-4 bg-[#ff0000]/10 border border-[#ff0000]/30 rounded h-full overflow-auto">
                      <div className="mb-2">{t('sql.errorHeader')}</div>
                      {error}
                    </div>
                  ) : result ? (
                    <DataGrid result={result} />
                  ) : (
                    <div className="text-[#737373] flex items-center justify-center h-full font-mono text-xs">
                      {t('sql.waiting')}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'history',
              label: <span className="chat2data-sql-tab-label">{t('sql.history')}</span>,
              className: 'h-full min-h-0 flex flex-col',
              children: (
                <div className="flex-1 min-h-0 p-3 overflow-hidden bg-[#050505] flex flex-col">
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
