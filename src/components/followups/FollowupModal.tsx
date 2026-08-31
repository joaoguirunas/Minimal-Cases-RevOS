import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FileText, MessageSquare, Mail, Smartphone, Clock } from 'lucide-react';
import { useCreateFollowup, useUpdateFollowup, type StageFollowup, type FollowupCanal } from '@/hooks/useFollowups';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useOmniChannelConfig } from '@/hooks/useOmniChannelConfig';
import { usePipelines } from '@/hooks/usePipelines';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { ScoreMatrixSelector } from './ScoreMatrixSelector';
import WhatsappTemplatePickerModal from './WhatsappTemplatePickerModal';
import { VariablePicker, insertAtTextareaCursor } from './VariablePicker';
import { FollowupEmailEditor } from './FollowupEmailEditor';
import { cn } from '@/lib/utils';

interface FollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  stageId?: string;
  scoreMatrixId?: string;
  followup?: StageFollowup | null;
}

// WhatsApp always = template. Canais disponíveis:
const CANAIS: { value: FollowupCanal; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'whatsapp_template', label: 'WhatsApp', icon: MessageSquare, desc: 'Template aprovado pelo WhatsApp Business' },
  { value: 'email',             label: 'E-mail',   icon: Mail,          desc: 'Envio por e-mail' },
  { value: 'sms',               label: 'SMS',       icon: Smartphone,    desc: 'Mensagem de texto via SMS' },
];

const ORIGENS: { value: number | null; label: string }[] = [
  { value: null, label: 'Todas' },
  { value: 1,   label: 'Recomendação' },
  { value: 2,   label: 'Pessoal' },
  { value: 3,   label: 'Evento / Campanha' },
  { value: 4,   label: 'Network' },
];

interface FormState {
  leads_stages_id: string;
  canal: FollowupCanal;
  template_id: string;
  template_name: string;
  whatsapp_template_id: string;
  as_queue_id: string;
  email_template_id: string;
  mensagem: string;
  assunto: string;
  dias: number;
  horas: number;
  minutos: number;
  ativo: boolean;
  score_matrix_id: string | undefined;
  target_stage_id: string | undefined;
  control: number | undefined;
  business_hours_only: boolean;
  bh_only_last: boolean;
}

const defaultForm = (stageId = '', scoreId?: string): FormState => ({
  leads_stages_id:      stageId,
  canal:                'whatsapp_template',
  template_id:          '',
  template_name:        '',
  whatsapp_template_id: '',
  as_queue_id:          '',
  email_template_id:    '',
  mensagem:             '',
  assunto:              '',
  dias:                 0,
  horas:                1,
  minutos:              0,
  ativo:                true,
  score_matrix_id:      scoreId,
  target_stage_id:      undefined,
  control:              undefined,
  business_hours_only:  false,
  bh_only_last:         true,
});

const FollowupModal = ({
  isOpen,
  onClose,
  stageId,
  scoreMatrixId,
  followup,
}: FollowupModalProps) => {
  const [form, setForm]                      = useState<FormState>(defaultForm(stageId, scoreMatrixId));
  const [isTemplatePickerOpen, setTplPicker] = useState(false);
  const mensagemRef = useRef<HTMLTextAreaElement>(null);

  const createFollowup = useCreateFollowup();
  const updateFollowup = useUpdateFollowup();
  const { pipelines, stages: allStages, isLoading: loadingStages } = usePipelines();
  const { data: whatsappTemplates = [] } = useWhatsappTemplates();
  const { data: emailTemplates = [] } = useEmailTemplates();
  const { data: emailChannelConfig } = useOmniChannelConfig('email');

  const activePipelines = (pipelines ?? []).filter(p => p.ativo || p.active);
  const activeStages    = (allStages ?? []).filter(s => s.ativo || s.active);

  const upd = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!isOpen) return;
    if (followup) {
      const resolvedTemplateName = followup.template_id
        ? (whatsappTemplates.find(t => t.id_template === followup.template_id)?.nome ?? followup.template_id)
        : '';
      upd({
        leads_stages_id:      followup.leads_stages_id ?? stageId ?? '',
        canal:                (followup.tipo === 'whatsapp_texto' ? 'whatsapp_template' : followup.tipo) as FollowupCanal,
        template_id:          followup.template_id ?? '',
        template_name:        resolvedTemplateName,
        whatsapp_template_id: followup.whatsapp_template_id ?? '',
        as_queue_id:          followup.as_queue_id ?? '',
        email_template_id:    followup.email_template_id ?? '',
        mensagem:             followup.mensagem ?? '',
        assunto:              followup.assunto ?? '',
        dias:                 followup.dias,
        horas:                followup.horas,
        minutos:              followup.minutos,
        ativo:                followup.ativo,
        score_matrix_id:      followup.score_matrix_id ?? undefined,
        target_stage_id:      followup.target_stage_id ?? undefined,
        control:              followup.control ?? undefined,
        business_hours_only:  followup.business_hours_only ?? false,
        bh_only_last:         followup.bh_only_last ?? true,
      });
    } else {
      setForm(defaultForm(stageId, scoreMatrixId));
    }
  }, [followup, isOpen, stageId, scoreMatrixId, whatsappTemplates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leads_stages_id) { toast.error('Selecione uma etapa.'); return; }
    if (form.canal === 'whatsapp_template' && !form.template_id) {
      toast.error('Selecione um template WhatsApp.'); return;
    }
    if (form.canal === 'sms' && !form.mensagem.trim()) {
      toast.error('Digite o conteúdo da mensagem.'); return;
    }
    if (form.canal === 'email' && !form.email_template_id && !form.mensagem.trim()) {
      toast.error('Selecione um template de e-mail ou escreva o corpo da mensagem.'); return;
    }
    if (form.dias === 0 && form.horas === 0 && form.minutos === 0) {
      toast.error('Defina pelo menos um intervalo de tempo.'); return;
    }

    const payload = {
      stage_id:             form.leads_stages_id,
      score_matrix_id:      form.score_matrix_id || undefined,
      tipo:                 form.canal,
      template_id:          form.canal === 'whatsapp_template' ? form.template_id || null : null,
      whatsapp_template_id: form.canal === 'whatsapp_template' ? form.whatsapp_template_id || null : null,
      as_queue_id:          null,
      email_template_id:    form.canal === 'email' ? form.email_template_id || null : null,
      mensagem:             ['email', 'sms'].includes(form.canal) ? form.mensagem || null : null,
      assunto:              form.canal === 'email' && !form.email_template_id ? form.assunto || null : null,
      arquivo_audio:        null,
      dias:                 form.dias,
      horas:                form.horas,
      minutos:              form.minutos,
      ativo:                form.ativo,
      target_stage_id:      form.target_stage_id || null,
      control:              form.control ?? null,
      business_hours_only:  form.business_hours_only,
      bh_only_last:         form.bh_only_last,
    };

    try {
      if (followup?.id) {
        await updateFollowup.mutateAsync({ id: followup.id, ...payload });
      } else {
        await createFollowup.mutateAsync(payload);
      }
      onClose();
    } catch { /* errors handled in hooks */ }
  };

  const canalInfo = CANAIS.find(c => c.value === form.canal) ?? CANAIS[0];
  const isPending = createFollowup.isPending || updateFollowup.isPending;

  // Derive selected stage label for display
  const selectedStage = activeStages.find(s => s.id === form.leads_stages_id);
  const selectedPipelineForStage = selectedStage
    ? activePipelines.find(p => p.id === selectedStage.leads_pipelines_id)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{followup?.id ? 'Editar Follow-up' : 'Novo Follow-up'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">

          {/* Canal selector */}
          <div className="space-y-2">
            <Label className="text-[12px]">Canal de envio</Label>
            <div className="flex flex-wrap gap-1.5">
              {CANAIS.map(c => {
                const Icon   = c.icon;
                const active = form.canal === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => upd({ canal: c.value, template_id: '', template_name: '', mensagem: '', assunto: '', as_queue_id: '', email_template_id: '' })}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="w-3 h-3" strokeWidth={1.5} />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground/60">{canalInfo.desc}</p>
          </div>

          {/* Etapa — grouped by pipeline */}
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Etapa <span className="text-destructive">*</span>
              {selectedPipelineForStage && (
                <span className="ml-1.5 text-[11px] text-muted-foreground/50 font-normal">
                  · {selectedPipelineForStage.nome}
                </span>
              )}
            </Label>
            <Select
              value={form.leads_stages_id || '_none'}
              onValueChange={v => upd({ leads_stages_id: v === '_none' ? '' : v })}
              disabled={loadingStages}
            >
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent className="bg-background max-h-64">
                {activePipelines.map(pipeline => {
                  const pipelineStages = activeStages.filter(s => s.leads_pipelines_id === pipeline.id);
                  if (pipelineStages.length === 0) return null;
                  return (
                    <SelectGroup key={pipeline.id}>
                      <SelectLabel className="text-[11px] text-muted-foreground/60 py-1.5">
                        {pipeline.nome}
                      </SelectLabel>
                      {pipelineStages.map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-[13px] pl-4">
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Score específico */}
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Score específico <span className="text-muted-foreground/50">(opcional)</span>
            </Label>
            <ScoreMatrixSelector
              value={form.score_matrix_id}
              onValueChange={v => upd({ score_matrix_id: v })}
              placeholder="Todos os scores"
            />
          </div>

          {/* Conteúdo — condicional por canal */}
          {form.canal === 'whatsapp_template' && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Template WhatsApp <span className="text-destructive">*</span></Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start h-[30px] text-[13px]"
                onClick={() => setTplPicker(true)}
              >
                <FileText className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                {form.template_name || form.template_id || 'Selecionar template aprovado'}
              </Button>
              {!form.template_id && (
                <p className="text-[11px] text-muted-foreground/50">
                  Somente templates aprovados pelo WhatsApp Business podem ser enviados em follow-ups.
                </p>
              )}
            </div>
          )}

          {form.canal === 'sms' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[12px]">
                  Mensagem SMS <span className="text-destructive">*</span>
                  <span className={cn('ml-2 text-[11px]', form.mensagem.length > 160 ? 'text-destructive' : 'text-muted-foreground/50')}>
                    {form.mensagem.length}/160
                  </span>
                </Label>
                <VariablePicker
                  size="xs"
                  onInsert={v => insertAtTextareaCursor(mensagemRef.current, v, form.mensagem, msg => upd({ mensagem: msg }))}
                />
              </div>
              <Textarea
                ref={mensagemRef}
                value={form.mensagem}
                onChange={e => upd({ mensagem: e.target.value })}
                placeholder="Mensagem SMS (até 160 caracteres)"
                className="text-[13px] min-h-[80px] resize-none"
                maxLength={160}
              />
            </div>
          )}

          {form.canal === 'email' && (
            <>
              {/* Credenciais do canal (omni_channel_configs · channel=email) */}
              {emailChannelConfig && !emailChannelConfig.is_active ? (
                <p className="text-[11px] text-amber-500/90 rounded-[4px] border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5">
                  O canal de e-mail está inativo — o follow-up ficará na fila sem enviar.
                  Ative e configure o provedor em Configurações → Integrações → E-mail.
                </p>
              ) : emailChannelConfig?.is_active ? (
                <p className="text-[11px] text-muted-foreground/60">
                  Enviando via {String((emailChannelConfig.credentials as Record<string, unknown>)?.provider ?? 'provedor configurado')}
                  {(emailChannelConfig.credentials as Record<string, unknown>)?.from_email
                    ? ` · ${String((emailChannelConfig.credentials as Record<string, unknown>).from_email)}`
                    : ''} (Configurações → Integrações → E-mail).
                </p>
              ) : null}

              {/* Template da biblioteca (email_templates) ou conteúdo manual */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">Template de e-mail</Label>
                <Select
                  value={form.email_template_id || '_manual'}
                  onValueChange={v => upd({ email_template_id: v === '_manual' ? '' : v })}
                >
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue placeholder="Escrever manualmente" />
                  </SelectTrigger>
                  <SelectContent className="bg-background max-h-64">
                    <SelectItem value="_manual">— Escrever manualmente —</SelectItem>
                    {emailTemplates.filter(t => t.active).map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-[13px]">
                        {t.name}{t.category ? ` · ${t.category}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground/50">
                  Templates são criados em Configurações → Integrações → E-mail → Templates (com preview).
                </p>
              </div>

              {form.email_template_id ? (
                <div className="rounded-[4px] border border-border bg-muted/40 px-2.5 py-2 text-[12px] text-muted-foreground">
                  <span className="font-medium text-foreground">Assunto:</span>{' '}
                  {emailTemplates.find(t => t.id === form.email_template_id)?.subject ?? '—'}
                  <span className="block text-[11px] mt-0.5">
                    Assunto e corpo vêm do template; variáveis são preenchidas no envio.
                  </span>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Assunto</Label>
                    <Input
                      value={form.assunto}
                      onChange={e => upd({ assunto: e.target.value })}
                      placeholder="Assunto do e-mail"
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Corpo do e-mail <span className="text-destructive">*</span></Label>
                    <FollowupEmailEditor
                      content={form.mensagem}
                      onChange={html => upd({ mensagem: html })}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Timing */}
          <div className="space-y-1.5">
            <Label className="text-[12px]">Aguardar antes de enviar</Label>
            <div className="grid grid-cols-3 gap-3">
              {([
                ['Dias', 'dias', 31],
                ['Horas', 'horas', 24],
                ['Minutos', 'minutos', 60],
              ] as const).map(([lbl, key, max]) => (
                <div key={key} className="space-y-1">
                  <p className="text-[11px] text-muted-foreground/60">{lbl}</p>
                  <Select
                    value={form[key].toString()}
                    onValueChange={v => upd({ [key]: parseInt(v) } as Partial<FormState>)}
                  >
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {key === 'minutos'
                        ? [0, 5, 10, 15, 30, 45, 60].map(v => (
                            <SelectItem key={v} value={v.toString()}>{v}</SelectItem>
                          ))
                        : Array.from({ length: max }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>{i}</SelectItem>
                          ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {form.dias === 0 && form.horas === 0 && form.minutos === 0 && (
              <p className="text-[11px] text-amber-500/80">
                Timing zero = disparo imediato ao entrar na etapa.
              </p>
            )}
          </div>

          {/* Etapa de destino */}
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Mover para etapa após envio <span className="text-muted-foreground/50">(opcional)</span>
            </Label>
            <Select
              value={form.target_stage_id ?? '_none'}
              onValueChange={v => upd({ target_stage_id: v === '_none' ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder="Manter na etapa atual" />
              </SelectTrigger>
              <SelectContent className="bg-background max-h-64">
                <SelectItem value="_none">Manter na etapa atual</SelectItem>
                {activePipelines.map(pipeline => {
                  const pipelineStages = activeStages.filter(s => s.leads_pipelines_id === pipeline.id);
                  if (pipelineStages.length === 0) return null;
                  return (
                    <SelectGroup key={pipeline.id}>
                      <SelectLabel className="text-[11px] text-muted-foreground/60 py-1.5">
                        {pipeline.nome}
                      </SelectLabel>
                      {pipelineStages.map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-[13px] pl-4">
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Origem da lista */}
          <div className="space-y-2">
            <Label className="text-[12px]">
              Origem da lista <span className="text-muted-foreground/50">(opcional)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ORIGENS.map(o => {
                const active = (form.control ?? null) === o.value;
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    onClick={() => upd({ control: o.value ?? undefined })}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-2">
            <Switch
              id="ativo"
              checked={form.ativo}
              onCheckedChange={v => upd({ ativo: v })}
            />
            <Label htmlFor="ativo" className="text-[13px]">Follow-up ativo</Label>
          </div>

          {/* Business hours */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center gap-2">
              <Switch
                id="bh-only-fup"
                checked={form.business_hours_only}
                onCheckedChange={v => upd({ business_hours_only: v })}
              />
              <Label htmlFor="bh-only-fup" className="text-[13px] flex items-center gap-1.5 cursor-pointer">
                <Clock className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                Respeitar horário comercial
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {followup?.id ? 'Atualizar' : 'Criar follow-up'}
            </Button>
          </div>
        </form>

        <WhatsappTemplatePickerModal
          isOpen={isTemplatePickerOpen}
          onClose={() => setTplPicker(false)}
          onSelect={(id, name, uuid) => { upd({ template_id: id, template_name: name, whatsapp_template_id: uuid }); setTplPicker(false); }}
          selectedTemplateId={form.template_id}
        />
      </DialogContent>
    </Dialog>
  );
};

export default FollowupModal;
