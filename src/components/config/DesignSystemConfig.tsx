import { useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Check,
  X,
  AlertCircle,
  Info,
  Search,
  Plus,
  Trash2,
  Edit,
  Settings,
  ChevronRight,
  Upload,
  Save,
  Eye,
  Filter,
  Zap,
  Shield,
  Target,
  Layers,
  Sparkles,
} from "lucide-react";

const MarketingAssetsHub = lazy(() => import("./assets/MarketingAssetsHub"));

// ─── TOC definition ───────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: "brand",      label: "Brand" },
  { id: "cores",      label: "Cores" },
  { id: "tipografia", label: "Tipografia" },
  { id: "espacamento",label: "Espaçamento" },
  { id: "botoes",     label: "Botões" },
  { id: "badges",     label: "Badges" },
  { id: "forms",      label: "Formulários" },
  { id: "cards",      label: "Cards" },
  { id: "tabs",       label: "Tabs" },
  { id: "icones",     label: "Ícones" },
  { id: "estados",    label: "Estados" },
  { id: "padroes",    label: "Padrões UI" },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[10px] text-muted-foreground/40 tracking-tight">
    {children}
  </span>
);

const Rule = () => <div className="border-t border-border/20 my-10" />;

const Sec = ({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="scroll-mt-6">
    <div className="mb-7">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70 mb-1">
        {eyebrow}
      </p>
      <h2 className="text-[17px] font-semibold text-foreground leading-snug">{title}</h2>
      {description && (
        <p className="text-[13px] text-muted-foreground/60 mt-1 leading-relaxed max-w-lg">
          {description}
        </p>
      )}
    </div>
    <div>{children}</div>
  </section>
);

const Sub = ({ label }: { label: string }) => (
  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/35 mb-4 mt-8 first:mt-0">
    {label}
  </p>
);

// ─── Color swatch ─────────────────────────────────────────────────────────────

const Swatch = ({
  label,
  bg,
  token,
  hex,
  role,
}: {
  label: string;
  bg: string;
  token: string;
  hex?: string;
  role?: string;
}) => (
  <div className="flex-1 min-w-[88px] max-w-[120px]">
    <div
      className="h-14 rounded-[4px] ring-1 ring-black/[0.06] dark:ring-white/[0.06] mb-2.5"
      style={{ background: bg }}
    />
    <p className="text-[12px] font-medium text-foreground leading-snug">{label}</p>
    {role && <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">{role}</p>}
    <Mono>{token}</Mono>
    {hex && <><br /><Mono>{hex}</Mono></>}
  </div>
);

// ─── Typography row ───────────────────────────────────────────────────────────

const TypeRow = ({
  name,
  cls,
  token,
  sample,
}: {
  name: string;
  cls: string;
  token: string;
  sample: string;
}) => (
  <div className="grid grid-cols-[140px_1fr_160px] items-baseline gap-6 py-3.5 border-b border-border/15 last:border-0">
    <div>
      <p className="text-[11px] font-medium text-foreground">{name}</p>
      <Mono>{token}</Mono>
    </div>
    <p className={cn(cls, "text-foreground")}>{sample}</p>
    <Mono>{cls.split(" ").filter(c => c.startsWith("text-")).join(" ")}</Mono>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const DesignSystemConfig = () => {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [tabDemo, setTabDemo] = useState("tab1");

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveTab(id);
  };

  const TAB = 'h-9 rounded-none text-xs px-4 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground';

  return (
    <Tabs defaultValue="design-system" className="w-full">
      <TabsList className="h-9 bg-transparent p-0 gap-0 rounded-none border-b border-border w-full justify-start mb-8">
        <TabsTrigger value="design-system" className={TAB}>Design System</TabsTrigger>
        <TabsTrigger value="marketing-assets" className={TAB}>Marketing Assets</TabsTrigger>
      </TabsList>

      {/* ── Marketing Assets tab ─────────────────────────────────────────── */}
      <TabsContent value="marketing-assets">
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>}>
          <MarketingAssetsHub />
        </Suspense>
      </TabsContent>

      {/* ── Design System tab ────────────────────────────────────────────── */}
      <TabsContent value="design-system">
      <div className="pb-20">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-10 pb-8 border-b border-border/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70 mb-1.5">
            Growthsales
          </p>
          <h1 className="text-[22px] font-semibold text-foreground leading-tight">
            Design System
          </h1>
          <p className="text-[13px] text-muted-foreground/60 mt-2 max-w-md leading-relaxed">
            Referência canônica de identidade visual, tokens de design e componentes.
            Use como fonte única de verdade ao construir novas interfaces.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* BRAND */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="brand"
          eyebrow="Identidade"
          title="Brand"
          description="A essência visual e de comunicação do sistema."
        >

          {/* Brand mark */}
          <div className="flex items-center gap-8 mb-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[8px] bg-primary flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">Growthsales</p>
                <p className="text-[11px] text-muted-foreground/50">Platform</p>
              </div>
            </div>
            <div className="h-10 w-px bg-border/30" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[8px] bg-card border border-border flex items-center justify-center">
                <p className="text-[20px] font-bold text-foreground leading-none">G</p>
              </div>
              <p className="text-[11px] text-muted-foreground/50 max-w-[120px] leading-snug">
                Fallback quando sem logo configurada
              </p>
            </div>
          </div>

          {/* Brand attributes */}
          <Sub label="Personalidade da marca" />
          <div className="grid grid-cols-5 gap-3">
            {[
              { icon: Zap,      trait: "Ágil",       desc: "Rápido, sem fricção" },
              { icon: Shield,   trait: "Confiável",  desc: "Dados precisos" },
              { icon: Target,   trait: "Focado",     desc: "Clareza de propósito" },
              { icon: Layers,   trait: "Escalável",  desc: "Cresce com o negócio" },
              { icon: Sparkles, trait: "Inteligente",desc: "IA integrada" },
            ].map(({ icon: Icon, trait, desc }) => (
              <div key={trait} className="flex flex-col gap-2">
                <Icon className="w-4 h-4 text-primary/60" strokeWidth={1.5} />
                <p className="text-[12px] font-semibold text-foreground">{trait}</p>
                <p className="text-[11px] text-muted-foreground/50 leading-snug">{desc}</p>
              </div>
            ))}
          </div>

          {/* Brand voice */}
          <Sub label="Voz & Tom" />
          <div className="grid grid-cols-2 gap-x-12 gap-y-4 max-w-xl">
            {[
              { do: "Leads convertidos esta semana: 12", dont: "Foram realizadas 12 conversões" },
              { do: "Configure em 30 segundos", dont: "O processo de configuração pode ser efetuado" },
              { do: "Reunião confirmada", dont: "A reunião foi agendada com sucesso" },
              { do: "Algo deu errado. Tente novamente.", dont: "Ocorreu um erro inesperado no sistema" },
            ].map((ex, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <Check className="w-3 h-3 text-success mt-0.5 shrink-0" strokeWidth={2} />
                  <p className="text-[12px] text-foreground">{ex.do}</p>
                </div>
                <div className="flex items-start gap-2">
                  <X className="w-3 h-3 text-muted-foreground/30 mt-0.5 shrink-0" strokeWidth={2} />
                  <p className="text-[12px] text-muted-foreground/40 line-through">{ex.dont}</p>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* CORES */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="cores"
          eyebrow="Foundation"
          title="Sistema de Cores"
          description="Todos os tokens são CSS custom properties. Nunca use hex ou rgb hardcoded na UI."
        >
          <Sub label="Primária — Brand" />
          <div className="flex flex-wrap gap-5">
            <Swatch label="Primary" bg="hsl(var(--primary))" token="--primary" hex="#F26B36" role="CTA, active states" />
            <Swatch label="Primary Hover" bg="hsl(var(--primary-hover))" token="--primary-hover" hex="#F57F4F" role="Hover de CTA" />
            <Swatch label="Primary Fg" bg="hsl(var(--primary-foreground))" token="--primary-foreground" role="Texto sobre primary" />
          </div>

          <Sub label="Semânticas" />
          <div className="flex flex-wrap gap-5">
            <Swatch label="Success" bg="hsl(var(--success))" token="--success" hex="#16A34A" role="Confirmação, ganho" />
            <Swatch label="Warning" bg="hsl(var(--warning))" token="--warning" hex="#EAB308" role="Atenção, pendente" />
            <Swatch label="Destructive" bg="hsl(var(--destructive))" token="--destructive" hex="#F04844" role="Erro, exclusão" />
            <Swatch label="Accent" bg="hsl(var(--accent))" token="--accent" hex="#3B82F6" role="Info, links, novo" />
          </div>

          <Sub label="Superfície" />
          <div className="flex flex-wrap gap-5">
            <Swatch label="Background" bg="hsl(var(--background))" token="--background" role="Fundo da página" />
            <Swatch label="Card" bg="hsl(var(--card))" token="--card" role="Fundo de cards" />
            <Swatch label="Muted" bg="hsl(var(--muted))" token="--muted" role="Fundo sutil" />
            <Swatch label="Border" bg="hsl(var(--border))" token="--border" role="Bordas, dividers" />
            <Swatch label="Input" bg="hsl(var(--input))" token="--input" role="Fundo de inputs" />
          </div>

          <Sub label="Texto" />
          <div className="flex flex-wrap gap-5">
            <Swatch label="Foreground" bg="hsl(var(--foreground))" token="--foreground" role="Texto principal" />
            <Swatch label="Muted Fg" bg="hsl(var(--muted-foreground))" token="--muted-foreground" role="Texto secundário" />
          </div>

          <Sub label="BI / KPI Cards" />
          <div className="flex flex-wrap gap-5">
            <Swatch label="Stats Blue" bg="hsl(var(--stats-primary))" token="--stats-primary" role="Leads, pipeline" />
            <Swatch label="Stats Green" bg="hsl(var(--stats-secondary))" token="--stats-secondary" role="Ganhos, receita" />
            <Swatch label="Stats Purple" bg="hsl(var(--stats-tertiary))" token="--stats-tertiary" role="AI, agentes" />
            <Swatch label="Stats Orange" bg="hsl(var(--stats-quaternary))" token="--stats-quaternary" role="Disparos, sends" />
          </div>

          <Sub label="Cards Semânticos" />
          <div className="flex flex-wrap gap-5">
            <Swatch label="Info" bg="hsl(var(--card-info))" token="--card-info" role="Informação" />
            <Swatch label="Empresa" bg="hsl(var(--card-empresa))" token="--card-empresa" role="Contexto empresa" />
            <Swatch label="Financeiro" bg="hsl(var(--card-money))" token="--card-money" role="Valores, LTV" />
            <Swatch label="Resumo" bg="hsl(var(--card-summary))" token="--card-summary" role="Sumário, nota" />
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TIPOGRAFIA */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="tipografia"
          eyebrow="Foundation"
          title="Tipografia"
          description="Inter para corpo de texto. Outfit disponível para uso em marca/headings decorativos."
        >
          {/* Type scale */}
          <div className="mb-8">
            <TypeRow
              name="Display"
              cls="text-[28px] font-semibold leading-tight"
              token="Display / Hero"
              sample="Leads convertidos"
            />
            <TypeRow
              name="Page Title"
              cls="text-xl font-semibold"
              token="Header h1"
              sample="CRM PRO™"
            />
            <TypeRow
              name="Section Title"
              cls="text-[15px] font-semibold"
              token="Section heading"
              sample="Configurações Gerais"
            />
            <TypeRow
              name="Body Medium"
              cls="text-[13px] font-medium"
              token="Label, emphasis"
              sample="Nome da empresa"
            />
            <TypeRow
              name="Body"
              cls="text-[13px]"
              token="Body standard"
              sample="Texto principal de conteúdo e descrições de campo"
            />
            <TypeRow
              name="Description"
              cls="text-[13px] text-muted-foreground/70"
              token="Helper / description"
              sample="Configure informações da empresa, idioma e preferências"
            />
            <TypeRow
              name="Caption"
              cls="text-[12px] text-muted-foreground/60"
              token="Caption / meta"
              sample="Atualizado há 2 horas · João Silva"
            />
            <TypeRow
              name="Small"
              cls="text-[11px] text-muted-foreground/50"
              token="Hint / helper text"
              sample="Razão social ou nome fantasia registrado"
            />
            <TypeRow
              name="Micro"
              cls="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40"
              token="Nav group label"
              sample="CRM PRO™"
            />
          </div>

          {/* Weights */}
          <Sub label="Pesos" />
          <div className="flex gap-8">
            {[
              { w: "font-normal",   num: "400", s: "Regular" },
              { w: "font-medium",   num: "500", s: "Medium" },
              { w: "font-semibold", num: "600", s: "Semibold" },
              { w: "font-bold",     num: "700", s: "Bold" },
            ].map((f) => (
              <div key={f.w}>
                <p className={cn("text-[18px] text-foreground mb-1", f.w)}>{f.s}</p>
                <Mono>{f.w} · {f.num}</Mono>
              </div>
            ))}
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ESPAÇAMENTO */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="espacamento"
          eyebrow="Foundation"
          title="Espaçamento & Raio"
          description="Escala baseada em 4px. Border radius: rounded-[4px] para elementos, rounded-lg para containers."
        >
          <Sub label="Escala de espaçamento" />
          <div className="space-y-2">
            {[
              ["1",   "4px",  "gap-1, p-1 — micro"],
              ["1.5", "6px",  "gap-1.5 — itens compactos"],
              ["2",   "8px",  "p-2 — padding interno mínimo"],
              ["2.5", "10px", "gap-2.5 — espaço entre ícone e label"],
              ["3",   "12px", "px-3, py-3 — padding de button sm"],
              ["4",   "16px", "px-4, py-4 — padding padrão de card"],
              ["5",   "20px", "px-5 — padding de FieldRow"],
              ["6",   "24px", "p-6 — padding de página"],
              ["8",   "32px", "p-8 — padding de content area (settings)"],
              ["10",  "40px", "py-10 — separação de seções"],
            ].map(([token, px, note]) => (
              <div key={token} className="flex items-center gap-5">
                <span className="font-mono text-[10px] text-muted-foreground/40 w-8 text-right shrink-0">
                  {token}
                </span>
                <div
                  className="h-3.5 bg-primary/20 rounded-sm shrink-0"
                  style={{ width: px }}
                />
                <span className="font-mono text-[10px] text-muted-foreground/40 w-10 shrink-0">
                  {px}
                </span>
                <span className="text-[11px] text-muted-foreground/40">{note}</span>
              </div>
            ))}
          </div>

          <Sub label="Border radius" />
          <div className="flex flex-wrap items-end gap-7">
            {[
              { cls: "rounded-none",  label: "none",    use: "Dividers" },
              { cls: "rounded-[4px]", label: "[4px]",   use: "Botões, inputs, badges" },
              { cls: "rounded",       label: "4px",     use: "Tags, chips" },
              { cls: "rounded-md",    label: "6px",     use: "Dropdown items" },
              { cls: "rounded-lg",    label: "8px",     use: "Cards, modais" },
              { cls: "rounded-xl",    label: "12px",    use: "Painéis grandes" },
              { cls: "rounded-full",  label: "full",    use: "Badges, avatars" },
            ].map((r) => (
              <div key={r.label} className="flex flex-col items-center gap-2">
                <div className={cn("w-10 h-10 bg-primary/15 border border-primary/25", r.cls)} />
                <div className="text-center">
                  <Mono>{r.label}</Mono>
                  <p className="text-[10px] text-muted-foreground/35 mt-0.5">{r.use}</p>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* BOTÕES */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="botoes"
          eyebrow="Components"
          title="Botões"
          description="Hierarquia clara: default para ação principal, outline para secundária, ghost para terciária."
        >
          <Sub label="Variantes" />
          <div className="flex flex-wrap gap-2.5 items-center">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>

          <Sub label="Tamanhos" />
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col items-center gap-2">
              <Button size="sm">Small</Button>
              <Mono>h-8 · sm</Mono>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button>Default</Button>
              <Mono>h-9 · default</Mono>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button size="lg">Large</Button>
              <Mono>h-10 · lg</Mono>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button size="icon"><Settings className="w-4 h-4" /></Button>
              <Mono>icon</Mono>
            </div>
          </div>

          <Sub label="Com ícones" />
          <div className="flex flex-wrap gap-2.5 items-center">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />Novo
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />Upload
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />Salvar
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5">
              <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />Editar
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />Preview
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5">
              <Filter className="w-3.5 h-3.5" strokeWidth={1.5} />Filtros
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />Excluir
            </Button>
          </div>

          <Sub label="Estados" />
          <div className="flex flex-wrap gap-2.5 items-center">
            <Button disabled>Desabilitado</Button>
            <Button disabled className="gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />Salvando...
            </Button>
            <Button className="gap-1.5">
              <Check className="w-3.5 h-3.5" />Salvo
            </Button>
            <Button variant="ghost" className="text-muted-foreground/70">Cancelar</Button>
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* BADGES */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="badges"
          eyebrow="Components"
          title="Badges & Status"
          description="Rótulos, status e contagens. Semânticas customizadas com bg-{color}/10 text-{color}."
        >
          <Sub label="Variantes padrão" />
          <div className="flex flex-wrap gap-2 items-center">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>

          <Sub label="Semânticas" />
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>
            <Badge className="bg-warning/15 text-amber-700 dark:text-amber-400 border-warning/20">Pendente</Badge>
            <Badge className="bg-destructive/10 text-destructive border-destructive/20">Erro</Badge>
            <Badge className="bg-accent/10 text-accent border-accent/20">Novo</Badge>
            <Badge className="bg-muted text-muted-foreground border-border">Inativo</Badge>
            <Badge className="bg-primary/10 text-primary border-primary/20">Primary</Badge>
          </div>

          <Sub label="Nav badges (settings sidebar)" />
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-foreground">Item de menu</span>
            <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full leading-none">
              Popular
            </span>
            <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full leading-none">
              Novo
            </span>
            <span className="text-[10px] font-semibold bg-amber-400/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full leading-none">
              SOON
            </span>
          </div>

          <Sub label="Status dot" />
          <div className="flex gap-5 items-center">
            {[
              { color: "bg-success",              label: "Online" },
              { color: "bg-warning",              label: "Ausente" },
              { color: "bg-muted-foreground/30",  label: "Offline" },
              { color: "bg-destructive",          label: "Erro" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", color)} />
                <span className="text-[12px] text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* FORMULÁRIOS */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="forms"
          eyebrow="Components"
          title="Formulários"
          description="Input h-8 em configurações (settings), h-9 como padrão de página."
        >
          <Sub label="Input" />
          <div className="space-y-3 max-w-xs">
            {[
              { cls: "h-8 text-[13px]", label: "h-8 · settings" },
              { cls: "h-9 text-[13px]", label: "h-9 · default" },
            ].map((v) => (
              <div key={v.label} className="flex items-center gap-4">
                <Input className={cn(v.cls, "w-56")} placeholder="Placeholder..." />
                <Mono>{v.label}</Mono>
              </div>
            ))}
            <div className="flex items-center gap-4">
              <Input className="h-8 text-[13px] w-56" placeholder="Desabilitado" disabled />
              <Mono>disabled</Mono>
            </div>
          </div>

          <Sub label="Input com ícone" />
          <div className="relative w-56">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none"
              strokeWidth={1.5}
            />
            <Input className="h-8 text-[13px] pl-8" placeholder="Buscar..." />
          </div>

          <Sub label="Select" />
          <div className="flex flex-wrap gap-4">
            {[
              { cls: "h-8 text-[13px] w-52", label: "h-8 · settings" },
              { cls: "h-9 text-[13px] w-52", label: "h-9 · default" },
            ].map((v) => (
              <div key={v.label} className="flex flex-col gap-1.5">
                <Select defaultValue="op1">
                  <SelectTrigger className={v.cls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="op1">Opção 1</SelectItem>
                    <SelectItem value="op2">Opção 2</SelectItem>
                  </SelectContent>
                </Select>
                <Mono>{v.label}</Mono>
              </div>
            ))}
          </div>

          <Sub label="Textarea" />
          <div className="flex flex-col gap-1.5 max-w-xs">
            <Textarea className="text-[13px] resize-none w-64" placeholder="Texto longo..." rows={3} />
            <Mono>resize-none · rows=3</Mono>
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* CARDS */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="cards"
          eyebrow="Components"
          title="Cards & Superfícies"
          description="Quatro padrões de superfície usados no sistema, do mais neutro ao mais estruturado."
        >
          {/* 4 pattern grid */}
          <div className="grid grid-cols-2 gap-6 mb-8">

            {/* Pattern 1: Flat card */}
            <div>
              <p className="text-[11px] font-medium text-foreground mb-3">1 · Flat card</p>
              <div className="border border-border bg-card shadow-sm rounded-[4px] p-4 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Leads totais
                </p>
                <p className="text-2xl font-semibold text-foreground">1.247</p>
                <p className="text-[12px] text-success">+12% esta semana</p>
              </div>
              <Mono className="mt-2">border border-border bg-card shadow-sm rounded-[4px]</Mono>
            </div>

            {/* Pattern 2: Section card (FieldRow) */}
            <div>
              <p className="text-[11px] font-medium text-foreground mb-3">2 · Section card</p>
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-muted/30 border-b border-border/30">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                    Identificação
                  </p>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                  <p className="text-[13px] font-medium text-foreground">Empresa</p>
                  <Input className="h-8 text-[13px] w-36" placeholder="Acme Inc." />
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-[13px] font-medium text-foreground">Website</p>
                  <Input className="h-8 text-[13px] w-36" placeholder="https://..." />
                </div>
              </div>
              <Mono className="mt-2">border border-border/50 rounded-lg + SectionHeader</Mono>
            </div>

            {/* Pattern 3: Stat card (CSS vars) */}
            <div>
              <p className="text-[11px] font-medium text-foreground mb-3">3 · Stat card (BI)</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "Leads", v: "1.2k", bg: "--stats-primary", bd: "--stats-primary-border", tx: "--stats-primary-text" },
                  { l: "Ganhos", v: "87", bg: "--stats-secondary", bd: "--stats-secondary-border", tx: "--stats-secondary-text" },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-[4px] p-3"
                    style={{ background: `hsl(var(${s.bg}))`, border: `1px solid hsl(var(${s.bd}))` }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: `hsl(var(${s.tx}))` }}>{s.l}</p>
                    <p className="text-xl font-semibold" style={{ color: `hsl(var(${s.tx}))` }}>{s.v}</p>
                  </div>
                ))}
              </div>
              <Mono className="mt-2">--stats-{"{role}"} · --stats-{"{role}"}-border</Mono>
            </div>

            {/* Pattern 4: Muted box */}
            <div>
              <p className="text-[11px] font-medium text-foreground mb-3">4 · Muted box</p>
              <div className="bg-muted/30 rounded-[4px] border border-border/20 px-4 py-3">
                <p className="text-[13px] text-muted-foreground/70">
                  Nenhum item encontrado. Crie o primeiro para começar.
                </p>
              </div>
              <Mono className="mt-2">bg-muted/30 border border-border/20 rounded-[4px]</Mono>
            </div>
          </div>

          {/* List row */}
          <Sub label="List row — padrão de tabela" />
          <div className="border border-border/40 rounded-lg overflow-hidden max-w-md">
            {["João Silva", "Maria Santos", "Pedro Alves"].map((name, i) => (
              <div
                key={name}
                className={cn("flex items-center justify-between px-4 py-3", i < 2 && "border-b border-border/20")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/12 flex items-center justify-center text-[11px] font-semibold text-primary">
                    {name[0]}
                  </div>
                  <span className="text-[13px] font-medium text-foreground">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Gestor</Badge>
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground/40 hover:text-foreground">
                    <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TABS */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="tabs"
          eyebrow="Components"
          title="Navegação por Tabs"
          description="Padrão underline usado em páginas internas (AgenteSingle, NegocioSingle, ReuniaoSingle)."
        >
          <div className="border border-border/40 rounded-lg overflow-hidden max-w-lg">
            <Tabs value={tabDemo} onValueChange={setTabDemo}>
              <div className="border-b border-border/30 bg-card px-5">
                <TabsList className="h-9 bg-transparent p-0 gap-0 rounded-none">
                  {[
                    { v: "tab1", label: "Configurações" },
                    { v: "tab2", label: "Histórico" },
                    { v: "tab3", label: "Atividade" },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.v}
                      value={tab.v}
                      className="h-9 rounded-none text-xs px-4 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="p-5">
                <TabsContent value="tab1" className="mt-0">
                  <p className="text-[13px] text-muted-foreground/60">
                    Conteúdo da aba Configurações.
                  </p>
                </TabsContent>
                <TabsContent value="tab2" className="mt-0">
                  <p className="text-[13px] text-muted-foreground/60">
                    Conteúdo da aba Histórico.
                  </p>
                </TabsContent>
                <TabsContent value="tab3" className="mt-0">
                  <p className="text-[13px] text-muted-foreground/60">
                    Conteúdo da aba Atividade.
                  </p>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          <div className="mt-3">
            <Mono>border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent</Mono>
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ÍCONES */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="icones"
          eyebrow="Foundation"
          title="Ícones"
          description="lucide-react · strokeWidth={1.5} padrão. Tamanho varia por contexto de uso."
        >
          <div className="flex flex-wrap gap-8 items-end">
            {[
              { cls: "w-3 h-3",        label: "w-3",       use: "Micro" },
              { cls: "w-3.5 h-3.5",   label: "w-3.5",     use: "Button icons" },
              { cls: "w-4 h-4",        label: "w-4",       use: "Standard" },
              { cls: "w-[15px] h-[15px]", label: "w-[15px]", use: "Settings nav" },
              { cls: "w-[18px] h-[18px]", label: "w-[18px]", use: "Main nav" },
              { cls: "w-5 h-5",        label: "w-5",       use: "Header" },
              { cls: "w-6 h-6",        label: "w-6",       use: "Featured" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2.5">
                <div className="w-10 h-10 bg-muted/30 rounded-[4px] flex items-center justify-center">
                  <Settings className={s.cls} strokeWidth={1.5} />
                </div>
                <div className="text-center space-y-0.5">
                  <Mono>{s.label}</Mono>
                  <p className="text-[10px] text-muted-foreground/35 block">{s.use}</p>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ESTADOS */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="estados"
          eyebrow="Patterns"
          title="Estados do Sistema"
          description="Loading, vazio e feedback inline. Manter mensagens diretas e orientadas à ação."
        >
          <Sub label="Loading" />
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              <Mono>border-b-2 border-primary</Mono>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
              <Mono>Loader2 lucide</Mono>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground/60">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Carregando...
            </div>
          </div>

          <Sub label="Estado vazio" />
          <div className="flex flex-col items-center text-center py-8 max-w-xs">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Search className="w-4 h-4 text-muted-foreground/30" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-foreground">Nenhum resultado</p>
            <p className="text-[12px] text-muted-foreground/50 mt-1">
              Tente ajustar os filtros ou criar um novo item.
            </p>
            <Button size="sm" variant="outline" className="mt-4 gap-1.5">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />Criar novo
            </Button>
          </div>

          <Sub label="Feedback inline" />
          <div className="space-y-2 max-w-sm">
            {[
              { icon: Check,       color: "text-success",     bg: "bg-success/8 border-success/20",         msg: "Configurações salvas." },
              { icon: X,           color: "text-destructive", bg: "bg-destructive/8 border-destructive/20", msg: "Erro ao salvar. Tente novamente." },
              { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400",  bg: "bg-warning/10 border-warning/20", msg: "Ação irreversível. Confirme antes de continuar." },
              { icon: Info,        color: "text-muted-foreground/50", bg: "bg-muted/40 border-border/30",    msg: "Dica: configure webhooks em Integrações." },
            ].map(({ icon: Icon, color, bg, msg }) => (
              <div key={msg} className={cn("flex items-start gap-2 text-[12px] border rounded-[4px] px-3 py-2.5", bg)}>
                <Icon className={cn("w-3.5 h-3.5 mt-px shrink-0", color)} strokeWidth={1.5} />
                <span className="text-foreground/80">{msg}</span>
              </div>
            ))}
          </div>
        </Sec>

        <Rule />

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* PADRÕES UI */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Sec
          id="padroes"
          eyebrow="Patterns"
          title="Padrões de Interface"
          description="Componentes compostos e padrões recorrentes que devem ser replicados consistentemente."
        >
          <Sub label="Nav row (settings sidebar)" />
          <div className="border border-border/30 rounded-lg p-2 space-y-0.5 max-w-xs">
            {[
              { label: "Ativo",   active: true },
              { label: "Normal",  active: false },
              { label: "Normal",  active: false },
            ].map((item, i) => (
              <button
                key={i}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md text-[13px] tracking-[0.01em] h-8 px-3 transition-all",
                  item.active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/50"
                )}
              >
                <ChevronRight className="w-[15px] h-[15px] shrink-0" strokeWidth={1.5} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-2">
            <Mono>active: bg-accent text-accent-foreground · inactive: text-muted-foreground/70</Mono>
          </div>

          <Sub label="Dividers" />
          <div className="space-y-4 max-w-xs">
            {[
              { cls: "border-border/20", label: "border-border/20 · sutil (entre itens)" },
              { cls: "border-border/40", label: "border-border/40 · padrão" },
              { cls: "border-border/60", label: "border-border/60 · header/footer" },
              { cls: "border-border",    label: "border-border · primária" },
            ].map((d) => (
              <div key={d.label} className="space-y-1.5">
                <div className={cn("border-t w-full", d.cls)} />
                <Mono>{d.label}</Mono>
              </div>
            ))}
          </div>
        </Sec>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="mt-16 pt-6 border-t border-border/20 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/30">
            Design System · growthsales-app · CSS vars only · Inter
          </p>
          <p className="text-[11px] text-muted-foreground/30">
            v1.0 · Mar 2026
          </p>
        </div>

      </div>
      </TabsContent>
    </Tabs>
  );
};

export default DesignSystemConfig;
