import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, MessageSquare, Mail, Smartphone, Clock } from 'lucide-react';
import { useCreateAgendamentoFollowup, useUpdateAgendamentoFollowup, type AgendamentoFollowup, type MeetingStatus } from '@/hooks/useAgendamentosFollowups';
import WhatsappTemplatePickerModal from './WhatsappTemplatePickerModal';
import { VariablePicker, insertAtTextareaCursor } from './VariablePicker';
import { FollowupEmailEditor } from './FollowupEmailEditor';
import { cn } from '@/lib/utils';

const CANAIS = [
  { value: 'whatsapp_template', label: 'WA Template', icon: MessageSquare, desc: 'Template aprovado pelo WhatsApp' },
  { value: 'email',             label: 'E-mail',      icon: Mail,          desc: 'Envio por e-mail' },
  { value: 'sms',               label: 'SMS',         icon: Smartphone,    desc: 'Mensagem de texto via SMS' },
] as const;

const STATUS_LABELS: Record<MeetingStatus, string> = {
  agendado:        'Agendado',
  compareceu:      'Compareceu',
  nao_compareceu:  'Não Compareceu',
  cancelado:       'Cancelado',
  realizado:       'Realizado',
};

interface FormState {
  tipo:                  string;
  mensagem:              string;
  assunto:               string;
  template_id:           string;
  template_name:         string;
  whatsapp_template_id:  string;
  dias:                  number;
  horas:                 number;
  minutos:               number;
  ativo:                 boolean;
  as_queue_id:           string;
  business_hours_only:   boolean;
  bh_only_last:          boolean;
}

const buildDefault = (isAntes: boolean): FormState => ({
  tipo:                  'whatsapp_template',
  mensagem:              '',
  assunto:               '',
  template_id:           '',
  template_name:         '',
  whatsapp_template_id:  '',
  dias:                  isAntes ? 1 : 0,
  horas:                 isAntes ? 0 : 1,
  minutos:               0,
  ativo:                 true,
  as_queue_id:           '',
  business_hours_only:   false,
  bh_only_last:          true,
});

interface AgendamentoFollowupModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  status:   MeetingStatus;
  followup?: AgendamentoFollowup | null;
}

const AgendamentoFollowupModal = ({ isOpen, onClose, status, followup }: AgendamentoFollowupModalProps) => {
  const isAntes = status === 'agendado';
  const [form, setForm]               = useState<FormState>(buildDefault(isAntes));
  const [isTemplatePicker, setTplPicker] = useState(false);
  const mensagemRef = useRef<HTMLTextAreaElement>(null);

  const createFollowup = useCreateAgendamentoFollowup();
  const updateFollowup = useUpdateAgendamentoFollowup();
  const isEditing      = !!(followup?.id);
  const isPending      = createFollowup.isPending || updateFollowup.isPending;

  const upd = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!isOpen) return;
    if (followup) {
      // Resolve best available template identifier for display
      const tplId   = followup.template_id || '';
      const tplUuid = followup.whatsapp_template_id || '';
      const tplName = followup.whatsapp_template_name || tplId || '';

      upd({
        tipo:                  ['whatsapp', 'whatsapp_texto'].includes(followup.tipo) ? 'whatsapp_template' : (followup.tipo || 'whatsapp_template'),
        mensagem:              followup.mensagem              || '',
        assunto:               followup.assunto               || '',
        template_id:           tplId,
        template_name:         tplName,
        whatsapp_template_id:  tplUuid,
        dias:                  followup.dias,
        horas:                 followup.horas,
        minutos:               followup.minutos,
        ativo:                 followup.ativo,
        as_queue_id:           followup.as_queue_id           || '',
        business_hours_only:   followup.business_hours_only  ?? false,
        bh_only_last:          followup.bh_only_last         ?? true,
      });
    } else {
      setForm(buildDefault(isAntes));
    }
  }, [followup, isOpen, isAntes]);

  const diasOptions    = Array.from({ length: 11 }, (_, i) => i);    // 0–10
  const horasOptions   = Array.from({ length: 25 }, (_, i) => i);    // 0–24
  const minutosOptions = [0, 5, 10, 15, 30, 45];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.tipo === 'whatsapp_template' && !form.template_id) {
      toast.error('Selecione um template WhatsApp.'); return;
    }
    if (['email', 'sms'].includes(form.tipo) && !form.mensagem.trim()) {
      toast.error('Digite o conteúdo da mensagem.'); return;
    }
    // 0/0/0 = imediato — válido para todos os status:
    //   agendado → dispara na hora do agendamento (confirmação imediata)
    //   demais   → dispara quando o status muda

    const payload = {
      meeting_status:       status,
      tipo:                 form.tipo,
      mensagem:             ['email', 'sms'].includes(form.tipo) ? form.mensagem || null : null,
      assunto:              form.tipo === 'email' ? form.assunto || null : null,
      template_id:          form.tipo === 'whatsapp_template' ? form.template_id || null : null,
      whatsapp_template_id: form.tipo === 'whatsapp_template' ? form.whatsapp_template_id || null : null,
      audio_file:           null as null,
      dias:                 form.dias,
      horas:                form.horas,
      minutos:              form.minutos,
      ativo:                form.ativo,
      control:              followup?.control ?? null,
      as_queue_id:          null,
      business_hours_only:  form.business_hours_only,
      bh_only_last:         form.bh_only_last,
    };

    try {
      if (isEditing && followup) {
        await updateFollowup.mutateAsync({
          id:         followup.id,
          created_at: followup.created_at,
          updated_at: followup.updated_at,
          ...payload,
        });
      } else {
        await createFollowup.mutateAsync(payload);
      }
      onClose();
    } catch { /* handled in hooks */ }
  };

  const canalInfo = CANAIS.find(c => c.value === form.tipo) ?? CANAIS[0];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {isEditing ? 'Editar' : 'Novo'} Follow-up
              <span className="ml-2 text-[13px] font-normal text-muted-foreground/50">
                — {STATUS_LABELS[status]}
              </span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">

            {/* Canal — chip selector */}
            <div className="space-y-2">
              <Label className="text-[12px]">Canal de envio</Label>
              <div className="flex flex-wrap gap-1.5">
                {CANAIS.map(c => {
                  const Icon   = c.icon;
                  const active = form.tipo === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => upd({ tipo: c.value, template_id: '', template_name: '', mensagem: '', assunto: '' })}
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
              <p className="text-[11px] text-muted-foreground/50">{canalInfo.desc}</p>
            </div>

            {/* WA Template picker */}
            {form.tipo === 'whatsapp_template' && (
              <div className="space-y-1.5">
                <Label className="text-[12px]">Template WhatsApp <span className="text-destructive">*</span></Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start h-[30px] text-[13px]"
                  onClick={() => setTplPicker(true)}
                >
                  <FileText className="w-3.5 h-3.5 mr-2 text-muted-foreground" strokeWidth={1.5} />
                  {form.template_name || form.template_id || 'Selecionar template aprovado'}
                </Button>
              </div>
            )}

            {/* E-mail subject */}
            {form.tipo === 'email' && (
              <div className="space-y-1.5">
                <Label className="text-[12px]">Assunto</Label>
                <Input
                  value={form.assunto}
                  onChange={e => upd({ assunto: e.target.value })}
                  placeholder="Assunto do e-mail"
                  className="h-8 text-[13px]"
                />
              </div>
            )}

            {/* Mensagem — SMS */}
            {form.tipo === 'sms' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px]">
                    Mensagem <span className="text-destructive">*</span>
                    {form.tipo === 'sms' && (
                      <span className={cn('ml-2 text-[11px]',
                        form.mensagem.length > 160 ? 'text-destructive' : 'text-muted-foreground/40'
                      )}>
                        {form.mensagem.length}/160
                      </span>
                    )}
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

            {/* Corpo do e-mail — Tiptap */}
            {form.tipo === 'email' && (
              <div className="space-y-1.5">
                <Label className="text-[12px]">
                  Corpo do e-mail <span className="text-destructive">*</span>
                </Label>
                <FollowupEmailEditor
                  content={form.mensagem}
                  onChange={html => upd({ mensagem: html })}
                />
              </div>
            )}

            {/* Timing */}
            <div className="space-y-1.5">
              <Label className="text-[12px]">
                Enviar {isAntes ? 'antes da reunião' : 'após o evento'}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['Dias',    'dias',    diasOptions   ],
                  ['Horas',   'horas',   horasOptions  ],
                  ['Minutos', 'minutos', minutosOptions],
                ] as const).map(([lbl, key, opts]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-[11px] text-muted-foreground/50">{lbl}</p>
                    <Select
                      value={form[key].toString()}
                      onValueChange={v => upd({ [key]: parseInt(v) } as Partial<FormState>)}
                    >
                      <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {opts.map((v: number) => (
                          <SelectItem key={v} value={v.toString()}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="ativo-ag"
                checked={form.ativo}
                onCheckedChange={v => upd({ ativo: v })}
              />
              <Label htmlFor="ativo-ag" className="text-[13px]">Follow-up ativo</Label>
            </div>

            {/* Business hours */}
            <div className="space-y-2 pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                <Switch
                  id="bh-only-ag"
                  checked={form.business_hours_only}
                  onCheckedChange={v => upd({ business_hours_only: v })}
                />
                <Label htmlFor="bh-only-ag" className="text-[13px] flex items-center gap-1.5 cursor-pointer">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                  Respeitar horário comercial
                </Label>
              </div>
              </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isEditing ? 'Atualizar' : 'Criar follow-up'}
              </Button>
            </div>
          </form>

          <WhatsappTemplatePickerModal
            isOpen={isTemplatePicker}
            onClose={() => setTplPicker(false)}
            onSelect={(id, name, uuid) => { upd({ template_id: id, template_name: name, whatsapp_template_id: uuid }); setTplPicker(false); }}
            selectedTemplateId={form.template_id || form.whatsapp_template_id}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgendamentoFollowupModal;
