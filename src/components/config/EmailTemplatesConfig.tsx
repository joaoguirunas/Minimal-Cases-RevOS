import { useState } from 'react';
import { Copy, Loader2, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  EmailTemplate,
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
} from '@/hooks/useEmailTemplates';
import { EmailTemplateEditorModal } from './EmailTemplateEditorModal';
import { cn } from '@/lib/utils';

export const EmailTemplatesConfig = () => {
  const { data: templates, isLoading } = useEmailTemplates();
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();
  const del = useDeleteEmailTemplate();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [toDelete, setToDelete] = useState<EmailTemplate | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (t: EmailTemplate) => { setEditing(t); setEditorOpen(true); };

  const handleDuplicate = async (t: EmailTemplate) => {
    try {
      await create.mutateAsync({
        name: `${t.name} (cópia)`,
        subject: t.subject,
        html_body: t.html_body,
        variables: t.variables,
        category: t.category,
        active: t.active,
      });
      toast.success('Template duplicado.');
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao duplicar template.');
    }
  };

  const handleToggleActive = async (t: EmailTemplate) => {
    setTogglingId(t.id);
    try {
      await update.mutateAsync({
        id: t.id,
        name: t.name,
        subject: t.subject,
        html_body: t.html_body,
        variables: t.variables,
        category: t.category,
        active: !t.active,
      });
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao atualizar template.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success('Template excluído.');
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao excluir template.');
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Templates de E-mail</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Biblioteca de corpos HTML reutilizáveis com variáveis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openCreate} className="h-8 gap-1.5 text-[12px]">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Novo template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-border">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Mail className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-foreground mb-1">Nenhum template ainda</p>
          <p className="text-[12px] text-muted-foreground mb-4 max-w-xs leading-relaxed">
            Crie um template HTML com pré-visualização para reutilizar nos e-mails.
          </p>
          <Button variant="outline" size="sm" onClick={openCreate} className="h-8 gap-1.5 text-[12px]">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Criar template
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          {templates.map(t => (
            <div
              key={t.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors',
                !t.active && 'opacity-50',
              )}
            >
              <Switch
                checked={t.active}
                disabled={togglingId === t.id}
                onCheckedChange={() => handleToggleActive(t)}
                className="scale-90 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground truncate">{t.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{t.subject}</p>
              </div>
              {t.category && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border shrink-0">
                  {t.category}
                </span>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost" size="sm" onClick={() => openEdit(t)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
                <Button
                  variant="ghost" size="sm" onClick={() => handleDuplicate(t)}
                  disabled={create.isPending}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Duplicar"
                >
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
                <Button
                  variant="ghost" size="sm" onClick={() => setToDelete(t)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EmailTemplateEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editing}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template "{toDelete?.name}" será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={del.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
