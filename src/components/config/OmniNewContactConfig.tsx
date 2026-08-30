import { useState, useCallback } from 'react';
import { UserPlus, Loader2, Smartphone, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOmniNewContactSettings, type OmniChannelSetting } from '@/hooks/useOmniNewContactSettings';
import { usePipelines, useStages } from '@/hooks/usePipelinesReal';
import { cn } from '@/lib/utils';

type Channel = OmniChannelSetting['channel'];

const CHANNEL_ORDER: Channel[] = ['whatsapp', 'email', 'instagram_dm', 'instagram_comment'];

const CHANNEL_CONFIG: Record<Channel, {
  label: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
  ring: string;
}> = {
  whatsapp: {
    label: 'WhatsApp',
    Icon: Smartphone,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/8 dark:bg-emerald-500/10',
    ring: 'border-emerald-500/20',
  },
  email: {
    label: 'E-mail',
    Icon: Mail,
    color: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-500/8 dark:bg-blue-500/10',
    ring: 'border-blue-500/20',
  },
  instagram_dm: {
    label: 'Instagram Direct',
    Icon: MessageCircle,
    color: 'text-pink-500 dark:text-pink-400',
    bg: 'bg-pink-500/8 dark:bg-pink-500/10',
    ring: 'border-pink-500/20',
  },
  instagram_comment: {
    label: 'Instagram Comentário',
    Icon: MessageSquare,
    color: 'text-purple-500 dark:text-purple-400',
    bg: 'bg-purple-500/8 dark:bg-purple-500/10',
    ring: 'border-purple-500/20',
  },
};

// ─── ChannelCard ──────────────────────────────────────────────────────────────

interface ChannelCardProps {
  setting: OmniChannelSetting;
  onUpdate: (patch: Partial<OmniChannelSetting> & { channel: string }) => void;
  isUpdating: boolean;
}

function ChannelCard({ setting, onUpdate, isUpdating }: ChannelCardProps) {
  const [localTitle, setLocalTitle] = useState(setting.title_template);
  const { data: allPipelines = [] } = usePipelines();
  const { data: allStages = [] } = useStages();

  const cfg = CHANNEL_CONFIG[setting.channel];
  const { Icon } = cfg;

  const stages = allStages.filter(
    (s) => s.pipeline_id === setting.pipeline_id || s.leads_pipelines_id === setting.pipeline_id,
  );

  const disabled = !setting.auto_create_negocio;

  const handleToggle = useCallback(
    (checked: boolean) => onUpdate({ channel: setting.channel, auto_create_negocio: checked }),
    [setting.channel, onUpdate],
  );
  const handlePipeline = useCallback(
    (value: string) => onUpdate({ channel: setting.channel, pipeline_id: value, stage_id: null }),
    [setting.channel, onUpdate],
  );
  const handleStage = useCallback(
    (value: string) => onUpdate({ channel: setting.channel, stage_id: value }),
    [setting.channel, onUpdate],
  );
  const handleTitleBlur = useCallback(() => {
    if (localTitle !== setting.title_template)
      onUpdate({ channel: setting.channel, title_template: localTitle });
  }, [setting.channel, setting.title_template, localTitle, onUpdate]);

  const selectedPipeline = allPipelines.find(p => p.id === setting.pipeline_id);
  const selectedStage = allStages.find(s => s.id === setting.stage_id);

  return (
    <div className={cn(
      'rounded-[6px] border bg-card overflow-hidden transition-all duration-150',
      setting.auto_create_negocio ? cfg.ring : 'border-border',
      !setting.auto_create_negocio && 'opacity-70',
    )}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3', cfg.bg)}>
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-7 h-7 rounded-[5px] flex items-center justify-center bg-background/70 shrink-0',
            cfg.color,
          )}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[13px] font-semibold text-foreground">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <Switch
            checked={setting.auto_create_negocio}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-orange-500"
          />
        </div>
      </div>

      {/* Fields */}
      <div className="px-4 py-3 space-y-2">
        {/* Pipeline */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground w-14 shrink-0">Pipeline</span>
          <Select
            value={setting.pipeline_id ?? ''}
            onValueChange={handlePipeline}
            disabled={disabled}
          >
            <SelectTrigger className="h-[26px] text-[12px] flex-1 bg-transparent">
              <SelectValue placeholder="—">
                {selectedPipeline ? selectedPipeline.name : '—'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allPipelines.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stage */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground w-14 shrink-0">Etapa</span>
          <Select
            value={setting.stage_id ?? ''}
            onValueChange={handleStage}
            disabled={disabled || !setting.pipeline_id}
          >
            <SelectTrigger className="h-[26px] text-[12px] flex-1 bg-transparent">
              <SelectValue placeholder="—">
                {selectedStage ? selectedStage.name : '—'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Title template */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground w-14 shrink-0">Título</span>
          <Input
            className="h-[26px] text-[12px] flex-1 bg-transparent"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            disabled={disabled}
            placeholder="Nova conversa - {{nome}}"
          />
        </div>

        {/* Hint */}
        <p className="text-[10px] text-muted-foreground/50 pl-[68px]">
          {'{{nome}}'} e {'{{telefone}}'} como variáveis
        </p>
      </div>
    </div>
  );
}

// ─── OmniNewContactConfig ─────────────────────────────────────────────────────

export default function OmniNewContactConfig() {
  const { settings, isLoading, updateSetting, isUpdating } = useOmniNewContactSettings();

  const settingMap = Object.fromEntries(settings.map((s) => [s.channel, s]));
  const orderedSettings: OmniChannelSetting[] = CHANNEL_ORDER.map(
    (ch) =>
      settingMap[ch] ?? {
        id: '',
        channel: ch,
        auto_create_negocio: false,
        pipeline_id: null,
        stage_id: null,
        title_template: 'Nova conversa - {{nome}}',
      },
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserPlus className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <div>
          <p className="text-[13px] font-semibold text-foreground">Novo Contato OMNI</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Cria automaticamente um negócio quando um contato desconhecido envia mensagem
          </p>
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {orderedSettings.map((s) => (
            <ChannelCard
              key={s.channel}
              setting={s}
              onUpdate={updateSetting}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
