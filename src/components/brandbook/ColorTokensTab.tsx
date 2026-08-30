import { SectionHeader, GlowCard, SwatchRow, TokenRow } from './shared';

export default function ColorTokensTab() {
  return (
    <div className="space-y-32">
      {/* 01 Core Palette */}
      <section>
        <SectionHeader num="01" title="Core Palette" subtitle="Primary accent, surface, and signal colors — João Guirunas gold edition" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlowCard glow="#FF4400">
            <h3 className="text-[10px] font-mono text-white/30 mb-5 uppercase tracking-[0.08em]">Primary Tokens</h3>
            <SwatchRow color="#FF4400" name="Primary / Accent" token="--bb-accent" />
            <SwatchRow color="#0a0a0a" name="Canvas / Background" token="--bb-canvas" />
            <SwatchRow color="#111113" name="Surface (elevated)" token="--bb-surface" />
            <SwatchRow color="#F4F4E8" name="Cream (primary text)" token="--bb-cream" />
          </GlowCard>
          <GlowCard glow="#3B82F6">
            <h3 className="text-[10px] font-mono text-white/30 mb-5 uppercase tracking-[0.08em]">Signal Colors</h3>
            <SwatchRow color="#3B82F6" name="Blue (secondary)" token="--bb-blue" />
            <SwatchRow color="#F59E0B" name="Warning / Flare" token="--bb-flare" />
            <SwatchRow color="#EF4444" name="Error / Destructive" token="--bb-error" />
            <SwatchRow color="#00D26A" name="Success" token="--bb-success" />
          </GlowCard>
        </div>
      </section>

      {/* 02 Surface Stack */}
      <section>
        <SectionHeader num="02" title="Surface Stack" subtitle="8 elevation levels — dark shell to overlay" />
        <GlowCard glow="#6C16F8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Canvas', color: '#0a0a0a', token: '--bb-canvas', desc: 'Page base' },
              { name: 'Dark Shell', color: '#050505', token: '--bb-dark', desc: 'Hero panels' },
              { name: 'Surface', color: '#111113', token: '--bb-surface', desc: 'Cards, panels' },
              { name: 'Surface Alt', color: '#1C1E19', token: '--bb-surface-alt', desc: 'Nested blocks' },
              { name: 'Surface Deep', color: '#0D0D0D', token: '--bb-surface-deep', desc: 'Code blocks' },
              { name: 'Panel', color: '#131318', token: '--bb-surface-panel', desc: 'Sidebars' },
              { name: 'Console', color: '#0E0E12', token: '--bb-surface-console', desc: 'Terminal zones' },
              { name: 'Overlay', color: 'rgba(15,15,17,0.92)', token: '--bb-surface-overlay', desc: 'Modals' },
            ].map(({ name, color, token, desc }) => (
              <div key={name} className="flex flex-col items-center gap-2 p-4 rounded-[2px] border border-white/[0.04]">
                <div className="w-full h-16 rounded-[2px] border border-white/[0.06]" style={{ backgroundColor: color }} />
                <p className="text-[10px] font-medium text-white/50">{name}</p>
                <code className="text-[9px] font-mono text-[#FF4400]/50">{token}</code>
                <p className="text-[9px] text-white/20">{desc}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 03 Text Hierarchy */}
      <section>
        <SectionHeader num="03" title="Text Hierarchy" subtitle="5-level opacity-based text color system" />
        <GlowCard glow="#FF4400">
          <div className="space-y-0">
            {[
              { name: 'Primary', opacity: '90%', token: '--text-primary', example: 'Main headings and body text' },
              { name: 'Secondary', opacity: '70%', token: '--text-secondary', example: 'Subheadings and descriptions' },
              { name: 'Tertiary', opacity: '55%', token: '--text-tertiary', example: 'Supporting information' },
              { name: 'Muted', opacity: '40%', token: '--text-muted', example: 'Placeholder and disabled text' },
              { name: 'Meta', opacity: '25%', token: '--text-meta', example: 'Timestamps, IDs, footnotes' },
            ].map(({ name, opacity, token, example }) => (
              <div key={name} className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-4">
                  <span className="text-[16px] font-semibold" style={{ color: `rgba(255,255,255,${parseInt(opacity) / 100})` }}>{name}</span>
                  <span className="text-[10px] font-mono text-white/20">{opacity}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px]" style={{ color: `rgba(255,255,255,${parseInt(opacity) / 100})` }}>{example}</span>
                  <code className="text-[9px] font-mono text-[#FF4400]/40">{token}</code>
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 04 Neutral Scale */}
      <section>
        <SectionHeader num="04" title="Neutral Scale" subtitle="Gray ramp for borders, backgrounds, and subtle UI" />
        <GlowCard glow="#3B82F6">
          <div className="flex items-end gap-2">
            {[
              { name: 'Charcoal', color: '#1A1A1A' },
              { name: 'Dim', color: '#2A2A2A' },
              { name: 'Muted', color: '#3D3D3D' },
              { name: 'Silver', color: '#6B6B6B' },
              { name: 'Ash', color: '#8B8B8B' },
              { name: 'Fog', color: '#ABABAB' },
              { name: 'Cloud', color: '#CCCCCC' },
              { name: 'Smoke', color: '#E5E5E5' },
            ].map(({ name, color }, i) => (
              <div key={name} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-[2px] border border-white/[0.04]" style={{ backgroundColor: color, height: `${40 + i * 8}px` }} />
                <p className="text-[9px] font-mono text-white/25">{name}</p>
                <p className="text-[8px] font-mono text-white/15">{color}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 05 Border System */}
      <section>
        <SectionHeader num="05" title="Border System" subtitle="5 semantic border tokens for consistent UI framing" />
        <GlowCard glow="#00D26A">
          <div className="space-y-4">
            {[
              { name: 'Default', token: '--bb-border', value: 'rgba(156,156,156,0.15)', desc: 'Subtle dividers, card edges' },
              { name: 'Soft', token: '--bb-border-soft', value: 'rgba(156,156,156,0.10)', desc: 'Hairline dividers' },
              { name: 'Strong', token: '--bb-border-strong', value: 'rgba(156,156,156,0.25)', desc: 'Active sections, high contrast' },
              { name: 'Hover', token: '--bb-border-hover', value: 'rgba(156,156,156,0.24)', desc: 'Interactive feedback' },
              { name: 'Input', token: '--bb-border-input', value: 'rgba(156,156,156,0.20)', desc: 'Form entry zones' },
            ].map(({ name, token, value, desc }) => (
              <div key={name} className="flex items-center gap-4 py-3 border-b last:border-0" style={{ borderColor: value }}>
                <div className="w-24 h-12 rounded-[2px] bg-white/[0.02]" style={{ border: `2px solid ${value}` }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-medium text-white/60">{name}</span>
                    <code className="text-[9px] font-mono text-[#FF4400]/40">{token}</code>
                  </div>
                  <p className="text-[10px] text-white/25">{desc}</p>
                </div>
                <code className="text-[9px] font-mono text-white/20">{value}</code>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 06 Accent Opacity Ladder */}
      <section>
        <SectionHeader num="06" title="Accent Opacity Ladder" subtitle="14-step opacity scale for layered accent usage" />
        <GlowCard glow="#FF4400">
          <div className="flex gap-2">
            {[0.02, 0.04, 0.05, 0.06, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25, 0.40, 0.50, 0.75, 0.90].map((op) => (
              <div key={op} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full h-14 rounded-[2px]" style={{ backgroundColor: `rgba(255,68,0,${op})` }} />
                <span className="text-[8px] font-mono text-white/20">{(op * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/[0.04]">
            <code className="text-[9px] font-mono text-white/15">Usage: bg-[#FF4400]/{'{opacity}'} — e.g. bg-[#FF4400]/10, border-[#FF4400]/20</code>
          </div>
        </GlowCard>
      </section>

      {/* 07 shadcn/ui Mapping */}
      <section>
        <SectionHeader num="07" title="shadcn/ui Mapping" subtitle="João Guirunas tokens mapped to shadcn CSS variables" />
        <GlowCard glow="#EC4899">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-[9px] font-mono text-white/25 uppercase tracking-wider py-2 pr-4">shadcn token</th>
                  <th className="text-[9px] font-mono text-white/25 uppercase tracking-wider py-2 pr-4">REVOS alias</th>
                  <th className="text-[9px] font-mono text-white/25 uppercase tracking-wider py-2 pr-4">resolved value</th>
                  <th className="text-[9px] font-mono text-white/25 uppercase tracking-wider py-2">preview</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { shadcn: '--background', alias: '--bb-canvas', value: '#0a0a0a' },
                  { shadcn: '--foreground', alias: '--bb-cream', value: 'hsl(220 9% 98%)' },
                  { shadcn: '--primary', alias: '--bb-accent', value: '#FF4400' },
                  { shadcn: '--primary-foreground', alias: '--bb-dark', value: '#FFFFFF' },
                  { shadcn: '--accent', alias: '--bb-accent-10', value: 'rgba(255,68,0,0.10)' },
                  { shadcn: '--destructive', alias: '--bb-error', value: '#EF4444' },
                  { shadcn: '--border', alias: '--bb-border', value: 'hsl(220 13% 20%)' },
                  { shadcn: '--card', alias: '--bb-surface', value: 'hsl(220 13% 11%)' },
                  { shadcn: '--muted', alias: '--bb-muted', value: 'hsl(220 13% 14%)' },
                  { shadcn: '--muted-foreground', alias: '--bb-dim', value: 'hsl(220 9% 65%)' },
                  { shadcn: '--ring', alias: '--bb-accent', value: '#FF4400' },
                  { shadcn: '--input', alias: '--bb-border-input', value: 'hsl(220 13% 13%)' },
                ].map(({ shadcn, alias, value }) => (
                  <tr key={shadcn} className="border-b border-white/[0.03]">
                    <td className="text-[10px] font-mono text-white/50 py-2.5 pr-4">{shadcn}</td>
                    <td className="text-[10px] font-mono text-[#FF4400]/50 py-2.5 pr-4">{alias}</td>
                    <td className="text-[10px] font-mono text-white/25 py-2.5 pr-4">{value}</td>
                    <td className="py-2.5">
                      <div className="w-6 h-6 rounded-[2px] border border-white/[0.06]" style={{ backgroundColor: value.startsWith('hsl') || value.startsWith('rgba') ? undefined : value }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
