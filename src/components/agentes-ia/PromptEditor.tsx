import { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface PromptEditorRef {
  insertAtCursor: (text: string) => void;
  getPosition: () => { line: number; column: number } | null;
  setPosition: (line: number, column: number) => void;
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
}

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(
  ({ value, onChange, disabled = false, placeholder = '', minHeight = 280 }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      insertAtCursor: (text: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = value.slice(0, start) + text + value.slice(end);
        onChange(newValue);
        // Restore cursor after insertion
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(start + text.length, start + text.length);
        });
      },
      getPosition: () => {
        const ta = textareaRef.current;
        if (!ta) return null;
        const text = ta.value.slice(0, ta.selectionStart);
        const lines = text.split('\n');
        return { line: lines.length, column: lines[lines.length - 1].length + 1 };
      },
      setPosition: (line: number, column: number) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const lines = ta.value.split('\n');
        let pos = 0;
        for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
          pos += lines[i].length + 1;
        }
        pos += Math.min(column - 1, (lines[line - 1] || '').length);
        ta.focus();
        ta.setSelectionRange(pos, pos);
      },
    }));

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const ta = e.currentTarget;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const newValue = value.slice(0, start) + '  ' + value.slice(end);
          onChange(newValue);
          requestAnimationFrame(() => {
            ta.setSelectionRange(start + 2, start + 2);
          });
        }
      },
      [value, onChange]
    );

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        style={{ minHeight: `${minHeight}px` }}
        className="w-full resize-y p-3 text-xs font-mono leading-relaxed bg-background text-foreground placeholder:text-muted-foreground rounded-b-[4px] border-0 outline-none focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    );
  }
);

PromptEditor.displayName = 'PromptEditor';
