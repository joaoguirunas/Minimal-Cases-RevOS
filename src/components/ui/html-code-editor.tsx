/**
 * HtmlCodeEditor — editor de código HTML com destaque de sintaxe (CodeMirror),
 * usado no modo "Código HTML" do editor de templates de e-mail (Task 15).
 * Carregado via `React.lazy` no modal (bundle do CodeMirror fica em chunk à parte).
 */
import { useCallback, useEffect, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { cn } from '@/lib/utils';

interface HtmlCodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  minHeight?: string;
  /** Recebe uma função de inserção no cursor atual — usada pelo VariablePicker/"Inserir imagem". */
  onInsertRef?: (fn: (text: string) => void) => void;
  className?: string;
}

const HtmlCodeEditor = ({
  value, onChange, minHeight = '240px', onInsertRef, className,
}: HtmlCodeEditorProps) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const isDark = typeof document !== 'undefined'
    && document.documentElement.classList.contains('dark');

  const insertAtCursor = useCallback((text: string) => {
    const view = editorRef.current?.view;
    if (!view) { onChange(value + text); return; }
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, [onChange, value]);

  useEffect(() => {
    onInsertRef?.(insertAtCursor);
  }, [onInsertRef, insertAtCursor]);

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      minHeight={minHeight}
      extensions={[html()]}
      theme={isDark ? 'dark' : 'light'}
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
      onChange={onChange}
      className={cn('rounded-xl border border-border overflow-hidden text-[12px] font-mono', className)}
    />
  );
};

export default HtmlCodeEditor;
