import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { usePipelines } from '@/hooks/usePipelines';
import { useAiAgents } from '@/hooks/useAiAgents';
import { Calendar, Clock, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { WhatsappTemplatePreview } from '@/components/config/WhatsappTemplatePreview';
import { WhatsappTemplateModal } from '@/components/config/WhatsappTemplateModal';
import { Button } from '@/components/ui/button';

interface ConfiguracaoDisparoTabProps {
  onConfigChange: (config: any) => void;
  channel?: string;
}

const INTERVAL_OPTIONS = [
  { value: 5, label: '5 segundos' },
  { value: 10, label: '10 segundos' },
  { value: 30, label: '30 segundos' },
  { value: 60, label: '1 minuto' },
  { value: 300, label: '5 minutos' },
  { value: 600, label: '10 minutos' },
  { value: 1800, label: '30 minutos' },
  { value: 3600, label: '60 minutos' },
];

const VOICE_MIN_INTERVAL = 60;

export default function ConfiguracaoDisparoTab({ onConfigChange, channel }: ConfiguracaoDisparoTabProps) {
  const isVoice = channel === 'voice_ai';

  const [config, setConfig] = useState({
    template_id: null as string | null,
    voice_agent_id: null as string | null,
    send_interval_seconds: 60,
    pipeline_id: null as string | null,
    stage_ids: null as string[] | null,
    movePipeline: false,
    agendar: false,
    scheduled_date: '',
    scheduled_time: '',
  });
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const { data: templates } = useWhatsappTemplates();
  const { data: voiceAgents, isLoading: loadingAgents } = useAiAgents();
  const { pipelines, stages: allStages } = usePipelines();
  const activeTemplates = templates?.filter(t => t.system_enabled === true);

  const stages = allStages?.filter(s => s.leads_pipelines_id === config.pipeline_id) || [];

  const selectedTemplate = activeTemplates?.find(t => t.id === config.template_id);
  const selectedVoiceAgent = voiceAgents?.find(a => a.id === config.voice_agent_id);

  const intervalOptions = isVoice
    ? INTERVAL_OPTIONS.filter(o => o.value >= VOICE_MIN_INTERVAL)
    : INTERVAL_OPTIONS;

  useEffect(() => {
    if (isVoice && config.send_interval_seconds < VOICE_MIN_INTERVAL) {
      const newConfig = { ...config, send_interval_seconds: VOICE_MIN_INTERVAL };
      setConfig(newConfig);
      onConfigChange(newConfig);
    }
  }, [isVoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-border bg-card rounded-[2px] space-y-6">
        {isVoice ? (
          <div>
            <Label htmlFor="voice-agent">Voice Agent *</Label>
            <p className="text-xs text-muted-foreground mb-2">Agente de IA que conduzirá as chamadas via ElevenLabs.</p>
            <Select
              value={config.voice_agent_id || undefined}
              onValueChange={(v) => handleChange('voice_agent_id', v)}
            >
              <SelectTrigger id="voice-agent">
                <SelectValue placeholder={loadingAgents ? 'Carregando agentes...' : 'Selecionar voice agent'} />
              </SelectTrigger>
              <SelectContent>
                {voiceAgents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {voiceAgents && voiceAgents.length === 0 && !loadingAgents && (
              <p className="text-xs text-amber-500 mt-2">
                Nenhum voice agent ativo encontrado. Configure um em Agentes IA.
              </p>
            )}
          </div>
        ) : (
          <div>
            <Label htmlFor="template">WhatsApp Template</Label>
            <p className="text-xs text-muted-foreground mb-2">Only required for WhatsApp channel. For other channels, content is configured in N8N.</p>
            <div className="flex gap-2">
              <Select
                value={config.template_id || undefined}
                onValueChange={(v) => handleChange('template_id', v)}
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder="Selecionar template" />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplate && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowTemplateModal(true)}
                  title="Ver detalhes do template"
                  className="h-[30px] w-[30px] rounded-[4px]"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              )}
            </div>

            {selectedTemplate && selectedTemplate.json_data?.components && (
              <div className="mt-4">
                <WhatsappTemplatePreview components={selectedTemplate.json_data.components} />
              </div>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="interval">{isVoice ? 'Intervalo entre chamadas *' : 'Intervalo entre Envios *'}</Label>
          <Select
            value={config.send_interval_seconds.toString()}
            onValueChange={(v) => handleChange('send_interval_seconds', parseInt(v))}
          >
            <SelectTrigger id="interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intervalOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isVoice && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Mínimo de 1 minuto para chamadas de voz.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              id="movePipeline"
              checked={config.movePipeline}
              onCheckedChange={(checked) => handleChange('movePipeline', checked)}
            />
            <Label htmlFor="movePipeline" className="cursor-pointer">
              Mover leads após disparo (opcional)
            </Label>
          </div>

          {config.movePipeline && (
            <div className="space-y-4 pl-6">
              <div>
                <Label htmlFor="pipeline">Pipeline de Destino</Label>
                <Select
                  value={config.pipeline_id || undefined}
                  onValueChange={(v) => handleChange('pipeline_id', v)}
                >
                  <SelectTrigger id="pipeline">
                    <SelectValue placeholder="Selecionar pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines?.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {config.pipeline_id && (
                <div>
                  <Label htmlFor="stage">Etapa Inicial</Label>
                  <Select
                    value={config.stage_ids?.[0] || undefined}
                    onValueChange={(v) => handleChange('stage_ids', v ? [v] : null)}
                  >
                    <SelectTrigger id="stage">
                      <SelectValue placeholder="Selecionar etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage: any) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              id="agendar"
              checked={config.agendar}
              onCheckedChange={(checked) => handleChange('agendar', checked)}
            />
            <Label htmlFor="agendar" className="cursor-pointer">
              Agendar disparo
            </Label>
          </div>

          {config.agendar && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div>
                <Label htmlFor="date">Data</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    value={config.scheduled_date}
                    onChange={(e) => handleChange('scheduled_date', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="time">Hora</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="time"
                    type="time"
                    value={config.scheduled_time}
                    onChange={(e) => handleChange('scheduled_time', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <h3 className="font-semibold mb-3">Resumo da Configuração</h3>
        <div className="space-y-2 text-sm">
          {isVoice ? (
            <div>
              <strong>Voice Agent:</strong> {selectedVoiceAgent?.name || 'Não selecionado'}
            </div>
          ) : (
            <div>
              <strong>Template:</strong> {selectedTemplate?.nome || 'Não selecionado'}
            </div>
          )}
          <div>
            <strong>Intervalo:</strong>{' '}
            {INTERVAL_OPTIONS.find(o => o.value === config.send_interval_seconds)?.label}
          </div>
          {config.movePipeline && config.pipeline_id && (
            <div>
              <strong>Pipeline destino:</strong> {pipelines?.find(p => p.id === config.pipeline_id)?.name} →{' '}
              {stages.find((s: any) => s.id === config.stage_ids?.[0])?.name}
            </div>
          )}
          {config.agendar && config.scheduled_date && (
            <div>
              <strong>Agendado para:</strong> {config.scheduled_date} às {config.scheduled_time}
            </div>
          )}
        </div>
      </Card>

      {selectedTemplate && (
        <WhatsappTemplateModal
          template={selectedTemplate}
          open={showTemplateModal}
          onOpenChange={setShowTemplateModal}
        />
      )}
    </div>
  );
}
