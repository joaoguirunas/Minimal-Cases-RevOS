import React from 'react';

export function SectionHeader({ num, title, subtitle }: { num: string; title: string; subtitle: string }) {
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

export function GlowCard({ children, className = '', glow }: { children: React.ReactNode; className?: string; glow?: string }) {
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

export function ComponentCard({ title, desc, importPath, children, className = '' }: {
  title: string; desc: string; importPath: string; children: React.ReactNode; className?: string;
}) {
  return (
    <GlowCard className={className} glow="#FF4400">
      <h3 className="text-[13px] font-semibold text-white/80 mb-1">{title}</h3>
      <p className="text-[11px] text-white/35 mb-5">{desc}</p>
      <div className="space-y-4">{children}</div>
      <div className="mt-5 pt-3 border-t border-white/[0.04]">
        <code className="text-[10px] font-mono text-white/20">{importPath}</code>
      </div>
    </GlowCard>
  );
}

export function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-mono text-white/25 mb-3 tracking-[0.1em] uppercase">{children}</p>;
}

export function TokenRow({ token, value, desc }: { token: string; value: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-3">
        <code className="text-[10px] font-mono text-[#FF4400]/70">{token}</code>
        <span className="text-[10px] text-white/25">—</span>
        <span className="text-[10px] text-white/40">{desc}</span>
      </div>
      <code className="text-[10px] font-mono text-white/30">{value}</code>
    </div>
  );
}

export function SwatchRow({ color, name, token }: { color: string; name: string; token: string }) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-white/[0.04] last:border-0">
      <div className="w-8 h-8 rounded-[2px] border border-white/[0.08] shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-white/60">{name}</p>
        <p className="text-[9px] font-mono text-white/25">{token}</p>
      </div>
      <code className="text-[10px] font-mono text-white/30">{color}</code>
    </div>
  );
}
