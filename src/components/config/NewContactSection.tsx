import { useState, useCallback } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import { useOmniNewContactSettings, type OmniChannelSetting } from '@/hooks/useOmniNewContactSettings';
import { usePipelines, useStages } from '@/hooks/usePipelinesReal';

type Channel = OmniChannelSetting['channel'];

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp:           'WhatsApp',
  email:              'E-mail',
  instagram_dm:       'Instagram Direct',
  instagram_comment:  'Instagram Comentário',
  sms:                'SMS',
  telefone:           'Telefone',
};

// ─── ChannelCard ──────────────────────────────────────────────────────────────

interface ChannelCardProps {
  setting: OmniChannelSetting;
  onUpdate: (patch: Partial<OmniChannelSetting> & { channel: string }) => void;
  isUpdating: boolean;
}

function ChannelCard({ setting, onUpdate, isUpdating }: ChannelCardProps) {
  const { t } = useTranslation();
  const [localTitle, setLocalTitle] = useState(setting.title_template);
  const { data: allPipelines = [] } = usePipelines();
  const { data: allStages = [] } = useStages();

  const stages = allStages.filter(
    (s) => s.pipeline_id === setting.pipeline_id || s.leads_pipelines_id === setting.pipeline_id
  );

  const handleToggle = useCallback(
    (checked: boolean) => onUpdate({ channel: setting.channel, auto_create_negocio: checked }),
    [setting.channel, onUpdate]
  );
  const handlePipeline = useCallback(
    (value: string) => onUpdate({ channel: setting.channel, pipeline_id: value, stage_id: null }),
    [setting.channel, onUpdate]
  );
  const handleStage = useCallback(
    (value: string) => onUpdate({ channel: setting.channel, stage_id: value }),
    [setting.channel, onUpdate]
  );
  const handleTitleBlur = useCallback(() => {
    if (localTitle !== setting.title_template)
      onUpdate({ channel: setting.channel, title_template: localTitle });
  }, [setting.channel, setting.title_template, localTitle, onUpdate]);

  const disabled = !setting.auto_create_negocio;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{CHANNEL_LABELS[setting.channel]}</span>
        <div className="flex items-center gap-2">
          {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <Switch checked={setting.auto_create_negocio} onCheckedChange={handleToggle} />
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t('omniNewContact.pipeline')}</Label>
          <Select value={setting.pipeline_id ?? ''} onValueChange={handlePipeline} disabled={disabled}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {allPipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t('omniNewContact.stage')}</Label>
          <Select value={setting.stage_id ?? ''} onValueChange={handleStage} disabled={disabled || !setting.pipeline_id}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t('omniNewContact.titleTemplate')}</Label>
          <Input
            className="h-7 text-xs"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            disabled={disabled}
            placeholder="Nova conversa - {{nome}}"
          />
          <p className="text-[10px] text-muted-foreground/70">{t('omniNewContact.titleHint')}</p>
        </div>
      </div>
    </div>
  );
}

// ─── ChannelFields (flat, sem wrapper) ───────────────────────────────────────

function ChannelFields({
  setting,
  onUpdate,
  isUpdating,
}: ChannelCardProps) {
  const { t } = useTranslation();
  const [localTitle, setLocalTitle] = useState(setting.title_template);
  const { data: allPipelines = [] } = usePipelines();
  const { data: allStages = [] } = useStages();

  const stages = allStages.filter(
    (s) => s.pipeline_id === setting.pipeline_id || s.leads_pipelines_id === setting.pipeline_id
  );

  const handleToggle = useCallback(
    (checked: boolean) => onUpdate({ channel: setting.channel, auto_create_negocio: checked }),
    [setting.channel, onUpdate]
  );
  const handlePipeline = useCallback(
    (value: string) => onUpdate({ channel: setting.channel, pipeline_id: value, stage_id: null }),
    [setting.channel, onUpdate]
  );
  const handleStage = useCallback(
    (value: string) => onUpdate({ channel: setting.channel, stage_id: value }),
    [setting.channel, onUpdate]
  );
  const handleTitleBlur = useCallback(() => {
    if (localTitle !== setting.title_template)
      onUpdate({ channel: setting.channel, title_template: localTitle });
  }, [setting.channel, setting.title_template, localTitle, onUpdate]);

  const disabled = !setting.auto_create_negocio;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Criar negócio automaticamente</span>
        <div className="flex items-center gap-2">
          {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <Switch checked={setting.auto_create_negocio} onCheckedChange={handleToggle} />
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t('omniNewContact.pipeline')}</Label>
          <Select value={setting.pipeline_id ?? ''} onValueChange={handlePipeline} disabled={disabled}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {allPipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t('omniNewContact.stage')}</Label>
          <Select value={setting.stage_id ?? ''} onValueChange={handleStage} disabled={disabled || !setting.pipeline_id}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t('omniNewContact.titleTemplate')}</Label>
          <Input
            className="h-7 text-xs"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            disabled={disabled}
            placeholder="Nova conversa - {{nome}}"
          />
          <p className="text-[10px] text-muted-foreground/70">{t('omniNewContact.titleHint')}</p>
        </div>
      </div>
    </div>
  );
}

// ─── NewContactSection ────────────────────────────────────────────────────────

interface NewContactSectionProps {
  channels: Channel[];
  compact?: boolean;
}

export default function NewContactSection({ channels, compact }: NewContactSectionProps) {
  const { settings, isLoading, updateSetting, isUpdating } = useOmniNewContactSettings();

  const settingMap = Object.fromEntries(settings.map((s) => [s.channel, s]));

  const orderedSettings: OmniChannelSetting[] = channels.map(
    (ch) =>
      settingMap[ch] ?? {
        id: '',
        channel: ch,
        auto_create_negocio: false,
        pipeline_id: null,
        stage_id: null,
        title_template: 'Nova conversa - {{nome}}',
      }
  );

  const loadingNode = (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  );

  if (compact) {
    if (isLoading) return loadingNode;
    if (channels.length === 1) {
      return (
        <ChannelFields
          setting={orderedSettings[0]}
          onUpdate={updateSetting}
          isUpdating={isUpdating}
        />
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {orderedSettings.map((s) => (
          <ChannelCard key={s.channel} setting={s} onUpdate={updateSetting} isUpdating={isUpdating} />
        ))}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">Novo Contato</p>
        <span className="text-[10px] text-muted-foreground">Criar negócio automaticamente ao receber mensagem</span>
      </div>
      {isLoading ? loadingNode : (
        <div className={channels.length > 1 ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : ''}>
          {orderedSettings.map((s) => (
            <ChannelCard key={s.channel} setting={s} onUpdate={updateSetting} isUpdating={isUpdating} />
          ))}
        </div>
      )}
    </div>
  );
}
