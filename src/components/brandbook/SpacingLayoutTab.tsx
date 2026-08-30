import { SectionHeader, GlowCard } from './shared';

export default function SpacingLayoutTab() {
  return (
    <div className="space-y-32">
      {/* 01 Named Spacing Tokens */}
      <section>
        <SectionHeader num="01" title="Named Spacing Tokens" subtitle="5 semantic spacing scales — xs through xl" />
        <GlowCard glow="#FF4400">
          <div className="space-y-4">
            {[
              { name: 'xs', value: '8px', units: '2u', color: '#FF4400' },
              { name: 'sm', value: '16px', units: '4u', color: '#3B82F6' },
              { name: 'md', value: '32px', units: '8u', color: '#00D26A' },
              { name: 'lg', value: '48px', units: '12u', color: '#6C16F8' },
              { name: 'xl', value: '64px', units: '16u', color: '#F59E0B' },
            ].map(({ name, value, units, color }) => (
              <div key={name} className="flex items-center gap-4">
                <code className="text-[10px] font-mono text-white/40 w-24">--spacing-{name}</code>
                <div className="h-6 rounded-[2px] transition-all" style={{ width: value, backgroundColor: `${color}30`, border: `1px solid ${color}40` }} />
                <span className="text-[10px] font-mono text-white/25">{value}</span>
                <span className="text-[9px] font-mono text-white/15">{units}</span>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 02 Numeric Scale */}
      <section>
        <SectionHeader num="02" title="Spacing Scale" subtitle="14-step numeric scale — 0 to 180px (4px base unit)" />
        <GlowCard glow="#3B82F6">
          <div className="space-y-2">
            {[
              { step: 0, px: 0, group: 'Micro UI' },
              { step: 1, px: 4, group: 'Micro UI' },
              { step: 2, px: 8, group: 'Micro UI' },
              { step: 3, px: 12, group: 'Micro UI' },
              { step: 4, px: 15, group: 'Components' },
              { step: 5, px: 20, group: 'Components' },
              { step: 6, px: 30, group: 'Components' },
              { step: 7, px: 40, group: 'Section' },
              { step: 8, px: 60, group: 'Section' },
              { step: 9, px: 80, group: 'Section' },
              { step: 10, px: 90, group: 'Layout' },
              { step: 11, px: 120, group: 'Layout' },
              { step: 12, px: 150, group: 'Editorial' },
              { step: 13, px: 180, group: 'Editorial' },
            ].map(({ step, px, group }) => {
              const groupColor = group === 'Micro UI' ? '#FF4400' : group === 'Components' ? '#3B82F6' : group === 'Section' || group === 'Layout' ? '#00D26A' : '#6C16F8';
              return (
                <div key={step} className="flex items-center gap-3">
                  <code className="text-[9px] font-mono text-white/20 w-16 text-right">--space-{step}</code>
                  <span className="text-[9px] font-mono text-white/30 w-10 text-right">{px}px</span>
                  <div className="h-4 rounded-[1px] transition-all" style={{ width: `${Math.max(px * 1.5, 2)}px`, backgroundColor: `${groupColor}40` }} />
                  <span className="text-[8px] font-mono text-white/15">{group}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-white/[0.04] flex gap-4">
            {[
              { name: 'Micro UI', color: '#FF4400', range: '0–3' },
              { name: 'Components', color: '#3B82F6', range: '4–6' },
              { name: 'Section/Layout', color: '#00D26A', range: '7–11' },
              { name: 'Editorial', color: '#6C16F8', range: '12–13' },
            ].map(({ name, color, range }) => (
              <div key={name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] font-mono text-white/25">{name} ({range})</span>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 03 Z-Index Stack */}
      <section>
        <SectionHeader num="03" title="Z-Index Stack" subtitle="5-layer elevation system for overlapping UI" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlowCard glow="#6C16F8">
            <h3 className="text-[10px] font-mono text-white/30 mb-5 uppercase tracking-[0.08em]">Layer Stack</h3>
            <div className="relative h-64">
              {[
                { name: 'Toast', z: 500, color: '#EF4444', y: 0 },
                { name: 'Modal', z: 400, color: '#F59E0B', y: 48 },
                { name: 'Overlay', z: 300, color: '#6C16F8', y: 96 },
                { name: 'Dropdown', z: 200, color: '#3B82F6', y: 144 },
                { name: 'Nav', z: 100, color: '#00D26A', y: 192 },
              ].map(({ name, z, color, y }) => (
                <div
                  key={name}
                  className="absolute left-0 right-0 h-10 rounded-[2px] flex items-center justify-between px-4 border"
                  style={{ top: `${y}px`, backgroundColor: `${color}10`, borderColor: `${color}30`, zIndex: z }}
                >
                  <span className="text-[10px] font-mono text-white/50">{name}</span>
                  <code className="text-[9px] font-mono" style={{ color }}>{z}</code>
                </div>
              ))}
            </div>
          </GlowCard>

          <GlowCard glow="#00D26A">
            <h3 className="text-[10px] font-mono text-white/30 mb-5 uppercase tracking-[0.08em]">Responsive Breakpoints</h3>
            <div className="space-y-4">
              {[
                { name: 'Mobile', bp: 'max-width: 767px', token: '--bp-mobile', w: '30%', color: '#FF4400' },
                { name: 'Tablet', bp: 'min-width: 768px', token: '--bp-tablet', w: '60%', color: '#3B82F6' },
                { name: 'Desktop', bp: 'min-width: 1200px', token: '--bp-desktop', w: '100%', color: '#00D26A' },
              ].map(({ name, bp, token, w, color }) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-white/50">{name}</span>
                    <code className="text-[9px] font-mono text-white/20">{bp}</code>
                  </div>
                  <div className="h-3 rounded-[2px] bg-white/[0.03] overflow-hidden">
                    <div className="h-full rounded-[2px]" style={{ width: w, backgroundColor: `${color}30` }} />
                  </div>
                  <code className="text-[8px] font-mono text-[#FF4400]/30 mt-1 block">{token}</code>
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </section>

      {/* 04 Grid System */}
      <section>
        <SectionHeader num="04" title="Grid System" subtitle="Responsive column layouts with gap tokens" />
        <GlowCard glow="#FF4400">
          <h3 className="text-[10px] font-mono text-white/30 mb-5 uppercase tracking-[0.08em]">Column Grids</h3>
          {[
            { cols: 2, label: '2-col (md)' },
            { cols: 3, label: '3-col (lg)' },
            { cols: 4, label: '4-col (xl)' },
          ].map(({ cols, label }) => (
            <div key={cols} className="mb-6">
              <span className="text-[9px] font-mono text-white/20 mb-2 block">{label}</span>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array.from({ length: cols }).map((_, i) => (
                  <div key={i} className="h-10 rounded-[2px] bg-[#FF4400]/[0.06] border border-[#FF4400]/10 flex items-center justify-center">
                    <span className="text-[9px] font-mono text-[#FF4400]/30">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </GlowCard>
      </section>
    </div>
  );
}
