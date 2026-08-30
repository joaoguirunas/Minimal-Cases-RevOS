import { SectionHeader, GlowCard } from './shared';

export default function VfxTab() {
  return (
    <div className="space-y-32">
      {/* 01 Film Grain */}
      <section>
        <SectionHeader num="01" title="Film Grain" subtitle="4 intensity levels — subtle to heavy noise overlay" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'Subtle', opacity: 0.05 },
            { name: 'Light', opacity: 0.10 },
            { name: 'Medium', opacity: 0.15 },
            { name: 'Heavy', opacity: 0.25 },
          ].map(({ name, opacity }) => (
            <GlowCard key={name} glow="#F59E0B">
              <div className="relative h-32 rounded-[2px] bg-gradient-to-br from-[#FF4400]/15 to-[#3B82F6]/15 overflow-hidden mb-3">
                <div className="absolute inset-0" style={{ opacity, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[14px] font-['Outfit'] font-bold text-white/60">{name}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/30">{(opacity * 100).toFixed(0)}%</span>
                <code className="text-[9px] font-mono text-[#FF4400]/30">grain-{name.toLowerCase()}</code>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 02 Blend Modes */}
      <section>
        <SectionHeader num="02" title="Blend Modes" subtitle="6 CSS blend modes for compositing layers" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {['multiply', 'screen', 'overlay', 'soft-light', 'color-dodge', 'difference'].map((mode) => (
            <GlowCard key={mode} glow="#6C16F8">
              <div className="relative h-24 rounded-[2px] overflow-hidden mb-3">
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF4400] to-[#3B82F6]" />
                <div className="absolute inset-0 bg-gradient-to-b from-white to-black" style={{ mixBlendMode: mode as any }} />
              </div>
              <code className="text-[10px] font-mono text-white/40">{mode}</code>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 03 Blur Effects */}
      <section>
        <SectionHeader num="03" title="Blur Effects" subtitle="4 blur intensities for depth and focus hierarchy" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'None', blur: 0 },
            { name: 'Subtle', blur: 4 },
            { name: 'Medium', blur: 8 },
            { name: 'Heavy', blur: 16 },
          ].map(({ name, blur }) => (
            <GlowCard key={name} glow="#3B82F6">
              <div className="h-24 rounded-[2px] overflow-hidden mb-3 flex items-center justify-center bg-gradient-to-br from-[#FF4400]/20 to-[#6C16F8]/20">
                <span className="text-[20px] font-['Outfit'] font-bold text-white/60" style={{ filter: `blur(${blur}px)` }}>REVOS</span>
              </div>
              <p className="text-[10px] font-medium text-white/50">{name}</p>
              <code className="text-[9px] font-mono text-white/20">blur({blur}px)</code>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 04 Glow Treatments */}
      <section>
        <SectionHeader num="04" title="Glow Treatments" subtitle="3 glow styles — neon, soft, ring" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: 'Neon Glow', shadow: '0 0 20px #FF4400, 0 0 40px rgba(255,68,0,0.4)', border: '#FF4400' },
            { name: 'Soft Glow', shadow: '0 0 30px rgba(255,68,0,0.15)', border: 'rgba(255,68,0,0.3)' },
            { name: 'Ring Glow', shadow: '0 0 0 2px #FF4400, 0 0 20px rgba(255,68,0,0.3)', border: '#FF4400' },
          ].map(({ name, shadow, border }) => (
            <GlowCard key={name} glow="#FF4400">
              <h3 className="text-[10px] font-mono text-white/30 mb-6 uppercase tracking-[0.08em]">{name}</h3>
              <div className="flex items-center justify-center h-28">
                <div className="w-20 h-20 rounded-[2px] bg-white/[0.02]" style={{ boxShadow: shadow, border: `1px solid ${border}` }} />
              </div>
              <code className="text-[9px] font-mono text-white/15 block text-center mt-4 break-all">{shadow}</code>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 05 Overlay Composites */}
      <section>
        <SectionHeader num="05" title="Overlay Composites" subtitle="4 post-processing overlays — scanlines, CRT, vignette, edge fade" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <GlowCard glow="#00D26A">
            <div className="h-24 rounded-[2px] bg-[#FF4400]/10 relative overflow-hidden mb-3">
              <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)' }} />
            </div>
            <p className="text-[10px] font-mono text-white/40">Scanlines</p>
          </GlowCard>
          <GlowCard glow="#EC4899">
            <div className="h-24 rounded-[2px] bg-[#FF4400]/10 relative overflow-hidden mb-3">
              <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 3px)', borderRadius: '50% / 10%' }} />
            </div>
            <p className="text-[10px] font-mono text-white/40">CRT Effect</p>
          </GlowCard>
          <GlowCard glow="#6C16F8">
            <div className="h-24 rounded-[2px] bg-[#FF4400]/10 relative overflow-hidden mb-3">
              <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 60px 20px rgba(0,0,0,0.6)' }} />
            </div>
            <p className="text-[10px] font-mono text-white/40">Vignette</p>
          </GlowCard>
          <GlowCard glow="#F59E0B">
            <div className="h-24 rounded-[2px] bg-[#FF4400]/10 relative overflow-hidden mb-3">
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.8) 0%, transparent 30%, transparent 70%, rgba(10,10,10,0.8) 100%)' }} />
            </div>
            <p className="text-[10px] font-mono text-white/40">Edge Fade</p>
          </GlowCard>
        </div>
      </section>
    </div>
  );
}
