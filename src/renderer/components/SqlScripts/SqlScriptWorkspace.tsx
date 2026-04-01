import React, { useEffect, useMemo, useState } from 'react';
import type {
  SqlScript,
  SqlScriptExecutionValues,
  SqlScriptInput,
  SqlScriptParameterInput,
} from '../../../shared/sql-scripts';
import { useTabStore } from '../../store/tabStore';
import SqlEditor from '../SqlEditor';
import { useI18n } from '../../i18n/i18n-context';
import {
  renderSqlScriptPlaceholders,
  validateSqlScriptDefinition,
} from '../../features/sql-scripts/sql-script-placeholders';
import { buildSqlTabFromScript } from '../../features/sql-scripts/script-tab-routing';
import SqlScriptParameterModal from './SqlScriptParameterModal';

interface SqlScriptWorkspaceProps {
  tabId: string;
}

interface SqlScriptDraft {
  name: string;
  description: string;
  tagsText: string;
  sql: string;
  parameters: SqlScriptParameterInput[];
}

type ReplayMode = 'load' | 'execute' | null;

export const createEmptyScriptDraft = (): SqlScriptDraft => ({
  name: '',
  description: '',
  tagsText: '',
  sql: '',
  parameters: [],
});

export const toScriptDraft = (script: SqlScript): SqlScriptDraft => ({
  name: script.name,
  description: script.description ?? '',
  tagsText: script.tags.join(', '),
  sql: script.sql,
  parameters: script.parameters.map((parameter) => ({
    id: parameter.id,
    name: parameter.name,
    label: parameter.label,
    type: parameter.type,
    required: parameter.required,
    defaultValue: parameter.defaultValue,
    position: parameter.position,
  })),
});

export const buildSqlScriptSaveInput = (
  tabConnectionId: string,
  databaseName: string,
  scriptId: string | undefined,
  draft: SqlScriptDraft
): SqlScriptInput => ({
  id: scriptId,
  connectionId: tabConnectionId,
  databaseName,
  name: draft.name,
  description: draft.description,
  sql: draft.sql,
  tags: draft.tagsText
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean),
  parameters: draft.parameters.map((parameter, index) => ({
    ...parameter,
    name: parameter.name.trim(),
    label: parameter.label.trim(),
    defaultValue: parameter.defaultValue?.trim() || undefined,
    position: index,
  })),
});

export const formatSqlScriptValidationError = (
  validation: ReturnType<typeof validateSqlScriptDefinition>
) => {
  if (validation.ok) {
    return null;
  }

  const parts: string[] = [];
  if (validation.missingPlaceholders.length > 0) {
    parts.push(`Missing parameter definitions: ${validation.missingPlaceholders.join(', ')}`);
  }
  if (validation.extraParameters.length > 0) {
    parts.push(`Unused parameters: ${validation.extraParameters.join(', ')}`);
  }

  return parts.join(' | ');
};

const getReplayTitle = (scriptName: string) => scriptName.trim() || 'SQL Script';

const SqlScriptWorkspace: React.FC<SqlScriptWorkspaceProps> = ({ tabId }) => {
  const { t } = useI18n();
  const { tabs, updateTab, addTab } = useTabStore();
  const tab = tabs.find((entry) => entry.id === tabId);

  const [draft, setDraft] = useState<SqlScriptDraft>(createEmptyScriptDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayMode, setReplayMode] = useState<ReplayMode>(null);

  const databaseName = tab?.scriptDatabaseName ?? tab?.database ?? '';
  const selectedConnection = useMemo(() => {
    if (!tab?.connectionId || !tab.dbType) {
      return null;
    }

    return {
      id: tab.connectionId,
      dbType: tab.dbType,
      database: databaseName || tab.database,
    };
  }, [databaseName, tab]);

  useEffect(() => {
    if (!tab?.scriptId) {
      setDraft(createEmptyScriptDraft());
      return;
    }

    let cancelled = false;

    setLoading(true);
    window.api.storage
      .getSqlScript(tab.scriptId)
      .then((script) => {
        if (cancelled || !script) {
          return;
        }

        setDraft(toScriptDraft(script));
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tab?.scriptId]);

  if (!tab) {
    return null;
  }

  const saveInput = buildSqlScriptSaveInput(tab.connectionId, databaseName, tab.scriptId, draft);
  const placeholderValidation = validateSqlScriptDefinition(saveInput.sql, saveInput.parameters ?? []);

  const handleSave = async () => {
    const validationError = formatSqlScriptValidationError(placeholderValidation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    const saved = await window.api.storage.saveSqlScript(saveInput);
    setDraft(toScriptDraft(saved));
    updateTab(tabId, {
      title: saved.name,
      scriptId: saved.id,
      scriptDatabaseName: saved.databaseName,
      database: saved.databaseName,
    });
  };

  const replayRenderedSql = (mode: Exclude<ReplayMode, null>, values: SqlScriptExecutionValues = {}) => {
    if (!selectedConnection) {
      return;
    }

    const rendered = renderSqlScriptPlaceholders(saveInput.sql, saveInput.parameters ?? [], values);
    if (!rendered.ok) {
      setError(`Parameter error (${rendered.parameter}): ${rendered.reason}`);
      return;
    }

    addTab(
      buildSqlTabFromScript({
        selectedConnection,
        databaseName,
        title: getReplayTitle(saveInput.name),
        sql: rendered.sql,
        executeNow: mode === 'execute',
      })
    );
    setReplayMode(null);
  };

  const handleReplay = (mode: Exclude<ReplayMode, null>) => {
    if ((saveInput.parameters ?? []).length === 0) {
      replayRenderedSql(mode);
      return;
    }

    setReplayMode(mode);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto bg-[#0a0a0a] p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-mono text-[#d4d4d4]">
          <span>{t('scripts.name')}</span>
          <input
            data-testid="script-name-input"
            className="rounded border border-[#333333] bg-[#050505] px-3 py-2 text-[#f5f5f5]"
            value={draft.name}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft((current) => ({
                ...current,
                name: nextValue,
              }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-mono text-[#d4d4d4]">
          <span>{t('scripts.tags')}</span>
          <input
            data-testid="script-tags-input"
            className="rounded border border-[#333333] bg-[#050505] px-3 py-2 text-[#f5f5f5]"
            value={draft.tagsText}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft((current) => ({
                ...current,
                tagsText: nextValue,
              }));
            }}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-mono text-[#d4d4d4]">
        <span>{t('scripts.description')}</span>
        <textarea
          data-testid="script-description-input"
          className="min-h-20 rounded border border-[#333333] bg-[#050505] px-3 py-2 text-[#f5f5f5]"
          value={draft.description}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraft((current) => ({
              ...current,
              description: nextValue,
            }));
          }}
        />
      </label>

      <div className="rounded border border-[#333333] bg-[#101010] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-mono text-[#FFB347]">{t('scripts.parameters')}</div>
          <button
            type="button"
            data-testid="add-parameter-button"
            className="rounded border border-[#333333] px-3 py-2 text-xs font-mono text-[#a3a3a3]"
            onClick={() => {
              setDraft((current) => ({
                ...current,
                parameters: [
                  ...current.parameters,
                  {
                    name: `param${current.parameters.length + 1}`,
                    label: `Param ${current.parameters.length + 1}`,
                    type: 'text',
                    required: true,
                    position: current.parameters.length,
                  },
                ],
              }));
            }}
          >
            {t('scripts.addParameter')}
          </button>
        </div>
        <div className="space-y-3">
          {draft.parameters.map((parameter, index) => (
            <div key={`${parameter.id ?? 'new'}-${index}`} className="grid gap-2 rounded border border-[#222] bg-[#050505] p-3 lg:grid-cols-5">
              <input
                data-testid={`parameter-name-${index}`}
                className="rounded border border-[#333333] bg-[#050505] px-2 py-2 text-xs text-[#f5f5f5]"
                value={parameter.name}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    parameters: current.parameters.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, name: nextValue } : entry
                    ),
                  }));
                }}
              />
              <input
                data-testid={`parameter-label-${index}`}
                className="rounded border border-[#333333] bg-[#050505] px-2 py-2 text-xs text-[#f5f5f5]"
                value={parameter.label}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    parameters: current.parameters.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, label: nextValue } : entry
                    ),
                  }));
                }}
              />
              <select
                data-testid={`parameter-type-${index}`}
                className="rounded border border-[#333333] bg-[#050505] px-2 py-2 text-xs text-[#f5f5f5]"
                value={parameter.type}
                onChange={(event) => {
                  const nextValue = event.target.value as SqlScriptParameterInput['type'];
                  setDraft((current) => ({
                    ...current,
                    parameters: current.parameters.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, type: nextValue } : entry
                    ),
                  }));
                }}
              >
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="date">date</option>
                <option value="datetime">datetime</option>
                <option value="rawSql">rawSql</option>
              </select>
              <input
                data-testid={`parameter-default-${index}`}
                className="rounded border border-[#333333] bg-[#050505] px-2 py-2 text-xs text-[#f5f5f5]"
                value={parameter.defaultValue ?? ''}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    parameters: current.parameters.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, defaultValue: nextValue } : entry
                    ),
                  }));
                }}
              />
              <label className="flex items-center gap-2 text-xs font-mono text-[#d4d4d4]">
                <input
                  data-testid={`parameter-required-${index}`}
                  type="checkbox"
                  checked={parameter.required}
                  onChange={(event) => {
                    const nextValue = event.target.checked;
                    setDraft((current) => ({
                      ...current,
                      parameters: current.parameters.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, required: nextValue } : entry
                      ),
                    }));
                  }}
                />
                required
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded border border-[#333333] bg-[#101010] p-4">
        <div className="mb-3 text-sm font-mono text-[#FFB347]">{t('scripts.sql')}</div>
        <div data-testid="sql-script-editor">
          <SqlEditor
            value={draft.sql}
            onChange={(value) => {
              setDraft((current) => ({
                ...current,
                sql: value ?? '',
              }));
            }}
            onExecute={() => undefined}
            onExecutionTargetChange={() => undefined}
            connectionId={tab.connectionId}
            dbType={tab.dbType}
            database={databaseName}
            schema={tab.schema}
            height="280px"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-xs font-mono text-[#737373]">{t('scripts.loading')}</div>
      ) : null}
      {error ? (
        <div data-testid="script-error" className="rounded border border-[#ff0000]/30 bg-[#ff0000]/10 px-3 py-2 text-xs font-mono text-[#ff7875]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="save-script-button"
          className="rounded border border-[#FFB347] bg-[#FFB347]/10 px-3 py-2 text-xs font-mono text-[#FFB347]"
          onClick={() => {
            void handleSave();
          }}
        >
          {t('common.save')}
        </button>
        <button
          type="button"
          data-testid="load-script-button"
          className="rounded border border-[#333333] px-3 py-2 text-xs font-mono text-[#a3a3a3]"
          onClick={() => handleReplay('load')}
        >
          {t('scripts.loadIntoNewEditor')}
        </button>
        <button
          type="button"
          data-testid="execute-script-button"
          className="rounded border border-[#333333] px-3 py-2 text-xs font-mono text-[#a3a3a3]"
          onClick={() => handleReplay('execute')}
        >
          {t('scripts.executeNow')}
        </button>
      </div>

      <SqlScriptParameterModal
        open={replayMode !== null}
        parameters={saveInput.parameters ?? []}
        onCancel={() => setReplayMode(null)}
        onSubmit={(values) => {
          replayRenderedSql(replayMode === 'execute' ? 'execute' : 'load', values);
        }}
      />
    </div>
  );
};

export default SqlScriptWorkspace;
