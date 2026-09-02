import { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2, MessageSquareText, Plus, QrCode, Trash2, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  useEvolutionChannels,
  useEvolutionSetup,
  useEvolutionConnect,
  useEvolutionStatus,
  useEvolutionLogout,
  useEvolutionDelete,
  type EvolutionChannel,
} from '@/hooks/useEvolutionIntegration';
import { useSetDefaultWhatsappChannel } from '@/hooks/useWhatsappChannels';

const WhatsappTemplatesConfig = lazy(() =>
  import('@/components/config/WhatsappTemplatesConfig').then((m) => ({ default: m.WhatsappTemplatesConfig })),
);

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  WORKING: { label: 'Conectado', variant: 'default' },
  SCAN_QR_CODE: { label: 'Aguardando leitura do QR', variant: 'secondary' },
  STARTING: { label: 'Iniciando...', variant: 'secondary' },
  STOPPED: { label: 'Desconectado', variant: 'outline' },
  FAILED: { label: 'Falha na conexão', variant: 'destructive' },
  BANNED: { label: 'Número banido', variant: 'destructive' },
};

function StatusBadge({ status }: { status: string | null }) {
  const info = status ? STATUS_LABEL[status] : undefined;
  if (!info) return <Badge variant="outline" className="text-[11px]">Não configurado</Badge>;
  return <Badge variant={info.variant} className="text-[11px]">{info.label}</Badge>;
}

// ── Formulário de novo canal (sempre disponível — vários canais Evolution podem coexistir) ──

function NewEvolutionChannelForm({ onDone }: { onDone: () => void }) {
  const setup = useEvolutionSetup();
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [instanceName, setInstanceName] = useState('');

  const handleSetup = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || !instanceName.trim()) return;
    await setup.mutateAsync({
      base_url: baseUrl.trim(),
      api_key: apiKey.trim(),
      instance_name: instanceName.trim(),
      label: label.trim() || undefined,
    });
    onDone();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquareText className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
        <p className="text-[13px] font-medium text-foreground">Novo canal Evolution</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="evo-label" className="text-[12px] text-muted-foreground">Nome (opcional)</Label>
        <Input
          id="evo-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex: WhatsApp Comercial"
          className="h-8 text-[13px]"
          disabled={setup.isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="evo-base-url" className="text-[12px] text-muted-foreground">URL do servidor</Label>
        <Input
          id="evo-base-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://evolution.seudominio.com"
          className="h-8 text-[13px]"
          disabled={setup.isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="evo-api-key" className="text-[12px] text-muted-foreground">API Key</Label>
        <Input
          id="evo-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AUTHENTICATION_API_KEY do servidor"
          className="h-8 text-[13px]"
          disabled={setup.isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="evo-instance" className="text-[12px] text-muted-foreground">Nome da instância</Label>
        <Input
          id="evo-instance"
          value={instanceName}
          onChange={(e) => setInstanceName(e.target.value)}
          placeholder="ex: crm-comercial"
          className="h-8 text-[13px]"
          disabled={setup.isPending}
        />
        <p className="text-[11px] text-muted-foreground/50">
          Precisa ser único nesse servidor Evolution — não reusar entre canais diferentes.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-8 text-[13px]"
          onClick={handleSetup}
          disabled={setup.isPending || !baseUrl.trim() || !apiKey.trim() || !instanceName.trim()}
        >
          {setup.isPending ? 'Configurando...' : 'Configurar'}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-[13px]" onClick={onDone} disabled={setup.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Card de um canal já configurado (conectar/status/default/desconectar/remover) ──

function EvolutionChannelCard({ channel }: { channel: EvolutionChannel }) {
  const connect = useEvolutionConnect();
  const status = useEvolutionStatus();
  const logout = useEvolutionLogout();
  const remove = useEvolutionDelete();
  const setDefault = useSetDefaultWhatsappChannel();

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const currentStatus = channel.evolution_status;
  const isWorking = currentStatus === 'WORKING';
  const isAwaitingScan = currentStatus === 'SCAN_QR_CODE';
  // Handshake passa por SCAN_QR_CODE → STARTING → WORKING — precisa continuar
  // pollando durante o STARTING também, senão fica preso mostrando "Iniciando..."
  // pra sempre assim que sai do SCAN_QR_CODE (bug real, visto em produção).
  const isConnecting = isAwaitingScan || currentStatus === 'STARTING';

  useEffect(() => {
    if (!isConnecting) return;
    const interval = setInterval(() => {
      status.mutate(channel.id);
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnecting, channel.id]);

  useEffect(() => {
    if (isWorking) {
      setQrDataUrl(null);
      setPairingCode(null);
    }
  }, [isWorking]);

  const handleConnect = async () => {
    const result = await connect.mutateAsync(channel.id);
    setQrDataUrl(result.qr_data_url);
    setPairingCode(result.pairing_code);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquareText className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{channel.label || channel.evolution_instance_name}</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono truncate">{channel.evolution_instance_name}</p>
          </div>
        </div>
        <StatusBadge status={currentStatus} />
      </div>

      {!isWorking && (
        <div className="space-y-3">
          {qrDataUrl ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <img src={qrDataUrl} alt="QR code de conexão" className="w-48 h-48 rounded border border-border" />
              <p className="text-[11px] text-muted-foreground text-center">
                Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo, e escaneie.
              </p>
              {pairingCode && (
                <p className="text-[11px] text-muted-foreground">Ou use o código: <span className="font-mono">{pairingCode}</span></p>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[13px]"
              onClick={handleConnect}
              disabled={connect.isPending}
            >
              <QrCode className="h-3.5 w-3.5" strokeWidth={1.5} />
              {connect.isPending ? 'Gerando QR...' : 'Conectar (gerar QR)'}
            </Button>
          )}
        </div>
      )}

      {isWorking && channel.evolution_last_seen_at && (
        <p className="text-[12px] text-muted-foreground">
          Última verificação: {new Date(channel.evolution_last_seen_at).toLocaleString('pt-BR')}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Switch
          checked={channel.is_default}
          disabled={setDefault.isPending}
          onCheckedChange={(v) => setDefault.mutate({ channelId: channel.id, isDefault: v })}
        />
        <div>
          <span className="text-xs text-muted-foreground">Canal padrão</span>
          <p className="text-[10px] text-muted-foreground/40 leading-tight">
            Usado quando nenhum canal específico é resolvido. Só 1 canal — Meta ou Evolution — pode ser o padrão por vez.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-border">
        {isWorking && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-[13px] text-muted-foreground"
            onClick={() => logout.mutate(channel.id)}
            disabled={logout.isPending}
          >
            <Unplug className="h-3.5 w-3.5" strokeWidth={1.5} />
            Desconectar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-[13px] text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm(`Remover o canal "${channel.label || channel.evolution_instance_name}"? Isso apaga a configuração — vai precisar configurar de novo.`)) {
              remove.mutate(channel.id);
            }
          }}
          disabled={remove.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          Remover canal
        </Button>
      </div>
    </div>
  );
}

// ── Componente principal — lista de canais + adicionar novo ──────────────────

export default function EvolutionIntegrationConfig() {
  const { data: channels, isLoading } = useEvolutionChannels();
  const [addingNew, setAddingNew] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const hasChannels = (channels?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
        <p className="text-[12px] font-medium text-amber-600 dark:text-amber-400">WhatsApp não-oficial (Evolution API)</p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Conecta um número de WhatsApp real via QR code (sem aprovação da Meta, sem template, sem janela de 24h).
          Uma vez conectado, funciona pra <span className="font-medium text-foreground">todo o CRM</span> — igual ao canal Meta oficial. Requer um servidor Evolution API self-hosted já rodando.
          Você pode conectar mais de um número — cada canal é independente e pode ser escolhido por lead, campanha ou follow-up.
          Risco real: números automatizados por essa via podem ser banidos pelo WhatsApp.
        </p>
      </div>

      {channels?.map((channel) => (
        <EvolutionChannelCard key={channel.id} channel={channel} />
      ))}

      {addingNew ? (
        <NewEvolutionChannelForm onDone={() => setAddingNew(false)} />
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-[13px]"
          onClick={() => setAddingNew(true)}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          {hasChannels ? 'Adicionar outro canal' : 'Configurar canal Evolution'}
        </Button>
      )}

      {hasChannels && (
        <div className="pt-2 border-t border-border">
          <Suspense fallback={<div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
            <WhatsappTemplatesConfig provider="evolution" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
