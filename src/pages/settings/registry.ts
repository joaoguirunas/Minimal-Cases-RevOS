import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  Users,
  Users2,
  GitBranch,
  Clock,
  AlertCircle,
  Tag,
  Settings,
  MessageSquare,
  Target,
  Sparkles,
  ListPlus,
  Mail,
  Phone,
  Plug,
  BarChart3,
  Zap,
  MoreHorizontal,
  KeyRound,
  ShieldCheck,
  CalendarDays,
  Webhook,
  Palette,
  MessagesSquare,
} from 'lucide-react';

// Paths reserved for manual Routes (dynamic segments or standalone layout):
//   /settings/crm/aiagents/:id     → AgenteSingle
//   /settings/general/times/:teamId → TimeSingle
//   /settings/mfa-setup             → MfaSetup (no DashLayout)
//   /settings/mfa-recovery-regenerate → MfaRecoveryRegenerate (no DashLayout)

export type SettingsGroup = 'crmPro' | 'omniPro' | 'schedulePro' | 'geral';

export interface SettingsSection {
  id: string;
  group: SettingsGroup;
  titleKey: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  // All /settings/* paths that map to this section (canonical first)
  paths: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: LazyExoticComponent<any>;
  badgeKey?: string;
  // Width variant for main panel
  wide?: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  // ── CRM PRO™ ──────────────────────────────────────────────────────────────
  {
    id: 'pipelines',
    group: 'crmPro',
    titleKey: 'settings.sections.pipelines.title',
    icon: GitBranch,
    paths: ['/settings/crm/pipelines'],
    Component: lazy(() => import('@/components/config/PipelinesConfig')),
  },
  {
    id: 'motivos',
    group: 'crmPro',
    titleKey: 'settings.sections.lossReasons.title',
    icon: AlertCircle,
    paths: ['/settings/crm/motivos'],
    Component: lazy(() => import('@/components/config/MotivosConfig')),
  },
  {
    id: 'lead-types',
    group: 'crmPro',
    titleKey: 'Tipos de Lista',
    icon: Tag,
    paths: ['/settings/crm/lead-types'],
    Component: lazy(() => import('@/components/config/LeadTypesConfig')),
  },
  {
    id: 'tags',
    group: 'crmPro',
    titleKey: 'Tags',
    icon: Tag,
    paths: ['/settings/crm/tags'],
    Component: lazy(() => import('@/components/config/TagsConfig')),
  },
  {
    id: 'followups',
    group: 'crmPro',
    titleKey: 'settings.sections.followups.title',
    icon: Clock,
    paths: ['/settings/crm/followups'],
    Component: lazy(() => import('@/pages/Followups')),
  },
  {
    id: 'campos-extras',
    group: 'crmPro',
    titleKey: 'settings.sections.camposExtras.title',
    icon: ListPlus,
    paths: ['/settings/crm/campos-extras'],
    Component: lazy(() => import('@/components/config/CamposExtrasConfig')),
  },
  {
    id: 'score',
    group: 'crmPro',
    titleKey: 'settings.sections.score.title',
    icon: Target,
    paths: ['/settings/crm/score'],
    Component: lazy(() =>
      import('@/components/config/ScoreConfig').then((m) => ({ default: m.ScoreConfig }))
    ),
    wide: true,
  },
  {
    id: 'qualificacao-score',
    group: 'crmPro',
    titleKey: 'Qualificação e Score',
    icon: Target,
    paths: [
      '/settings/crm/qualificacao-score',
      '/settings/crm/motivos',       // legacy alias
      '/settings/crm/campos-extras', // legacy alias
      '/settings/crm/score',         // legacy alias
    ],
    Component: lazy(() => import('@/components/config/QualificacaoScoreConfig')),
    wide: true,
  },
  {
    id: 'agentes-ia',
    group: 'crmPro',
    titleKey: 'settings.sections.aiAgents.title',
    icon: Sparkles,
    // crm/aiagents (list); crm/aiagents/:id is reserved as manual Route
    paths: ['/settings/crm/aiagents'],
    Component: lazy(() => import('@/pages/AgentesIA')),
  },
  {
    id: 'conversoes',
    group: 'crmPro',
    titleKey: 'Conversões',
    icon: BarChart3,
    paths: ['/settings/crm/conversoes'],
    Component: lazy(() => import('@/components/config/ConversionTrackingConfig')),
    wide: true,
  },

  // ── OMNI PRO™ ─────────────────────────────────────────────────────────────
  {
    id: 'omni-whatsapp',
    group: 'omniPro',
    titleKey: 'WhatsApp & Meta',
    icon: MessagesSquare,
    paths: ['/settings/omni/whatsapp-meta'],
    Component: lazy(() => import('@/components/config/MetaIntegrationConfig')),
    wide: true,
  },
  {
    id: 'omni-email',
    group: 'omniPro',
    titleKey: 'settings.sections.omniEmail.title',
    icon: Mail,
    paths: ['/settings/omni/email'],
    Component: lazy(() => import('@/components/config/EmailMegaConfig')),
  },
  {
    id: 'omni-call',
    group: 'omniPro',
    titleKey: 'settings.sections.omniCall.title',
    icon: Phone,
    paths: [
      '/settings/omni/call',
      '/settings/call/config',   // legacy alias
    ],
    Component: lazy(() => import('@/components/config/CallMegaConfig')),
  },
  {
    id: 'omni-sms',
    group: 'omniPro',
    titleKey: 'settings.sections.omniSms.title',
    icon: MessageSquare,
    paths: ['/settings/omni/sms'],
    Component: lazy(() => import('@/components/config/SmsMegaConfig')),
  },
  {
    id: 'omni-geral',
    group: 'omniPro',
    titleKey: 'Geral',
    icon: Settings,
    paths: [
      '/settings/omni/geral',
      '/settings/omni/dedup',          // legacy alias
      '/settings/omni/whatsapp-log',   // legacy alias
    ],
    Component: lazy(() => import('@/components/config/OmniGeralConfig')),
  },

  // ── SCHEDULE PRO™ ─────────────────────────────────────────────────────────
  {
    id: 'schedule-distribuicao',
    group: 'schedulePro',
    titleKey: 'settings.sections.scheduleDistribuicao.title',
    icon: GitBranch,
    paths: ['/settings/schedule/distribuicao'],
    Component: lazy(() => import('@/components/config/horarios/BookingDistribuicaoConfig')),
  },
  {
    id: 'schedule-automacoes',
    group: 'schedulePro',
    titleKey: 'settings.sections.scheduleAutomacoes.title',
    icon: Zap,
    paths: ['/settings/schedule/automacoes'],
    Component: lazy(() => import('@/pages/ScheduleAutomacoes')),
  },
  {
    id: 'schedule-calendario',
    group: 'schedulePro',
    titleKey: 'Calendário',
    icon: CalendarDays,
    paths: ['/settings/schedule/calendario'],
    Component: lazy(() => import('@/components/config/horarios/ScheduleCalendarioConfig')),
  },

  // ── Geral ─────────────────────────────────────────────────────────────────
  {
    id: 'geral',
    group: 'geral',
    titleKey: 'settings.sections.general.title',
    icon: Settings,
    paths: [
      '/settings/general/config',
      '/settings/general/white-label',  // legacy alias
      '/settings/general/branding',     // legacy alias
    ],
    Component: lazy(() => import('@/components/config/GeralConfig')),
  },
  {
    id: 'usuarios',
    group: 'geral',
    titleKey: 'settings.sections.users.title',
    icon: Users,
    paths: ['/settings/general/usuarios'],
    Component: lazy(() => import('@/components/config/UsuariosConfig')),
    badgeKey: 'settings.badges.essential',
  },
  {
    id: 'times',
    group: 'geral',
    titleKey: 'settings.sections.teams.title',
    icon: Users2,
    paths: ['/settings/general/times'],
    // times/:teamId is reserved as manual Route → TimeSingle
    Component: lazy(() => import('@/components/config/TimesConfig')),
  },
  {
    id: 'usuarios-equipes',
    group: 'geral',
    titleKey: 'Usuários e Equipes',
    icon: Users2,
    paths: [
      '/settings/general/usuarios-equipes',
      '/settings/general/usuarios',    // alias → hub
      '/settings/general/times',       // alias → hub (times/:teamId stays as manual Route)
      '/settings/general/permissoes',  // alias → hub
    ],
    Component: lazy(() => import('@/components/config/UsuariosEquipesConfig')),
  },
  {
    id: 'integracoes',
    group: 'geral',
    titleKey: 'Integrações',
    icon: Plug,
    paths: [
      '/settings/general/integracoes',
      '/settings/general/ai-providers',
      '/settings/schedule/google',    // legacy alias
      '/settings/schedule/teams',     // legacy alias
      '/settings/bi/ads',             // legacy alias
      '/settings/lp/config',          // legacy alias
      '/settings/crm/elevenlabs',     // legacy alias
      '/settings/omni/whatsapp',      // legacy alias (P0-03 root cause)
      '/settings/omni/meta',          // legacy alias
      '/settings/omni/new-contact',   // legacy alias
    ],
    Component: lazy(() => import('@/components/config/IntegracoesConfig')),
    wide: true,
  },
  {
    id: 'api-keys',
    group: 'geral',
    titleKey: 'API Keys',
    icon: KeyRound,
    paths: ['/settings/general/api-keys'],
    Component: lazy(() => import('@/components/config/ApiKeysConfig')),
    wide: true,
  },
  {
    id: 'webhook-inbound',
    group: 'geral',
    titleKey: 'Webhook',
    icon: Webhook,
    paths: ['/settings/general/webhook-inbound'],
    Component: lazy(() => import('@/components/config/WebhookInboundConfig')),
    wide: true,
  },
  {
    id: 'design-system',
    group: 'geral',
    titleKey: 'Design System',
    icon: Palette,
    paths: ['/settings/general/design-system'],
    Component: lazy(() => import('@/components/config/DesignSystemRedirect')),
    wide: true,
  },
  {
    id: 'permissoes',
    group: 'geral',
    titleKey: 'Permissões',
    icon: ShieldCheck,
    paths: ['/settings/general/permissoes'],
    Component: lazy(() => import('@/components/config/PermissoesConfig')),
    wide: true,
  },
  {
    id: 'outros',
    group: 'geral',
    titleKey: 'Outros',
    icon: MoreHorizontal,
    paths: [
      '/settings/general/outros',
      '/settings/general/logs',         // legacy alias
      '/settings/general/documentacao', // legacy alias
      '/settings/general/brandbook',    // legacy alias (P0-04 root cause)
      '/settings/general/webhooks',     // legacy alias (P1-01 root cause)
    ],
    Component: lazy(() => import('@/components/config/OutrosConfig')),
    wide: true,
  },

  // ── Send ──────────────────────────────────────────────────────────────────
  // /settings/send/config was silently falling to 'geral' (P1-01); map explicitly.
  // No sidebar entry — accessed only via deep-link from CriarDisparo.
  // Using IntegracoesConfig as canonical target for send config (WhatsApp channels).
  {
    id: 'send-config',
    group: 'geral',
    titleKey: 'Send Config',
    icon: Plug,
    paths: ['/settings/send/config'],
    Component: lazy(() => import('@/components/config/IntegracoesConfig')),
    wide: true,
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export const SECTION_BY_ID = new Map(
  SETTINGS_SECTIONS.map((s) => [s.id, s])
);

export const SECTION_BY_PATH = new Map(
  SETTINGS_SECTIONS.flatMap((s) => s.paths.map((p) => [p, s]))
);

export const NAV_GROUPS: { key: SettingsGroup; label: string }[] = [
  { key: 'crmPro',      label: 'CRM PRO™' },
  { key: 'omniPro',     label: 'OMNI PRO™' },
  { key: 'schedulePro', label: 'SCHEDULE PRO™' },
  { key: 'geral',       label: 'Geral' },
];

// Sections to show in sidebar (all except hidden deep-link-only ones)
const SIDEBAR_HIDDEN_IDS = new Set([
  'send-config',
  'omni-whatsapp',
  'omni-email',
  'omni-call',
  'omni-sms',
  'lead-types',
  'motivos',
  'campos-extras',
  'score',
  'usuarios',
  'times',
  'design-system',
  'permissoes',
]);
export const SIDEBAR_SECTIONS = SETTINGS_SECTIONS.filter(
  (s) => !SIDEBAR_HIDDEN_IDS.has(s.id)
);
