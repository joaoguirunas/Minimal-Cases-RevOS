/**
 * Design System — interactive reference panel
 *
 * Live documentation of the REVOS CRM visual language: tokens, components,
 * spacing scale, iconography and page patterns. Purpose: a single place to
 * inspect / standardize the system's look before propagating changes.
 *
 * Route: /design-system (super_adm only)
 * Stack: React + TypeScript + Tailwind + shadcn/ui + lucide-react
 *
 * No new CSS introduced. Every example here renders using existing tokens
 * defined in src/index.css and tailwind.config.ts.
 */

import { useState, useMemo, type ReactNode, type ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Palette,
  Type,
  Component as ComponentIcon,
  LayoutGrid,
  Sparkles,
  FileCode2,
  Copy,
  Check,
  // Iconography demo set
  Home,
  Settings,
  Users,
  Mail,
  Phone,
  MessageSquare,
  MessageCircle,
  Search,
  Bell,
  Calendar,
  Clock,
  Star,
  Heart,
  Shield,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Minus,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Edit,
  Trash2,
  Save,
  Download,
  Upload,
  Filter,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Sun,
  Moon,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Flame,
  Rocket,
  // Page pattern icons
  Inbox,
  FolderOpen,
  FileText,
  PlusCircle,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════════════════
   PRIMITIVES — building blocks used across all tabs
   ═══════════════════════════════════════════════════════════════════════════ */

/** Section header inside a tab — title + descrição curta. */
function SectionHead({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[15px] font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-[12px] text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}

/** Card-like wrapper with the system's standard border/radius for grouping demos. */
function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[4px] border border-border bg-card p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Tiny monospace token label — used for `text-xs`, `--background`, etc. */
function Token({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[10px] text-muted-foreground bg-muted/40 border border-border/60 rounded-[2px] px-1.5 py-0.5">
      {children}
    </code>
  );
}

/** Copyable monospace value (CSS var, hex, class) with toast feedback. */
function CopyableValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`Copiado: ${value}`);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors group"
      aria-label={label ?? `Copiar ${value}`}
    >
      <span>{value}</span>
      {copied ? (
        <Check className="w-3 h-3 text-success" strokeWidth={2} />
      ) : (
        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: TIPOGRAFIA
   ═══════════════════════════════════════════════════════════════════════════ */

interface TypeStyle {
  name: string;
  classes: string;
  sample: string;
  family: string;
  weight: string;
  lineHeight: string;
  letterSpacing: string;
}

const TYPE_STYLES: TypeStyle[] = [
  {
    name: 'Display / H1',
    classes: 'text-[32px] font-bold tracking-[-0.025em]',
    sample: 'Pipeline de Vendas',
    family: 'Inter Tight',
    weight: '700',
    lineHeight: '1.1',
    letterSpacing: '-0.025em',
  },
  {
    name: 'Title Large / H2',
    classes: 'text-[24px] font-semibold tracking-[-0.015em]',
    sample: 'Negócios em aberto',
    family: 'Inter Tight',
    weight: '600',
    lineHeight: '1.2',
    letterSpacing: '-0.015em',
  },
  {
    name: 'Title Medium / H3',
    classes: 'text-[18px] font-semibold',
    sample: 'Configurações gerais',
    family: 'Inter Tight',
    weight: '600',
    lineHeight: '1.3',
    letterSpacing: '0',
  },
  {
    name: 'Title Small / H4',
    classes: 'text-[15px] font-semibold',
    sample: 'Dados do contato',
    family: 'Inter Tight',
    weight: '600',
    lineHeight: '1.35',
    letterSpacing: '0',
  },
  {
    name: 'Subtitle / H5',
    classes: 'text-[14px] font-medium',
    sample: 'Status atual',
    family: 'Inter Tight',
    weight: '500',
    lineHeight: '1.4',
    letterSpacing: '0',
  },
  {
    name: 'Label / H6',
    classes: 'text-[13px] font-medium',
    sample: 'Nome completo',
    family: 'Inter Tight',
    weight: '500',
    lineHeight: '1.45',
    letterSpacing: '0',
  },
  {
    name: 'Body',
    classes: 'text-[14px] font-normal',
    sample: 'O cliente confirmou a reunião para terça-feira às 14h.',
    family: 'Inter Tight',
    weight: '400',
    lineHeight: '1.5',
    letterSpacing: '0',
  },
  {
    name: 'Body Small',
    classes: 'text-[13px] font-normal',
    sample: 'Texto secundário usado em descrições e ajudas inline.',
    family: 'Inter Tight',
    weight: '400',
    lineHeight: '1.5',
    letterSpacing: '0',
  },
  {
    name: 'Caption',
    classes: 'text-[12px] font-medium uppercase tracking-[0.05em]',
    sample: 'METADADOS DA SEÇÃO',
    family: 'Inter Tight',
    weight: '500',
    lineHeight: '1.4',
    letterSpacing: '0.05em',
  },
  {
    name: 'Micro',
    classes: 'text-[11px] font-medium tracking-[0.025em]',
    sample: 'Atualizado há 3 min',
    family: 'Inter Tight',
    weight: '500',
    lineHeight: '1.4',
    letterSpacing: '0.025em',
  },
  {
    name: 'Mono',
    classes: 'font-mono text-[12px] font-normal',
    sample: 'const id = "neg_a1b2c3";',
    family: 'JetBrains Mono',
    weight: '400',
    lineHeight: '1.5',
    letterSpacing: '0',
  },
];

const TAILWIND_CLASS_REFERENCE = [
  { className: 'text-[32px]', usage: 'Títulos de página (H1)' },
  { className: 'text-[24px]', usage: 'Headers de seção (H2)' },
  { className: 'text-[18px]', usage: 'Subtítulos (H3)' },
  { className: 'text-[15px]', usage: 'Títulos de card / modal' },
  { className: 'text-[14px]', usage: 'Body padrão' },
  { className: 'text-[13px]', usage: 'Labels de formulário, body small' },
  { className: 'text-[12px]', usage: 'Captions, helper text' },
  { className: 'text-[11px]', usage: 'Micro text, metadados' },
  { className: 'text-[10px]', usage: 'Badges, tokens, mono refs' },
];

function TipografiaTab() {
  return (
    <div className="space-y-8">
      {/* Font stack */}
      <Surface>
        <SectionHead
          title="Font stack"
          description="Famílias carregadas globalmente via Google Fonts em src/index.css."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-[2px] border border-border bg-background p-4">
            <p className="text-[11px] text-muted-foreground mb-2">Sans (default)</p>
            <p style={{ fontFamily: 'Inter Tight, sans-serif' }} className="text-[24px] font-semibold">
              Inter Tight
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Pesos: 300 → 900. Usado em todo body, headings e UI.
            </p>
          </div>
          <div className="rounded-[2px] border border-border bg-background p-4">
            <p className="text-[11px] text-muted-foreground mb-2">Mono</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-[24px] font-semibold">
              JetBrains Mono
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Pesos: 400, 500, 600. Tokens, IDs, código inline, badges.
            </p>
          </div>
          <div className="rounded-[2px] border border-border bg-background p-4">
            <p className="text-[11px] text-muted-foreground mb-2">Display (Brandbook)</p>
            <p style={{ fontFamily: 'Fraunces, serif' }} className="text-[24px] font-semibold">
              Fraunces
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Variável (op-sz 9..144). Reservado a peças editoriais.
            </p>
          </div>
        </div>
      </Surface>

      {/* Type scale */}
      <Surface>
        <SectionHead
          title="Escala de tipografia"
          description="Hierarquia real do sistema. Click no token para copiar a classe."
        />
        <div className="divide-y divide-border">
          {TYPE_STYLES.map((style) => (
            <div
              key={style.name}
              className="py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-baseline"
            >
              <div className="lg:col-span-3">
                <p className="text-[12px] font-medium text-foreground">{style.name}</p>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  <CopyableValue value={style.classes} />
                </div>
              </div>
              <div className="lg:col-span-6">
                <p className={style.classes}>{style.sample}</p>
              </div>
              <div className="lg:col-span-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                <span className="text-muted-foreground/60">family</span>
                <span>{style.family}</span>
                <span className="text-muted-foreground/60">weight</span>
                <span>{style.weight}</span>
                <span className="text-muted-foreground/60">line-h</span>
                <span>{style.lineHeight}</span>
                <span className="text-muted-foreground/60">tracking</span>
                <span>{style.letterSpacing}</span>
              </div>
            </div>
          ))}
        </div>
      </Surface>

      {/* Paragraph example */}
      <Surface>
        <SectionHead
          title="Parágrafo de exemplo"
          description="Body text em diferentes tamanhos com line-height padrão (1.5)."
        />
        <div className="space-y-5 max-w-3xl">
          <div>
            <p className="text-[11px] text-muted-foreground mb-2 font-mono">text-[14px] · body</p>
            <p className="text-[14px] leading-relaxed text-foreground">
              O CRM REVOS centraliza pipelines, conversas omnichannel e agendamentos numa única
              superfície. Cada interação com lead é registrada em tempo real, mantendo o histórico
              completo disponível para qualquer membro da equipa.
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-2 font-mono">text-[13px] · body small</p>
            <p className="text-[13px] leading-relaxed text-foreground">
              O CRM REVOS centraliza pipelines, conversas omnichannel e agendamentos numa única
              superfície. Cada interação com lead é registrada em tempo real.
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-2 font-mono">text-[12px] · caption</p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Texto auxiliar usado em descrições secundárias, helper text de formulários e
              metadados de listagem.
            </p>
          </div>
        </div>
      </Surface>

      {/* Tailwind reference table */}
      <Surface>
        <SectionHead
          title="Classes Tailwind em uso"
          description="Tamanhos arbitrários adotados ao longo do código."
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Classe</TableHead>
              <TableHead>Uso recomendado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TAILWIND_CLASS_REFERENCE.map((row) => (
              <TableRow key={row.className}>
                <TableCell>
                  <CopyableValue value={row.className} />
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{row.usage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: CORES
   ═══════════════════════════════════════════════════════════════════════════ */

interface ColorToken {
  cssVar: string;
  twClass: string;
  hslDark: string;
  usage: string;
  textOn?: string;
}

const CORE_TOKENS: ColorToken[] = [
  { cssVar: '--background',          twClass: 'bg-background',          hslDark: '0 0% 4%',     usage: 'Fundo global da aplicação' },
  { cssVar: '--foreground',          twClass: 'text-foreground',        hslDark: '0 0% 96%',    usage: 'Texto principal' },
  { cssVar: '--card',                twClass: 'bg-card',                hslDark: '240 6% 7%',   usage: 'Superfície de cards e popovers' },
  { cssVar: '--card-foreground',     twClass: 'text-card-foreground',   hslDark: '0 0% 96%',    usage: 'Texto sobre card' },
  { cssVar: '--popover',             twClass: 'bg-popover',             hslDark: '240 6% 7%',   usage: 'Fundo de popovers/menus' },
  { cssVar: '--primary',             twClass: 'bg-primary',             hslDark: '11 100% 53%', usage: 'Ações primárias, links, CTA (Ember)' },
  { cssVar: '--primary-hover',       twClass: 'bg-primary-hover',       hslDark: '11 100% 60%', usage: 'Hover do primary' },
  { cssVar: '--primary-foreground',  twClass: 'text-primary-foreground',hslDark: '0 0% 100%',   usage: 'Texto sobre primary' },
  { cssVar: '--secondary',           twClass: 'bg-secondary',           hslDark: '240 5% 8%',   usage: 'Botões/superfícies secundárias' },
  { cssVar: '--muted',               twClass: 'bg-muted',               hslDark: '240 5% 8%',   usage: 'Fundos sutis, skeletons' },
  { cssVar: '--muted-foreground',    twClass: 'text-muted-foreground',  hslDark: '0 0% 55%',    usage: 'Texto auxiliar, captions' },
  { cssVar: '--accent',              twClass: 'bg-accent',              hslDark: '11 60% 18%',  usage: 'Hover sutil em itens de menu' },
  { cssVar: '--accent-foreground',   twClass: 'text-accent-foreground', hslDark: '11 90% 88%',  usage: 'Texto sobre accent' },
  { cssVar: '--border',              twClass: 'border-border',          hslDark: '0 0% 14%',    usage: 'Bordas padrão' },
  { cssVar: '--input',               twClass: 'border-input',           hslDark: '0 0% 8%',     usage: 'Borda de inputs' },
  { cssVar: '--ring',                twClass: 'ring-ring',              hslDark: '11 100% 53%', usage: 'Focus ring' },
];

const STATE_TOKENS: ColorToken[] = [
  { cssVar: '--success',     twClass: 'bg-success',     hslDark: '142 76% 36%',  usage: 'Confirmações, status OK' },
  { cssVar: '--warning',     twClass: 'bg-warning',     hslDark: '48 96% 53%',   usage: 'Atenção / pré-erro' },
  { cssVar: '--destructive', twClass: 'bg-destructive', hslDark: '0 84% 60%',    usage: 'Erros, ações destrutivas' },
  { cssVar: '--info',        twClass: 'bg-info',        hslDark: '11 100% 53%',  usage: 'Notificações neutras' },
];

const STATS_GROUPS = [
  { name: 'Stats Primary',     bg: '--stats-primary',     border: '--stats-primary-border',     text: '--stats-primary-text' },
  { name: 'Stats Secondary',   bg: '--stats-secondary',   border: '--stats-secondary-border',   text: '--stats-secondary-text' },
  { name: 'Stats Tertiary',    bg: '--stats-tertiary',    border: '--stats-tertiary-border',    text: '--stats-tertiary-text' },
  { name: 'Stats Quaternary',  bg: '--stats-quaternary',  border: '--stats-quaternary-border',  text: '--stats-quaternary-text' },
];

const CARD_VARIANTS = [
  { name: 'Info',     bg: '--card-info',     border: '--card-info-border',     text: '--card-info-text' },
  { name: 'Empresa',  bg: '--card-empresa',  border: '--card-empresa-border',  text: '--card-empresa-text' },
  { name: 'Money',    bg: '--card-money',    border: '--card-money-border',    text: '--card-money-text' },
  { name: 'Summary',  bg: '--card-summary',  border: '--card-summary-border',  text: '--card-summary-text' },
];

function ColorSwatch({ token }: { token: ColorToken }) {
  return (
    <div className="rounded-[2px] border border-border overflow-hidden flex flex-col">
      <div
        className="h-16 w-full"
        style={{ backgroundColor: `hsl(${token.hslDark})` }}
        aria-hidden="true"
      />
      <div className="p-3 bg-card space-y-1.5">
        <p className="text-[11px] font-semibold text-foreground">{token.cssVar}</p>
        <CopyableValue value={token.twClass} />
        <p className="text-[10px] font-mono text-muted-foreground/60">hsl({token.hslDark})</p>
        <p className="text-[10px] text-muted-foreground leading-snug">{token.usage}</p>
      </div>
    </div>
  );
}

function CoresTab() {
  return (
    <div className="space-y-8">
      <Surface>
        <SectionHead
          title="Tokens semânticos (core)"
          description="Tokens principais que dirigem toda a UI. Modo dark é o default."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CORE_TOKENS.map((t) => (
            <ColorSwatch key={t.cssVar} token={t} />
          ))}
        </div>
      </Surface>

      <Surface>
        <SectionHead
          title="Cores de estado"
          description="Comunicam intenção semântica em mensagens e indicadores."
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATE_TOKENS.map((t) => (
            <ColorSwatch key={t.cssVar} token={t} />
          ))}
        </div>
      </Surface>

      <Surface>
        <SectionHead
          title="Stats palettes"
          description="Usados em cards de métrica e dashboards (4 famílias rotativas)."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {STATS_GROUPS.map((g) => (
            <div
              key={g.name}
              className="rounded-[4px] p-4 border"
              style={{
                backgroundColor: `hsl(var(${g.bg}))`,
                borderColor: `hsl(var(${g.border}))`,
                color: `hsl(var(${g.text}))`,
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{g.name}</p>
              <p className="text-[24px] font-bold mt-1">R$ 42.8k</p>
              <p className="text-[11px] opacity-70 mt-1">+12% vs último mês</p>
              <div className="mt-3 space-y-0.5">
                <CopyableValue value={g.bg} />
                <CopyableValue value={g.border} />
                <CopyableValue value={g.text} />
              </div>
            </div>
          ))}
        </div>
      </Surface>

      <Surface>
        <SectionHead
          title="Card variants (info / empresa / money / summary)"
          description="Variantes coloridas para cards informativos contextuais."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {CARD_VARIANTS.map((g) => (
            <div
              key={g.name}
              className="rounded-[4px] p-4 border"
              style={{
                backgroundColor: `hsl(var(${g.bg}))`,
                borderColor: `hsl(var(${g.border}))`,
                color: `hsl(var(${g.text}))`,
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{g.name}</p>
              <p className="text-[15px] font-semibold mt-2">Conteúdo de exemplo</p>
              <div className="mt-3 space-y-0.5">
                <CopyableValue value={g.bg} />
                <CopyableValue value={g.border} />
                <CopyableValue value={g.text} />
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: COMPONENTES
   ═══════════════════════════════════════════════════════════════════════════ */

function DemoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 py-4 border-b border-border last:border-b-0">
      <p className="text-[12px] font-medium text-muted-foreground pt-1">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ComponentesTab() {
  const [selectValue, setSelectValue] = useState('option-1');
  const [radioValue, setRadioValue] = useState('a');
  const [switchOn, setSwitchOn] = useState(true);
  const [checked, setChecked] = useState<boolean | 'indeterminate'>(true);

  return (
    <div className="space-y-8">
      {/* Buttons */}
      <Surface>
        <SectionHead
          title="Botões"
          description="Altura padrão h-[30px], radius rounded-[4px], texto text-xs."
        />
        <DemoRow label="Variantes">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </DemoRow>
        <DemoRow label="Tamanhos">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button size="default">default</Button>
          <Button size="lg">lg</Button>
          <Button size="icon" aria-label="Icon button">
            <Plus />
          </Button>
        </DemoRow>
        <DemoRow label="Com ícone">
          <Button>
            <Plus /> Criar negócio
          </Button>
          <Button variant="outline">
            <Download /> Exportar
          </Button>
          <Button variant="destructive">
            <Trash2 /> Excluir
          </Button>
        </DemoRow>
        <DemoRow label="Estados">
          <Button disabled>Disabled</Button>
          <Button>
            <Loader2 className="animate-spin" /> Carregando
          </Button>
        </DemoRow>
      </Surface>

      {/* Inputs */}
      <Surface>
        <SectionHead
          title="Inputs"
          description="Altura h-[30px], radius rounded-[2px], texto text-xs."
        />
        <DemoRow label="Default">
          <Input placeholder="Nome do contato" className="max-w-xs" />
        </DemoRow>
        <DemoRow label="Com label">
          <div className="space-y-1.5 max-w-xs w-full">
            <Label className="text-[12px]">Email</Label>
            <Input type="email" placeholder="seu@email.com" />
          </div>
        </DemoRow>
        <DemoRow label="Com ícone">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
            <Input placeholder="Buscar..." className="pl-8" />
          </div>
        </DemoRow>
        <DemoRow label="Erro">
          <div className="space-y-1.5 max-w-xs w-full">
            <Input
              placeholder="CPF inválido"
              className="border-destructive focus-visible:ring-destructive"
              defaultValue="000.000.000-00"
            />
            <p className="text-[11px] text-destructive">CPF não confere com os dados do contato.</p>
          </div>
        </DemoRow>
        <DemoRow label="Disabled">
          <Input placeholder="Campo travado" disabled className="max-w-xs" defaultValue="ID gerado automaticamente" />
        </DemoRow>
        <DemoRow label="Textarea">
          <Textarea placeholder="Notas sobre o lead..." className="max-w-md min-h-[80px]" />
        </DemoRow>
      </Surface>

      {/* Badges */}
      <Surface>
        <SectionHead
          title="Badges"
          description="Pílulas semânticas para status, contadores e tags."
        />
        <DemoRow label="Variantes">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </DemoRow>
        <DemoRow label="Status comuns">
          <Badge className="bg-success text-success-foreground border-transparent">Ativo</Badge>
          <Badge className="bg-warning text-warning-foreground border-transparent">Pendente</Badge>
          <Badge className="bg-destructive text-destructive-foreground border-transparent">Falha</Badge>
          <Badge variant="outline" className="text-muted-foreground">Arquivado</Badge>
        </DemoRow>
        <DemoRow label="Com contador">
          <Badge variant="secondary">12 leads</Badge>
          <Badge>3 novos</Badge>
        </DemoRow>
      </Surface>

      {/* Selects, checkboxes, switches, radios */}
      <Surface>
        <SectionHead title="Controles de formulário" />
        <DemoRow label="Select">
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger className="max-w-[220px] h-[30px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option-1">Pipeline padrão</SelectItem>
              <SelectItem value="option-2">Pipeline de retenção</SelectItem>
              <SelectItem value="option-3">Pipeline de upsell</SelectItem>
            </SelectContent>
          </Select>
        </DemoRow>
        <DemoRow label="Checkbox">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ds-cb"
              checked={checked}
              onCheckedChange={(v) => setChecked(v)}
            />
            <Label htmlFor="ds-cb" className="text-[12px] cursor-pointer">
              Notificar responsável
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ds-cb-disabled" disabled />
            <Label htmlFor="ds-cb-disabled" className="text-[12px] text-muted-foreground">
              Disabled
            </Label>
          </div>
        </DemoRow>
        <DemoRow label="Switch">
          <div className="flex items-center gap-2">
            <Switch id="ds-sw" checked={switchOn} onCheckedChange={setSwitchOn} />
            <Label htmlFor="ds-sw" className="text-[12px] cursor-pointer">
              Habilitar agente IA
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ds-sw-off" disabled />
            <Label htmlFor="ds-sw-off" className="text-[12px] text-muted-foreground">
              Disabled
            </Label>
          </div>
        </DemoRow>
        <DemoRow label="Radio group">
          <RadioGroup value={radioValue} onValueChange={setRadioValue} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="a" id="ds-r-a" />
              <Label htmlFor="ds-r-a" className="text-[12px] cursor-pointer">Round-robin</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="b" id="ds-r-b" />
              <Label htmlFor="ds-r-b" className="text-[12px] cursor-pointer">Carga balanceada</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="c" id="ds-r-c" />
              <Label htmlFor="ds-r-c" className="text-[12px] cursor-pointer">Manual</Label>
            </div>
          </RadioGroup>
        </DemoRow>
      </Surface>

      {/* Cards */}
      <Surface>
        <SectionHead title="Cards" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-border p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Card simples</p>
            <p className="text-[24px] font-bold mt-2">R$ 12.450</p>
            <p className="text-[12px] text-muted-foreground mt-1">Receita mensal</p>
          </Card>
          <Card className="border-0 p-5 bg-muted/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sem borda</p>
            <p className="text-[24px] font-bold mt-2">128</p>
            <p className="text-[12px] text-muted-foreground mt-1">Negócios ativos</p>
          </Card>
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-[15px]">Card composto</CardTitle>
              <CardDescription className="text-[12px]">Header + content + footer.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[13px]">Usar quando há ações no footer ou múltiplas seções.</p>
            </CardContent>
            <CardFooter>
              <Button size="xs" variant="outline">Ver detalhes</Button>
            </CardFooter>
          </Card>
        </div>
      </Surface>

      {/* Alerts / Toasts */}
      <Surface>
        <SectionHead
          title="Alertas e toasts"
          description="Alerts inline para mensagens persistentes; toasts via sonner para feedback transiente."
        />
        <div className="space-y-3 mb-5">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>Alert default — informações neutras inline.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de validação</AlertTitle>
            <AlertDescription>Variant destructive — usar para falhas críticas.</AlertDescription>
          </Alert>
        </div>
        <DemoRow label="Toasts (sonner)">
          <Button size="sm" variant="outline" onClick={() => toast.success('Salvo com sucesso')}>
            Success
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.error('Falha ao salvar')}>
            Error
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.info('Sincronizando dados...')}>
            Info
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.warning('Verifique o formato')}>
            Warning
          </Button>
        </DemoRow>
      </Surface>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: LAYOUT & GRID
   ═══════════════════════════════════════════════════════════════════════════ */

const SPACING_SCALE = [
  { token: 'p-1',  px: '4px' },
  { token: 'p-2',  px: '8px' },
  { token: 'p-3',  px: '12px' },
  { token: 'p-4',  px: '16px' },
  { token: 'p-5',  px: '20px' },
  { token: 'p-6',  px: '24px' },
  { token: 'p-8',  px: '32px' },
  { token: 'p-10', px: '40px' },
  { token: 'p-12', px: '48px' },
];

const RADIUS_SCALE = [
  { token: 'rounded-[2px]', usage: 'Cards, popovers, badges, inputs' },
  { token: 'rounded-[3px]', usage: 'Triggers de sub-tabs internos' },
  { token: 'rounded-[4px]', usage: 'Botões, surfaces destacadas' },
  { token: 'rounded-[6px]', usage: 'Containers ocasionais' },
  { token: 'rounded-md',    usage: 'shadcn default (calc(--radius) - 2px)' },
  { token: 'rounded-full',  usage: 'Avatares, pílulas, dots' },
];

const SHADOW_SCALE = [
  { token: 'shadow-none',    sample: 'shadow-none'    },
  { token: 'shadow-sm',      sample: 'shadow-sm'      },
  { token: 'shadow',         sample: 'shadow'         },
  { token: 'shadow-md',      sample: 'shadow-md'      },
  { token: 'shadow-lg',      sample: 'shadow-lg'      },
  { token: 'shadow-elegant', sample: 'shadow-elegant' },
];

function LayoutTab() {
  return (
    <div className="space-y-8">
      {/* Sidebar layout sketch */}
      <Surface>
        <SectionHead
          title="Layout de Dashboard"
          description="Estrutura usada pelo DashLayout: sidebar fixa + área de conteúdo."
        />
        <div className="rounded-[4px] border border-border overflow-hidden h-[320px] grid grid-cols-[200px_1fr]">
          <div className="bg-sidebar border-r border-sidebar-border p-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
              Sidebar
            </p>
            {['Dashboard', 'Negócios', 'Conversas', 'Configurações'].map((label, i) => (
              <div
                key={label}
                className={cn(
                  'flex items-center gap-2 rounded-[2px] px-2 py-1.5 text-[12px] transition-colors',
                  i === 1
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40',
                )}
              >
                <span className="w-1 h-1 rounded-full bg-current opacity-60" />
                {label}
              </div>
            ))}
          </div>
          <div className="bg-background p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[15px] font-semibold">Área de conteúdo</p>
                <p className="text-[11px] text-muted-foreground">Padding consistente p-6 / p-8</p>
              </div>
              <Button size="xs">
                <Plus /> Ação
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-[2px] border border-border bg-muted/30" />
              ))}
            </div>
          </div>
        </div>
      </Surface>

      {/* Spacing scale */}
      <Surface>
        <SectionHead
          title="Escala de espaçamento"
          description="Valores em uso ao longo do sistema (Tailwind default: 1 unit = 4px)."
        />
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {SPACING_SCALE.map((s) => (
            <div key={s.token} className="flex flex-col items-center gap-2">
              <div className="bg-muted/40 rounded-[2px] flex items-center justify-center">
                <div className={cn('bg-primary/80 rounded-[2px]', s.token)}>
                  <div className="w-1 h-1" />
                </div>
              </div>
              <CopyableValue value={s.token} />
              <p className="text-[10px] text-muted-foreground/70">{s.px}</p>
            </div>
          ))}
        </div>
      </Surface>

      {/* Border radius */}
      <Surface>
        <SectionHead title="Border radius" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {RADIUS_SCALE.map((r) => (
            <div
              key={r.token}
              className="flex flex-col items-center gap-2 p-3 border border-border rounded-[2px] bg-background"
            >
              <div className={cn('w-16 h-16 bg-primary/80', r.token)} />
              <CopyableValue value={r.token} />
              <p className="text-[10px] text-center text-muted-foreground/70 leading-tight">
                {r.usage}
              </p>
            </div>
          ))}
        </div>
      </Surface>

      {/* Shadows */}
      <Surface>
        <SectionHead title="Sombras" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {SHADOW_SCALE.map((s) => (
            <div key={s.token} className="flex flex-col items-center gap-2">
              <div className={cn('w-20 h-20 rounded-[2px] bg-card border border-border', s.sample)} />
              <CopyableValue value={s.token} />
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: ICONOGRAFIA
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconEntry {
  name: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

const ICON_LIBRARY: IconEntry[] = [
  { name: 'Home', Icon: Home },
  { name: 'Settings', Icon: Settings },
  { name: 'Users', Icon: Users },
  { name: 'Mail', Icon: Mail },
  { name: 'Phone', Icon: Phone },
  { name: 'MessageSquare', Icon: MessageSquare },
  { name: 'MessageCircle', Icon: MessageCircle },
  { name: 'Search', Icon: Search },
  { name: 'Bell', Icon: Bell },
  { name: 'Calendar', Icon: Calendar },
  { name: 'Clock', Icon: Clock },
  { name: 'Star', Icon: Star },
  { name: 'Heart', Icon: Heart },
  { name: 'Shield', Icon: Shield },
  { name: 'Eye', Icon: Eye },
  { name: 'EyeOff', Icon: EyeOff },
  { name: 'Lock', Icon: Lock },
  { name: 'Unlock', Icon: Unlock },
  { name: 'Plus', Icon: Plus },
  { name: 'Minus', Icon: Minus },
  { name: 'X', Icon: X },
  { name: 'ChevronRight', Icon: ChevronRight },
  { name: 'ChevronLeft', Icon: ChevronLeft },
  { name: 'ChevronDown', Icon: ChevronDown },
  { name: 'ChevronUp', Icon: ChevronUp },
  { name: 'ArrowRight', Icon: ArrowRight },
  { name: 'ArrowLeft', Icon: ArrowLeft },
  { name: 'Edit', Icon: Edit },
  { name: 'Trash2', Icon: Trash2 },
  { name: 'Save', Icon: Save },
  { name: 'Download', Icon: Download },
  { name: 'Upload', Icon: Upload },
  { name: 'Filter', Icon: Filter },
  { name: 'RefreshCw', Icon: RefreshCw },
  { name: 'AlertCircle', Icon: AlertCircle },
  { name: 'AlertTriangle', Icon: AlertTriangle },
  { name: 'Info', Icon: Info },
  { name: 'CheckCircle2', Icon: CheckCircle2 },
  { name: 'XCircle', Icon: XCircle },
  { name: 'Loader2', Icon: Loader2 },
  { name: 'Sun', Icon: Sun },
  { name: 'Moon', Icon: Moon },
  { name: 'Zap', Icon: Zap },
  { name: 'TrendingUp', Icon: TrendingUp },
  { name: 'TrendingDown', Icon: TrendingDown },
  { name: 'BarChart3', Icon: BarChart3 },
  { name: 'PieChart', Icon: PieChart },
  { name: 'Activity', Icon: Activity },
  { name: 'Target', Icon: Target },
  { name: 'Flame', Icon: Flame },
  { name: 'Rocket', Icon: Rocket },
];

const ICON_SIZES = [
  { className: 'w-3 h-3',   usage: 'Badges, inline indicators' },
  { className: 'w-3.5 h-3.5', usage: 'Inputs com ícone, helper inline' },
  { className: 'w-4 h-4',   usage: 'Botões padrão, ações' },
  { className: 'w-5 h-5',   usage: 'Nav items, cards' },
  { className: 'w-6 h-6',   usage: 'Headers, destaques' },
];

function IconografiaTab() {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(
    () =>
      ICON_LIBRARY.filter((i) =>
        i.name.toLowerCase().includes(filter.trim().toLowerCase()),
      ),
    [filter],
  );

  return (
    <div className="space-y-8">
      <Surface>
        <SectionHead
          title="lucide-react"
          description="Biblioteca padrão de ícones. strokeWidth padrão recomendado: 1.5."
        />
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6">
          {ICON_SIZES.map((s) => (
            <div key={s.className} className="rounded-[2px] border border-border bg-background p-3 flex flex-col items-center gap-2">
              <Home className={s.className} strokeWidth={1.5} />
              <CopyableValue value={s.className} />
              <p className="text-[10px] text-center text-muted-foreground/70 leading-tight">{s.usage}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] text-muted-foreground">
            {filtered.length} ícone{filtered.length === 1 ? '' : 's'}
          </p>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder="Filtrar ícones..."
              className="pl-8"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {filtered.map(({ name, Icon }) => (
            <TooltipProvider key={name} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-[2px] border border-border bg-background hover:bg-muted/40 hover:border-border transition-colors group"
                    onClick={() => {
                      navigator.clipboard.writeText(`<${name} className="w-4 h-4" strokeWidth={1.5} />`);
                      toast.success(`Copiado: <${name} />`);
                    }}
                  >
                    <Icon className="w-5 h-5 text-foreground/70 group-hover:text-foreground transition-colors" strokeWidth={1.5} />
                    <span className="text-[10px] font-mono text-muted-foreground/70 truncate w-full text-center">
                      {name}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[11px]">Clique para copiar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </Surface>

      <Surface>
        <SectionHead
          title="Stroke widths"
          description="Padronizado em 1.5 para ícones de UI; 2 apenas em casos de destaque."
        />
        <div className="flex flex-wrap items-center gap-6">
          {[1, 1.25, 1.5, 1.75, 2].map((sw) => (
            <div key={sw} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-[2px] border border-border bg-background flex items-center justify-center">
                <Home className="w-7 h-7" strokeWidth={sw} />
              </div>
              <CopyableValue value={`strokeWidth={${sw}}`} />
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB: PADRÕES DE PÁGINA
   ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_NEGOCIOS = [
  { id: 'NEG-001', cliente: 'Acme Corp',       valor: 'R$ 12.500', stage: 'Proposta', updated: '2h' },
  { id: 'NEG-002', cliente: 'Globex SA',       valor: 'R$ 8.900',  stage: 'Negociação', updated: '5h' },
  { id: 'NEG-003', cliente: 'Initech Ltda',    valor: 'R$ 42.000', stage: 'Fechado',   updated: '1d' },
  { id: 'NEG-004', cliente: 'Hooli Brasil',    valor: 'R$ 3.250',  stage: 'Qualificação', updated: '3d' },
  { id: 'NEG-005', cliente: 'Stark Industries',valor: 'R$ 78.000', stage: 'Proposta', updated: '1w' },
];

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    Qualificação: 'bg-muted text-muted-foreground border-border',
    Proposta:     'bg-warning/10 text-warning border-warning/30',
    Negociação:   'bg-primary/10 text-primary border-primary/30',
    Fechado:      'bg-success/10 text-success border-success/30',
  };
  return (
    <Badge variant="outline" className={cn('border', map[stage] ?? 'border-border')}>
      {stage}
    </Badge>
  );
}

function PadroesTab() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <Surface>
        <SectionHead
          title="Header de página/seção"
          description="Título + descrição + ações à direita. Padrão para topo de qualquer view."
        />
        <div className="border border-border rounded-[4px] bg-background">
          <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
                Negócios em aberto
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Pipeline principal · 24 negócios totalizando R$ 312.4k
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm">
                <Filter /> Filtros
              </Button>
              <Button size="sm">
                <Plus /> Novo negócio
              </Button>
            </div>
          </div>
          <div className="p-5 text-[12px] text-muted-foreground">
            <em>(área de conteúdo)</em>
          </div>
        </div>
      </Surface>

      {/* Empty state */}
      <Surface>
        <SectionHead
          title="Empty state"
          description="Exibido quando uma listagem ou seção não tem dados."
        />
        <div className="border border-dashed border-border rounded-[4px] bg-background p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
            <Inbox className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground">Nenhum negócio ainda</h3>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-sm">
            Quando você criar um negócio, ele aparecerá aqui. Comece adicionando o primeiro.
          </p>
          <Button size="sm" className="mt-4">
            <PlusCircle /> Criar primeiro negócio
          </Button>
        </div>
      </Surface>

      {/* Loading skeletons */}
      <Surface>
        <SectionHead
          title="Loading states (Skeleton)"
          description="Substituem o conteúdo enquanto dados são buscados."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-[2px] bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-5/6" />
              <Skeleton className="h-2 w-4/6" />
            </div>
          ))}
        </div>
      </Surface>

      {/* Table */}
      <Surface>
        <SectionHead
          title="Tabela de dados"
          description="Listagem padrão com header, linhas e badges semânticos."
        />
        <div className="border border-border rounded-[2px] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_NEGOCIOS.map((neg) => (
                <TableRow key={neg.id}>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {neg.id}
                  </TableCell>
                  <TableCell className="text-[13px] font-medium">{neg.cliente}</TableCell>
                  <TableCell className="text-[13px]">{neg.valor}</TableCell>
                  <TableCell>
                    <StageBadge stage={neg.stage} />
                  </TableCell>
                  <TableCell className="text-right text-[11px] text-muted-foreground">
                    há {neg.updated}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Surface>

      {/* Form pattern */}
      <Surface>
        <SectionHead
          title="Formulário com seções"
          description="Estrutura comum de formulário em modais e páginas de edição."
        />
        <div className="border border-border rounded-[4px] bg-background max-w-2xl">
          <div className="px-5 py-2.5 bg-muted border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Dados do contato
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Nome</Label>
                <Input placeholder="João da Silva" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Email</Label>
                <Input type="email" placeholder="joao@empresa.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Observações</Label>
              <Textarea placeholder="Notas internas..." className="min-h-[72px]" />
            </div>
          </div>
          <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
            <Button variant="outline" size="sm">Cancelar</Button>
            <Button size="sm">
              <Save /> Salvar
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE SHELL
   ═══════════════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'tipografia',   label: 'Tipografia',  Icon: Type,           Component: TipografiaTab },
  { id: 'cores',        label: 'Cores',       Icon: Palette,        Component: CoresTab },
  { id: 'componentes',  label: 'Componentes', Icon: ComponentIcon,  Component: ComponentesTab },
  { id: 'layout',       label: 'Layout & Grid', Icon: LayoutGrid,   Component: LayoutTab },
  { id: 'iconografia',  label: 'Iconografia', Icon: Sparkles,       Component: IconografiaTab },
  { id: 'padroes',      label: 'Padrões de Página', Icon: FileCode2, Component: PadroesTab },
] as const;

type TabId = (typeof TABS)[number]['id'];

const DesignSystem = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('tipografia');

  // Guard: only super_adm
  if (!user) return null;
  if (!user.profile?.super_adm) {
    return <Navigate to="/bipro" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <header className="border-b border-border bg-card">
        <div className="px-6 py-5 max-w-[1400px] mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Palette className="w-4 h-4 text-primary" strokeWidth={1.5} />
                <Badge variant="outline" className="text-[9px]">
                  super_adm
                </Badge>
              </div>
              <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
                Design System
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl">
                Referência viva dos tokens, componentes e padrões usados em todo o REVOS CRM.
                Tudo o que está aqui é renderizado com os mesmos estilos consumidos pelo sistema em produção.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[9px]">dark · default</Badge>
              <Badge variant="outline" className="text-[9px]">Tailwind</Badge>
              <Badge variant="outline" className="text-[9px]">shadcn/ui</Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs nav + content */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabId)}
        className="max-w-[1400px] mx-auto"
      >
        <div className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          <div className="px-6">
            <TabsList className="h-[45px] gap-1 justify-start overflow-x-auto">
              {TABS.map(({ id, label, Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="gap-1.5 data-[state=active]:border-primary"
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="px-6 py-6">
          {TABS.map(({ id, Component }) => (
            <TabsContent key={id} value={id} className="mt-0 focus-visible:outline-none">
              <Component />
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Footer hint */}
      <Separator />
      <footer className="px-6 py-6 max-w-[1400px] mx-auto">
        <p className="text-[11px] text-muted-foreground">
          Origem dos tokens: <Token>src/index.css</Token> · Tailwind config:{' '}
          <Token>tailwind.config.ts</Token> · Componentes:{' '}
          <Token>src/components/ui</Token>
        </p>
      </footer>
    </div>
  );
};

export default DesignSystem;
