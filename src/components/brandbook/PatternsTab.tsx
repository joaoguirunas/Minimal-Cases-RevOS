import { SectionHeader, GlowCard } from './shared';

export default function PatternsTab() {
  return (
    <div className="space-y-32">
      {/* 01 Grid Patterns */}
      <section>
        <SectionHeader num="01" title="Grid Patterns" subtitle="8 background texture patterns — dots, crosshair, wireframe" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'Dot Grid', desc: '16px spacing', bg: 'radial-gradient(circle, rgba(255,68,0,0.15) 1px, transparent 1px)', size: '16px 16px' },
            { name: 'Dot Dense', desc: '8px spacing', bg: 'radial-gradient(circle, rgba(255,68,0,0.1) 0.5px, transparent 0.5px)', size: '8px 8px' },
            { name: 'Dot Sparse', desc: '32px spacing', bg: 'radial-gradient(circle, rgba(255,68,0,0.2) 1.5px, transparent 1.5px)', size: '32px 32px' },
            { name: 'Crosshair', desc: '80px grid', bg: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', size: '80px 80px' },
            { name: 'Crosshair Tight', desc: '40px grid', bg: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', size: '40px 40px' },
            { name: 'Wireframe', desc: '60px perspective', bg: 'linear-gradient(rgba(255,68,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,68,0,0.05) 1px, transparent 1px)', size: '60px 60px' },
            { name: 'Symbol X', desc: '32px tile', bg: 'repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(255,68,0,0.06) 14px, rgba(255,68,0,0.06) 16px), repeating-linear-gradient(-45deg, transparent, transparent 14px, rgba(255,68,0,0.06) 14px, rgba(255,68,0,0.06) 16px)', size: '32px 32px' },
            { name: 'Plus Grid', desc: '32px tile', bg: 'linear-gradient(rgba(255,68,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,68,0,0.06) 1px, transparent 1px), radial-gradient(circle, rgba(255,68,0,0.1) 1px, transparent 1px)', size: '32px 32px' },
          ].map(({ name, desc, bg, size }) => (
            <GlowCard key={name} glow="#FF4400">
              <div className="h-28 rounded-[2px] border border-white/[0.04] mb-3" style={{ backgroundImage: bg, backgroundSize: size }} />
              <p className="text-[10px] font-medium text-white/50">{name}</p>
              <p className="text-[9px] font-mono text-white/20">{desc}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 02 HUD Frames */}
      <section>
        <SectionHeader num="02" title="HUD Frames" subtitle="8 containment elements — brackets, tech, notch" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'Bracket', desc: 'Corner brackets' },
            { name: 'Bracket Full', desc: '4-corner brackets' },
            { name: 'Tech Frame', desc: '12px corner cuts' },
            { name: 'Tech Small', desc: '8px corner cuts' },
            { name: 'Tech Large', desc: '20px corner cuts' },
            { name: 'Notch TR', desc: 'Top-right 16px' },
            { name: 'Notch BL', desc: 'Bottom-left 16px' },
            { name: 'Notch Both', desc: 'Diagonal notches' },
          ].map(({ name, desc }) => (
            <div key={name} className="relative p-5 rounded-[2px] border border-white/[0.06] bg-white/[0.02]">
              {/* Corner bracket decorations */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#FF4400]/30" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#FF4400]/30" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#FF4400]/30" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#FF4400]/30" />
              <div className="h-16 flex items-center justify-center">
                <span className="text-[10px] font-mono text-white/20">FRAME</span>
              </div>
              <p className="text-[10px] font-medium text-white/50">{name}</p>
              <p className="text-[9px] font-mono text-white/20">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 03 Hazard/Warning */}
      <section>
        <SectionHeader num="03" title="Hazard & Warning" subtitle="4 alert pattern treatments — stripes and bars" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlowCard glow="#F59E0B">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Hazard Stripes</h3>
            <div className="h-8 rounded-[2px] mb-4" style={{ background: 'repeating-linear-gradient(45deg, #FF4400, #FF4400 10px, #0a0a0a 10px, #0a0a0a 20px)' }} />
            <div className="h-6 rounded-[2px] mb-4" style={{ background: 'repeating-linear-gradient(45deg, rgba(255,68,0,0.3), rgba(255,68,0,0.3) 5px, transparent 5px, transparent 10px)' }} />
            <div className="h-6 rounded-[2px]" style={{ background: 'repeating-linear-gradient(45deg, rgba(255,68,0,0.15), rgba(255,68,0,0.15) 5px, transparent 5px, transparent 10px)' }} />
          </GlowCard>
          <GlowCard glow="#EF4444">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Warning Bar</h3>
            <div className="h-10 rounded-[2px] bg-[#FF4400] flex items-center px-4 gap-2 mb-4">
              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">Warning: System Alert</span>
            </div>
            <div className="h-8 rounded-[2px] bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center px-3">
              <span className="text-[9px] font-mono text-[#F59E0B]/70">⚠ Caution zone active</span>
            </div>
          </GlowCard>
        </div>
      </section>

      {/* 04 Textures */}
      <section>
        <SectionHeader num="04" title="Textures" subtitle="5 surface treatments — scanlines, noise, data rain" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { name: 'Scanlines', bg: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)' },
            { name: 'Scanlines Heavy', bg: 'repeating-linear-gradient(0deg, transparent, transparent 0.5px, rgba(255,255,255,0.06) 0.5px, rgba(255,255,255,0.06) 1px)' },
            { name: 'Noise', bg: 'none' },
            { name: 'Data Rain', bg: 'repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,68,0,0.04) 39px, rgba(255,68,0,0.04) 40px)' },
            { name: 'Industrial', bg: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.2) 100%)' },
          ].map(({ name, bg }) => (
            <div key={name} className="p-3 rounded-[2px] border border-white/[0.04]">
              <div className="h-20 rounded-[2px] bg-white/[0.02] mb-2" style={{ backgroundImage: bg }} />
              <p className="text-[9px] font-mono text-white/30">{name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 05 Dividers */}
      <section>
        <SectionHeader num="05" title="Dividers & Separators" subtitle="4 section break styles — gradient, arrow, dashed, double" />
        <GlowCard glow="#00D26A">
          <div className="space-y-8">
            <div>
              <p className="text-[9px] font-mono text-white/20 mb-2">Tech Divider</p>
              <div className="h-px bg-gradient-to-r from-transparent via-[#FF4400]/30 to-transparent" />
            </div>
            <div>
              <p className="text-[9px] font-mono text-white/20 mb-2">Arrow Divider</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gradient-to-r from-[#FF4400]/30 to-transparent" />
                <span className="text-[#FF4400]/40 text-xs">→</span>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-mono text-white/20 mb-2">Dashed Divider</p>
              <div className="border-t border-dashed border-[#FF4400]/20" />
            </div>
            <div>
              <p className="text-[9px] font-mono text-white/20 mb-2">Double Divider</p>
              <div className="space-y-1">
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
              </div>
            </div>
          </div>
        </GlowCard>
      </section>

      {/* 06 Circuit Traces */}
      <section>
        <SectionHeader num="06" title="Circuit Traces" subtitle="PCB-inspired decorative patterns" />
        <GlowCard glow="#06B6D4">
          <div className="h-24 rounded-[2px] bg-white/[0.01] border border-white/[0.04] relative overflow-hidden flex items-center justify-center">
            <svg width="100%" height="100%" viewBox="0 0 400 80" className="absolute inset-0">
              <line x1="0" y1="40" x2="120" y2="40" stroke="rgba(255,68,0,0.15)" strokeWidth="1" />
              <circle cx="120" cy="40" r="3" fill="rgba(255,68,0,0.3)" />
              <line x1="120" y1="40" x2="200" y2="20" stroke="rgba(255,68,0,0.15)" strokeWidth="1" />
              <circle cx="200" cy="20" r="3" fill="rgba(255,68,0,0.3)" />
              <line x1="200" y1="20" x2="300" y2="20" stroke="rgba(255,68,0,0.15)" strokeWidth="1" />
              <line x1="200" y1="20" x2="200" y2="60" stroke="rgba(255,68,0,0.1)" strokeWidth="1" />
              <circle cx="200" cy="60" r="3" fill="rgba(255,68,0,0.2)" />
              <line x1="300" y1="20" x2="300" y2="40" stroke="rgba(255,68,0,0.15)" strokeWidth="1" />
              <circle cx="300" cy="40" r="3" fill="rgba(255,68,0,0.3)" />
              <line x1="300" y1="40" x2="400" y2="40" stroke="rgba(255,68,0,0.15)" strokeWidth="1" />
            </svg>
            <span className="text-[10px] font-mono text-white/15 relative z-10">Circuit Trace Pattern</span>
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
