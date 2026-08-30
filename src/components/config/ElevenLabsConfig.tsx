import { useState } from 'react';
import { Mic, Eye, EyeOff, Loader2, Save, RefreshCw, Play, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useElevenLabsConfig,
  useUpsertElevenLabsConfig,
  useElevenLabsVoices,
  ELEVENLABS_MODELS,
  ELEVENLABS_FORMATS,
} from '@/hooks/useElevenLabsConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

// ── Main component ────────────────────────────────────────────────────────────

const ElevenLabsConfig = () => {
  const { config, isLoading, isConfigured } = useElevenLabsConfig();
  const upsertMutation = useUpsertElevenLabsConfig();
  const { data: voices = [] } = useElevenLabsVoices();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showKey, setShowKey] = useState(false);
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState({
    api_key: '',
    default_model_id: 'eleven_flash_v2_5',
    default_voice_id: '' as string | null,
    default_output_format: 'mp3_44100_128',
    monthly_char_limit: 100000,
    active: true,
  });

  // Sync form when config loads
  const [initialized, setInitialized] = useState(false);
  if (config && !initialized) {
    setForm({
      api_key: config.api_key ? '••••••••' : '',
      default_model_id: config.default_model_id || 'eleven_flash_v2_5',
      default_voice_id: config.default_voice_id ?? '',
      default_output_format: config.default_output_format || 'mp3_44100_128',
      monthly_char_limit: config.monthly_char_limit || 100000,
      active: config.active,
    });
    setInitialized(true);
  }

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      default_model_id: form.default_model_id,
      default_voice_id: form.default_voice_id || null,
      default_output_format: form.default_output_format,
      monthly_char_limit: form.monthly_char_limit,
      active: form.active,
    };

    if (apiKeyChanged && form.api_key && form.api_key !== '••••••••') {
      payload.api_key = form.api_key;
    }

    upsertMutation.mutate(payload);
    setApiKeyChanged(false);
  };

  const handleSyncVoices = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-sync');
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-voices'] });
      toast({
        title: 'Vozes sincronizadas',
        description: `${data.synced} vozes encontradas, ${data.removed} removidas`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao sincronizar vozes', description: message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground/50">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  const usagePercent = config
    ? Math.round(((config.monthly_char_used || 0) / (config.monthly_char_limit || 100000)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mic className="h-4 w-4 text-muted-foreground" />
          ElevenLabs — Voz AI
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure a API de Text-to-Speech da ElevenLabs para vozes nos agentes de IA e chamadas.
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-4 border border-border rounded-[4px] p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            API Key
            {isConfigured && (
              <button
                className="ml-2 text-[10px] text-primary hover:underline font-normal"
                onClick={() => setApiKeyChanged(v => !v)}
              >
                {apiKeyChanged ? 'cancelar alteração' : 'alterar chave'}
              </button>
            )}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type={showKey ? 'text' : 'password'}
              value={form.api_key}
              onChange={(e) => { setForm(f => ({ ...f, api_key: e.target.value })); setApiKeyChanged(true); }}
              placeholder={isConfigured && !apiKeyChanged ? 'Chave atual mantida' : 'xi-...'}
              disabled={isConfigured && !apiKeyChanged}
              className="h-[30px] text-sm font-mono flex-1"
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              title={showKey ? 'Ocultar' : 'Mostrar'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={form.active}
            onCheckedChange={(v) => setForm(f => ({ ...f, active: v }))}
          />
          <span className="text-xs text-muted-foreground">
            {form.active ? 'Ativo — TTS habilitado' : 'Inativo — TTS desabilitado'}
          </span>
        </div>
      </div>

      {/* Model + Voice + Format */}
      <div className="space-y-4 border border-border rounded-[4px] p-4">
        <p className="text-xs font-medium text-foreground">Padrões de TTS</p>

        {/* Model */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Modelo</Label>
          <Select
            value={form.default_model_id}
            onValueChange={(v) => setForm(f => ({ ...f, default_model_id: v }))}
          >
            <SelectTrigger className="h-[30px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELEVENLABS_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <div>
                    <span>{m.label}</span>
                    <span className="text-muted-foreground text-[10px] ml-2">{m.hint}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Voz padrão</Label>
          <Select
            value={form.default_voice_id || '_none'}
            onValueChange={(v) => setForm(f => ({ ...f, default_voice_id: v === '_none' ? null : v }))}
          >
            <SelectTrigger className="h-[30px] text-sm">
              <SelectValue placeholder="Selecione uma voz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">
                <span className="text-muted-foreground">Nenhuma (definir por agente)</span>
              </SelectItem>
              {voices.map((v) => (
                <SelectItem key={v.voice_id} value={v.voice_id}>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3 w-3 text-muted-foreground" />
                    <span>{v.name}</span>
                    {v.category && (
                      <span className="text-muted-foreground text-[10px]">{v.category}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {voices.length === 0 && isConfigured && (
            <p className="text-[10px] text-muted-foreground/60">
              Nenhuma voz sincronizada. Sincronize vozes após salvar a API key.
            </p>
          )}
        </div>

        {/* Output format */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Formato de saída</Label>
          <Select
            value={form.default_output_format}
            onValueChange={(v) => setForm(f => ({ ...f, default_output_format: v }))}
          >
            <SelectTrigger className="h-[30px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELEVENLABS_FORMATS.map((fmt) => (
                <SelectItem key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Usage */}
      {isConfigured && config && (
        <div className="space-y-2 border border-border rounded-[4px] p-4">
          <p className="text-xs font-medium text-foreground">Uso mensal</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usagePercent > 90 ? 'bg-destructive' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {(config.monthly_char_used || 0).toLocaleString('pt-BR')} / {(config.monthly_char_limit || 100000).toLocaleString('pt-BR')} chars
            </span>
          </div>

          {/* Monthly limit input */}
          <div className="space-y-1.5 pt-2">
            <Label className="text-xs text-muted-foreground">Limite mensal (caracteres)</Label>
            <Input
              type="number"
              value={form.monthly_char_limit}
              onChange={(e) => setForm(f => ({ ...f, monthly_char_limit: parseInt(e.target.value) || 0 }))}
              className="h-[30px] text-sm w-48"
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={upsertMutation.isPending}
          className="h-[30px] gap-1.5 text-xs"
        >
          {upsertMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Salvar configuração
        </Button>

        {isConfigured && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncVoices}
            disabled={syncing}
            className="h-[30px] gap-1.5 text-xs"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sincronizar Vozes
          </Button>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-[4px] border border-border bg-muted px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Como funciona</p>
        <ul className="space-y-1 list-disc list-inside leading-relaxed">
          <li>A API key da ElevenLabs é usada para gerar áudio via Text-to-Speech (TTS)</li>
          <li>O modelo Flash v2.5 é recomendado: ~75ms de latência e 50% mais barato</li>
          <li>O limite mensal controla quantos caracteres podem ser convertidos em áudio por mês</li>
          <li>Vozes são sincronizadas do workspace ElevenLabs e podem ser atribuídas aos agentes</li>
        </ul>
      </div>
    </div>
  );
};

export default ElevenLabsConfig;
