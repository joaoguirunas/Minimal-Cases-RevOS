/**
 * FollowupEmailEditor
 *
 * Tiptap rich-text editor compacto para corpo de e-mail de follow-ups.
 * Inclui toolbar com formatação básica + inserção de variáveis.
 */
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import PlaceholderExt from '@tiptap/extension-placeholder';
import LinkExt from '@tiptap/extension-link';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlignExt from '@tiptap/extension-text-align';
import { useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Unlink, Undo, Redo,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { VariablePicker } from './VariablePicker';
import { cn } from '@/lib/utils';

interface FollowupEmailEditorProps {
  content:   string;
  onChange:  (html: string) => void;
  className?: string;
}

export const FollowupEmailEditor = ({ content, onChange, className }: FollowupEmailEditorProps) => {
  const [linkUrl,         setLinkUrl]        = useState('');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, code: false }),
      PlaceholderExt.configure({
        placeholder: 'Escreva o corpo do e-mail...',
        emptyEditorClass: 'is-fup-empty',
      }),
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
      UnderlineExt,
      TextAlignExt.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px]',
          'prose-p:text-foreground prose-p:leading-relaxed prose-p:my-1',
          'prose-strong:text-foreground prose-ul:text-foreground prose-ol:text-foreground',
          'prose-a:text-primary prose-a:underline',
        ),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const openLinkPopover = useCallback(() => {
    if (!editor) return;
    setLinkUrl(editor.getAttributes('link').href || '');
    setLinkPopoverOpen(true);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    linkUrl
      ? editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
      : editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkUrl('');
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const handleInsertVariable = (variable: string) => {
    editor?.chain().focus().insertContent(variable).run();
  };

  if (!editor) return null;

  return (
    <div className={cn('rounded-[4px] border border-border bg-background overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-card">
        <Toggle size="sm" pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          className="h-[30px] w-[30px] p-0">
          <Bold className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          className="h-[30px] w-[30px] p-0">
          <Italic className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          className="h-[30px] w-[30px] p-0">
          <Underline className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        <Toggle size="sm" pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          className="h-[30px] w-[30px] p-0">
          <List className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          className="h-[30px] w-[30px] p-0">
          <ListOrdered className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'left' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
          className="h-[30px] w-[30px] p-0">
          <AlignLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'center' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
          className="h-[30px] w-[30px] p-0">
          <AlignCenter className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: 'right' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
          className="h-[30px] w-[30px] p-0">
          <AlignRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        {/* Link */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Toggle size="sm" pressed={editor.isActive('link')}
              onPressedChange={openLinkPopover}
              className="h-[30px] w-[30px] p-0">
              <LinkIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-2">
              <Input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="h-[30px] text-[12px]"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyLink())}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={applyLink} className="flex-1 h-[30px] text-[12px]">Aplicar</Button>
                {editor.isActive('link') && (
                  <Button size="sm" variant="outline" className="h-[30px] px-2"
                    onClick={() => { editor.chain().focus().unsetLink().run(); setLinkPopoverOpen(false); }}>
                    <Unlink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        <Toggle size="sm" onPressedChange={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()} className="h-[30px] w-[30px] p-0">
          <Undo className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>
        <Toggle size="sm" onPressedChange={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()} className="h-[30px] w-[30px] p-0">
          <Redo className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Toggle>

        <div className="flex-1" />

        {/* Variable picker */}
        <VariablePicker onInsert={handleInsertVariable} size="xs" />
      </div>

      {/* BubbleMenu */}
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 80 }}
          className="flex items-center gap-0.5 p-1 rounded border bg-background">
          <Toggle size="sm" pressed={editor.isActive('bold')}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            className="h-6 w-6 p-0">
            <Bold className="h-3 w-3" strokeWidth={1.5} />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive('italic')}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            className="h-6 w-6 p-0">
            <Italic className="h-3 w-3" strokeWidth={1.5} />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive('underline')}
            onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
            className="h-6 w-6 p-0">
            <Underline className="h-3 w-3" strokeWidth={1.5} />
          </Toggle>
        </BubbleMenu>
      )}

      {/* Content */}
      <EditorContent editor={editor} className="px-3 py-2 text-[13px]" />

      <style>{`
        .is-fup-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground) / 0.5);
          pointer-events: none;
          height: 0;
          font-size: 0.8125rem;
        }
        .ProseMirror:focus { outline: none; }
        .ProseMirror p { margin-bottom: 0.5rem; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.25rem; margin-bottom: 0.5rem; }
      `}</style>
    </div>
  );
};
