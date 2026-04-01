import React, { useEffect, useState } from 'react';
import type {
  SqlScriptExecutionValues,
  SqlScriptParameterInput,
} from '../../../shared/sql-scripts';
import { useI18n } from '../../i18n/i18n-context';

interface SqlScriptParameterModalProps {
  open: boolean;
  parameters: SqlScriptParameterInput[];
  onCancel: () => void;
  onSubmit: (values: SqlScriptExecutionValues) => void;
}

const buildInitialValues = (parameters: SqlScriptParameterInput[]) =>
  parameters.reduce<Record<string, string>>((accumulator, parameter) => {
    accumulator[parameter.name] = parameter.defaultValue ?? '';
    return accumulator;
  }, {});

const SqlScriptParameterModal: React.FC<SqlScriptParameterModalProps> = ({
  open,
  parameters,
  onCancel,
  onSubmit,
}) => {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(buildInitialValues(parameters));
  }, [open, parameters]);

  if (!open) {
    return null;
  }

  return (
    <div className="rounded border border-[#333333] bg-[#101010] p-4" data-testid="script-parameter-modal">
      <div className="mb-3 text-sm font-mono text-[#FFB347]">{t('scripts.parameterDialogTitle')}</div>
      <div className="space-y-3">
        {parameters.map((parameter) => (
          <label key={parameter.name} className="flex flex-col gap-1 text-xs font-mono text-[#d4d4d4]">
            <span>{parameter.label || parameter.name}</span>
            <input
              data-testid={`parameter-input-${parameter.name}`}
              className="rounded border border-[#333333] bg-[#050505] px-3 py-2 text-[#f5f5f5]"
              type={parameter.type === 'number' ? 'number' : 'text'}
              value={values[parameter.name] ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value;
                setValues((current) => ({
                  ...current,
                  [parameter.name]: nextValue,
                }));
              }}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded border border-[#333333] px-3 py-2 text-xs font-mono text-[#a3a3a3]"
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="rounded border border-[#FFB347] bg-[#FFB347]/10 px-3 py-2 text-xs font-mono text-[#FFB347]"
          onClick={() => {
            const nextValues = parameters.reduce<SqlScriptExecutionValues>((accumulator, parameter) => {
              const rawValue = values[parameter.name] ?? '';

              if (parameter.type === 'number' && rawValue !== '') {
                accumulator[parameter.name] = Number(rawValue);
              } else {
                accumulator[parameter.name] = rawValue;
              }

              return accumulator;
            }, {});

            onSubmit(nextValues);
          }}
        >
          {t('scripts.parameterConfirm')}
        </button>
      </div>
    </div>
  );
};

export default SqlScriptParameterModal;
