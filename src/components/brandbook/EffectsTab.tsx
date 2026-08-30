import { Zap, RotateCw, Heart } from 'lucide-react';
import { SectionHeader, GlowCard } from './shared';

export default function EffectsTab() {
  return (
    <div className="space-y-32">
      {/* 01 Ticker Strip */}
      <section>
        <SectionHeader num="01" title="Ticker Strip" subtitle="Scrolling technology integration marquee" />
        <GlowCard glow="#FF4400">
          <div className="overflow-hidden py-3">
            <div className="flex gap-8 animate-[ticker_20s_linear_infinite] whitespace-nowrap">
              {[...['React', 'TypeScript', 'Tailwind', 'Supabase', 'Vercel', 'shadcn/ui', 'Recharts', 'Framer Motion', 'Zustand', 'React Query'], ...['React', 'TypeScript', 'Tailwind', 'Supabase', 'Vercel', 'shadcn/ui', 'Recharts', 'Framer Motion', 'Zustand', 'React Query']].map((tech, i) => (
                <div key={`${tech}-${i}`} className="flex items-center gap-2 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF4400]/60" />
                  <span className="text-[11px] font-mono text-white/40 uppercase tracking-[0.1em]">{tech}</span>
                </div>
              ))}
            </div>
          </div>
          <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
        </GlowCard>
      </section>

      {/* 02 Badge Variants */}
      <section>
        <SectionHeader num="02" title="Badge Variants" subtitle="5 color variants for status and category badges" />
        <GlowCard glow="#3B82F6">
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Primary', bg: 'rgba(255,68,0,0.1)', border: 'rgba(255,68,0,0.2)', color: '#FF4400' },
              { label: 'Blue', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', color: '#3B82F6' },
              { label: 'Error', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', color: '#EF4444' },
              { label: 'Surface', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' },
              { label: 'Solid', bg: '#FF4400', border: '#FF4400', color: '#FFFFFF' },
            ].map(({ label, bg, border, color }) => (
              <span key={label} className="px-3 py-1 rounded-[2px] text-[10px] font-mono font-medium uppercase tracking-wider" style={{ backgroundColor: bg, border: `1px solid ${border}`, color }}>
                {label}
              </span>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 03 Glow & Pulse */}
      <section>
        <SectionHeader num="03" title="Glow & Pulse" subtitle="3 animated accent effects — neon, spin, pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <GlowCard glow="#FF4400">
            <h3 className="text-[10px] font-mono text-white/30 mb-6 uppercase tracking-[0.08em]">Neon Glow</h3>
            <div className="flex items-center justify-center h-32">
              <div className="w-20 h-20 rounded-[2px] border border-[#FF4400]/40 flex items-center justify-center animate-pulse" style={{ boxShadow: '0 0 30px rgba(255,68,0,0.4), 0 0 60px rgba(255,68,0,0.15)' }}>
                <Zap className="w-8 h-8 text-[#FF4400]" strokeWidth={1.5} />
              </div>
            </div>
            <code className="text-[9px] font-mono text-white/15 block text-center">box-shadow: 0 0 30px accent/40</code>
          </GlowCard>
          <GlowCard glow="#3B82F6">
            <h3 className="text-[10px] font-mono text-white/30 mb-6 uppercase tracking-[0.08em]">Spin</h3>
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin" style={{ animationDuration: '3s' }}>
                <RotateCw className="w-10 h-10 text-[#3B82F6]/60" strokeWidth={1.5} />
              </div>
            </div>
            <code className="text-[9px] font-mono text-white/15 block text-center">animation: spin 3s linear infinite</code>
          </GlowCard>
          <GlowCard glow="#EC4899">
            <h3 className="text-[10px] font-mono text-white/30 mb-6 uppercase tracking-[0.08em]">Pulse</h3>
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse">
                <Heart className="w-10 h-10 text-[#EC4899]" strokeWidth={1.5} fill="rgba(236,72,153,0.2)" />
              </div>
            </div>
            <code className="text-[9px] font-mono text-white/15 block text-center">animation: pulse 2s ease-in-out infinite</code>
          </GlowCard>
        </div>
      </section>

      {/* 04 Hover Effects */}
      <section>
        <SectionHeader num="04" title="Hover Effects" subtitle="Interactive card hover states with transitions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { title: 'Scale', effect: 'hover:scale-[1.03]', color: '#FF4400' },
            { title: 'Border Glow', effect: 'hover:border-accent', color: '#3B82F6' },
            { title: 'Shadow Lift', effect: 'hover:shadow-xl', color: '#00D26A' },
            { title: 'BG Shift', effect: 'hover:bg-white/5', color: '#6C16F8' },
          ].map(({ title, effect, color }) => (
            <div
              key={title}
              className="p-5 rounded-[2px] border border-white/[0.06] bg-white/[0.02] cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:bg-white/[0.04]"
              style={{ ['--hover-color' as string]: color }}
            >
              <div className="w-8 h-8 rounded-[2px] mb-3 flex items-center justify-center" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}20` }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              </div>
              <p className="text-[11px] font-medium text-white/60 mb-1">{title}</p>
              <code className="text-[9px] font-mono text-white/20">{effect}</code>
            </div>
          ))}
        </div>
      </section>

      {/* 05 Film Grain */}
      <section>
        <SectionHeader num="05" title="Film Grain & Overlays" subtitle="Texture overlays for cinematic depth" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'Subtle', opacity: '5%' },
            { name: 'Light', opacity: '10%' },
            { name: 'Medium', opacity: '15%' },
            { name: 'Heavy', opacity: '25%' },
          ].map(({ name, opacity }) => (
            <GlowCard key={name} glow="#F59E0B">
              <div className="relative h-24 rounded-[2px] bg-gradient-to-br from-[#FF4400]/10 to-[#3B82F6]/10 overflow-hidden mb-3">
                <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='${parseInt(opacity)/100}'/%3E%3C/svg%3E")` }} />
              </div>
              <p className="text-[10px] font-medium text-white/50">Grain {name}</p>
              <code className="text-[9px] font-mono text-white/20">opacity: {opacity}</code>
            </GlowCard>
          ))}
        </div>
      </section>
    </div>
  );
}
