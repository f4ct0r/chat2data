import './monaco-bootstrap';
import React, { useEffect, useRef } from 'react';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import { SqlExecutionTarget } from './sql-execution';
import { ConnectionConfig } from '../../../shared/types';
import {
  clearSqlCompletionContext,
  registerSqlCompletionProvider,
  setSqlCompletionContext,
} from './sql-completion-provider';

interface SqlEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onExecute?: () => void;
  onExecutionTargetChange?: (target: SqlExecutionTarget) => void;
  connectionId?: string;
  dbType?: ConnectionConfig['dbType'];
  database?: string;
  schema?: string;
  language?: string;
  theme?: string;
  height?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onExecute,
  onExecutionTargetChange,
  connectionId,
  dbType,
  database,
  schema,
  language = 'sql',
  theme = 'hc-black',
  height = '100%',
}) => {
  const monaco = useMonaco();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    if (monaco) {
      registerSqlCompletionProvider(monaco);
    }
  }, [monaco]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model || !connectionId || !dbType) {
      return;
    }

    setSqlCompletionContext(model.uri.toString(), {
      connectionId,
      dbType,
      database,
      schema,
    });

    return () => {
      clearSqlCompletionContext(model.uri.toString());
    };
  }, [connectionId, dbType, database, schema]);

  const handleEditorChange = (value: string | undefined) => {
    onChange(value);
  };

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    if (connectionId && dbType) {
      setSqlCompletionContext(editor.getModel()!.uri.toString(), {
        connectionId,
        dbType,
        database,
        schema,
      });
    }

    const emitExecutionTarget = () => {
      const selection = editor.getSelection();

      if (!selection) {
        return;
      }

      const effectiveEndLineNumber =
        !selection.isEmpty() && selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber
          ? selection.endLineNumber - 1
          : selection.endLineNumber;

      onExecutionTargetChange?.({
        startLineNumber: selection.startLineNumber,
        endLineNumber: effectiveEndLineNumber,
        hasSelection: !selection.isEmpty(),
      });
    };

    emitExecutionTarget();
    editor.onDidChangeCursorSelection(emitExecutionTarget);

    if (onExecute) {
      editor.addAction({
        id: 'chat2data-execute-sql',
        label: 'Execute SQL',
        keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter],
        run: () => {
          onExecute();
        },
      });
    }
  };

  useEffect(() => {
    return () => {
      const model = editorRef.current?.getModel();
      if (model) {
        clearSqlCompletionContext(model.uri.toString());
      }
    };
  }, []);

  return (
    <div className="flex-1 w-full border border-[#333333] rounded-sm overflow-hidden bg-[#000000] relative min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <Editor
          height={height}
          defaultLanguage={language}
          theme={theme}
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'Courier New', Courier, monospace",
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false,
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            },
            renderLineHighlight: 'all',
            lineNumbersMinChars: 3,
          }}
        />
      </div>
    </div>
  );
};

export default SqlEditor;
