import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MetaIntegrationConfig   = lazy(() => import('@/components/config/MetaIntegrationConfig'));
const TikTokIntegrationConfig = lazy(() => import('@/components/config/TikTokIntegrationConfig'));
const AdsConfig               = lazy(() => import('@/components/config/AdsConfig'));
const GoogleConfig            = lazy(() => import('@/components/config/GoogleConfig'));
const TeamsConfig             = lazy(() => import('@/components/config/TeamsConfig'));
const AIProvidersConfig       = lazy(() => import('@/components/config/AIProvidersConfig'));
const ElevenLabsConfig        = lazy(() => import('@/components/config/ElevenLabsConfig'));
const EmailMegaConfig         = lazy(() => import('@/components/config/EmailMegaConfig'));
const SmsMegaConfig           = lazy(() => import('@/components/config/SmsMegaConfig'));
const CallMegaConfig          = lazy(() => import('@/components/config/CallMegaConfig'));
const ManyChatIntegrationConfig = lazy(() => import('@/components/config/ManyChatIntegrationConfig'));
const KiwifyIntegrationConfig   = lazy(() => import('@/components/config/KiwifyIntegrationConfig'));
const YampiIntegrationConfig    = lazy(() => import('@/components/config/YampiIntegrationConfig'));
const ZoppyIntegrationConfig    = lazy(() => import('@/components/config/ZoppyIntegrationConfig'));
const FormProConfig             = lazy(() => import('@/components/config/FormProConfig'));
const EvolutionIntegrationConfig = lazy(() => import('@/components/config/EvolutionIntegrationConfig'));

// ── Integration card definitions ───────────────────────────────────────────────

type IntegrationId = 'meta' | 'meta-leads' | 'whatsapp-evolution' | 'tiktok' | 'manychat' | 'kiwify' | 'yampi' | 'zoppy' | 'google-ads' | 'google-cal' | 'teams' | 'ia' | 'elevenlabs' | 'email' | 'sms' | 'telefonia';

const INTEGRATIONS: {
  id: IntegrationId;
  name: string;
  description: string;
  logo: string;
  gcal?: boolean;
}[] = [
  {
    id: 'meta',
    name: 'Meta & WhatsApp',
    description: 'Mensagens, canais WABA, templates e Instagram DM',
    logo: '/logos/meta.png',
  },
  {
    id: 'meta-leads',
    name: 'Meta Lead Ads',
    description: 'Formulários de captura de leads do Facebook e Instagram Ads',
    logo: '/logos/meta.png',
  },
  {
    id: 'whatsapp-evolution',
    name: 'WhatsApp (não-oficial)',
    description: 'Conecta um número via QR code — sem template, sem janela de 24h',
    logo: '/logos/whatsapp.svg',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Lead Ads e anúncios do TikTok Business',
    logo: '/logos/tiktok.jpg',
  },
  {
    id: 'manychat',
    name: 'ManyChat',
    description: 'TikTok DM e Instagram DM via ManyChat',
    logo: '/logos/manychat.png',
  },
  {
    id: 'kiwify',
    name: 'Kiwify',
    description: 'Vendas, carrinho e assinaturas via webhook',
    logo: '/logos/kiwify.png',
  },
  {
    id: 'yampi',
    name: 'Yampi',
    description: 'Carrinho abandonado, Pix, pedidos e cupons da loja',
    logo: '/logos/yampi.png',
  },
  {
    id: 'zoppy',
    name: 'Zoppy',
    description: 'Importa a base antiga: clientes, pedidos e carrinhos',
    logo: '/logos/zoppy.png',
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    description: 'Lead Ads e contas de anúncio do Google',
    logo: '/logos/google-ads.jpg',
  },
  {
    id: 'google-cal',
    name: 'Google Calendar',
    description: 'Agendamentos e reuniões via Google Calendar',
    logo: '/logos/google-calendar.svg',
    gcal: true,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Reuniões e notificações via Microsoft Teams',
    logo: '/logos/microsoft-teams.jpg',
  },
  {
    id: 'ia',
    name: 'Provedores de IA',
    description: 'OpenAI, Anthropic e outros provedores de LLM',
    logo: '/logos/chatgpt.jpg',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Síntese de voz para agentes de atendimento',
    logo: '/logos/elevenlabs.png',
  },
  {
    id: 'email',
    name: 'E-mail',
    description: 'SMTP, SendGrid e automações de e-mail',
    logo: '/logos/email.png',
  },
  {
    id: 'sms',
    name: 'SMS',
    description: 'Envio de SMS via Twilio ou webhook',
    logo: '/logos/twilio.png',
  },
  {
    id: 'telefonia',
    name: 'Telefonia',
    description: 'Chamadas e voz via Twilio',
    logo: '/logos/twilio.png',
  },
];

// ── Integration logo (with initials fallback when the asset is missing) ────────

function IntegrationLogo({ logo, name, className }: { logo: string; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    const initials = (name.match(/[A-Z]/g)?.join('') || name.slice(0, 2)).slice(0, 2).toUpperCase();
    return (
      <span className={cn(className, 'flex items-center justify-center bg-muted text-[10px] font-bold text-muted-foreground')}>
        {initials}
      </span>
    );
  }
  return <img src={logo} alt={name} className={className} onError={() => setFailed(true)} />;
}

// ── Fallback ───────────────────────────────────────────────────────────────────

const Fallback = () => (
  <div className="min-h-[200px] flex items-center justify-center">
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
  </div>
);

// ── Detail wrapper with back button ───────────────────────────────────────────

function DetailView({ id, onBack }: { id: IntegrationId; onBack: () => void }) {
  const integration = INTEGRATIONS.find(i => i.id === id)!;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 px-2 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Integrações
        </Button>
        <div className="w-px h-4 bg-border" />
        {integration.gcal ? (
          <div className="bg-white rounded-md p-0.5 shrink-0">
            <img src={integration.logo} alt={integration.name} className="w-5 h-5 object-contain" />
          </div>
        ) : (
          <IntegrationLogo logo={integration.logo} name={integration.name} className="w-5 h-5 object-cover rounded" />
        )}
        <span className="text-[13px] font-medium text-foreground">{integration.name}</span>
      </div>

      <Suspense fallback={<Fallback />}>
        {id === 'meta'        && <MetaIntegrationConfig />}
        {id === 'meta-leads'  && <FormProConfig />}
        {id === 'whatsapp-evolution' && <EvolutionIntegrationConfig />}
        {id === 'tiktok'      && <TikTokIntegrationConfig />}
        {id === 'manychat'    && <ManyChatIntegrationConfig />}
        {id === 'kiwify'      && <KiwifyIntegrationConfig />}
        {id === 'yampi'       && <YampiIntegrationConfig />}
        {id === 'zoppy'       && <ZoppyIntegrationConfig />}
        {id === 'google-ads'  && <AdsConfig platform="google" />}
        {id === 'google-cal'  && <GoogleConfig />}
        {id === 'teams'       && <TeamsConfig />}
        {id === 'ia'          && <AIProvidersConfig />}
        {id === 'elevenlabs'  && <ElevenLabsConfig />}
        {id === 'email'       && <EmailMegaConfig />}
        {id === 'sms'         && <SmsMegaConfig />}
        {id === 'telefonia'   && <CallMegaConfig />}
      </Suspense>
    </div>
  );
}

// ── Grid ───────────────────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  onClick,
}: {
  integration: (typeof INTEGRATIONS)[number];
  onClick: () => void;
}) {
  const { logo, name, description, gcal } = integration;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-border bg-card p-5',
        'hover:border-foreground/20 hover:bg-accent/30 transition-colors cursor-pointer',
        'flex flex-col gap-0',
      )}
    >
      <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mb-4 shrink-0 overflow-hidden">
        {gcal ? (
          <div className="bg-white w-full h-full flex items-center justify-center p-1">
            <img src={logo} alt={name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <IntegrationLogo logo={logo} name={name} className="w-full h-full object-cover" />
        )}
      </div>
      <p className="text-sm font-medium text-foreground">{name}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Clique para configurar</span>
        <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground rotate-180" strokeWidth={1.5} />
      </div>
    </button>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

const INTEGRATION_IDS = new Set(INTEGRATIONS.map((i) => i.id));

// Redirects built elsewhere in the app (OAuth callbacks) use tab values that
// don't map 1:1 to an IntegrationId — alias them to the card that actually
// owns that flow instead of updating every call site.
const TAB_ALIASES: Record<string, IntegrationId> = {
  'meta-ads': 'meta',
};

function resolveTab(tabParam: string | null): IntegrationId | null {
  if (!tabParam) return null;
  if (INTEGRATION_IDS.has(tabParam as IntegrationId)) return tabParam as IntegrationId;
  return TAB_ALIASES[tabParam] ?? null;
}

export default function IntegracoesConfig() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<IntegrationId | null>(() => resolveTab(searchParams.get('tab')));

  const handleBack = () => {
    setSelected(null);
    if (searchParams.has('tab')) {
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  };

  if (selected) {
    return <DetailView id={selected} onBack={handleBack} />;
  }

  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground">Integrações</h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">
          Gerencie todas as conexões com serviços externos em um só lugar.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            onClick={() => setSelected(integration.id)}
          />
        ))}
      </div>
    </div>
  );
}
