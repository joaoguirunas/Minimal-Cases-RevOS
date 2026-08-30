import { SectionHeader, GlowCard } from './shared';

export default function SurfacesTab() {
  return (
    <div className="space-y-32">
      {/* 01 Surface Elevation */}
      <section>
        <SectionHeader num="01" title="Surface Elevation" subtitle="8-level surface stack — from canvas to overlay" />
        <GlowCard glow="#6C16F8">
          <div className="flex gap-3 items-end">
            {[
              { name: 'Canvas', bg: '#0a0a0a', level: 0 },
              { name: 'Dark', bg: '#050505', level: 1 },
              { name: 'Surface', bg: '#111113', level: 2 },
              { name: 'Alt', bg: '#1C1E19', level: 3 },
              { name: 'Deep', bg: '#0D0D0D', level: 1 },
              { name: 'Panel', bg: '#131318', level: 2 },
              { name: 'Console', bg: '#0E0E12', level: 1 },
              { name: 'Overlay', bg: 'rgba(15,15,17,0.92)', level: 4 },
            ].map(({ name, bg, level }) => (
              <div key={name} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-[2px] border border-white/[0.06] shadow-lg"
                  style={{ backgroundColor: bg, height: `${60 + level * 20}px` }}
                />
                <p className="text-[9px] font-mono text-white/30">{name}</p>
                <p className="text-[8px] font-mono text-white/15">{bg.length > 15 ? 'rgba(…0.92)' : bg}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 02 Border Radius Scale */}
      <section>
        <SectionHeader num="02" title="Border Radius Scale" subtitle="7-step radius tokens — 2px brutalist to full circle" />
        <GlowCard glow="#3B82F6">
          <div className="flex items-center justify-center gap-8 py-8">
            {[
              { r: '2px', label: 'xs', token: '--radius-xs' },
              { r: '4px', label: 'sm', token: '--radius-sm' },
              { r: '8px', label: 'md', token: '--radius-md' },
              { r: '12px', label: 'lg', token: '--radius-lg' },
              { r: '16px', label: 'xl', token: '--radius-xl' },
              { r: '24px', label: '2xl', token: '--radius-2xl' },
              { r: '9999px', label: 'full', token: '--radius-full' },
            ].map(({ r, label, token }) => (
              <div key={label} className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 border-2 border-[#3B82F6]/40 bg-[#3B82F6]/[0.06]" style={{ borderRadius: r }} />
                <p className="text-[10px] font-semibold text-white/50">{label}</p>
                <p className="text-[9px] font-mono text-white/25">{r}</p>
                <code className="text-[8px] font-mono text-[#FF4400]/30">{token}</code>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 03 Glass & Blur */}
      <section>
        <SectionHeader num="03" title="Glass & Blur Effects" subtitle="Frosted glass surfaces with backdrop blur" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlowCard glow="#FF4400">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Glass Blur (10px)</h3>
            <div className="relative h-40 rounded-[2px] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF4400]/20 to-[#3B82F6]/20" />
              <div className="absolute inset-4 rounded-[2px] border border-white/10 bg-white/[0.05] backdrop-blur-[10px] flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[11px] font-medium text-white/60">Navigation / Modal</p>
                  <code className="text-[9px] font-mono text-white/25">blur(10px)</code>
                </div>
              </div>
            </div>
            <code className="text-[9px] font-mono text-[#FF4400]/30 mt-3 block">--glass-blur: blur(10px)</code>
          </GlowCard>
          <GlowCard glow="#00D26A">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Glass Blur Soft (5px)</h3>
            <div className="relative h-40 rounded-[2px] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00D26A]/15 to-[#6C16F8]/15" />
              <div className="absolute inset-4 rounded-[2px] border border-white/10 bg-white/[0.03] backdrop-blur-[5px] flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[11px] font-medium text-white/60">Tooltips / Popovers</p>
                  <code className="text-[9px] font-mono text-white/25">blur(5px)</code>
                </div>
              </div>
            </div>
            <code className="text-[9px] font-mono text-[#FF4400]/30 mt-3 block">--glass-blur-soft: blur(5px)</code>
          </GlowCard>
        </div>
      </section>

      {/* 04 Elevation Comparison */}
      <section>
        <SectionHeader num="04" title="Elevation Comparison" subtitle="Visual hierarchy through surface depth" />
        <GlowCard glow="#F59E0B">
          <h3 className="text-[10px] font-mono text-white/30 mb-6 uppercase tracking-[0.08em]">Stacked Surfaces</h3>
          <div className="relative h-56 flex items-center justify-center">
            <div className="w-[80%] h-44 rounded-[2px] bg-[#050505] border border-white/[0.04] flex items-end justify-center p-4">
              <div className="w-[80%] h-32 rounded-[2px] bg-[#111113] border border-white/[0.06] flex items-end justify-center p-4">
                <div className="w-[80%] h-20 rounded-[2px] bg-[#1C1E19] border border-white/[0.08] flex items-center justify-center">
                  <div className="w-[70%] h-10 rounded-[2px] bg-white/[0.05] border border-white/10 flex items-center justify-center">
                    <span className="text-[9px] font-mono text-white/30">Overlay</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {['Canvas', 'Surface', 'Elevated', 'Overlay'].map((n, i) => (
              <div key={n} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[1px] border border-white/[0.08]" style={{ backgroundColor: ['#050505', '#111113', '#1C1E19', 'rgba(255,255,255,0.05)'][i] }} />
                <span className="text-[9px] font-mono text-white/25">{n}</span>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
