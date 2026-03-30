import React, { useEffect, useRef, useState } from 'react';
import SqlEditor from '../SqlEditor';
import DataGrid from '../DataGrid/DataGrid';
import QueryHistory from '../QueryHistory/QueryHistory';
import { Button, Tabs, Modal, Typography } from 'antd';
import { CaretRightOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { QueryResult, TableEditMetadata } from '../../../shared/types';
import { useTabStore } from '../../store/tabStore';
import { SqlClassifier, SqlRiskLevel } from '../../../core/security/sql-classifier';
import { emitGlobalError } from '../../utils/errorBus';
import { resolveExecutableSql, SqlExecutionTarget } from '../SqlEditor/sql-execution';
import { useI18n } from '../../i18n/I18nProvider';
import {
  createTableEditBuffer,
  markTableEditRowDeleted,
  resetTableEditBuffer,
  TableEditBuffer,
  updateTableEditCell,
} from '../../features/table-edit-buffer';
import { generateTableEditSql } from '../../features/table-edit-sql';
import {
  GridCellSelection,
  GridDeleteAction,
  GridSelectionState,
} from '../DataGrid/data-grid-editing-state';
import {
  EditablePreviewNotice,
  getEditablePreviewViewState,
  getPostApplyNotice,
  shouldLoadEditablePreviewMetadata,
} from './editable-preview-state';
import { getExecutionDisplayState } from './sql-workspace-state';

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

const EMPTY_GRID_SELECTION: GridSelectionState = {
  selectedRowIds: [],
  selectedCell: null,
  anchorRowId: null,
};

const getPendingChangeCount = (buffer: TableEditBuffer | null) => {
  if (!buffer) {
    return 0;
  }

  return buffer.rows.filter((row) => row.deleted || row.changedColumns.length > 0).length;
};

const formatEditingValue = (value: unknown) => {
  if (value === null) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const coerceEditedCellValue = (rawValue: string, currentValue: unknown) => {
  if (rawValue === formatEditingValue(currentValue)) {
    return currentValue;
  }

  if (typeof currentValue === 'number') {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : rawValue;
  }

  if (typeof currentValue === 'boolean') {
    if (rawValue === '1' || rawValue === '0') {
      return rawValue === '1';
    }

    if (/^(true|false)$/i.test(rawValue)) {
      return rawValue.toLowerCase() === 'true';
    }
  }

  return rawValue;
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
  const [editMetadata, setEditMetadata] = useState<TableEditMetadata | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<TableEditBuffer | null>(null);
  const [selection, setSelection] = useState<GridSelectionState>(EMPTY_GRID_SELECTION);
  const [editingCell, setEditingCell] = useState<GridCellSelection | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [postApplyNotice, setPostApplyNotice] = useState<EditablePreviewNotice | null>(null);
  const [refreshLockReason, setRefreshLockReason] = useState<string | null>(null);
  const [lastExecutionKind, setLastExecutionKind] = useState<'preview' | 'custom' | null>(null);
  const handledPreviewRequestRef = useRef<string | null>(null);
  const tabType = tab?.type;
  const tabConnectionId = tab?.connectionId;
  const tabDatabase = tab?.database;
  const tabSchema = tab?.schema;
  const previewTable = tab?.previewTable;
  const completionCacheStatus = tab?.completionCacheStatus;
  const tabRecordId = tab?.id;
  const pendingPreviewSql = tab?.pendingPreviewSql;
  const pendingPreviewRequestId = tab?.pendingPreviewRequestId;
  const previewTableKey = previewTable
    ? [
        previewTable.dbType,
        previewTable.database ?? '',
        previewTable.schema ?? '',
        previewTable.table,
        previewTable.previewSql,
      ].join('|')
    : '';

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
  const displayState = getExecutionDisplayState(result, error);
  const pendingChangeCount = getPendingChangeCount(editBuffer);
  const editablePreviewViewState = getEditablePreviewViewState({
    previewTable,
    isPreviewResult: lastExecutionKind === 'preview',
    editMetadata,
    pendingChangeCount,
    isApplying,
    inactiveReason: t('editablePreview.runPreviewToEdit'),
    metadataErrorReason: metadataError,
    refreshLockReason,
  });

  useEffect(() => {
    setEditMetadata(null);
    setMetadataError(null);
    setEditBuffer(null);
    setSelection(EMPTY_GRID_SELECTION);
    setEditingCell(null);
    setEditingValue('');
    setApplyError(null);
    setPostApplyNotice(null);
    setRefreshLockReason(null);
    setLastExecutionKind(null);
  }, [previewTableKey]);

  useEffect(() => {
    if (
      !shouldLoadEditablePreviewMetadata({
        connectionId: tabConnectionId,
        previewTable,
      })
    ) {
      return;
    }

    let cancelled = false;

    void window.api.db
      .getTableEditMetadata(tabConnectionId, previewTable)
      .then((metadata) => {
        if (cancelled) {
          return;
        }

        setEditMetadata(metadata);
        setMetadataError(null);
      })
      .catch((err) => {
        console.error('Failed to load editable preview metadata', err);
        if (cancelled) {
          return;
        }

        setEditMetadata({
          editable: false,
          reason: t('editablePreview.metadataUnavailable'),
          key: null,
        });
        setMetadataError(t('editablePreview.metadataUnavailable'));
      });

    return () => {
      cancelled = true;
    };
  }, [previewTableKey, previewTable, t, tabConnectionId]);

  useEffect(() => {
    if (
      !previewTable ||
      lastExecutionKind !== 'preview' ||
      !result ||
      !editMetadata?.editable ||
      !editMetadata.key
    ) {
      setEditBuffer(null);
      setSelection(EMPTY_GRID_SELECTION);
      setEditingCell(null);
      setEditingValue('');
      return;
    }

    setEditBuffer(createTableEditBuffer(result.rows, editMetadata.key.columns));
    setSelection(EMPTY_GRID_SELECTION);
    setEditingCell(null);
    setEditingValue('');
    setApplyError(null);
  }, [editMetadata, lastExecutionKind, previewTable, result]);

  const isPreviewExecution = (sql: string) =>
    Boolean(previewTable && sql.trim() === previewTable.previewSql.trim());

  async function performExecution(
    sql: string,
    options: { suppressDisplayError?: boolean } = {}
  ) {
    if (!sql.trim() || !tabConnectionId) {
      return null;
    }

    setExecuting(true);
    if (!options.suppressDisplayError) {
      setError(null);
    }

    const startTime = Date.now();
    try {
      const res = await window.api.db.executeQuery(tabConnectionId, sql);
      if (res.error) {
        throw new Error(res.error);
      }

      const nextExecutionKind = isPreviewExecution(sql) ? 'preview' : 'custom';
      setLastExecutionKind(nextExecutionKind);
      setError(null);
      setResult(res);

      if (nextExecutionKind === 'preview') {
        setRefreshLockReason(null);
        setPostApplyNotice(null);
      }

      setHistory((prev) => [
        {
          id: Date.now().toString(),
          sql,
          durationMs: res.durationMs,
          timestamp: Date.now(),
          status: 'success',
        },
        ...prev,
      ]);

      return res;
    } catch (err) {
      const errorMessage = getErrorMessage(err);

      if (!options.suppressDisplayError) {
        setError(errorMessage);
        setResult(null);
        emitGlobalError({
          title: t('errors.sqlExecution'),
          message: errorMessage,
          type: 'sql_syntax',
        });
      }

      setHistory((prev) => [
        {
          id: Date.now().toString(),
          sql,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
          status: 'error',
          error: errorMessage,
        },
        ...prev,
      ]);

      throw err;
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

    void performExecution(pendingPreviewSql)
      .catch(() => undefined)
      .finally(() => {
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

    setApplyError(null);
    setPostApplyNotice(null);

    const classification = SqlClassifier.classify(executableSql);
    
    if (classification.level === SqlRiskLevel.DANGEROUS) {
      Modal.confirm({
        title: t('sql.dangerousTitle'),
        icon: <ExclamationCircleOutlined className="text-red-500" />,
        content: t('sql.dangerousContent', { operation: classification.operation }),
        okText: t('sql.confirmExecute'),
        okType: 'danger',
        cancelText: t('common.cancel'),
        onOk: () => performExecution(executableSql).catch(() => undefined),
      });
    } else {
      void performExecution(executableSql).catch(() => undefined);
    }
  };

  const handleReplay = (sql: string) => {
    updateTab(tab.id, { content: sql });
    // setTimeout to allow state update before execute, or just rely on the user to click execute
  };

  const handleSelectionChange = (nextSelection: GridSelectionState) => {
    setSelection(nextSelection);
  };

  const handleEditStart = (cell: GridCellSelection) => {
    if (!editBuffer) {
      return;
    }

    const row = editBuffer.rows.find((candidate) => candidate.rowId === cell.rowId);
    if (!row) {
      return;
    }

    setEditingCell(cell);
    setEditingValue(formatEditingValue(row.pendingRow[cell.column]));
    setApplyError(null);
    setPostApplyNotice(null);
  };

  const handleEditCommit = () => {
    if (!editBuffer || !editingCell) {
      return;
    }

    const row = editBuffer.rows.find((candidate) => candidate.rowId === editingCell.rowId);
    if (!row) {
      setEditingCell(null);
      setEditingValue('');
      return;
    }

    const nextValue = coerceEditedCellValue(
      editingValue,
      row.pendingRow[editingCell.column]
    );

    setEditBuffer(
      updateTableEditCell(editBuffer, editingCell.rowId, editingCell.column, nextValue)
    );
    setSelection({
      selectedRowIds: [],
      selectedCell: editingCell,
      anchorRowId: editingCell.rowId,
    });
    setEditingCell(null);
    setEditingValue('');
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const handleDeleteAction = (action: GridDeleteAction) => {
    if (!editBuffer) {
      return;
    }

    setApplyError(null);
    setPostApplyNotice(null);

    if (action.type === 'setCellNull') {
      setEditBuffer(
        updateTableEditCell(editBuffer, action.cell.rowId, action.cell.column, null)
      );
      setEditingCell(null);
      setEditingValue('');
      return;
    }

    if (action.type === 'deleteRows') {
      const nextBuffer = action.rowIds.reduce(
        (currentBuffer, rowId) => markTableEditRowDeleted(currentBuffer, rowId),
        editBuffer
      );

      setEditBuffer(nextBuffer);
      setSelection(EMPTY_GRID_SELECTION);
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const handleDiscardChanges = () => {
    if (!editBuffer) {
      return;
    }

    setEditBuffer(resetTableEditBuffer(editBuffer));
    setSelection(EMPTY_GRID_SELECTION);
    setEditingCell(null);
    setEditingValue('');
    setApplyError(null);
    setPostApplyNotice(null);
  };

  const handleApplyChanges = () => {
    if (!editBuffer || !previewTable || !tabConnectionId) {
      return;
    }

    const generatedSql = generateTableEditSql(editBuffer, previewTable);

    if (!generatedSql.ok) {
      setApplyError(generatedSql.unsupportedValue.reason);
      return;
    }

    if (generatedSql.batchStatements.length === 0) {
      return;
    }

    const updateCount = generatedSql.statements.filter(
      (statement) => statement.kind === 'update'
    ).length;
    const deleteCount = generatedSql.statements.filter(
      (statement) => statement.kind === 'delete'
    ).length;

    Modal.confirm({
      title: t('editablePreview.confirmTitle'),
      okText: t('editablePreview.confirmExecute'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setIsApplying(true);
        setApplyError(null);
        setPostApplyNotice(null);

        try {
          const batchResult = await window.api.db.executeBatch(
            tabConnectionId,
            generatedSql.batchStatements
          );

          if (!batchResult.ok) {
            const errorMessage =
              batchResult.failedStatementIndex !== undefined && batchResult.error
                ? t('editablePreview.failedStatement', {
                    index: batchResult.failedStatementIndex + 1,
                    message: batchResult.error,
                  })
                : batchResult.error ?? t('errors.sqlExecution');

            setApplyError(errorMessage);
            return;
          }

          try {
            await performExecution(previewTable.previewSql, {
              suppressDisplayError: true,
            });
          } catch (refreshErr) {
            setEditBuffer(null);
            setSelection(EMPTY_GRID_SELECTION);
            setEditingCell(null);
            setEditingValue('');
            setRefreshLockReason(t('editablePreview.refreshLockReason'));
            setPostApplyNotice(
              getPostApplyNotice({
                batchResult,
                refreshError:
                  refreshErr instanceof Error
                    ? refreshErr
                    : new Error(getErrorMessage(refreshErr)),
                refreshFailureMessage: t('editablePreview.refreshFailedApplied'),
              })
            );
          }
        } finally {
          setIsApplying(false);
        }
      },
      content: (
        <div className="font-mono text-xs text-[#d4d4d4]">
          <div>{t('editablePreview.confirmUpdates', { count: updateCount })}</div>
          <div>{t('editablePreview.confirmDeletes', { count: deleteCount })}</div>
          <div className="mt-3 text-[#737373]">
            {t('editablePreview.confirmSqlPreview')}
          </div>
          <pre className="mt-2 max-h-48 overflow-auto rounded border border-[#333333] bg-[#050505] p-3 whitespace-pre-wrap text-[#d4d4d4]">
            {generatedSql.previewSql}
          </pre>
        </div>
      ),
    });
  };

  const effectiveEditBuffer =
    editablePreviewViewState.mode === 'editable' && displayState.kind === 'data'
      ? editBuffer ??
        createTableEditBuffer(displayState.result.rows, editMetadata?.key?.columns ?? [])
      : null;

  const editablePreviewProps =
    editablePreviewViewState.mode === 'editable' && effectiveEditBuffer
      ? {
          buffer: effectiveEditBuffer,
          selection,
          editingCell,
          editingValue,
        }
      : undefined;

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
                  {displayState.kind === 'error' ? (
                    <div className="text-[#ff0000] font-mono text-sm p-4 bg-[#ff0000]/10 border border-[#ff0000]/30 rounded h-full overflow-auto">
                      <div className="mb-2">{t('sql.errorHeader')}</div>
                      {displayState.message}
                    </div>
                  ) : displayState.kind === 'data' ? (
                    editablePreviewViewState.mode === 'hidden' ? (
                      <DataGrid result={displayState.result} />
                    ) : (
                      <div className="editable-preview-shell flex flex-1 min-h-0 flex-col gap-2">
                        {editablePreviewViewState.showToolbar ? (
                          <div className="editable-preview-toolbar flex items-center justify-between gap-3 rounded border border-[#333333] bg-[#101010] px-3 py-2 font-mono text-xs text-[#d4d4d4]">
                            <span>
                              {t('editablePreview.pendingChanges', {
                                count: editablePreviewViewState.pendingChangeCount,
                              })}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button size="small" onClick={handleDiscardChanges}>
                                {t('editablePreview.discard')}
                              </Button>
                              <Button
                                size="small"
                                type="primary"
                                loading={isApplying}
                                onClick={handleApplyChanges}
                              >
                                {t('editablePreview.apply')}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {editablePreviewViewState.mode === 'read-only' &&
                        editablePreviewViewState.readOnlyReason ? (
                          <div className="editable-preview-readonly-reason rounded border border-[#333333] bg-[#101010] px-3 py-2 font-mono text-xs text-[#737373]">
                            {editablePreviewViewState.readOnlyReason}
                          </div>
                        ) : null}
                        {applyError ? (
                          <div className="rounded border border-[#ff0000]/30 bg-[#ff0000]/10 px-3 py-2 font-mono text-xs text-[#ff7875]">
                            {applyError}
                          </div>
                        ) : null}
                        {postApplyNotice ? (
                          <div className="rounded border border-[#faad14]/30 bg-[#faad14]/10 px-3 py-2 font-mono text-xs text-[#ffd666]">
                            {postApplyNotice.message}
                          </div>
                        ) : null}
                        <DataGrid
                          result={displayState.result}
                          editablePreview={editablePreviewProps}
                          onSelectionChange={handleSelectionChange}
                          onEditStart={handleEditStart}
                          onEditChange={setEditingValue}
                          onEditCommit={handleEditCommit}
                          onEditCancel={handleEditCancel}
                          onDeleteAction={handleDeleteAction}
                        />
                      </div>
                    )
                  ) : displayState.kind === 'success-empty' ? (
                    <div className="text-[#52c41a] font-mono text-sm p-4 bg-[#52c41a]/10 border border-[#52c41a]/30 rounded h-full overflow-auto">
                      <div className="mb-2">{t('sql.successHeader')}</div>
                      {t('sql.successNoResult')}
                    </div>
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
