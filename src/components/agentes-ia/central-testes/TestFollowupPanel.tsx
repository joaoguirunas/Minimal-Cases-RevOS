import { useState } from 'react';
import { Send, Loader2, Clock, Bell, ChevronDown, FileText } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStageFollowups, type StageFollowup, type FollowupCanal } from '@/hooks/useFollowups';
import { useFollowupTriggerWorker } from '@/hooks/useFollowupEnqueue';
import { useWhatsappTemplates, type WhatsappTemplate } from '@/hooks/useWhatsappTemplates';
import { cn } from '@/lib/utils';

const CANAL_LABEL: Record<FollowupCanal, string> = {
  whatsapp_template: 'WhatsApp (template)',
  whatsapp_texto: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  ligacao: 'Ligação',
};

function formatDelay(fup: StageFollowup) {
  const parts: string[] = [];
  if (fup.dias) parts.push(`${fup.dias}d`);
  if (fup.horas) parts.push(`${fup.horas}h`);
  if (fup.minutos) parts.push(`${fup.minutos}min`);
  return parts.length ? parts.join(' ') : 'imediato';
}

function extractTemplateBody(template: WhatsappTemplate): string {
  const jsonData = template.json_data;
  if (!jsonData) return '';
  // Standard Meta components[] format
  if (jsonData.components && Array.isArray(jsonData.components)) {
    const bodyComp = (jsonData.components as Array<{ type: string; text?: string }>)
      .find(c => (c.type as string)?.toUpperCase() === 'BODY');
    if (bodyComp?.text) return bodyComp.text;
  }
  // Gupshup legacy containerMeta
  let cm: { data?: string } = {};
  if (jsonData.containerMeta) {
    cm = typeof jsonData.containerMeta === 'string'
      ? JSON.parse(jsonData.containerMeta)
      : (jsonData.containerMeta as { data?: string });
  }
  return cm.data || (jsonData.data as string) || '';
}

interface FollowupCardProps {
  fup: StageFollowup;
  leadId: string | null;
  personId: string | null;
  templateMap: Map<string, WhatsappTemplate>;
  isSending: boolean;
  onSend: (fup: StageFollowup) => void;
}

function FollowupCard({ fup, leadId, templateMap, isSending, onSend }: FollowupCardProps) {
  const [expanded, setExpanded] = useState(false);

  const template = fup.whatsapp_template_id ? templateMap.get(fup.whatsapp_template_id) : null;
  const templateBody = template ? extractTemplateBody(template) : null;
  const previewText = fup.mensagem || templateBody;
  const hasPreview = !!previewText;

  return (
    <div className="border border-border rounded-[4px] bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-1.5">
        <span className="text-[12px] font-medium text-foreground truncate">
          {CANAL_LABEL[fup.tipo] ?? fup.tipo}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Clock className="h-2.5 w-2.5" />
            {formatDelay(fup)}
          </span>
          {hasPreview && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
              title="Pré-visualizar mensagem"
            >
              <FileText className="h-3 w-3" />
              <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {/* Template name badge */}
      {template && (
        <div className="px-2.5 pb-1">
          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-[2px] bg-violet-500/10 text-violet-600 dark:text-violet-400 font-mono truncate max-w-full">
            {template.nome || template.meta_template_name || 'template'}
          </span>
        </div>
      )}

      {/* Preview expandido */}
      {hasPreview && expanded && (
        <div className="mx-2.5 mb-2 rounded-[3px] bg-muted/60 border border-border p-2">
          <p className="text-[11px] text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {previewText}
          </p>
        </div>
      )}

      {/* Preview colapsado (1 linha) */}
      {hasPreview && !expanded && (
        <p className="px-2.5 pb-1.5 text-[10px] text-muted-foreground/60 line-clamp-1">
          {previewText}
        </p>
      )}

      {/* Send button */}
      <div className="px-2.5 pb-2.5">
        <Button
          variant="outline"
          size="sm"
          disabled={!leadId || isSending}
          onClick={() => onSend(fup)}
          className="w-full h-[28px] text-[11px] gap-1.5 border-border"
        >
          {isSending
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Send className="h-3 w-3" />}
          Enviar agora
        </Button>
      </div>
    </div>
  );
}

interface TestFollowupPanelProps {
  stageId: string | null;
  leadId: string | null;
  personId: string | null;
}

export function TestFollowupPanel({ stageId, leadId, personId }: TestFollowupPanelProps) {
  const { data: followups = [], isLoading } = useStageFollowups(stageId ?? undefined);
  const { data: allTemplates = [] } = useWhatsappTemplates();
  const triggerWorker = useFollowupTriggerWorker();

  const templateMap = new Map(allTemplates.map(t => [t.id, t]));

  const sendNow = useMutation({
    mutationFn: async (fup: StageFollowup) => {
      if (!leadId) throw new Error('Lead inválido');
      const { error } = await supabase.from('followup_queue').insert({
        followup_id: fup.id,
        lead_id: leadId,
        person_id: personId ?? null,
        channel: fup.tipo,
        template_id: fup.template_id ?? null,
        message: fup.mensagem ?? null,
        subject: fup.assunto ?? null,
        source_type: 'stage',
        scheduled_for: new Date(Date.now() - 1000).toISOString(),
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      triggerWorker.mutate();
      toast.success('Follow-up enviado');
    },
    onError: (e: Error) => toast.error(`Erro ao disparar follow-up: ${e.message}`),
  });

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-1.5">
        <Bell className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Follow-ups da etapa
        </span>
      </div>

      <div className="px-3 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : followups.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/50 py-4 text-center">
            Nenhum follow-up configurado para esta etapa
          </p>
        ) : (
          <div className="space-y-2">
            {followups.map((fup) => (
              <FollowupCard
                key={fup.id}
                fup={fup}
                leadId={leadId}
                personId={personId}
                templateMap={templateMap}
                isSending={sendNow.isPending && sendNow.variables?.id === fup.id}
                onSend={(f) => sendNow.mutate(f)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
