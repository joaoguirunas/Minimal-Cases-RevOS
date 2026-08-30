import { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Loader2, Type } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FollowupEmailEditor } from '@/components/followups/FollowupEmailEditor';
import { VariablePicker, insertAtTextareaCursor } from '@/components/followups/VariablePicker';
import {
  EmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
} from '@/hooks/useEmailTemplates';
import {
  detectVariables, renderPreview, buildPreviewDocument,
} from '@/lib/emailTemplatePreview';

interface EmailTemplateEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Template being edited, or null to create a new one. */
  template: EmailTemplate | null;
}

const htmlHasContent = (html: string): boolean =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

export const EmailTemplateEditorModal = ({
  open, onOpenChange, template,
}: EmailTemplateEditorModalProps) => {
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);
  const [htmlBody, setHtmlBody] = useState('');
  const [rawMode, setRawMode] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const rawRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? '');
    setSubject(template?.subject ?? '');
    setCategory(template?.category ?? '');
    setActive(template?.active ?? true);
    setHtmlBody(template?.html_body ?? '');
    setRawMode(false);
  }, [open, template]);

  const subjectPreview = useMemo(() => renderPreview(subject), [subject]);
  const bodyPreviewDoc = useMemo(
    () => buildPreviewDocument(renderPreview(htmlBody)),
    [htmlBody],
  );
  const detectedVars = useMemo(
    () => detectVariables(subject, htmlBody),
    [subject, htmlBody],
  );

  const insertIntoSubject = (variable: string) => {
    const el = subjectRef.current;
    if (!el) { setSubject(s => s + variable); return; }
    const start = el.selectionStart ?? subject.length;
    const end = el.selectionEnd ?? subject.length;
    const next = subject.slice(0, start) + variable + subject.slice(end);
    setSubject(next);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + variable.length;
    }, 0);
  };

  const saving = create.isPending || update.isPending;

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome do template.'); return; }
    if (!subject.trim()) { toast.error('Informe o assunto do e-mail.'); return; }
    if (!htmlHasContent(htmlBody)) { toast.error('O corpo do e-mail não pode ficar vazio.'); return; }

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      html_body: htmlBody,
      variables: detectedVars,
      category: category.trim() || null,
      active,
    };

    try {
      if (template) {
        await update.mutateAsync({ id: template.id, ...payload });
        toast.success('Template atualizado.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Template criado.');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao salvar template.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[92vw] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-[15px]">
            {template ? 'Editar template de e-mail' : 'Novo template de e-mail'}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Monte o corpo HTML e veja a pré-visualização com variáveis de exemplo ao lado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 flex-1 min-h-0 overflow-hidden">
          {/* ── Editor column ── */}
          <div className="flex flex-col min-h-0 overflow-y-auto px-6 py-4 space-y-4 border-r border-border">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Nome</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Compra Aprovada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Categoria</Label>
                <Input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="pos-venda"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[13px]">Assunto</Label>
                <VariablePicker onInsert={insertIntoSubject} size="xs" />
              </div>
              <Input
                ref={subjectRef}
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Sua compra foi aprovada 🎉"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[13px]">Corpo do e-mail</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRawMode(m => !m)}
                  className="h-7 gap-1.5 text-[11px]"
                >
                  {rawMode
                    ? <><Type className="w-3 h-3" strokeWidth={1.5} /> Editor</>
                    : <><Code2 className="w-3 h-3" strokeWidth={1.5} /> Código HTML</>}
                </Button>
              </div>

              {rawMode ? (
                <div className="space-y-1.5">
                  <div className="flex justify-end">
                    <VariablePicker
                      onInsert={(v) => insertAtTextareaCursor(rawRef.current, v, htmlBody, setHtmlBody)}
                      size="xs"
                    />
                  </div>
                  <Textarea
                    ref={rawRef}
                    value={htmlBody}
                    onChange={e => setHtmlBody(e.target.value)}
                    placeholder="<div>Olá {{nome}}...</div>"
                    className="font-mono text-[12px] min-h-[240px] resize-y"
                  />
                </div>
              ) : (
                <FollowupEmailEditor content={htmlBody} onChange={setHtmlBody} />
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div>
                <p className="text-[13px] font-medium">Ativo</p>
                <p className="text-[11px] text-muted-foreground">Templates inativos ficam ocultos nos seletores.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          {/* ── Preview column ── */}
          <div className="flex flex-col min-h-0 overflow-hidden bg-muted/30">
            <div className="px-6 py-3 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Pré-visualização
              </p>
              <p className="text-[13px] font-medium text-foreground mt-1 truncate" title={subjectPreview}>
                {subjectPreview || <span className="text-muted-foreground/50">Assunto…</span>}
              </p>
            </div>
            <iframe
              title="Pré-visualização do e-mail"
              sandbox=""
              srcDoc={bodyPreviewDoc}
              className="flex-1 w-full bg-white border-0"
            />
            {detectedVars.length > 0 && (
              <div className="px-6 py-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground/60">
                  {detectedVars.length} variáve{detectedVars.length === 1 ? 'l' : 'is'}: {detectedVars.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 min-w-[120px]">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            {saving ? 'Salvando...' : 'Salvar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
