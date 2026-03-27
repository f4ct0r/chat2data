import './monaco-bootstrap';
import React, { useEffect } from 'react';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import { SqlExecutionTarget } from './sql-execution';

interface SqlEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onExecute?: () => void;
  onExecutionTargetChange?: (target: SqlExecutionTarget) => void;
  language?: string;
  theme?: string;
  height?: string;
}

let sqlCompletionProviderRegistered = false;

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onExecute,
  onExecutionTargetChange,
  language = 'sql',
  theme = 'hc-black',
  height = '100%',
}) => {
  const monaco = useMonaco();

  useEffect(() => {
    if (monaco && !sqlCompletionProviderRegistered) {
      sqlCompletionProviderRegistered = true;
      // You can configure Monaco editor settings here, 
      // like registering custom completion providers or themes
      monaco.languages.registerCompletionItemProvider('sql', {
        provideCompletionItems: () => {
          const suggestions = [
            {
              label: 'SELECT',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'SELECT ',
            },
            {
              label: 'FROM',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'FROM ',
            },
            {
              label: 'WHERE',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'WHERE ',
            },
            {
              label: 'JOIN',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'JOIN ',
            },
            {
              label: 'GROUP BY',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'GROUP BY ',
            },
            {
              label: 'ORDER BY',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'ORDER BY ',
            },
            {
              label: 'LIMIT',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'LIMIT ',
            },
          ];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return { suggestions: suggestions as any };
        },
      });
    }
  }, [monaco]);

  const handleEditorChange = (value: string | undefined) => {
    onChange(value);
  };

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
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
