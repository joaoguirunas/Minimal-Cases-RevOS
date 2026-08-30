import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Type, Palette, Box, Layers, Moon, Sun,
  MessageSquare, Phone, BarChart3, Calendar, Mail, Zap, FileText,
  Bot, Send, Megaphone, Check, AlertTriangle, Info, XCircle,
  ArrowLeft, ArrowRight, Search, Star, Heart, Shield, Globe, Users,
  Eye, Target, Compass, Flame, Crown, Sparkles, Rocket,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  ChevronRight, Home, Settings, Terminal,
  Trash2, Plus, Settings2, Loader2, Save, X,
  Upload, GripVertical, TrendingUp, Activity, PieChart,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RePieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
  ComposedChart, Tooltip as RechartsTooltip,
} from 'recharts';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Card as ShadcnCard,
  CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { ContactAvatar } from '@/components/ui/contact-avatar';

import {
  FoundationsTab, ColorTokensTab, SpacingLayoutTab, SurfacesTab,
  SemanticTokensTab, TokenExportTab, EffectsTab, PatternsTab,
  VfxTab, TemplatesTab, SeoTab, LpSectionsTab, FeedbackTab,
  TablesTab, CardsTab, NavigationTab, SectionsTab, FlowDiagramTab,
  AdvancedTab,
} from '@/components/brandbook';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionHeader({ num, title, subtitle }: { num: string; title: string; subtitle: string }) {
  return (
    <div className="mb-12">
      <div className="flex items-end gap-5 mb-3">
        <span
          className="font-['Outfit'] leading-none font-black bg-gradient-to-b from-white/[0.08] to-transparent bg-clip-text text-transparent select-none"
          style={{ fontSize: 'clamp(4rem, 8vw, 6rem)' }}
        >
          {num}
        </span>
        <div className="pb-3">
          <h2
            className="font-['Outfit'] font-bold text-white tracking-tight"
            style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}
          >
            {title}
          </h2>
          <p className="text-[13px] text-white/35 mt-1 tracking-wide">{subtitle}</p>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-white/10 via-white/[0.04] to-transparent" />
    </div>
  );
}

function ColorSwatch({ name, hex, hsl, token }: {
  name: string; hex: string; hsl: string; token: string;
}) {
  return (
    <div className="group flex flex-col items-center gap-3">
      <div
        className="w-[72px] h-[72px] rounded-[2px] border border-white/[0.08] shadow-lg transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundColor: hex }}
      />
      <div className="text-center space-y-0.5">
        <p className="text-[11px] font-semibold text-white/70">{name}</p>
        <p className="text-[10px] font-mono text-white/35">{hex}</p>
        <p className="text-[10px] font-mono text-white/25">{hsl}</p>
        <p className="text-[10px] font-mono text-[#B8924B]/50">{token}</p>
      </div>
    </div>
  );
}

function GlowCard({ children, className = '', glow }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <div className={`group/card relative rounded-[2px] border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.10] hover:bg-white/[0.035] ${className}`}>
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[2px] opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 -z-10"
          style={{ boxShadow: `0 0 80px 4px ${glow}10, inset 0 0 60px 2px ${glow}06` }}
        />
      )}
      {children}
    </div>
  );
}

function ComponentCard({ title, desc, importPath, children, className = '' }: {
  title: string; desc: string; importPath: string; children: React.ReactNode; className?: string;
}) {
  return (
    <GlowCard className={className} glow="#B8924B">
      <h3 className="text-[13px] font-semibold text-white/80 mb-1">{title}</h3>
      <p className="text-[11px] text-white/35 mb-5">{desc}</p>
      <div className="space-y-4">{children}</div>
      <div className="mt-5 pt-3 border-t border-white/[0.04]">
        <code className="text-[10px] font-mono text-white/20">{importPath}</code>
      </div>
    </GlowCard>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-mono text-white/25 mb-3 tracking-[0.1em] uppercase">{children}</p>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Brandbook() {
  const [sliderValue, setSliderValue] = useState([40]);
  const [textareaValue, setTextareaValue] = useState('');
  const [inlineEditValue, setInlineEditValue] = useState('Click to edit');
  const [isEditing, setIsEditing] = useState(false);
  const [animatedNumber, setAnimatedNumber] = useState(0);
  const [motionKey, setMotionKey] = useState(0);
  const navigate = useNavigate();

  // Animated number counter
  useEffect(() => {
    const target = 12847;
    const duration = 2000;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= duration) { setAnimatedNumber(target); clearInterval(timer); }
      else setAnimatedNumber(Math.floor((elapsed / duration) * target));
    }, 16);
    return () => clearInterval(timer);
  }, [motionKey]);

  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen selection:bg-[#B8924B]/30 selection:text-white">

      {/* ── TOP BAR ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-[60] bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-12 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/[0.06]"
            onClick={() => navigate('/settings/general/outros')}
            title="Voltar"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
          <div className="w-px h-4 bg-white/10" />
          <span className="font-['Outfit'] text-sm font-bold tracking-tight">
            <span className="text-white">João Guirunas</span>
          </span>
          <span className="text-[10px] font-mono text-white/25 tracking-[0.1em] uppercase ml-1">Design System</span>
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <div className="px-8 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-[#B8924B]/[0.035] rounded-full blur-[140px]" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-[#B8924B] animate-pulse" />
                <span className="text-[10px] font-mono text-white/40 tracking-[0.12em] uppercase">Design System v1.0 // Dark Cockpit Edition</span>
              </div>
              <h1 className="font-['Outfit'] font-black tracking-tighter mb-4" style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)' }}>
                <span className="text-white">João Guirunas</span>
              </h1>
              <p className="text-white/30 font-light tracking-[0.08em] uppercase text-sm">CRM Intelligence Platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="identity" className="w-full">
        <div className="sticky top-0 z-50 bg-white/[0.03] border-b border-white/[0.06] backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-8 md:px-12">
            <TabsList className="h-auto min-h-[45px] w-full justify-start bg-transparent gap-0 rounded-none p-0 flex flex-wrap">
              {[
                { value: 'identity', label: 'Identity' },
                { value: 'foundations', label: 'Foundations' },
                { value: 'colors', label: 'Colors' },
                { value: 'color-tokens', label: 'Tokens' },
                { value: 'typography', label: 'Type' },
                { value: 'spacing-layout', label: 'Spacing' },
                { value: 'surfaces', label: 'Surfaces' },
                { value: 'semantic-tokens', label: 'Semantic' },
                { value: 'components', label: 'Components' },
                { value: 'forms', label: 'Forms' },
                { value: 'feedback', label: 'Feedback' },
                { value: 'tables', label: 'Tables' },
                { value: 'cards', label: 'Cards' },
                { value: 'navigation', label: 'Nav' },
                { value: 'charts', label: 'Charts' },
                { value: 'motion', label: 'Motion' },
                { value: 'effects', label: 'Effects' },
                { value: 'patterns', label: 'Patterns' },
                { value: 'vfx', label: 'VFX' },
                { value: 'templates', label: 'Templates' },
                { value: 'sections', label: 'Sections' },
                { value: 'lp-sections', label: 'LP' },
                { value: 'flow-diagram', label: 'Flow' },
                { value: 'layout', label: 'Layout' },
                { value: 'iconography', label: 'Icons' },
                { value: 'token-export', label: 'Export' },
                { value: 'seo', label: 'SEO' },
                { value: 'advanced', label: 'Advanced' },
                { value: 'brand', label: 'Brand' },
              ].map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-[#B8924B] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none bg-transparent text-white/40 hover:text-white/60 text-[12px] font-mono uppercase tracking-[0.08em] px-3 transition-all"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 md:px-12 py-16">

          {/* ════════════════════════════════════════════════════════════════
              TAB 1 — IDENTITY
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="identity" className="mt-0 space-y-32">

            {/* Identity System */}
            <section>
              <SectionHeader num="01" title="Identity System" subtitle="Logo, tagline e marca João Guirunas" />
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <GlowCard className="md:col-span-3 flex flex-col items-center justify-center py-20" glow="#B8924B">
                  <div className="relative">
                    <div className="absolute -inset-16 bg-[#B8924B]/[0.04] rounded-full blur-[80px] pointer-events-none" />
                    <h2 className="relative font-['Outfit'] font-black tracking-tighter" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)' }}>
                      <span className="text-white">João Guirunas</span>
                    </h2>
                  </div>
                  <p className="text-[11px] text-white/25 mt-8 font-mono tracking-[0.3em] uppercase">CRM Intelligence Platform</p>
                  <p className="text-[10px] text-white/15 mt-2 font-mono tracking-[0.15em]">by GrowthSales</p>
                </GlowCard>

                <GlowCard className="md:col-span-2" glow="#3B82F6">
                  <h3 className="text-[11px] font-mono text-white/40 mb-5 tracking-[0.08em] uppercase">Brand Mark Variants</h3>
                  <div className="space-y-4">
                    {[
                      { bg: 'bg-[#B8924B]/15', color: '#B8924B', label: 'Primary', sub: 'Dark surfaces' },
                      { bg: 'bg-white', color: '#0a0a0a', label: 'Inverse', sub: 'Light surfaces', textDark: true },
                      { bg: 'bg-[#6C16F8]/15', color: '#6C16F8', label: 'AI Accent', sub: 'AI features' },
                      { bg: 'bg-[#3B82F6]/15', color: '#3B82F6', label: 'Accent', sub: 'Highlights' },
                    ].map(({ bg, color, label, sub, textDark }) => (
                      <div key={label} className={`flex items-center gap-4 p-3 rounded-[2px] ${textDark ? 'bg-white border border-white/20' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                        <div className={`w-10 h-10 rounded-[2px] ${bg} flex items-center justify-center`}>
                          <span className="font-['Outfit'] text-sm font-black" style={{ color }}>R</span>
                        </div>
                        <div>
                          <p className={`text-[11px] font-semibold ${textDark ? 'text-gray-900' : 'text-white/80'}`}>{label}</p>
                          <p className={`text-[10px] ${textDark ? 'text-gray-500' : 'text-white/30'}`}>{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-white/[0.06]">
                    <p className="text-[9px] font-mono text-white/20 leading-relaxed">
                      Min size: 24px &bull; Clear space: 0.5× logo width &bull; Never rotate, stretch or recolor
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      {[
                        {
                          label: 'Wordmark SVG',
                          sub: 'REV white + OS orange',
                          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60"><rect width="200" height="60" fill="#0a0a0a"/><text x="16" y="44" font-family="Outfit,Arial Black,sans-serif" font-weight="900" font-size="42" fill="#ffffff" letter-spacing="-1">REV</text><text x="106" y="44" font-family="Outfit,Arial Black,sans-serif" font-weight="900" font-size="42" fill="#B8924B" letter-spacing="-1">OS</text></svg>`,
                          filename: 'joaoguirunas-wordmark.svg',
                        },
                        {
                          label: 'Wordmark SVG (light bg)',
                          sub: 'REV dark + OS orange',
                          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60"><rect width="200" height="60" fill="#ffffff"/><text x="16" y="44" font-family="Outfit,Arial Black,sans-serif" font-weight="900" font-size="42" fill="#0a0a0a" letter-spacing="-1">REV</text><text x="106" y="44" font-family="Outfit,Arial Black,sans-serif" font-weight="900" font-size="42" fill="#B8924B" letter-spacing="-1">OS</text></svg>`,
                          filename: 'joaoguirunas-wordmark-light.svg',
                        },
                        {
                          label: 'Mark only SVG',
                          sub: 'Monogram R orange',
                          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60"><rect width="60" height="60" fill="#0a0a0a"/><text x="8" y="48" font-family="Outfit,Arial Black,sans-serif" font-weight="900" font-size="52" fill="#B8924B">R</text></svg>`,
                          filename: 'joaoguirunas-mark.svg',
                        },
                      ].map(({ label, sub, svg, filename }) => (
                        <button
                          key={filename}
                          onClick={() => {
                            const blob = new Blob([svg], { type: 'image/svg+xml' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-[2px] bg-white/[0.04] border border-white/[0.06] hover:bg-[#B8924B]/[0.20] hover:border-[#B8924B]/40 transition-all group"
                        >
                          <div className="text-left">
                            <p className="text-[11px] text-white/80 group-hover:text-white font-medium">{label}</p>
                            <p className="text-[9px] text-white/30 font-mono">{sub}</p>
                          </div>
                          <svg className="w-3.5 h-3.5 text-white/30 group-hover:text-[#B8924B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* Brand Manifesto */}
            <section>
              <SectionHeader num="02" title="Brand Manifesto" subtitle="Posicionamento, missão e valores" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <GlowCard className="md:col-span-2 relative overflow-hidden" glow="#B8924B">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#B8924B]/[0.03] rounded-full blur-[80px] pointer-events-none" />
                  <div className="relative">
                    <h3 className="text-[11px] font-mono text-[#B8924B]/50 mb-4 tracking-[0.12em] uppercase">Positioning</h3>
                    <p className="text-[22px] font-['Outfit'] font-bold text-white/80 leading-snug mb-6">
                      A plataforma de CRM inteligente que transforma dados em decisões e relacionamentos em receita.
                    </p>
                    <div className="space-y-4">
                      {[
                        { label: 'Category', text: 'CRM Intelligence Platform' },
                        { label: 'Target', text: 'PMEs e equipes comerciais BR que precisam de mais do que um CRM' },
                        { label: 'Enemy', text: 'Ferramentas fragmentadas, dados isolados, decisões no achismo' },
                      ].map(({ label, text }) => (
                        <div key={label}>
                          <p className="text-[10px] font-mono text-white/25 mb-1 tracking-[0.08em] uppercase">{label}</p>
                          <p className="text-[13px] text-white/60">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlowCard>

                <GlowCard glow="#6C16F8">
                  <h3 className="text-[11px] font-mono text-[#6C16F8]/50 mb-4 tracking-[0.12em] uppercase">Brand Archetypes</h3>
                  <div className="space-y-4">
                    {[
                      { icon: Compass, name: 'Explorer', pct: '35%', desc: 'Descobrir caminhos', color: '#3B82F6' },
                      { icon: Crown, name: 'Ruler', pct: '30%', desc: 'Controle e organização', color: '#B8924B' },
                      { icon: Sparkles, name: 'Magician', pct: '20%', desc: 'Dados em inteligência', color: '#6C16F8' },
                      { icon: Rocket, name: 'Hero', pct: '15%', desc: 'Superar desafios', color: '#00D26A' },
                    ].map(({ icon: Icon, name, pct, desc, color }) => (
                      <div key={name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[2px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}20` }}>
                          <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] font-semibold text-white/70">{name}</p>
                            <span className="text-[10px] font-mono" style={{ color }}>{pct}</span>
                          </div>
                          <p className="text-[9px] text-white/25">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: 'Missão', icon: Target, text: 'Democratizar a inteligência comercial, dando a toda equipe de vendas as ferramentas para vender com dados.', color: '#B8924B' },
                  { label: 'Visão', icon: Eye, text: 'Ser a plataforma definitiva de CRM inteligente para PMEs da América Latina.', color: '#3B82F6' },
                  { label: 'Valores', icon: Flame, text: 'Transparência radical. Simplicidade obsessiva. Resultado mensurável. Empatia com o vendedor.', color: '#6C16F8' },
                ].map(({ label, icon: Icon, text, color }) => (
                  <GlowCard key={label} glow={color}>
                    <div className="flex items-center gap-2 mb-4">
                      <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.5} />
                      <h3 className="text-[11px] font-mono tracking-[0.12em] uppercase" style={{ color: `${color}80` }}>{label}</h3>
                    </div>
                    <p className="text-[12px] text-white/45 leading-relaxed">{text}</p>
                  </GlowCard>
                ))}
              </div>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 2 — COLORS
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="colors" className="mt-0 space-y-32">
            <section>
              <SectionHeader num="01" title="Color Palette" subtitle="Tokens CSS reais extraídos de index.css" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <GlowCard className="md:col-span-2" glow="#B8924B">
                  <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Primary & Core</h3>
                  <div className="flex flex-wrap gap-8 justify-center">
                    <ColorSwatch name="Primary" hex="#B8924B" hsl="17 100% 50%" token="--primary" />
                    <ColorSwatch name="Primary Hover" hex="#FF6A33" hsl="18 100% 58%" token="--primary-hover" />
                    <ColorSwatch name="Accent" hex="#3B82F6" hsl="217 91% 60%" token="--accent" />
                    <ColorSwatch name="Foreground" hex="#F8F9FA" hsl="220 9% 98%" token="--foreground" />
                  </div>
                </GlowCard>

                <GlowCard glow="#283040">
                  <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Surface Stack</h3>
                  <div className="space-y-3">
                    {[
                      { name: 'Background', hex: '#141921', token: '--background' },
                      { name: 'Card', hex: '#181D27', token: '--card' },
                      { name: 'Surface', hex: '#1E2330', token: '--secondary' },
                      { name: 'Border', hex: '#283040', token: '--border' },
                      { name: 'Input', hex: '#1B2028', token: '--input' },
                    ].map(({ name, hex, token }) => (
                      <div key={name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[2px] border border-white/[0.08] shrink-0" style={{ backgroundColor: hex }} />
                        <div className="flex-1">
                          <p className="text-[10px] font-semibold text-white/60">{name}</p>
                          <p className="text-[9px] font-mono text-white/25">{hex}</p>
                        </div>
                        <code className="text-[9px] font-mono text-[#B8924B]/40 shrink-0">{token}</code>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <GlowCard glow="#6C16F8">
                  <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Brand Colors (Iatize)</h3>
                  <div className="flex flex-wrap gap-8 justify-center">
                    <ColorSwatch name="Iatize Blue" hex="#2563FF" hsl="225 100% 57%" token="iatize.blue" />
                    <ColorSwatch name="Iatize Green" hex="#00D26A" hsl="150 100% 41%" token="iatize.green" />
                    <ColorSwatch name="Iatize Purple" hex="#6C16F8" hsl="265 93% 53%" token="iatize.purple" />
                  </div>
                </GlowCard>

                <GlowCard glow="#22C55E">
                  <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Semantic</h3>
                  <div className="flex flex-wrap gap-8 justify-center">
                    <ColorSwatch name="Success" hex="#22C55E" hsl="142 76% 36%" token="--success" />
                    <ColorSwatch name="Warning" hex="#EAB308" hsl="48 96% 53%" token="--warning" />
                    <ColorSwatch name="Destructive" hex="#EF4444" hsl="0 84% 60%" token="--destructive" />
                    <ColorSwatch name="Info" hex="#B8924B" hsl="17 100% 50%" token="--info" />
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* Stat & Domain Cards */}
            <section>
              <SectionHeader num="02" title="Semantic Tokens" subtitle="Status, stat cards e domain color tokens" />

              <GlowCard className="mb-8" glow="#22C55E">
                <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Status Cards</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {[
                    { label: 'Info', icon: Info, bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400' },
                    { label: 'Success', icon: Check, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
                    { label: 'Warning', icon: AlertTriangle, bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
                    { label: 'Error', icon: XCircle, bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' },
                  ].map(({ label, icon: Icon, bg, border, text }) => (
                    <div key={label} className={`${bg} ${border} border rounded-[2px] p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${text}`} />
                        <span className={`text-[11px] font-semibold ${text}`}>{label}</span>
                      </div>
                      <p className="text-[10px] text-white/30">Message for {label.toLowerCase()} state.</p>
                    </div>
                  ))}
                </div>
              </GlowCard>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                {[
                  { label: 'Total Leads', value: '2,847', delta: '+12.5%', color: '#B8924B' },
                  { label: 'Conversões', value: '384', delta: '+8.2%', color: '#00D26A' },
                  { label: 'Agendamentos', value: '156', delta: '+22.1%', color: '#6C16F8' },
                  { label: 'Receita MRR', value: 'R$ 47k', delta: '+5.8%', color: '#3B82F6' },
                ].map(({ label, value, delta, color }) => (
                  <div
                    key={label}
                    className="relative rounded-[2px] border p-5 transition-all duration-300 hover:scale-[1.02] group overflow-hidden"
                    style={{ borderColor: `${color}18`, backgroundColor: `${color}06` }}
                  >
                    <div
                      className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[40px]"
                      style={{ backgroundColor: `${color}20` }}
                    />
                    <p className="text-[11px] text-white/35 mb-1.5">{label}</p>
                    <p className="text-[28px] font-bold text-white/85 font-['Outfit'] leading-none">{value}</p>
                    <div className="flex items-center gap-1 mt-3">
                      <ArrowRight className="w-3 h-3 -rotate-45" style={{ color }} />
                      <span className="text-[11px] font-semibold" style={{ color }}>{delta}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Card Info', sub: 'Lead detail', color: '#3B82F6', token: '--card-info-*' },
                  { label: 'Card Empresa', sub: 'Company', color: '#8B5CF6', token: '--card-empresa-*' },
                  { label: 'Card Money', sub: 'Revenue', color: '#10B981', token: '--card-money-*' },
                  { label: 'Card Summary', sub: 'Overview', color: '#F59E0B', token: '--card-summary-*' },
                ].map(({ label, sub, color, token }) => (
                  <div key={label} className="rounded-[2px] border border-white/[0.06] bg-white/[0.02] p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-all duration-300">
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
                    <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(to right, ${color}30, transparent)` }} />
                    <p className="text-[11px] font-semibold text-white/65 pl-4">{label}</p>
                    <p className="text-[10px] text-white/25 pl-4 mt-0.5">{sub}</p>
                    <div className="mt-4 pl-4">
                      <div className="w-full h-1.5 rounded-full bg-white/[0.04]">
                        <div className="h-1.5 rounded-full" style={{ backgroundColor: `${color}50`, width: '65%' }} />
                      </div>
                    </div>
                    <p className="text-[8px] font-mono text-white/15 pl-4 mt-3">{token}</p>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 3 — TYPOGRAPHY
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="typography" className="mt-0 space-y-32">
            <section>
              <SectionHeader num="01" title="Type System" subtitle="Inter (body) + Outfit (display)" />

              <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
                <GlowCard className="md:col-span-3" glow="#3B82F6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-[2px] bg-[#3B82F6]/10 border border-[#3B82F6]/15 flex items-center justify-center">
                      <Type className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white/80">Inter</h3>
                      <p className="text-[10px] font-mono text-white/30 tracking-[0.08em]">PRIMARY — BODY & UI</p>
                    </div>
                  </div>
                  <p className="text-[40px] font-light text-white/80 leading-tight mb-4" style={{ fontFamily: 'Inter' }}>Aa Bb Cc 0123</p>
                  <p className="text-sm text-white/40 leading-relaxed" style={{ fontFamily: 'Inter' }}>
                    ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
                    abcdefghijklmnopqrstuvwxyz<br />
                    0123456789 !@#$%&amp;*()-+=
                  </p>
                  <div className="mt-6 pt-4 border-t border-white/[0.06]">
                    <p className="text-[10px] font-mono text-white/25">Weights: 300 · 400 · 500 · 600 · 700 · 800 · 900</p>
                  </div>
                </GlowCard>

                <GlowCard className="md:col-span-2" glow="#6C16F8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-[2px] bg-[#6C16F8]/10 border border-[#6C16F8]/15 flex items-center justify-center">
                      <Type className="w-5 h-5 text-[#6C16F8]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white/80">Outfit</h3>
                      <p className="text-[10px] font-mono text-white/30 tracking-[0.08em]">DISPLAY — HEADINGS</p>
                    </div>
                  </div>
                  <p className="text-[40px] font-black text-white/80 leading-tight font-['Outfit'] mb-4">Aa Bb Cc</p>
                  <p className="text-sm text-white/40 leading-relaxed font-['Outfit']">
                    ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
                    abcdefghijklmnopqrstuvwxyz<br />
                    0123456789
                  </p>
                  <div className="mt-6 pt-4 border-t border-white/[0.06]">
                    <p className="text-[10px] font-mono text-white/25">Usage: Display, H1-H3, Brand, Numbers</p>
                  </div>
                </GlowCard>
              </div>

              <GlowCard className="mb-8" glow="#B8924B">
                <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Weight Scale</h3>
                <div className="space-y-2">
                  {[
                    { w: 300, label: 'Light', cls: 'font-light' },
                    { w: 400, label: 'Regular', cls: 'font-normal' },
                    { w: 500, label: 'Medium', cls: 'font-medium' },
                    { w: 600, label: 'Semibold', cls: 'font-semibold' },
                    { w: 700, label: 'Bold', cls: 'font-bold' },
                    { w: 800, label: 'Extrabold', cls: 'font-extrabold' },
                    { w: 900, label: 'Black', cls: 'font-black' },
                  ].map(({ w, label, cls }) => (
                    <div key={w} className="flex items-center gap-4">
                      <span className="text-[10px] font-mono text-[#B8924B]/40 w-8 text-right">{w}</span>
                      <div className="flex-1 h-px bg-white/[0.04]" />
                      <span className={`text-lg ${cls} text-white/70`}>{label} — The quick brown fox</span>
                      <div className="flex-1 h-px bg-white/[0.04]" />
                      <span className="text-[10px] font-mono text-white/25">.{cls.replace('font-', '')}</span>
                    </div>
                  ))}
                </div>
              </GlowCard>

              <GlowCard glow="#3B82F6">
                <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Size Scale</h3>
                <div className="space-y-4">
                  {[
                    { size: 48, label: 'Display', cls: "font-['Outfit'] font-black" },
                    { size: 36, label: 'H1', cls: "font-['Outfit'] font-bold" },
                    { size: 30, label: 'H2', cls: "font-['Outfit'] font-bold" },
                    { size: 24, label: 'H3', cls: "font-['Outfit'] font-semibold" },
                    { size: 20, label: 'H4', cls: 'font-semibold' },
                    { size: 16, label: 'Body', cls: 'font-normal' },
                    { size: 14, label: 'Small', cls: 'font-normal' },
                    { size: 13, label: 'UI Text', cls: 'font-medium' },
                    { size: 12, label: 'Caption', cls: 'font-medium' },
                    { size: 11, label: 'Micro', cls: 'font-medium' },
                  ].map(({ size, label, cls }) => (
                    <div key={size} className="flex items-baseline gap-4">
                      <span className="text-[10px] font-mono text-[#B8924B]/40 w-10 text-right shrink-0">{size}px</span>
                      <span className={`${cls} text-white/70 truncate`} style={{ fontSize: `${size}px`, lineHeight: 1.2 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 4 — COMPONENTS
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="components" className="mt-0 space-y-32">

            {/* ── 01 BUTTON ROLES ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="01" title="Button Roles" subtitle="Cada tipo de botão tem uma função clara no João Guirunas CRM" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlowCard glow="#B8924B">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[2px] bg-[#B8924B]/10 shrink-0">
                      <Save className="w-5 h-5 text-[#B8924B]" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-semibold text-white/90">Action Button</h3>
                      <p className="text-[11px] text-white/35 mt-0.5">Ação principal — salvar, confirmar, enviar, criar</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button className="h-[30px] rounded-[4px] text-xs">Salvar</Button>
                    <Button className="h-[30px] rounded-[4px] text-xs">Confirmar</Button>
                    <Button className="h-[30px] rounded-[4px] text-xs">Enviar</Button>
                  </div>
                  <p className="text-[10px] font-mono text-white/20 mt-4">h-[30px] · rounded-[4px] · variant=default</p>
                </GlowCard>

                <GlowCard glow="#3B82F6">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[2px] bg-[#3B82F6]/10 shrink-0">
                      <ArrowRight className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-semibold text-white/90">Navigation Button</h3>
                      <p className="text-[11px] text-white/35 mt-0.5">Links e navegação — ghost ou link variant</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="ghost" className="h-[30px] rounded-[4px] text-xs">Dashboard</Button>
                    <Button variant="link" className="h-[30px] text-xs">Ver detalhes →</Button>
                    <Button variant="ghost" className="h-[30px] rounded-[4px] text-xs gap-1.5"><Globe className="w-3.5 h-3.5" /> Integrações</Button>
                  </div>
                  <p className="text-[10px] font-mono text-white/20 mt-4">variant=ghost | link · navegação contextual</p>
                </GlowCard>

                <GlowCard glow="#6C16F8">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[2px] bg-[#6C16F8]/10 shrink-0">
                      <Settings className="w-5 h-5 text-[#6C16F8]" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-semibold text-white/90">Icon Button</h3>
                      <p className="text-[11px] text-white/35 mt-0.5">Ações compactas — só ícone, sem texto</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="icon" className="h-[30px] w-[30px] rounded-[4px]"><Heart className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" className="h-[30px] w-[30px] rounded-[4px]"><Search className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" className="h-[30px] w-[30px] rounded-[4px]"><Settings2 className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" className="h-[30px] w-[30px] rounded-[4px]"><Mail className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-[30px] w-[30px] rounded-[4px]"><Star className="w-4 h-4" /></Button>
                  </div>
                  <p className="text-[10px] font-mono text-white/20 mt-4">h-[30px] w-[30px] · size=icon · rounded-[4px]</p>
                </GlowCard>

                <GlowCard glow="#00D26A">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[2px] bg-[#00D26A]/10 shrink-0">
                      <Rocket className="w-5 h-5 text-[#00D26A]" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-semibold text-white/90">CTA Button</h3>
                      <p className="text-[11px] text-white/35 mt-0.5">Formulários e landing pages — tamanho maior, destaque</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="lg" className="rounded-[4px] gap-2"><Zap className="w-4 h-4" /> Começar Agora</Button>
                    <Button size="lg" variant="outline" className="rounded-[4px] gap-2"><FileText className="w-4 h-4" /> Saiba Mais</Button>
                  </div>
                  <p className="text-[10px] font-mono text-white/20 mt-4">size=lg · formulários, onboarding, landing pages</p>
                </GlowCard>
              </div>
              <div className="mt-6 pt-3 border-t border-white/[0.04]">
                <code className="text-[10px] font-mono text-white/20">import {'{ Button }'} from '@/components/ui/button'</code>
              </div>
            </section>

            {/* ── 02 BUTTON VARIANTS ───────────────────────────────────────── */}
            <section>
              <SectionHeader num="02" title="Button Variants" subtitle="4 variações core do design system João Guirunas" />
              <GlowCard glow="#B8924B">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {[
                    { variant: 'default' as const, label: 'Primary', color: '#B8924B', desc: 'Ação principal · bg-primary' },
                    { variant: 'secondary' as const, label: 'Secondary', color: '#FFFFFF', desc: 'Ação secundária · white/10' },
                    { variant: 'ghost' as const, label: 'Ghost', color: '#666666', desc: 'Ação sutil · transparent' },
                    { variant: 'destructive' as const, label: 'Destructive', color: '#EF4444', desc: 'Ação perigosa · red' },
                  ].map(({ variant, label, color, desc }) => (
                    <div key={variant} className="flex flex-col items-center gap-3">
                      <Button variant={variant} className="h-[30px] rounded-[4px] text-xs w-full">{label}</Button>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-mono text-white/25">{variant}</span>
                      </div>
                      <span className="text-[9px] text-white/20 text-center">{desc}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.04]">
                  <SubLabel>Also Available</SubLabel>
                  <div className="flex gap-3 mt-2">
                    <Button variant="outline" className="h-[30px] rounded-[4px] text-xs">Outline</Button>
                    <Button variant="link" className="h-[30px] text-xs">Link →</Button>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 03 BUTTON SIZES ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="03" title="Button Sizes" subtitle="3 tamanhos padronizados — SM, MD, LG" />
              <GlowCard glow="#B8924B">
                <div className="grid grid-cols-3 gap-8">
                  {[
                    { size: 'sm' as const, label: 'SM', spec: 'h-7 (28px)', use: 'Toolbars, inline' },
                    { size: 'default' as const, label: 'MD', spec: 'h-9 (36px)', use: 'Padrão do app' },
                    { size: 'lg' as const, label: 'LG', spec: 'h-11 (44px)', use: 'CTAs, forms' },
                  ].map(({ size, label, spec, use }) => (
                    <div key={label} className="flex flex-col items-center gap-4 p-4 rounded-[2px] border border-white/[0.06] bg-white/[0.015]">
                      <Button size={size} className="rounded-[4px] w-full">{label}</Button>
                      <div className="text-center space-y-1">
                        <span className="text-[11px] font-mono text-white/40 block font-semibold">{spec}</span>
                        <span className="text-[9px] text-white/20 block">{use}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B8924B]/50" />
                    <p className="text-[10px] text-white/30">João Guirunas Standard: <span className="text-white/50 font-semibold">h-[30px]</span> action buttons, <span className="text-white/50 font-semibold">h-[45px]</span> tab bars, <span className="text-white/50 font-semibold">h-11</span> form CTAs</p>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 04 BUTTON STATES ─────────────────────────────────────────── */}
            <section>
              <SectionHeader num="04" title="Button States" subtitle="Estados interativos e de carregamento" />
              <GlowCard glow="#B8924B">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                  <div className="flex flex-col items-center gap-3">
                    <Button className="h-[30px] rounded-[4px] text-xs">Default</Button>
                    <span className="text-[10px] font-mono text-white/25">default</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <Button className="h-[30px] rounded-[4px] text-xs bg-[hsl(18,100%,58%)]">Hover</Button>
                    <span className="text-[10px] font-mono text-white/25">:hover</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <Button disabled className="h-[30px] rounded-[4px] text-xs gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading...
                    </Button>
                    <span className="text-[10px] font-mono text-white/25">loading</span>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <Button disabled className="h-[30px] rounded-[4px] text-xs">Disabled</Button>
                    <span className="text-[10px] font-mono text-white/25">disabled</span>
                  </div>
                </div>
                <div className="mt-8 pt-4 border-t border-white/[0.04]">
                  <SubLabel>Loading Pattern</SubLabel>
                  <div className="rounded-[2px] bg-white/[0.02] border border-white/[0.06] p-4">
                    <code className="text-[11px] font-mono text-white/40 leading-relaxed whitespace-pre">{`<Button disabled className="gap-1.5">
  <Loader2 className="w-3.5 h-3.5 animate-spin" />
  Salvando...
</Button>`}</code>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 05 BUTTON COMBINATIONS ───────────────────────────────────── */}
            <section>
              <SectionHeader num="05" title="Button Combinations" subtitle="Padrões reais usados no João Guirunas CRM" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlowCard glow="#B8924B">
                  <SubLabel>Action Pair — Salvar + Cancelar</SubLabel>
                  <p className="text-[11px] text-white/30 mb-4">O par mais comum do app: ação primária + escape</p>
                  <div className="flex items-center gap-3">
                    <Button className="h-[30px] rounded-[4px] text-xs gap-1.5"><Save className="w-3.5 h-3.5" /> Salvar</Button>
                    <Button variant="ghost" className="h-[30px] rounded-[4px] text-xs gap-1.5"><X className="w-3.5 h-3.5" /> Cancelar</Button>
                  </div>
                </GlowCard>

                <GlowCard glow="#00D26A">
                  <SubLabel>Create — Novo Lead</SubLabel>
                  <p className="text-[11px] text-white/30 mb-4">Ação de criação com ícone Plus</p>
                  <div className="flex items-center gap-3">
                    <Button className="h-[30px] rounded-[4px] text-xs gap-1.5"><Plus className="w-3.5 h-3.5" /> Novo Lead</Button>
                    <Button variant="outline" className="h-[30px] rounded-[4px] text-xs gap-1.5"><Plus className="w-3.5 h-3.5" /> Novo Negócio</Button>
                  </div>
                </GlowCard>

                <GlowCard glow="#EF4444">
                  <SubLabel>Destructive — Excluir</SubLabel>
                  <p className="text-[11px] text-white/30 mb-4">Ação perigosa, exige confirmação</p>
                  <div className="flex items-center gap-3">
                    <Button variant="destructive" className="h-[30px] rounded-[4px] text-xs gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Excluir</Button>
                    <Button variant="outline" className="h-[30px] rounded-[4px] text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Remover</Button>
                  </div>
                </GlowCard>

                <GlowCard glow="#6C16F8">
                  <SubLabel>Utility — Config + Navigation</SubLabel>
                  <p className="text-[11px] text-white/30 mb-4">Ações secundárias e links</p>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="h-[30px] rounded-[4px] text-xs gap-1.5"><Settings2 className="w-3.5 h-3.5" /> Configurações</Button>
                    <Button variant="link" className="text-xs gap-1">Ver mais <ArrowRight className="w-3 h-3" /></Button>
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* ── 06 FORM CONTROLS ─────────────────────────────────────────── */}
            <section>
              <SectionHeader num="06" title="Form Controls" subtitle="Checkbox, Switch, Radio, Toggle, ToggleGroup" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <ComponentCard title="Checkbox" desc="Boolean selection with label" importPath="import { Checkbox } from '@/components/ui/checkbox'">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id="cb1" defaultChecked />
                      <Label htmlFor="cb1" className="text-sm text-white/70">Checked</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="cb2" />
                      <Label htmlFor="cb2" className="text-sm text-white/70">Unchecked</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="cb3" disabled />
                      <Label htmlFor="cb3" className="text-sm text-white/40">Disabled</Label>
                    </div>
                  </div>
                </ComponentCard>

                <ComponentCard title="Switch" desc="On/off toggle control" importPath="import { Switch } from '@/components/ui/switch'">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch id="sw1" defaultChecked />
                      <Label htmlFor="sw1" className="text-sm text-white/70">Ativado</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch id="sw2" />
                      <Label htmlFor="sw2" className="text-sm text-white/70">Desativado</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch id="sw3" disabled />
                      <Label htmlFor="sw3" className="text-sm text-white/40">Disabled</Label>
                    </div>
                  </div>
                </ComponentCard>

                <ComponentCard title="Radio Group" desc="Single selection from a set" importPath="import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'">
                  <RadioGroup defaultValue="option-1">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="option-1" id="r1" />
                      <Label htmlFor="r1" className="text-sm text-white/70">Opção A</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="option-2" id="r2" />
                      <Label htmlFor="r2" className="text-sm text-white/70">Opção B</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="option-3" id="r3" />
                      <Label htmlFor="r3" className="text-sm text-white/70">Opção C</Label>
                    </div>
                  </RadioGroup>
                </ComponentCard>

                <ComponentCard title="Toggle" desc="Pressable icon buttons" importPath="import { Toggle } from '@/components/ui/toggle'">
                  <div className="flex gap-2">
                    <Toggle aria-label="Bold"><Bold className="w-4 h-4" /></Toggle>
                    <Toggle aria-label="Italic"><Italic className="w-4 h-4" /></Toggle>
                    <Toggle aria-label="Underline"><Underline className="w-4 h-4" /></Toggle>
                  </div>
                </ComponentCard>

                <ComponentCard title="Toggle Group" desc="Exclusive or multi selection" importPath="import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'" className="md:col-span-2">
                  <div className="space-y-4">
                    <div>
                      <SubLabel>Single Selection</SubLabel>
                      <ToggleGroup type="single" defaultValue="center" variant="outline">
                        <ToggleGroupItem value="left" aria-label="Align left"><AlignLeft className="w-4 h-4" /></ToggleGroupItem>
                        <ToggleGroupItem value="center" aria-label="Align center"><AlignCenter className="w-4 h-4" /></ToggleGroupItem>
                        <ToggleGroupItem value="right" aria-label="Align right"><AlignRight className="w-4 h-4" /></ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div>
                      <SubLabel>Multiple Selection</SubLabel>
                      <ToggleGroup type="multiple" variant="outline">
                        <ToggleGroupItem value="bold" aria-label="Bold"><Bold className="w-4 h-4" /></ToggleGroupItem>
                        <ToggleGroupItem value="italic" aria-label="Italic"><Italic className="w-4 h-4" /></ToggleGroupItem>
                        <ToggleGroupItem value="underline" aria-label="Underline"><Underline className="w-4 h-4" /></ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </div>
                </ComponentCard>
              </div>
            </section>

            {/* ── 07 FORM INPUTS ───────────────────────────────────────────── */}
            <section>
              <SectionHeader num="07" title="Form Inputs" subtitle="Input, Textarea, Select, Inline Edit" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ComponentCard title="Text Input" desc="Standard and specialized text fields" importPath="import { Input } from '@/components/ui/input'">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-[11px] text-white/40 mb-1.5 block">Default</Label>
                      <Input placeholder="Digite algo..." />
                    </div>
                    <div>
                      <Label className="text-[11px] text-white/40 mb-1.5 block">Search with Icon</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                        <Input placeholder="Buscar leads..." className="pl-9" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-white/40 mb-1.5 block">Password</Label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                        <Input type="password" placeholder="••••••••" className="pl-9" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-white/40 mb-1.5 block">Disabled</Label>
                      <Input disabled placeholder="Campo desabilitado" />
                    </div>
                  </div>
                </ComponentCard>

                <ComponentCard title="Textarea & Select" desc="Multi-line input and dropdown" importPath="import { Input } from '@/components/ui/input'">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-[11px] text-white/40 mb-1.5 block">Textarea with Counter</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-[2px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B8924B] resize-none"
                        placeholder="Descreva o negócio..."
                        maxLength={200}
                        value={textareaValue}
                        onChange={e => setTextareaValue(e.target.value)}
                      />
                      <div className="flex justify-end mt-1"><span className="text-[9px] font-mono text-white/25">{textareaValue.length} / 200</span></div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-white/40 mb-1.5 block">Select</Label>
                      <select className="flex h-10 w-full rounded-[2px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B8924B]">
                        <option>Vendas Inbound</option>
                        <option>Vendas Outbound</option>
                        <option>Pós-venda</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[11px] text-white/40 mb-1.5 block">Inline Edit</Label>
                      <div
                        className="flex items-center gap-3 p-2.5 rounded-[2px] border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all cursor-pointer group"
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        {isEditing ? (
                          <Input autoFocus defaultValue={inlineEditValue} onBlur={e => { setInlineEditValue(e.target.value); setIsEditing(false); }} className="h-7 text-xs" />
                        ) : (
                          <><span className="text-[13px] text-white/70 flex-1">{inlineEditValue}</span><Eye className="w-3.5 h-3.5 text-white/10 group-hover:text-white/30 transition-colors" /></>
                        )}
                      </div>
                    </div>
                  </div>
                </ComponentCard>
              </div>
            </section>

            {/* ── 08 DATA DISPLAY ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="08" title="Data Display" subtitle="Table, Badge, Avatar, Card, Accordion, KPI Cards" />

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Revenue', value: 'R$ 1.2M', change: '+12.5%', up: true, color: '#B8924B' },
                  { label: 'Leads', value: '8,432', change: '+5.2%', up: true, color: '#00D26A' },
                  { label: 'Churn', value: '3.1%', change: '-0.8%', up: false, color: '#EF4444' },
                  { label: 'NPS', value: '72', change: '+3', up: true, color: '#3B82F6' },
                ].map(({ label, value, change, up, color }) => (
                  <GlowCard key={label} glow={color}>
                    <p className="text-[10px] font-mono text-white/30 mb-2 uppercase tracking-[0.08em]">{label}</p>
                    <p className="text-[28px] font-['Outfit'] font-black text-white/90 leading-none mb-2">{value}</p>
                    <span className={`text-[11px] font-mono ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? '↑' : '↓'} {change}</span>
                  </GlowCard>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Badge */}
                <ComponentCard title="Badge" desc="Status indicators — 5 color variants" importPath="import { Badge } from '@/components/ui/badge'">
                  <div className="space-y-5">
                    <div>
                      <SubLabel>Standard</SubLabel>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>Default</Badge>
                        <Badge variant="secondary">Secondary</Badge>
                        <Badge variant="destructive">Destructive</Badge>
                        <Badge variant="outline">Outline</Badge>
                      </div>
                    </div>
                    <div>
                      <SubLabel>Semantic (5 colors)</SubLabel>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Ativo</Badge>
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pendente</Badge>
                        <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20">Cancelado</Badge>
                        <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20">Novo</Badge>
                        <Badge className="bg-[#6C16F8]/10 text-[#6C16F8] border-[#6C16F8]/20">AI</Badge>
                      </div>
                    </div>
                    <div>
                      <SubLabel>Module Tags</SubLabel>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-[#2563FF]/10 text-[#2563FF] border-[#2563FF]/20">CRM PRO™</Badge>
                        <Badge className="bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20">OMNI PRO™</Badge>
                        <Badge className="bg-[#6C16F8]/10 text-[#6C16F8] border-[#6C16F8]/20">AI AGENTS</Badge>
                        <Badge className="bg-[#B8924B]/10 text-[#B8924B] border-[#B8924B]/20">JG</Badge>
                      </div>
                    </div>
                  </div>
                </ComponentCard>

                {/* Avatar */}
                <div className="space-y-8">
                  <ComponentCard title="Avatar" desc="Radix Avatar with fallback initials" importPath="import { Avatar, AvatarFallback } from '@/components/ui/avatar'">
                    <div className="flex items-center gap-3">
                      <Avatar><AvatarFallback className="bg-[#B8924B]/10 text-[#B8924B]">JS</AvatarFallback></Avatar>
                      <Avatar><AvatarFallback className="bg-[#3B82F6]/10 text-[#3B82F6]">MA</AvatarFallback></Avatar>
                      <Avatar><AvatarFallback className="bg-[#6C16F8]/10 text-[#6C16F8]">RC</AvatarFallback></Avatar>
                      <Avatar><AvatarFallback className="bg-[#00D26A]/10 text-[#00D26A]">AL</AvatarFallback></Avatar>
                    </div>
                  </ComponentCard>
                  <ComponentCard title="ContactAvatar" desc="Auto-fallback with sizes" importPath="import { ContactAvatar } from '@/components/ui/contact-avatar'">
                    <div className="flex items-center gap-3">
                      {(['xs', 'sm', 'md', 'lg'] as const).map(sz => (
                        <div key={sz} className="flex flex-col items-center gap-2">
                          <ContactAvatar name={sz === 'xs' ? 'Ana' : sz === 'sm' ? 'Bruno Costa' : sz === 'md' ? 'Carlos Dias' : 'Diana'} size={sz} />
                          <span className="text-[9px] font-mono text-white/25">{sz}</span>
                        </div>
                      ))}
                    </div>
                  </ComponentCard>
                </div>

                {/* Card */}
                <ComponentCard title="Card" desc="Container with header, content, footer" importPath="import { Card, CardHeader, ... } from '@/components/ui/card'">
                  <ShadcnCard>
                    <CardHeader>
                      <CardTitle>Pipeline Vendas</CardTitle>
                      <CardDescription>3 etapas · 24 negócios ativos</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Valor total</span>
                        <span className="font-semibold">R$ 127.500</span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button size="sm" className="w-full h-[30px] rounded-[4px] text-xs">Ver Pipeline</Button>
                    </CardFooter>
                  </ShadcnCard>
                </ComponentCard>

                {/* Accordion */}
                <ComponentCard title="Accordion" desc="Collapsible content sections" importPath="import { Accordion, ... } from '@/components/ui/accordion'">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>O que é o João Guirunas CRM?</AccordionTrigger>
                      <AccordionContent>João Guirunas é a plataforma de CRM inteligente para equipes comerciais brasileiras.</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Quantos módulos tem?</AccordionTrigger>
                      <AccordionContent>8 módulos: CRM PRO, OMNI PRO, SCHEDULE PRO, BI PRO, CALL PRO, FORM PRO, SENDS PRO e AI AGENTS.</AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </ComponentCard>
              </div>

              {/* Table — full width */}
              <ComponentCard title="Table" desc="Data grid with module badges" importPath="import { Table, ... } from '@/components/ui/table'">
                <div className="rounded-[2px] border border-white/[0.06] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { id: 1, name: 'Maria Santos', email: 'maria@empresa.com', mod: 'CRM PRO', mc: '#2563FF', status: 'Ativo', value: 'R$ 12.500' },
                        { id: 2, name: 'Pedro Lima', email: 'pedro@tech.io', mod: 'OMNI PRO', mc: '#00D26A', status: 'Pendente', value: 'R$ 8.200' },
                        { id: 3, name: 'Ana Costa', email: 'ana@startup.com', mod: 'AI AGENTS', mc: '#6C16F8', status: 'Ativo', value: 'R$ 23.000' },
                        { id: 4, name: 'João Ramos', email: 'joao@growth.io', mod: 'BI PRO', mc: '#B8924B', status: 'Ativo', value: 'R$ 45.000' },
                      ].map(({ id, name, email, mod, mc, status, value }) => (
                        <TableRow key={id}>
                          <TableCell className="font-mono text-white/30">{id}</TableCell>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell className="text-white/50">{email}</TableCell>
                          <TableCell><Badge style={{ backgroundColor: `${mc}15`, color: mc, borderColor: `${mc}33` }}>{mod}</Badge></TableCell>
                          <TableCell>
                            <Badge className={status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}>{status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ComponentCard>
            </section>

            {/* ── 09 FEEDBACK & STATES ─────────────────────────────────────── */}
            <section>
              <SectionHeader num="09" title="Feedback & States" subtitle="Alert (4 types), Tooltip, Progress, Spinners, Skeleton" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Alerts — 4 types */}
                <ComponentCard title="Alert" desc="4 semantic alert types" importPath="import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'">
                  <div className="space-y-3">
                    <Alert className="border-sky-500/20 bg-sky-500/5 text-sky-400 [&>svg]:text-sky-400">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Info</AlertTitle>
                      <AlertDescription>Pipeline atualizado com sucesso.</AlertDescription>
                    </Alert>
                    <Alert className="border-emerald-500/20 bg-emerald-500/5 text-emerald-400 [&>svg]:text-emerald-400">
                      <Check className="h-4 w-4" />
                      <AlertTitle>Success</AlertTitle>
                      <AlertDescription>Lead importado com sucesso.</AlertDescription>
                    </Alert>
                    <Alert className="border-amber-500/20 bg-amber-500/5 text-amber-400 [&>svg]:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warning</AlertTitle>
                      <AlertDescription>Limite de envios próximo (90%).</AlertDescription>
                    </Alert>
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>Falha ao sincronizar com servidor.</AlertDescription>
                    </Alert>
                  </div>
                </ComponentCard>

                <div className="space-y-8">
                  {/* Tooltip */}
                  <ComponentCard title="Tooltip" desc="Contextual info on hover" importPath="import { Tooltip, ... } from '@/components/ui/tooltip'">
                    <TooltipProvider>
                      <div className="flex gap-3">
                        {[
                          { icon: Heart, tip: 'Favoritar' },
                          { icon: Settings, tip: 'Configurações' },
                          { icon: Mail, tip: 'Enviar email' },
                          { icon: Info, tip: 'Informações' },
                        ].map(({ icon: Ic, tip }) => (
                          <Tooltip key={tip}>
                            <TooltipTrigger asChild><Button variant="outline" size="icon" className="h-[30px] w-[30px] rounded-[4px]"><Ic className="w-4 h-4" /></Button></TooltipTrigger>
                            <TooltipContent><p>{tip}</p></TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  </ComponentCard>

                  {/* Progress Bars */}
                  <ComponentCard title="Progress" desc="4 levels: 25/50/75/100%" importPath="import { Progress } from '@/components/ui/progress'">
                    <div className="space-y-3">
                      {[25, 50, 75, 100].map(v => (
                        <div key={v} className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-white/25 w-8 text-right shrink-0">{v}%</span>
                          <Progress value={v} className="h-2 flex-1" />
                        </div>
                      ))}
                    </div>
                  </ComponentCard>

                  {/* Spinners */}
                  <ComponentCard title="Spinners" desc="S / M / L loading indicators" importPath="import LoadingSpinner from '@/components/ui/loading-spinner'">
                    <div className="flex items-center gap-8">
                      {(['small', 'medium', 'large'] as const).map(size => (
                        <div key={size} className="flex flex-col items-center gap-2">
                          <LoadingSpinner size={size} />
                          <span className="text-[9px] font-mono text-white/25">{size}</span>
                        </div>
                      ))}
                    </div>
                  </ComponentCard>
                </div>
              </div>

              {/* Skeleton Loaders */}
              <GlowCard glow="#3B82F6" className="mt-8">
                <SubLabel>Skeleton Loaders</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <div className="space-y-3">
                    <div className="h-3 w-3/4 bg-white/[0.06] rounded-[2px] animate-pulse" />
                    <div className="h-3 w-full bg-white/[0.04] rounded-[2px] animate-pulse" />
                    <div className="h-3 w-2/3 bg-white/[0.04] rounded-[2px] animate-pulse" />
                    <p className="text-[9px] font-mono text-white/20 mt-2">Text skeleton</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/[0.06] rounded-full animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 bg-white/[0.06] rounded-[2px] animate-pulse" />
                        <div className="h-2.5 w-1/2 bg-white/[0.04] rounded-[2px] animate-pulse" />
                      </div>
                    </div>
                    <p className="text-[9px] font-mono text-white/20 mt-2">Avatar + text</p>
                  </div>
                  <div className="space-y-3">
                    <div className="h-24 w-full bg-white/[0.06] rounded-[2px] animate-pulse" />
                    <div className="h-3 w-3/4 bg-white/[0.04] rounded-[2px] animate-pulse" />
                    <div className="h-3 w-1/2 bg-white/[0.04] rounded-[2px] animate-pulse" />
                    <p className="text-[9px] font-mono text-white/20 mt-2">Card skeleton</p>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 10 LAYOUT ────────────────────────────────────────────────── */}
            <section>
              <SectionHeader num="10" title="Layout" subtitle="Separator, Breadcrumb, Tab Bar 45px, Tabs pattern" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <ComponentCard title="Separator" desc="Horizontal and vertical dividers" importPath="import { Separator } from '@/components/ui/separator'">
                  <div className="space-y-5">
                    <div>
                      <SubLabel>Horizontal</SubLabel>
                      <p className="text-sm text-white/60">Content above</p>
                      <Separator className="my-3" />
                      <p className="text-sm text-white/60">Content below</p>
                    </div>
                    <div>
                      <SubLabel>Vertical</SubLabel>
                      <div className="flex items-center gap-4 h-6">
                        <span className="text-sm text-white/60">CRM</span>
                        <Separator orientation="vertical" />
                        <span className="text-sm text-white/60">OMNI</span>
                        <Separator orientation="vertical" />
                        <span className="text-sm text-white/60">BI</span>
                      </div>
                    </div>
                  </div>
                </ComponentCard>

                <ComponentCard title="Breadcrumb" desc="Navigation hierarchy" importPath="import { Breadcrumb, ... } from '@/components/ui/breadcrumb'">
                  <div className="space-y-4">
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem><BreadcrumbLink href="#">CRM</BreadcrumbLink></BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem><BreadcrumbPage>Pipeline Vendas</BreadcrumbPage></BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                </ComponentCard>
              </div>

              {/* Tab Bar Preview */}
              <ComponentCard title="Tab Bar — 45px Standard" desc="Design system navigation pattern" importPath="import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'">
                <div className="rounded-[2px] overflow-hidden border border-white/[0.08]">
                  <div className="flex items-center h-[45px] border-b border-white/[0.08] bg-[#0a0a0a] px-4">
                    {[
                      { icon: MessageSquare, label: 'Conversas', active: true },
                      { icon: Layers, label: 'Mensagens', active: false },
                      { icon: Zap, label: 'Automações', active: false },
                    ].map(({ icon: Icon, label, active }) => (
                      <button
                        key={label}
                        className={`flex items-center gap-1.5 px-4 h-full text-[13px] font-medium border-b-2 transition-colors ${
                          active ? 'border-[#B8924B] text-white' : 'border-transparent text-white/35 hover:text-white/55'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="h-16 bg-[#0a0a0a]/50 flex items-center justify-center">
                    <span className="text-[10px] text-white/15 font-mono tracking-[0.08em]">TAB CONTENT AREA</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#B8924B]/50" />
                  <p className="text-[10px] text-white/30">Standard: <span className="text-white/50 font-semibold">h-[45px]</span> · active: <span className="text-white/50 font-semibold">border-primary</span> · bg: <span className="text-white/50 font-semibold">bg-zinc-950</span></p>
                </div>
              </ComponentCard>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 5 — FORMS
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="forms" className="mt-0 space-y-32">

            {/* ── 01 TEXT INPUTS ─────────────────────────────────────────── */}
            <section>
              <SectionHeader num="01" title="Text Inputs" subtitle="Full Name, Email, Password, Disabled states" />
              <GlowCard glow="#B8924B">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Full Name</Label>
                    <Input placeholder="João da Silva" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <Input type="email" placeholder="joao@empresa.com" className="pl-9" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Password</Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <Input type="password" placeholder="••••••••" className="pl-9" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Disabled</Label>
                    <Input disabled placeholder="Campo desabilitado" className="opacity-50 cursor-not-allowed" />
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 02 TEXTAREA ────────────────────────────────────────────── */}
            <section>
              <SectionHeader num="02" title="Textarea" subtitle="Multi-line input with character counter" />
              <GlowCard glow="#3B82F6">
                <div className="space-y-6">
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Description</Label>
                    <textarea
                      className="flex min-h-[120px] w-full rounded-[2px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B8924B] resize-none"
                      placeholder="Descreva os detalhes do negócio..."
                      maxLength={500}
                      defaultValue="Lead qualificado, interesse em CRM PRO com integração WhatsApp."
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[9px] font-mono text-white/20">Markdown suportado</span>
                      <span className="text-[9px] font-mono text-white/25">62 / 500</span>
                    </div>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 03 SELECT ──────────────────────────────────────────────── */}
            <section>
              <SectionHeader num="03" title="Select & Dropdowns" subtitle="Single-selection dropdown patterns" />
              <GlowCard glow="#6C16F8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Pipeline</Label>
                    <select className="flex h-10 w-full rounded-[2px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B8924B]">
                      <option>Vendas Inbound</option>
                      <option>Vendas Outbound</option>
                      <option>Pós-venda</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Etapa</Label>
                    <select className="flex h-10 w-full rounded-[2px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/70">
                      <option>Qualificação</option>
                      <option>Proposta</option>
                      <option>Negociação</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Disabled</Label>
                    <select disabled className="flex h-10 w-full rounded-[2px] border border-white/[0.06] bg-white/[0.01] px-3 py-2 text-sm text-white/30 opacity-50">
                      <option>Selecione...</option>
                    </select>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 04 PHONE INPUT ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="04" title="Phone Input" subtitle="International phone with country selector" />
              <GlowCard glow="#00D26A">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">Telefone</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 px-3 rounded-[2px] border border-white/[0.08] bg-white/[0.03] text-sm text-white/60 shrink-0">
                        <span>🇧🇷</span><span className="text-white/40">+55</span>
                      </div>
                      <Input placeholder="(11) 99999-0000" className="flex-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/40 mb-1.5 block font-mono uppercase tracking-[0.08em]">WhatsApp</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 px-3 rounded-[2px] border border-emerald-500/20 bg-emerald-500/5 text-sm shrink-0">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400/60">+55</span>
                      </div>
                      <Input placeholder="(11) 99999-0000" className="flex-1" />
                    </div>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 05 FILE UPLOAD ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="05" title="File Upload" subtitle="Drag and drop upload area" />
              <GlowCard glow="#3B82F6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border-2 border-dashed border-white/[0.08] rounded-[2px] p-8 text-center hover:border-[#B8924B]/30 hover:bg-[#B8924B]/[0.02] transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-[2px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-6 h-6 text-white/30" />
                    </div>
                    <p className="text-[12px] text-white/50 mb-1">Drag & drop or click to browse</p>
                    <p className="text-[10px] font-mono text-white/20">PDF, PNG, JPG — max 10MB</p>
                  </div>
                  <div className="border border-white/[0.06] rounded-[2px] p-4 bg-white/[0.02]">
                    <p className="text-[10px] font-mono text-white/30 mb-3 uppercase tracking-[0.08em]">Uploaded Files</p>
                    <div className="space-y-2">
                      {[
                        { name: 'proposta-comercial.pdf', size: '2.4 MB', done: true },
                        { name: 'logo-cliente.png', size: '340 KB', done: true },
                        { name: 'contrato-v2.docx', size: '1.1 MB', done: false },
                      ].map(({ name, size, done }) => (
                        <div key={name} className="flex items-center gap-3 p-2 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
                          <FileText className="w-4 h-4 text-white/25 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-white/60 truncate">{name}</p>
                            <p className="text-[9px] font-mono text-white/20">{size}</p>
                          </div>
                          {done ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Loader2 className="w-3.5 h-3.5 text-[#B8924B] animate-spin shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 06 INLINE EDIT ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="06" title="Inline Edit" subtitle="Click-to-edit pattern for quick updates" />
              <GlowCard glow="#B8924B">
                <div className="space-y-4">
                  {[
                    { label: 'Deal Name', value: 'Projeto CRM Enterprise' },
                    { label: 'Company', value: 'TechStar Solutions' },
                    { label: 'Value', value: 'R$ 45.000,00' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-4 p-3 rounded-[2px] border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all group cursor-pointer">
                      <span className="text-[10px] font-mono text-white/25 w-24 shrink-0 uppercase tracking-[0.08em]">{label}</span>
                      <span className="text-[13px] text-white/70 flex-1">{value}</span>
                      <Eye className="w-3.5 h-3.5 text-white/10 group-hover:text-white/30 transition-colors" />
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>

            {/* ── 07 COMPOSED FORM ────────────────────────────────────────── */}
            <section>
              <SectionHeader num="07" title="Composed Form" subtitle="Complete form — Create Deal pattern" />
              <GlowCard glow="#B8924B">
                <div className="max-w-xl mx-auto">
                  <h3 className="text-[15px] font-semibold text-white/90 mb-1">Criar Negócio</h3>
                  <p className="text-[11px] text-white/30 mb-6">Preencha os dados para criar um novo negócio no pipeline.</p>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[11px] text-white/40 mb-1.5 block">Nome</Label>
                        <Input placeholder="Ex: Projeto CRM" />
                      </div>
                      <div>
                        <Label className="text-[11px] text-white/40 mb-1.5 block">Valor</Label>
                        <Input placeholder="R$ 0,00" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-white/40 mb-1.5 block">Observações</Label>
                      <textarea className="flex min-h-[80px] w-full rounded-[2px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B8924B] resize-none" placeholder="Notas..." />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="notify-bb" />
                      <Label htmlFor="notify-bb" className="text-[11px] text-white/50">Notificar equipe</Label>
                    </div>
                    <Separator className="bg-white/[0.06]" />
                    <div className="flex justify-end gap-3">
                      <Button variant="ghost" className="h-[30px] rounded-[4px] text-xs">Cancelar</Button>
                      <Button className="h-[30px] rounded-[4px] text-xs gap-1.5"><Plus className="w-3.5 h-3.5" /> Criar Negócio</Button>
                    </div>
                  </div>
                </div>
              </GlowCard>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 6 — MOTION
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="motion" className="mt-0 space-y-32">

            {/* ── 01 PRINCIPLES ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="01" title="Motion Principles" subtitle="GPU-accelerated, purposeful animation" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { title: 'Purposeful', desc: 'Every animation guides the user — no decorative motion.', color: '#B8924B' },
                  { title: 'GPU-first', desc: 'transform and opacity only. 60fps minimum.', color: '#3B82F6' },
                  { title: 'Subtle', desc: '150-300ms for UI. cubic-bezier(0.16, 1, 0.3, 1).', color: '#00D26A' },
                ].map(({ title, desc, color }) => (
                  <GlowCard key={title} glow={color}>
                    <div className="w-10 h-10 rounded-[2px] mb-4 flex items-center justify-center" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}20` }}>
                      <Zap className="w-5 h-5" style={{ color }} />
                    </div>
                    <h3 className="text-[13px] font-semibold text-white/80 mb-2">{title}</h3>
                    <p className="text-[11px] text-white/35 leading-relaxed">{desc}</p>
                  </GlowCard>
                ))}
              </div>
            </section>

            {/* ── 02 EASING CURVES ───────────────────────────────────────── */}
            <section>
              <SectionHeader num="02" title="Easing Curves" subtitle="Standard timing functions" />
              <GlowCard glow="#B8924B">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { name: 'ease-out-expo', value: 'cubic-bezier(0.16, 1, 0.3, 1)', use: 'Entrances' },
                    { name: 'ease-in-out', value: 'cubic-bezier(0.4, 0, 0.2, 1)', use: 'State changes' },
                    { name: 'spring', value: 'stiffness: 300, damping: 30', use: 'Bouncy' },
                    { name: 'ease-out', value: 'cubic-bezier(0, 0, 0.2, 1)', use: 'Exits' },
                  ].map(({ name, value, use }) => (
                    <div key={name} className="p-4 rounded-[2px] bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-[#B8924B]" />
                        <span className="text-[12px] font-semibold text-white/70">{name}</span>
                      </div>
                      <code className="text-[10px] font-mono text-white/30 block mb-1">{value}</code>
                      <span className="text-[10px] text-white/20">{use}</span>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>

            {/* ── 03 ANIMATION CATALOG ────────────────────────────────────── */}
            <section>
              <SectionHeader num="03" title="Animation Catalog" subtitle="8 Framer Motion patterns" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { num: '01', name: 'Orchestration Pulse', dur: '3.5s', desc: 'Hero splash — seed dot + stagger + glow ring', type: 'Entrance', color: '#B8924B' },
                  { num: '02', name: 'Speed Lines', dur: '2s', desc: 'Logo slides with neon speed lines', type: 'Emphasis', color: '#00D26A' },
                  { num: '03', name: 'Particle Orbit', dur: 'Loop', desc: 'Central element + 4 orbital particles', type: 'Continuous', color: '#3B82F6' },
                  { num: '04', name: 'Logo Dissolve', dur: '3s', desc: 'Letters flicker and dissolve', type: 'Exit', color: '#00D26A' },
                  { num: '05', name: 'Morphing Square', dur: '3.5s', desc: 'Square → rounded → circle → back', type: 'Loop', color: '#6C16F8' },
                  { num: '06', name: 'Glitch Reveal', dur: '2s', desc: 'Scanlines + noise + hue-rotate terminal', type: 'Dramatic', color: '#B8924B' },
                  { num: '07', name: 'Stagger Letters', dur: '1.5s', desc: 'Letters rise with spring + rotateX 3D', type: 'Entrance', color: '#3B82F6' },
                  { num: '08', name: 'Brand Reveal', dur: '3s', desc: 'Blinds open, logo with scale + glow', type: 'Hero', color: '#00D26A' },
                ].map(({ num, name, dur, desc, type, color }) => (
                  <GlowCard key={num} glow={color}>
                    <div className="flex items-start gap-4">
                      <span className="text-[28px] font-['Outfit'] font-black text-white/[0.06] leading-none shrink-0">{num}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[13px] font-semibold text-white/80">{name}</h3>
                          <Badge className="text-[9px] bg-white/[0.04] text-white/30 border-white/[0.06]">{type}</Badge>
                        </div>
                        <p className="text-[11px] text-white/35 mb-3">{desc}</p>
                        <span className="text-[10px] font-mono" style={{ color: `${color}80` }}>{dur}</span>
                      </div>
                    </div>
                  </GlowCard>
                ))}
              </div>
            </section>

            {/* ── 04 LIVE DEMOS ───────────────────────────────────────────── */}
            <section>
              <SectionHeader num="04" title="Live Demos" subtitle="Interactive animation previews" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <GlowCard glow="#B8924B">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Fade In Up</h3>
                  <div className="h-32 flex items-center justify-center">
                    <div className="animate-bounce"><div className="w-16 h-16 rounded-[2px] bg-[#B8924B]/20 border border-[#B8924B]/30 flex items-center justify-center"><Rocket className="w-8 h-8 text-[#B8924B]" /></div></div>
                  </div>
                </GlowCard>
                <GlowCard glow="#3B82F6">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Rotation</h3>
                  <div className="h-32 flex items-center justify-center">
                    <div className="animate-spin" style={{ animationDuration: '3s' }}><div className="w-16 h-16 rounded-full border-2 border-[#3B82F6]/30 border-t-[#3B82F6] flex items-center justify-center"><Compass className="w-6 h-6 text-[#3B82F6]" /></div></div>
                  </div>
                </GlowCard>
                <GlowCard glow="#00D26A">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Glow Pulse</h3>
                  <div className="h-32 flex items-center justify-center">
                    <div className="relative"><div className="absolute inset-0 rounded-full bg-[#00D26A]/20 animate-ping" style={{ animationDuration: '2s' }} /><div className="relative w-16 h-16 rounded-full bg-[#00D26A]/10 border border-[#00D26A]/30 flex items-center justify-center"><Sparkles className="w-6 h-6 text-[#00D26A]" /></div></div>
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* ── 05 DURATION SCALE ───────────────────────────────────────── */}
            <section>
              <SectionHeader num="05" title="Duration Scale" subtitle="Timing tokens" />
              <GlowCard glow="#B8924B">
                <div className="space-y-3">
                  {[
                    { ms: 100, label: 'micro', use: 'Hover states', w: 40 },
                    { ms: 150, label: 'fast', use: 'Button press', w: 60 },
                    { ms: 200, label: 'normal', use: 'UI transitions', w: 80 },
                    { ms: 300, label: 'medium', use: 'Panels, accordion', w: 120 },
                    { ms: 500, label: 'slow', use: 'Page transitions', w: 200 },
                    { ms: 1000, label: 'dramatic', use: 'Hero reveals', w: 320 },
                  ].map(({ ms, label, use, w }) => (
                    <div key={ms} className="flex items-center gap-4">
                      <span className="text-[10px] font-mono text-white/30 w-12 text-right shrink-0">{ms}ms</span>
                      <div className="h-5 rounded-[1px] bg-gradient-to-r from-[#B8924B]/50 to-[#B8924B]/10" style={{ width: `${w}px` }} />
                      <span className="text-[10px] font-semibold text-white/50 w-16 shrink-0">{label}</span>
                      <span className="text-[10px] text-white/20">{use}</span>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 7 — CHARTS
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="charts" className="mt-0 space-y-32">

            {/* ── 01 CHART CATALOG ────────────────────────────────────────── */}
            <section>
              <SectionHeader num="01" title="Chart Library" subtitle="12 chart types — Recharts + custom SVG" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { name: 'Bar Chart', icon: BarChart3, v: 2, color: '#B8924B' },
                  { name: 'Line Chart', icon: Target, v: 3, color: '#3B82F6' },
                  { name: 'Area Chart', icon: Layers, v: 3, color: '#00D26A' },
                  { name: 'Donut Chart', icon: Compass, v: 2, color: '#6C16F8' },
                  { name: 'Pie Chart', icon: LayoutGrid, v: 3, color: '#F59E0B' },
                  { name: 'Radar Chart', icon: Shield, v: 2, color: '#EC4899' },
                  { name: 'Radial Bar', icon: Flame, v: 2, color: '#EF4444' },
                  { name: 'Composed', icon: Sparkles, v: 2, color: '#06B6D4' },
                  { name: 'Rings', icon: Crown, v: 1, color: '#8B5CF6' },
                  { name: 'Animated Number', icon: Zap, v: 4, color: '#B8924B' },
                  { name: 'World Map', icon: Globe, v: 3, color: '#3B82F6' },
                  { name: 'KPI Grid', icon: LayoutGrid, v: 1, color: '#00D26A' },
                ].map(({ name, icon: Icon, v, color }) => (
                  <div key={name} className="group p-5 rounded-[2px] border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all">
                    <div className="w-10 h-10 rounded-[2px] mb-3 flex items-center justify-center" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}20` }}>
                      <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.5} />
                    </div>
                    <h4 className="text-[12px] font-semibold text-white/70 mb-0.5">{name}</h4>
                    <p className="text-[9px] font-mono text-white/20">{v} variant{v > 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── 02 BAR CHART ────────────────────────────────────────────── */}
            <section>
              <SectionHeader num="02" title="Bar Chart" subtitle="Monthly performance — SVG bars with hover" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlowCard glow="#B8924B">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Monthly Performance</h3>
                  <div className="flex items-end gap-3 h-48 px-2">
                    {[
                      { m: 'Jan', v: 45 }, { m: 'Fev', v: 62 }, { m: 'Mar', v: 38 }, { m: 'Abr', v: 71 },
                      { m: 'Mai', v: 55 }, { m: 'Jun', v: 89 }, { m: 'Jul', v: 76 }, { m: 'Ago', v: 94 },
                    ].map(({ m, v }) => (
                      <div key={m} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-[9px] font-mono text-white/30">{v}</span>
                        <div className="w-full rounded-t-[2px] bg-gradient-to-t from-[#B8924B] to-[#B8924B]/60 hover:to-[#B8924B]/80 transition-all cursor-pointer" style={{ height: `${(v / 100) * 140}px` }} />
                        <span className="text-[9px] font-mono text-white/20">{m}</span>
                      </div>
                    ))}
                  </div>
                </GlowCard>
                <GlowCard glow="#3B82F6">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Colored Bars — Multi Series</h3>
                  <div className="flex items-end gap-4 h-48 px-2">
                    {[
                      { m: 'Q1', revenue: 120, costs: 80 },
                      { m: 'Q2', revenue: 185, costs: 95 },
                      { m: 'Q3', revenue: 145, costs: 70 },
                      { m: 'Q4', revenue: 210, costs: 110 },
                    ].map(({ m, revenue, costs }) => (
                      <div key={m} className="flex-1 flex flex-col items-center gap-2">
                        <div className="flex gap-1 items-end w-full">
                          <div className="flex-1 rounded-t-[2px] bg-[#B8924B]/70 hover:bg-[#B8924B] transition-all" style={{ height: `${(revenue / 220) * 130}px` }} />
                          <div className="flex-1 rounded-t-[2px] bg-[#3B82F6]/70 hover:bg-[#3B82F6] transition-all" style={{ height: `${(costs / 220) * 130}px` }} />
                        </div>
                        <span className="text-[9px] font-mono text-white/20">{m}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-3 justify-center">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-[2px] bg-[#B8924B]" /><span className="text-[9px] text-white/30">Revenue</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-[2px] bg-[#3B82F6]" /><span className="text-[9px] text-white/30">Costs</span></div>
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* ── 03 DONUT & PIE ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="03" title="Donut & Pie Charts" subtitle="Circular data visualization with SVG" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <GlowCard glow="#6C16F8">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Donut Chart</h3>
                  <div className="flex justify-center py-4">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="20" />
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#B8924B" strokeWidth="20" strokeDasharray="188 377" strokeDashoffset="0" transform="rotate(-90 80 80)" />
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#3B82F6" strokeWidth="20" strokeDasharray="113 377" strokeDashoffset="-188" transform="rotate(-90 80 80)" />
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#00D26A" strokeWidth="20" strokeDasharray="75 377" strokeDashoffset="-301" transform="rotate(-90 80 80)" />
                      <text x="80" y="76" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">73%</text>
                      <text x="80" y="94" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10">Score</text>
                    </svg>
                  </div>
                  <div className="flex gap-3 justify-center">
                    {[{ l: 'CRM', c: '#B8924B' }, { l: 'OMNI', c: '#3B82F6' }, { l: 'BI', c: '#00D26A' }].map(({ l, c }) => (
                      <div key={l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} /><span className="text-[9px] text-white/30">{l}</span></div>
                    ))}
                  </div>
                </GlowCard>

                <GlowCard glow="#F59E0B">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Pie Chart</h3>
                  <div className="flex justify-center py-4">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                      <path d="M80,10 A70,70 0 0,1 145,95 L80,80 Z" fill="#B8924B" opacity="0.8" />
                      <path d="M145,95 A70,70 0 0,1 40,140 L80,80 Z" fill="#F59E0B" opacity="0.8" />
                      <path d="M40,140 A70,70 0 0,1 15,60 L80,80 Z" fill="#3B82F6" opacity="0.8" />
                      <path d="M15,60 A70,70 0 0,1 80,10 L80,80 Z" fill="#00D26A" opacity="0.8" />
                    </svg>
                  </div>
                  <div className="flex gap-3 justify-center flex-wrap">
                    {[{ l: 'Chrome 50%', c: '#B8924B' }, { l: 'Safari 25%', c: '#F59E0B' }, { l: 'Firefox 15%', c: '#3B82F6' }, { l: 'Edge 10%', c: '#00D26A' }].map(({ l, c }) => (
                      <div key={l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} /><span className="text-[9px] text-white/30">{l}</span></div>
                    ))}
                  </div>
                </GlowCard>

                <GlowCard glow="#8B5CF6">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Rings Chart</h3>
                  <div className="flex justify-center py-4">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="65" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                      <circle cx="80" cy="80" r="65" fill="none" stroke="#B8924B" strokeWidth="12" strokeDasharray="326 408" strokeLinecap="round" transform="rotate(-90 80 80)" />
                      <circle cx="80" cy="80" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                      <circle cx="80" cy="80" r="48" fill="none" stroke="#3B82F6" strokeWidth="12" strokeDasharray="211 301" strokeLinecap="round" transform="rotate(-90 80 80)" />
                      <circle cx="80" cy="80" r="31" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                      <circle cx="80" cy="80" r="31" fill="none" stroke="#00D26A" strokeWidth="12" strokeDasharray="136 195" strokeLinecap="round" transform="rotate(-90 80 80)" />
                    </svg>
                  </div>
                  <div className="flex gap-3 justify-center">
                    {[{ l: 'Revenue 80%', c: '#B8924B' }, { l: 'Profit 70%', c: '#3B82F6' }, { l: 'Growth 70%', c: '#00D26A' }].map(({ l, c }) => (
                      <div key={l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} /><span className="text-[9px] text-white/30">{l}</span></div>
                    ))}
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* ── 04 LINE & AREA ──────────────────────────────────────────── */}
            <section>
              <SectionHeader num="04" title="Line & Area Charts" subtitle="Trend visualization with SVG paths" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlowCard glow="#3B82F6">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Multi-Line Chart</h3>
                  <div className="py-4">
                    <svg width="100%" height="140" viewBox="0 0 400 140" preserveAspectRatio="none">
                      <line x1="0" y1="35" x2="400" y2="35" stroke="rgba(255,255,255,0.03)" />
                      <line x1="0" y1="70" x2="400" y2="70" stroke="rgba(255,255,255,0.03)" />
                      <line x1="0" y1="105" x2="400" y2="105" stroke="rgba(255,255,255,0.03)" />
                      <polyline points="0,110 57,85 114,95 171,60 228,70 285,40 342,55 400,20" fill="none" stroke="#B8924B" strokeWidth="2" />
                      <polyline points="0,120 57,105 114,110 171,90 228,95 285,80 342,85 400,60" fill="none" stroke="#3B82F6" strokeWidth="2" />
                      <polyline points="0,130 57,125 114,120 171,115 228,110 285,100 342,105 400,90" fill="none" stroke="#00D26A" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="flex gap-4 justify-center">
                    {[{ l: 'Revenue', c: '#B8924B' }, { l: 'Costs', c: '#3B82F6' }, { l: 'Profit', c: '#00D26A' }].map(({ l, c }) => (
                      <div key={l} className="flex items-center gap-1.5"><div className="w-3 h-[2px]" style={{ backgroundColor: c }} /><span className="text-[9px] text-white/30">{l}</span></div>
                    ))}
                  </div>
                </GlowCard>

                <GlowCard glow="#00D26A">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Area Chart</h3>
                  <div className="py-4">
                    <svg width="100%" height="140" viewBox="0 0 400 140" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#B8924B" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#B8924B" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon points="0,110 57,85 114,95 171,60 228,70 285,40 342,55 400,20 400,140 0,140" fill="url(#areaGrad)" />
                      <polyline points="0,110 57,85 114,95 171,60 228,70 285,40 342,55 400,20" fill="none" stroke="#B8924B" strokeWidth="2" />
                    </svg>
                  </div>
                  <p className="text-[9px] font-mono text-white/15 text-center">monotone · fill gradient · stroke solid</p>
                </GlowCard>
              </div>
            </section>

            {/* ── 05 RADAR & RADIAL ───────────────────────────────────────── */}
            <section>
              <SectionHeader num="05" title="Radar & Radial Bar" subtitle="Multi-dimensional data visualization" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlowCard glow="#EC4899">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Radar Chart</h3>
                  <div className="flex justify-center py-4">
                    <svg width="200" height="200" viewBox="0 0 200 200">
                      {[20, 40, 60].map(r => <polygon key={r} points={[0,1,2,3,4,5].map(i => { const a = (Math.PI * 2 * i / 6) - Math.PI / 2; return `${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`; }).join(' ')} fill="none" stroke="rgba(255,255,255,0.05)" />)}
                      <polygon points="100,45 148,68 148,132 100,155 52,132 52,68" fill="#B8924B" fillOpacity="0.15" stroke="#B8924B" strokeWidth="1.5" />
                      <polygon points="100,55 140,75 140,125 100,145 60,125 60,75" fill="#3B82F6" fillOpacity="0.1" stroke="#3B82F6" strokeWidth="1.5" />
                      {['Automação', 'Integração', 'Adoção', 'Suporte', 'Analytics', 'UX'].map((label, i) => {
                        const a = (Math.PI * 2 * i / 6) - Math.PI / 2;
                        return <text key={label} x={100 + 75 * Math.cos(a)} y={100 + 75 * Math.sin(a)} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8">{label}</text>;
                      })}
                    </svg>
                  </div>
                </GlowCard>

                <GlowCard glow="#EF4444">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Radial Bar / Gauge</h3>
                  <div className="flex justify-center py-4">
                    <svg width="200" height="120" viewBox="0 0 200 120">
                      <path d="M20,110 A80,80 0 0,1 180,110" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" strokeLinecap="round" />
                      <path d="M20,110 A80,80 0 0,1 155,45" fill="none" stroke="#B8924B" strokeWidth="16" strokeLinecap="round" />
                      <text x="100" y="95" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">78%</text>
                      <text x="100" y="112" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="10">Completion</text>
                    </svg>
                  </div>
                  <div className="flex justify-center gap-6 mt-2">
                    {[{ l: 'Automação', v: '85%', c: '#B8924B' }, { l: 'Integração', v: '62%', c: '#3B82F6' }, { l: 'Adoção', v: '45%', c: '#00D26A' }].map(({ l, v, c }) => (
                      <div key={l} className="text-center">
                        <p className="text-[14px] font-bold" style={{ color: c }}>{v}</p>
                        <p className="text-[9px] text-white/20">{l}</p>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* ── 06 ANIMATED NUMBERS ─────────────────────────────────────── */}
            <section>
              <SectionHeader num="06" title="Animated Numbers" subtitle="Integer, Percentage, Currency, Compact formats" />
              <GlowCard glow="#B8924B">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Integer', value: '8,432', format: 'toLocaleString()', color: '#B8924B' },
                    { label: 'Percentage', value: '87.3%', format: 'toFixed(1) + "%"', color: '#00D26A' },
                    { label: 'Currency', value: 'R$ 1.2M', format: 'Intl.NumberFormat', color: '#3B82F6' },
                    { label: 'Compact', value: '1.2K', format: 'notation: "compact"', color: '#6C16F8' },
                  ].map(({ label, value, format, color }) => (
                    <div key={label} className="text-center p-5 rounded-[2px] bg-white/[0.02] border border-white/[0.06]">
                      <p className="text-[10px] font-mono text-white/25 mb-2 uppercase tracking-[0.08em]">{label}</p>
                      <p className="text-[32px] font-['Outfit'] font-black leading-none mb-2" style={{ color }}>{value}</p>
                      <code className="text-[9px] font-mono text-white/15">{format}</code>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>

            {/* ── 07 COMPOSED CHARTS ──────────────────────────────────────── */}
            <section>
              <SectionHeader num="07" title="Composed Charts" subtitle="Bar + Line combinations" />
              <GlowCard glow="#06B6D4">
                <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Bar + Line Overlay</h3>
                <div className="relative h-48 px-2">
                  <div className="flex items-end gap-3 h-full">
                    {[
                      { m: 'Jan', bar: 45, line: 30 }, { m: 'Fev', bar: 62, line: 48 },
                      { m: 'Mar', bar: 38, line: 42 }, { m: 'Abr', bar: 71, line: 55 },
                      { m: 'Mai', bar: 55, line: 50 }, { m: 'Jun', bar: 89, line: 72 },
                    ].map(({ m, bar }) => (
                      <div key={m} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full rounded-t-[2px] bg-[#06B6D4]/40 hover:bg-[#06B6D4]/60 transition-all" style={{ height: `${(bar / 100) * 140}px` }} />
                        <span className="text-[9px] font-mono text-white/20">{m}</span>
                      </div>
                    ))}
                  </div>
                  <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline points="8,85 25,70 42,72 58,55 75,60 92,35" fill="none" stroke="#B8924B" strokeWidth="0.5" />
                    {[{ x: 8, y: 85 }, { x: 25, y: 70 }, { x: 42, y: 72 }, { x: 58, y: 55 }, { x: 75, y: 60 }, { x: 92, y: 35 }].map(({ x, y }) => (
                      <circle key={x} cx={x} cy={y} r="1" fill="#B8924B" />
                    ))}
                  </svg>
                </div>
                <div className="flex gap-4 mt-3 justify-center">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[1px] bg-[#06B6D4]/40" /><span className="text-[9px] text-white/30">Revenue (bar)</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-[2px] bg-[#B8924B]" /><span className="text-[9px] text-white/30">Profit (line)</span></div>
                </div>
              </GlowCard>
            </section>

            {/* ── 08 COLOR PALETTE ────────────────────────────────────────── */}
            <section>
              <SectionHeader num="08" title="Chart Color Palette" subtitle="Data series colors and CSS variables" />
              <GlowCard glow="#B8924B">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { n: 'Revenue', c: '#B8924B' }, { n: 'Costs', c: '#3B82F6' },
                    { n: 'Profit', c: '#00D26A' }, { n: 'Users', c: '#6C16F8' },
                    { n: 'Growth', c: '#F59E0B' }, { n: 'Churn', c: '#EF4444' },
                    { n: 'Sessions', c: '#EC4899' }, { n: 'Automation', c: '#06B6D4' },
                    { n: 'Support', c: '#8B5CF6' }, { n: 'Other', c: '#64748B' },
                  ].map(({ n, c }) => (
                    <div key={n} className="flex items-center gap-3 p-2.5 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
                      <div className="w-4 h-4 rounded-[1px] shrink-0" style={{ backgroundColor: c }} />
                      <div><p className="text-[10px] text-white/50">{n}</p><p className="text-[9px] font-mono text-white/20">{c}</p></div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-white/[0.04]">
                  <code className="text-[10px] font-mono text-white/20">{`--color-revenue: var(--bb-chart-1); --color-costs: var(--bb-chart-2); ...`}</code>
                </div>
              </GlowCard>
            </section>

            {/* ── 09 TOOLTIP & LEGEND ─────────────────────────────────────── */}
            <section>
              <SectionHeader num="09" title="Chart Patterns" subtitle="Tooltip, legend, axis styling standards" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlowCard glow="#3B82F6">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Tooltip Pattern</h3>
                  <div className="p-4 rounded-[2px] bg-[#111] border border-white/[0.08] inline-block">
                    <p className="text-[11px] text-white/50 mb-2 font-medium">Janeiro 2026</p>
                    {[
                      { l: 'Revenue', val: 'R$ 89.2K', c: '#B8924B' },
                      { l: 'Costs', val: 'R$ 45.1K', c: '#3B82F6' },
                      { l: 'Profit', val: 'R$ 44.1K', c: '#00D26A' },
                    ].map(({ l, val, c }) => (
                      <div key={l} className="flex items-center justify-between gap-8 mt-1.5">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} /><span className="text-[10px] text-white/40">{l}</span></div>
                        <span className="text-[10px] font-mono text-white/70">{val}</span>
                      </div>
                    ))}
                  </div>
                </GlowCard>
                <GlowCard glow="#00D26A">
                  <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Legend & Axis Standards</h3>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                      {[{ l: 'Revenue', c: '#B8924B' }, { l: 'Costs', c: '#3B82F6' }, { l: 'Profit', c: '#00D26A' }, { l: 'Users', c: '#6C16F8' }].map(({ l, c }) => (
                        <div key={l} className="flex items-center gap-1.5"><div className="w-3 h-[2px]" style={{ backgroundColor: c }} /><span className="text-[10px] text-white/40">{l}</span></div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-white/[0.04] space-y-1">
                      <p className="text-[10px] text-white/20">Axis: <code className="text-white/30">fontSize: 10 · fill: white/30 · fontFamily: mono</code></p>
                      <p className="text-[10px] text-white/20">Grid: <code className="text-white/30">stroke: white/5 · strokeDasharray: none</code></p>
                      <p className="text-[10px] text-white/20">Cursor: <code className="text-white/30">fill: white/3 · strokeDasharray: 3,3</code></p>
                    </div>
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* ── 10 KPI GRID ─────────────────────────────────────────────── */}
            <section>
              <SectionHeader num="10" title="KPI Grid" subtitle="Dashboard building blocks — big numbers with trends" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {[
                  { label: 'Revenue', value: 'R$ 1.2M', change: '+12.5%', up: true, color: '#B8924B' },
                  { label: 'Active Users', value: '8,432', change: '+5.2%', up: true, color: '#00D26A' },
                  { label: 'Churn Rate', value: '3.1%', change: '-0.8%', up: false, color: '#EF4444' },
                  { label: 'NPS Score', value: '72', change: '0%', up: null, color: '#3B82F6' },
                  { label: 'MRR', value: 'R$ 340K', change: '+8.1%', up: true, color: '#6C16F8' },
                  { label: 'CAC', value: 'R$ 127', change: '-15%', up: false, color: '#F59E0B' },
                  { label: 'LTV', value: 'R$ 4.2K', change: '+9.3%', up: true, color: '#EC4899' },
                  { label: 'ARR', value: 'R$ 4.1M', change: '+18%', up: true, color: '#B8924B' },
                  { label: 'Retention', value: '94%', change: '+1.2%', up: true, color: '#00D26A' },
                  { label: 'Avg Ticket', value: 'R$ 890', change: '+3.5%', up: true, color: '#06B6D4' },
                  { label: 'Conversion', value: '12.4%', change: '+0.8%', up: true, color: '#8B5CF6' },
                  { label: 'Leads/day', value: '47', change: '-2', up: false, color: '#64748B' },
                ].map(({ label, value, change, up, color }) => (
                  <GlowCard key={label} glow={color}>
                    <p className="text-[10px] font-mono text-white/30 mb-2 uppercase tracking-[0.08em]">{label}</p>
                    <p className="text-[28px] font-['Outfit'] font-black text-white/90 leading-none mb-2">{value}</p>
                    <div className="flex items-center gap-1.5">
                      {up !== null && <span className={`text-[11px] font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? '↑' : '↓'}</span>}
                      <span className={`text-[11px] font-mono ${up === true ? 'text-emerald-400/70' : up === false ? 'text-rose-400/70' : 'text-white/25'}`}>{change}</span>
                      <span className="text-[9px] text-white/15">vs last month</span>
                    </div>
                  </GlowCard>
                ))}
              </div>
            </section>

            {/* ── 11 WORLD MAP ─────────────────────────────────────────────── */}
            <section>
              <SectionHeader num="11" title="World Map" subtitle="Geographic data visualization" />
              <GlowCard glow="#3B82F6">
                <div className="h-48 rounded-[2px] bg-white/[0.01] border border-white/[0.04] flex items-center justify-center">
                  <div className="text-center">
                    <Globe className="w-12 h-12 text-white/10 mx-auto mb-3" />
                    <p className="text-[12px] text-white/30">World Map — EqualEarth Projection</p>
                    <p className="text-[10px] text-white/15 mt-1">Variants: No Markers · With Markers · Zoomable</p>
                    <code className="text-[9px] font-mono text-white/10 block mt-2">{`import { ComposableMap, Geographies, Geography } from 'react-simple-maps'`}</code>
                  </div>
                </div>
              </GlowCard>
            </section>

            {/* ── 12 IMPORT REFERENCE ─────────────────────────────────────── */}
            <section>
              <SectionHeader num="12" title="Import Reference" subtitle="Recharts components used in the system" />
              <GlowCard glow="#B8924B">
                <div className="space-y-3">
                  {[
                    "import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'",
                    "import { LineChart, Line, Area, AreaChart } from 'recharts'",
                    "import { PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'",
                    "import { RadialBarChart, RadialBar, ComposedChart } from 'recharts'",
                  ].map((imp) => (
                    <div key={imp} className="p-3 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
                      <code className="text-[10px] font-mono text-white/30">{imp}</code>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 8 — LAYOUT
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="layout" className="mt-0 space-y-32">
            <section>
              <SectionHeader num="01" title="Spacing & Grid" subtitle="4px base unit, radius scale, component heights" />

              <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
                <GlowCard className="md:col-span-3" glow="#B8924B">
                  <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Spacing Scale — 4px Base</h3>
                  <div className="space-y-3">
                    {[4, 8, 12, 16, 24, 32, 48, 64, 96].map((px) => (
                      <div key={px} className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-white/35 w-10 text-right shrink-0">{px}px</span>
                        <div
                          className="h-5 rounded bg-gradient-to-r from-[#B8924B]/60 to-[#B8924B]/10"
                          style={{ width: `${Math.min(px * 2.8, 260)}px` }}
                        />
                        <span className="text-[10px] font-mono text-white/20">{px / 4}u</span>
                      </div>
                    ))}
                  </div>
                </GlowCard>

                <GlowCard className="md:col-span-2" glow="#3B82F6">
                  <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Border Radius</h3>
                  <div className="grid grid-cols-3 gap-5">
                    {[
                      { r: '2px', label: 'xs' },
                      { r: '4px', label: 'sm' },
                      { r: '8px', label: 'default' },
                      { r: '12px', label: 'lg' },
                      { r: '16px', label: 'xl' },
                      { r: '9999px', label: 'full' },
                    ].map(({ r, label }) => (
                      <div key={label} className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 border border-[#3B82F6]/30 bg-[#3B82F6]/[0.07]" style={{ borderRadius: r }} />
                        <p className="text-[9px] font-mono text-white/30">{r}</p>
                        <p className="text-[10px] font-semibold text-white/50">{label}</p>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </div>

              <GlowCard className="mb-8" glow="#00D26A">
                <h3 className="text-[11px] font-mono text-white/40 mb-5 tracking-[0.08em] uppercase">Component Heights</h3>
                <div className="flex flex-wrap items-end gap-8 justify-center">
                  {[
                    { h: 30, label: 'Buttons', color: '#B8924B', sub: 'h-[30px]' },
                    { h: 36, label: 'Inputs', color: '#3B82F6', sub: 'h-[36px]' },
                    { h: 45, label: 'Tab Bars', color: '#00D26A', sub: 'h-[45px]' },
                  ].map(({ h, label, color, sub }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div
                        className="rounded-[2px] border flex items-center justify-center text-[10px] font-mono w-36"
                        style={{ height: `${h}px`, backgroundColor: `${color}12`, color, borderColor: `${color}25` }}
                      >
                        {h}px
                      </div>
                      <span className="text-[11px] text-white/50 font-medium">{label}</span>
                      <code className="text-[9px] font-mono text-white/20">{sub}</code>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>

            {/* Dark Mode */}
            <section>
              <SectionHeader num="02" title="Dark Mode" subtitle="CSS variables — light vs dark comparison" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <GlowCard className="!bg-white !border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 mb-5">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[11px] font-semibold text-gray-800">Light Mode</span>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-[2px] p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#B8924B]/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-[#B8924B]" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-900">João Silva</p>
                            <p className="text-[10px] text-gray-500">Lead Score: 85</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Ativo</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-8 rounded-[2px] bg-[#B8924B] flex items-center justify-center text-[10px] font-medium text-white">Primary</div>
                      <div className="flex-1 h-8 rounded-[2px] bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-700">Secondary</div>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-gray-200 space-y-1.5">
                    <p className="text-[9px] font-mono text-gray-400">--background: 0 0% 100%</p>
                    <p className="text-[9px] font-mono text-gray-400">--foreground: 210 11% 8%</p>
                    <p className="text-[9px] font-mono text-gray-400">--primary: 17 100% 50%</p>
                    <p className="text-[9px] font-mono text-gray-400">--border: 215 20% 89%</p>
                  </div>
                </GlowCard>

                <GlowCard className="overflow-hidden" glow="#6C16F8">
                  <div className="flex items-center gap-2 mb-5">
                    <Moon className="w-3.5 h-3.5 text-[#6C16F8]" />
                    <span className="text-[11px] font-semibold text-white/80">Dark Mode</span>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-[2px] p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#B8924B]/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-[#B8924B]" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-white/90">João Silva</p>
                            <p className="text-[10px] text-white/35">Lead Score: 85</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Ativo</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-8 rounded-[2px] bg-[#B8924B] flex items-center justify-center text-[10px] font-medium text-white">Primary</div>
                      <div className="flex-1 h-8 rounded-[2px] bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[10px] font-medium text-white/60">Secondary</div>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-1.5">
                    <p className="text-[9px] font-mono text-white/25">--background: 220 13% 9%</p>
                    <p className="text-[9px] font-mono text-white/25">--foreground: 220 9% 98%</p>
                    <p className="text-[9px] font-mono text-white/25">--primary: 17 100% 50%</p>
                    <p className="text-[9px] font-mono text-white/25">--border: 220 13% 20%</p>
                  </div>
                </GlowCard>
              </div>

              <GlowCard glow="#00D26A">
                <h3 className="text-[11px] font-mono text-white/40 mb-5 tracking-[0.08em] uppercase">Best Practices</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    { title: 'Semantic tokens only', desc: 'Never hardcode colors. Use --foreground, --background, --muted.' },
                    { title: 'Opacity over new shades', desc: 'Use text-white/40 or bg-white/5 rather than creating new grays.' },
                    { title: 'Test both modes', desc: 'Every component renders in light and dark. Use .dark class toggle.' },
                  ].map(({ title, desc }) => (
                    <div key={title} className="p-4 rounded-[2px] bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[11px] font-semibold text-[#00D26A] mb-1.5">{title}</p>
                      <p className="text-[10px] text-white/30 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 6 — ICONOGRAPHY
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="iconography" className="mt-0 space-y-32">
            <section>
              <SectionHeader num="01" title="Iconography" subtitle="Lucide React — icon set, sizes, stroke width" />

              <GlowCard className="mb-8" glow="#3B82F6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] font-mono text-white/40 tracking-[0.08em] uppercase">Lucide React — Default Set</h3>
                  <code className="text-[10px] font-mono text-white/25">strokeWidth: 1.5</code>
                </div>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-5">
                  {[
                    { icon: MessageSquare, label: 'Chat' },
                    { icon: Phone, label: 'Call' },
                    { icon: Mail, label: 'Email' },
                    { icon: Calendar, label: 'Calendar' },
                    { icon: BarChart3, label: 'Chart' },
                    { icon: Users, label: 'Users' },
                    { icon: Zap, label: 'Zap' },
                    { icon: Bot, label: 'AI' },
                    { icon: Send, label: 'Send' },
                    { icon: FileText, label: 'Doc' },
                    { icon: Search, label: 'Search' },
                    { icon: Star, label: 'Star' },
                    { icon: Shield, label: 'Shield' },
                    { icon: Globe, label: 'Globe' },
                    { icon: Heart, label: 'Heart' },
                    { icon: LayoutGrid, label: 'Grid' },
                    { icon: Palette, label: 'Palette' },
                    { icon: Box, label: 'Box' },
                    { icon: Layers, label: 'Layers' },
                    { icon: Megaphone, label: 'Mega' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 group">
                      <div className="w-10 h-10 rounded-[2px] bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:bg-[#B8924B]/10 group-hover:border-[#B8924B]/20 transition-all duration-200">
                        <Icon className="w-5 h-5 text-white/50 group-hover:text-[#B8924B] transition-colors duration-200" strokeWidth={1.5} />
                      </div>
                      <span className="text-[8px] font-mono text-white/25">{label}</span>
                    </div>
                  ))}
                </div>
              </GlowCard>

              <GlowCard glow="#B8924B">
                <h3 className="text-[11px] font-mono text-white/40 mb-8 tracking-[0.08em] uppercase">Size Scale</h3>
                <div className="flex items-end gap-10 justify-center">
                  {[
                    { size: 15, label: 'Nav', context: 'sidebar' },
                    { size: 16, label: 'Inline', context: 'text' },
                    { size: 20, label: 'Heading', context: 'titles' },
                    { size: 24, label: 'Display', context: 'hero' },
                  ].map(({ size, label, context }) => (
                    <div key={label} className="flex flex-col items-center gap-3">
                      <div className="flex items-center justify-center" style={{ width: `${size + 20}px`, height: `${size + 20}px` }}>
                        <Zap style={{ width: `${size}px`, height: `${size}px` }} className="text-[#B8924B]" strokeWidth={1.5} />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-white/50">{size}px</p>
                        <p className="text-[9px] text-white/25">{label}</p>
                        <p className="text-[8px] text-white/15 font-mono">{context}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </section>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 7 — BRAND
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="brand" className="mt-0 space-y-32">

            {/* Voice */}
            <section>
              <SectionHeader num="01" title="Brand Voice" subtitle="Tom profissional, vocabulário PT-BR" />
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <GlowCard className="md:col-span-2" glow="#B8924B">
                  <h3 className="text-[11px] font-mono text-white/40 mb-5 tracking-[0.08em] uppercase">Tom & Personalidade</h3>
                  <div className="space-y-3">
                    {[
                      { trait: 'Profissional', desc: 'Comunicação direta e confiável' },
                      { trait: 'Direto', desc: 'Vai ao ponto. Sem filler words' },
                      { trait: 'Minimalista', desc: 'Cada palavra tem propósito' },
                      { trait: 'PT-BR Nativo', desc: 'Linguagem brasileira, não traduzida' },
                    ].map(({ trait, desc }) => (
                      <div key={trait} className="flex items-start gap-3 p-3 rounded-[2px] bg-white/[0.02] border border-white/[0.05]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#B8924B] mt-1.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-white/70">{trait}</p>
                          <p className="text-[10px] text-white/30">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlowCard>

                <GlowCard className="md:col-span-3" glow="#00D26A">
                  <h3 className="text-[11px] font-mono text-white/40 mb-5 tracking-[0.08em] uppercase">Vocabulário</h3>
                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-mono text-emerald-400/60 mb-3 tracking-[0.1em] uppercase flex items-center gap-1.5">
                        <Check className="w-3 h-3" /> Termos Aprovados
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['Lead', 'Pipeline', 'Etapa', 'Negócio', 'Agendamento', 'Campanha', 'Automação', 'Score', 'Conversão', 'Consultor'].map(w => (
                          <span key={w} className="px-2.5 py-1 rounded-[2px] text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">{w}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-rose-400/60 mb-3 tracking-[0.1em] uppercase flex items-center gap-1.5">
                        <XCircle className="w-3 h-3" /> Termos Proibidos
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['Prospect → Lead', 'Deal → Negócio', 'Stage → Etapa', 'Meeting → Agendamento', 'Workflow → Automação', 'Agent → Consultor'].map(w => (
                          <span key={w} className="px-2.5 py-1 rounded-[2px] text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/15">{w}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlowCard>
              </div>
            </section>

            {/* Modules */}
            <section>
              <SectionHeader num="02" title="Modules & Products" subtitle="Ecossistema João Guirunas — 8 módulos" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { name: 'CRM PRO™', desc: 'Pipelines, leads, negócios e kanban', icon: LayoutGrid, color: '#2563FF', large: true },
                  { name: 'OMNI PRO™', desc: 'Inbox unificado, WhatsApp, Instagram', icon: MessageSquare, color: '#00D26A', large: true },
                  { name: 'SCHEDULE PRO™', desc: 'Agendamentos e calendário', icon: Calendar, color: '#F59E0B' },
                  { name: 'BI PRO™', desc: 'Dashboards e KPIs', icon: BarChart3, color: '#8B5CF6' },
                  { name: 'CALL PRO™', desc: 'Dialer e call center', icon: Phone, color: '#EF4444' },
                  { name: 'FORM PRO™', desc: 'Formulários e LPs', icon: FileText, color: '#EC4899' },
                  { name: 'SENDS PRO™', desc: 'Campanhas em massa', icon: Send, color: '#06B6D4' },
                  { name: 'AI AGENTS', desc: 'Agentes IA e automação', icon: Bot, color: '#6C16F8' },
                ].map(({ name, desc, icon: Icon, color, large }) => (
                  <div
                    key={name}
                    className={`group relative rounded-[2px] border border-white/[0.06] bg-white/[0.02] transition-all duration-300 overflow-hidden hover:border-white/[0.12] hover:bg-white/[0.04] ${
                      large ? 'md:col-span-2 p-8' : 'p-6'
                    }`}
                  >
                    <div
                      className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[50px]"
                      style={{ backgroundColor: `${color}15` }}
                    />
                    <div className="relative">
                      <div
                        className={`rounded-[2px] flex items-center justify-center ${large ? 'w-12 h-12 mb-5' : 'w-10 h-10 mb-4'}`}
                        style={{ backgroundColor: `${color}12`, border: `1px solid ${color}20` }}
                      >
                        <Icon className={large ? 'w-6 h-6' : 'w-5 h-5'} style={{ color }} strokeWidth={1.5} />
                      </div>
                      <h4 className={`font-bold text-white/85 tracking-tight ${large ? 'text-base' : 'text-[13px]'}`}>{name}</h4>
                      <p className={`text-white/30 mt-1 leading-relaxed ${large ? 'text-[12px]' : 'text-[11px]'}`}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Accessibility */}
            <section>
              <SectionHeader num="03" title="Accessibility" subtitle="Contraste, focus states, screen reader" />
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <GlowCard className="md:col-span-3" glow="#22C55E">
                  <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Contrast Requirements</h3>
                  <div className="space-y-4">
                    {[
                      { bg: '#0a0a0a', fg: '#FFFFFF', label: 'Text on background', ratio: '19.3:1', pass: 'AAA' },
                      { bg: '#0a0a0a', fg: '#B8924B', label: 'Primary on background', ratio: '4.8:1', pass: 'AA' },
                      { bg: '#0a0a0a', fg: '#3B82F6', label: 'Accent on background', ratio: '4.6:1', pass: 'AA' },
                      { bg: '#B8924B', fg: '#FFFFFF', label: 'Text on primary', ratio: '3.9:1', pass: 'AA Lg' },
                    ].map(({ bg, fg, label, ratio, pass }) => (
                      <div key={label} className="flex items-center gap-4 p-3 rounded-[2px] bg-white/[0.02] border border-white/[0.05]">
                        <div className="flex gap-1 shrink-0">
                          <div className="w-6 h-6 rounded" style={{ backgroundColor: bg, border: '1px solid rgba(255,255,255,0.1)' }} />
                          <div className="w-6 h-6 rounded" style={{ backgroundColor: fg, border: '1px solid rgba(255,255,255,0.1)' }} />
                        </div>
                        <div className="flex-1"><p className="text-[10px] text-white/60">{label}</p></div>
                        <code className="text-[10px] font-mono text-white/35 shrink-0">{ratio}</code>
                        <Badge className={`text-[9px] shrink-0 ${pass === 'AAA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-amber-500/10 text-amber-400 border-amber-500/15'}`}>
                          {pass}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </GlowCard>

                <GlowCard className="md:col-span-2" glow="#3B82F6">
                  <h3 className="text-[11px] font-mono text-white/40 mb-6 tracking-[0.08em] uppercase">Focus & Interaction</h3>
                  <div className="space-y-5">
                    <div>
                      <SubLabel>Focus Ring</SubLabel>
                      <Button className="ring-2 ring-[#B8924B] ring-offset-2 ring-offset-[#0a0a0a]">Focused</Button>
                    </div>
                    <div>
                      <SubLabel>Keyboard Nav</SubLabel>
                      <div className="flex items-center gap-2">
                        {['Tab', 'Enter', 'Esc', 'Arrow'].map(k => (
                          <kbd key={k} className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.10] text-[9px] font-mono text-white/50">{k}</kbd>
                        ))}
                      </div>
                    </div>
                    <div>
                      <SubLabel>Screen Reader</SubLabel>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/40">aria-label on icon buttons</p>
                        <p className="text-[10px] text-white/40">role="status" on live regions</p>
                        <p className="text-[10px] text-white/40">sr-only for visual-only content</p>
                      </div>
                    </div>
                  </div>
                </GlowCard>
              </div>
            </section>
          </TabsContent>

          {/* ════════ NEW TABS — Sub-components ════════ */}
          <TabsContent value="foundations" className="mt-0"><FoundationsTab /></TabsContent>
          <TabsContent value="color-tokens" className="mt-0"><ColorTokensTab /></TabsContent>
          <TabsContent value="spacing-layout" className="mt-0"><SpacingLayoutTab /></TabsContent>
          <TabsContent value="surfaces" className="mt-0"><SurfacesTab /></TabsContent>
          <TabsContent value="semantic-tokens" className="mt-0"><SemanticTokensTab /></TabsContent>
          <TabsContent value="token-export" className="mt-0"><TokenExportTab /></TabsContent>
          <TabsContent value="effects" className="mt-0"><EffectsTab /></TabsContent>
          <TabsContent value="patterns" className="mt-0"><PatternsTab /></TabsContent>
          <TabsContent value="vfx" className="mt-0"><VfxTab /></TabsContent>
          <TabsContent value="templates" className="mt-0"><TemplatesTab /></TabsContent>
          <TabsContent value="seo" className="mt-0"><SeoTab /></TabsContent>
          <TabsContent value="lp-sections" className="mt-0"><LpSectionsTab /></TabsContent>
          <TabsContent value="feedback" className="mt-0"><FeedbackTab /></TabsContent>
          <TabsContent value="tables" className="mt-0"><TablesTab /></TabsContent>
          <TabsContent value="cards" className="mt-0"><CardsTab /></TabsContent>
          <TabsContent value="navigation" className="mt-0"><NavigationTab /></TabsContent>
          <TabsContent value="sections" className="mt-0"><SectionsTab /></TabsContent>
          <TabsContent value="flow-diagram" className="mt-0"><FlowDiagramTab /></TabsContent>
          <TabsContent value="advanced" className="mt-0"><AdvancedTab /></TabsContent>

        </div>
      </Tabs>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-8 md:px-12 mt-16 pb-12 pt-8 border-t border-white/[0.06]">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#B8924B]/20" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8924B]/30" />
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#B8924B]/20" />
        </div>
        <p className="text-center font-mono uppercase tracking-[0.12em] text-white/15" style={{ fontSize: '0.6rem' }}>
          João Guirunas Design System // v1.0 // Dark Cockpit Edition
        </p>
      </div>
    </div>
  );
}
