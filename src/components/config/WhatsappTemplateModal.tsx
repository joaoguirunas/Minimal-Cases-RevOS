import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { WhatsappTemplateDetails } from './WhatsappTemplateDetails';
import { WhatsappTemplate } from '@/hooks/useWhatsappTemplates';
import { useWhatsappChannels } from '@/hooks/useWhatsappChannels';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface WhatsappTemplateModalProps {
  template: WhatsappTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WhatsappTemplateModal: React.FC<WhatsappTemplateModalProps> = ({
  template,
  open,
  onOpenChange,
}) => {
  const queryClient = useQueryClient();
  const { data: channels } = useWhatsappChannels();
  const defaultChannel = channels?.find(c => c.is_default) ?? channels?.[0];
  const [metaName, setMetaName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync local state when template changes
  React.useEffect(() => {
    setMetaName(template?.meta_template_name ?? '');
  }, [template?.id]);

  if (!template) return null;

  // If meta_template_name was set by sync (matches template name), it's read-only
  const isSynced = !!template.meta_template_name && template.meta_template_name === template.nome;

  const handleSaveMetaName = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ meta_template_name: metaName.trim() || null })
        .eq('id', template.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Nome Meta salvo');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    setDeleting(true);
    try {
      // Evolution não tem template registrado na Meta pra excluir — é só uma
      // linha local, soft-delete direto (mesmo padrão de handleToggleSystemEnabled).
      if (template.provider === 'evolution') {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update({ status: 'deleted', system_enabled: false })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        if (!defaultChannel) return;
        const { data, error } = await supabase.functions.invoke('whatsapp-templates-manage', {
          body: {
            action: 'delete',
            channel_id: defaultChannel.id,
            template_name: template.meta_template_name || template.nome,
          },
        });

        if (error) { toast.error(error.message || 'Erro ao excluir template'); return; }
        if (data?.error) { toast.error(data.error); return; }
      }

      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template excluído com sucesso');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir template');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const zonedDate = toZonedTime(date, 'America/Sao_Paulo');
    return format(zonedDate, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive':
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Detalhes do Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações principais */}
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome</label>
                <p className="text-sm font-semibold mt-1">{template.nome}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Slug</label>
                <p className="text-sm font-mono bg-muted px-2 py-1 rounded-md mt-1">{template.slug}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">ID Template (Meta)</label>
                <p className="text-sm font-mono bg-muted px-2 py-1 rounded-md mt-1">{template.id_template}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge className={getStatusColor(template.status)}>
                    {template.status}
                  </Badge>
                </div>
              </div>
            </div>

            {template.provider === 'evolution' && (
              <p className="text-sm text-muted-foreground/70 bg-muted px-3 py-2 rounded-md">
                Template WhatsApp não-oficial (Evolution) — texto livre, sem aprovação ou registro na Meta.
              </p>
            )}

            {template.provider !== 'evolution' && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Nome do Template no Meta{' '}
                <span className="text-xs font-normal opacity-60">(obrigatório para envio via API)</span>
              </label>
              {isSynced ? (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded-md">{template.meta_template_name}</p>
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-[10px] text-green-600">Sincronizado</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 mb-1">
                    Nome exato registrado no Meta Business Manager (ex: <code className="font-mono bg-muted px-1 rounded-md">murilo_atendimento</code>)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={metaName}
                      onChange={e => setMetaName(e.target.value)}
                      placeholder="ex: murilo_atendimento"
                      className="font-mono text-sm h-[30px] flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveMetaName}
                      disabled={saving}
                      className="h-[30px] shrink-0"
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </>
              )}
            </div>
            )}

            {template.provider !== 'evolution' && template.json_data && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Categoria</label>
                  <p className="text-sm mt-1">{template.json_data.category || '-'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Idioma</label>
                  <p className="text-sm mt-1">{template.json_data.language || template.json_data.languageCode || '-'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sincronizado em</label>
                  <p className="text-sm mt-1">{formatDate(template.updated_at)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Preview da mensagem */}
          <WhatsappTemplateDetails template={template} />
        </div>

        {template.status.toLowerCase() !== 'deleted' && (
          <DialogFooter className="border-t border-border pt-4 mt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
                  disabled={deleting || (template.provider !== 'evolution' && !defaultChannel)}
                >
                  {deleting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                  Excluir Template
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O template <strong>{template.nome}</strong> será {template.provider === 'evolution' ? 'desativado' : 'excluído da Meta e desativado localmente'}. Essa ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sim, excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
