import { Type, Palette, Layers, Box, Zap, Settings } from 'lucide-react';
import { SectionHeader, GlowCard } from './shared';

const sections = [
  { num: '01', title: 'Typography', desc: 'Font Families & Scale', detail: 'Display, Sans, Mono typefaces with weight systems', icon: Type, color: '#FF4400' },
  { num: '02', title: 'Color Tokens', desc: 'Core Palette', detail: 'Accent, surface, text, neutral, and border colors', icon: Palette, color: '#3B82F6' },
  { num: '03', title: 'Spacing & Layout', desc: 'Named Tokens & Scale', detail: 'Semantic spacing rules and responsive breakpoints', icon: Layers, color: '#00D26A' },
  { num: '04', title: 'Surfaces & Borders', desc: 'Elevation · Radius · Glass', detail: 'Surface elevation, glass effects, and border tokens', icon: Box, color: '#6C16F8' },
  { num: '05', title: 'Motion & Easing', desc: 'Curves & Durations', detail: 'Animation primitives and easing specifications', icon: Zap, color: '#F59E0B' },
  { num: '06', title: 'Semantic Tokens', desc: 'Aliases · States · shadcn', detail: 'Interactive states and shadcn/ui integration', icon: Settings, color: '#EC4899' },
];

export default function FoundationsTab() {
  return (
    <div className="space-y-32">
      <section>
        <SectionHeader num="01" title="Design Foundations" subtitle="Index of all foundation tokens and primitives — João Guirunas Design System v1.0" />

        {/* Banner */}
        <div className="mb-12 p-4 rounded-[2px] border border-[#FF4400]/20 bg-[#FF4400]/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#FF4400]/60 tracking-[0.15em] uppercase">REVOS Design Foundations v1.0 // Dark Cockpit Edition</span>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono text-white/25">Design System</span>
              <span className="text-[10px] font-mono text-white/25">6 Sections</span>
              <span className="text-[10px] font-mono text-white/25">2026</span>
            </div>
          </div>
        </div>

        {/* Foundation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map(({ num, title, desc, detail, icon: Icon, color }) => (
            <GlowCard key={num} glow={color} className="group cursor-pointer">
              <div className="flex items-start justify-between mb-6">
                <span className="text-[32px] font-['Outfit'] font-black text-white/[0.06]">{num}</span>
                <div className="w-10 h-10 rounded-[2px] flex items-center justify-center" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}20` }}>
                  <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.5} />
                </div>
              </div>
              <h3 className="text-[14px] font-semibold text-white/80 mb-1">{title}</h3>
              <p className="text-[11px] font-mono text-white/30 mb-3">{desc}</p>
              <p className="text-[10px] text-white/20 leading-relaxed">{detail}</p>
              <div className="mt-4 pt-3 border-t border-white/[0.04]">
                <span className="text-[10px] font-mono text-[#FF4400]/0 group-hover:text-[#FF4400]/50 transition-colors">Ver seção →</span>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* Design Principles */}
      <section>
        <SectionHeader num="02" title="Design Principles" subtitle="Core rules that govern the João Guirunas design system" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { title: 'Dark Cockpit', desc: 'Dark-first design. #0a0a0a canvas, white/opacity text hierarchy, glowing accents.', color: '#FF4400' },
            { title: 'Brutalist Corners', desc: 'rounded-[2px] everywhere. Sharp, intentional, engineered.', color: '#3B82F6' },
            { title: 'Mono Labels', desc: 'font-mono, 10px, uppercase, tracking-[0.08em+]. Technical, precise.', color: '#00D26A' },
            { title: 'Token-Driven', desc: 'Zero hardcoded values. All styling from CSS custom properties.', color: '#6C16F8' },
          ].map(({ title, desc, color }) => (
            <GlowCard key={title} glow={color}>
              <div className="w-2 h-2 rounded-full mb-4" style={{ backgroundColor: color }} />
              <h4 className="text-[12px] font-semibold text-white/70 mb-2">{title}</h4>
              <p className="text-[10px] text-white/30 leading-relaxed">{desc}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* Token Architecture */}
      <section>
        <SectionHeader num="03" title="Token Architecture" subtitle="3-tier token system — primitive → semantic → component" />
        <GlowCard glow="#FF4400">
          <div className="grid grid-cols-3 gap-8">
            {[
              { tier: 'Primitive', desc: 'Raw values: colors, sizes, weights', examples: ['#FF4400', '16px', '600', '0.5rem'], color: '#FF4400' },
              { tier: 'Semantic', desc: 'Purpose-driven aliases', examples: ['--primary', '--bg-surface', '--text-muted', '--border'], color: '#3B82F6' },
              { tier: 'Component', desc: 'Scoped to specific UI elements', examples: ['--btn-bg', '--card-border', '--input-ring', '--badge-fg'], color: '#00D26A' },
            ].map(({ tier, desc, examples, color }) => (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <h4 className="text-[11px] font-mono text-white/50 uppercase tracking-[0.08em]">{tier}</h4>
                </div>
                <p className="text-[10px] text-white/30 mb-4">{desc}</p>
                <div className="space-y-1.5">
                  {examples.map((ex) => (
                    <div key={ex} className="px-2.5 py-1 rounded-[2px] bg-white/[0.03] border border-white/[0.04]">
                      <code className="text-[9px] font-mono" style={{ color: `${color}90` }}>{ex}</code>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
