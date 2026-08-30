import { SectionHeader, GlowCard } from './shared';

export default function SemanticTokensTab() {
  return (
    <div className="space-y-32">
      {/* 01 Semantic Backgrounds */}
      <section>
        <SectionHeader num="01" title="Semantic Backgrounds" subtitle="6 purpose-driven background aliases" />
        <GlowCard glow="#6C16F8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { name: 'Void', token: '--color-bg-void', color: '#000000', desc: 'Absolute black' },
              { name: 'Base', token: '--color-bg-base', color: '#050505', desc: 'Page canvas' },
              { name: 'Surface', token: '--color-bg-surface', color: '#111113', desc: 'Cards, panels' },
              { name: 'Surface Alt', token: '--color-bg-surface-alt', color: '#1C1E19', desc: 'Nested blocks' },
              { name: 'Elevated', token: '--color-bg-elevated', color: '#1C1E19', desc: 'Highlighted panels' },
              { name: 'Overlay', token: '--color-bg-overlay', color: 'rgba(15,15,17,0.92)', desc: 'Modal backdrop' },
            ].map(({ name, token, color, desc }) => (
              <div key={name} className="p-4 rounded-[2px] border border-white/[0.04]">
                <div className="w-full h-16 rounded-[2px] border border-white/[0.06] mb-3" style={{ backgroundColor: color }} />
                <p className="text-[11px] font-medium text-white/50 mb-0.5">{name}</p>
                <code className="text-[9px] font-mono text-[#FF4400]/40 block mb-1">{token}</code>
                <p className="text-[9px] text-white/20">{desc}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 02 Semantic Text */}
      <section>
        <SectionHeader num="02" title="Semantic Text Colors" subtitle="4-level text hierarchy with opacity tokens" />
        <GlowCard glow="#FF4400">
          {[
            { name: 'Base', token: '--color-text-base', opacity: 0.9, desc: 'Primary body text, headings' },
            { name: 'Secondary', token: '--color-text-secondary', opacity: 0.7, desc: 'Descriptions, subheadings' },
            { name: 'Tertiary', token: '--color-text-tertiary', opacity: 0.55, desc: 'Labels, helper text' },
            { name: 'Muted', token: '--color-text-muted', opacity: 0.4, desc: 'Placeholders, disabled' },
          ].map(({ name, token, opacity, desc }) => (
            <div key={name} className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0">
              <div className="flex items-center gap-5">
                <span className="text-[18px] font-semibold w-24" style={{ color: `rgba(255,255,255,${opacity})` }}>{name}</span>
                <span className="text-[12px]" style={{ color: `rgba(255,255,255,${opacity})` }}>The quick brown fox jumps</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="text-[9px] font-mono text-[#FF4400]/40">{token}</code>
                <span className="text-[9px] font-mono text-white/20">{(opacity * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </GlowCard>
      </section>

      {/* 03 Glow & Neon */}
      <section>
        <SectionHeader num="03" title="Glow & Neon" subtitle="6 luminance tokens for accent glow effects" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { name: 'Neon', token: '--neon', color: '#FF4400', opacity: 1, shadow: '0 0 20px #FF4400' },
            { name: 'Neon Dim', token: '--neon-dim', color: '#FF4400', opacity: 0.15, shadow: '0 0 10px rgba(255,68,0,0.15)' },
            { name: 'Neon Glow', token: '--neon-glow', color: '#FF4400', opacity: 0.4, shadow: '0 0 40px rgba(255,68,0,0.4)' },
            { name: 'Accent Glow', token: '--accent-glow', color: '#FF4400', opacity: 0.25, shadow: '0 0 30px rgba(255,68,0,0.25)' },
            { name: 'Glow Soft', token: '--accent-glow-soft', color: '#FF4400', opacity: 0.1, shadow: '0 0 20px rgba(255,68,0,0.1)' },
            { name: 'Ring Glow', token: '--ring-glow', color: '#FF4400', opacity: 0.5, shadow: '0 0 0 2px #FF4400, 0 0 20px rgba(255,68,0,0.3)' },
          ].map(({ name, token, color, opacity, shadow }) => (
            <GlowCard key={name} glow={color}>
              <div className="flex items-center justify-center h-20 mb-4">
                <div className="w-16 h-16 rounded-[2px] border" style={{ borderColor: `rgba(255,68,0,${opacity})`, boxShadow: shadow, backgroundColor: `rgba(255,68,0,${opacity * 0.1})` }} />
              </div>
              <p className="text-[11px] font-medium text-white/50 mb-0.5">{name}</p>
              <code className="text-[9px] font-mono text-[#FF4400]/40">{token}</code>
              <p className="text-[9px] font-mono text-white/15 mt-1">{(opacity * 100).toFixed(0)}%</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 04 Interactive States */}
      <section>
        <SectionHeader num="04" title="Interactive States" subtitle="Focus, selection, and warning state tokens" />
        <GlowCard glow="#3B82F6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { name: 'Focus Brand', token: '--focus-brand', color: '#FF4400', example: 'Ring on focused inputs' },
              { name: 'Focus Neutral', token: '--focus-neutral', color: '#BDBDBD', example: 'Secondary focus ring' },
              { name: 'Selection BG', token: '--selection-bg', color: '#0a0a0a', example: 'Text selection background' },
              { name: 'Selection FG', token: '--selection-fg', color: '#FF4400', example: 'Text selection foreground' },
              { name: 'Warning BG', token: '--warning-bg', color: 'rgba(245,158,11,0.05)', example: 'Warning banner bg' },
              { name: 'Warning Border', token: '--warning-border', color: 'rgba(245,158,11,0.20)', example: 'Warning banner frame' },
            ].map(({ name, token, color, example }) => (
              <div key={name} className="p-3 rounded-[2px] border border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-[2px] border border-white/[0.08]" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-medium text-white/50">{name}</span>
                </div>
                <code className="text-[9px] font-mono text-[#FF4400]/40 block mb-1">{token}</code>
                <p className="text-[9px] text-white/20">{example}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 05 Font Weights */}
      <section>
        <SectionHeader num="05" title="Font Weight Scale" subtitle="7-step weight tokens with preview" />
        <GlowCard glow="#00D26A">
          <div className="space-y-0">
            {[
              { name: 'Thin', weight: 300, token: '--font-thin' },
              { name: 'Regular', weight: 400, token: '--font-regular' },
              { name: 'Medium', weight: 500, token: '--font-medium' },
              { name: 'Semibold', weight: 600, token: '--font-semibold' },
              { name: 'Bold', weight: 700, token: '--font-bold' },
              { name: 'Extrabold', weight: 800, token: '--font-extrabold' },
              { name: 'Black', weight: 900, token: '--font-black' },
            ].map(({ name, weight, token }) => (
              <div key={name} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <span className="text-[16px] text-white/70" style={{ fontWeight: weight }}>{name} — The quick brown fox</span>
                <div className="flex items-center gap-3">
                  <code className="text-[9px] font-mono text-[#FF4400]/40">{token}</code>
                  <span className="text-[9px] font-mono text-white/20 w-8 text-right">{weight}</span>
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
