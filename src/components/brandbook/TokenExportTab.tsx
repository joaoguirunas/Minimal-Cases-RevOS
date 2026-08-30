import { useState } from 'react';
import { Check } from 'lucide-react';
import { SectionHeader, GlowCard } from './shared';

const revosCSS = `:root {
  /* ── Palette ─────────────────────────── */
  --background: 220 13% 9%;
  --foreground: 220 9% 98%;
  --primary: 17 100% 50%;
  --primary-foreground: 0 0% 100%;
  --card: 220 13% 11%;
  --card-foreground: 220 9% 98%;
  --popover: 220 13% 11%;
  --popover-foreground: 220 9% 98%;
  --secondary: 220 13% 14%;
  --secondary-foreground: 220 9% 98%;
  --muted: 220 13% 14%;
  --muted-foreground: 220 9% 65%;
  --accent: 217 91% 60%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 220 13% 20%;
  --input: 220 13% 13%;
  --ring: 17 100% 50%;
  --radius: 0.125rem;

  /* ── Extended ────────────────────────── */
  --surface: #111113;
  --surface-alt: #1C1E19;
  --surface-panel: #131318;
  --dim: hsl(220 9% 65%);
  --accent-blue: #3B82F6;
  --success: #00D26A;
  --warning: #F59E0B;
  --error: #EF4444;

  /* ── Fonts ───────────────────────────── */
  --font-display: 'Outfit', sans-serif;
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* ── Motion ──────────────────────────── */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-decel: cubic-bezier(0, 0, 0.2, 1);
}`;

export default function TokenExportTab() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(revosCSS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-32">
      {/* 01 Instructions */}
      <section>
        <SectionHeader num="01" title="Token Export" subtitle="Copy João Guirunas theme tokens for Tailwind + shadcn/ui projects" />
        <GlowCard glow="#FF4400">
          <h3 className="text-[10px] font-mono text-white/30 mb-6 uppercase tracking-[0.08em]">3-Step Integration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Select Theme', desc: 'REVOS uses a single dark theme. Copy the CSS below.' },
              { step: '02', title: 'Copy CSS', desc: 'Click "Copy CSS" to copy all tokens to clipboard.' },
              { step: '03', title: 'Paste', desc: 'Paste into index.css or globals.css inside @layer base.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="p-4 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[24px] font-['Outfit'] font-black text-[#FF4400]/20">{step}</span>
                <h4 className="text-[12px] font-semibold text-white/60 mt-2 mb-1">{title}</h4>
                <p className="text-[10px] text-white/30">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
            <p className="text-[10px] text-white/25">Works with: Tailwind v3 + v4, shadcn/ui, Lovable, Vite, Next.js</p>
          </div>
        </GlowCard>
      </section>

      {/* 02 REVOS Dark Theme */}
      <section>
        <SectionHeader num="02" title="João Guirunas Dark Theme" subtitle="Dark Cockpit Edition — complete CSS variable set" />
        <GlowCard glow="#FF4400">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-[11px] font-mono text-white/40 uppercase tracking-[0.08em]">João Guirunas Dark Cockpit</h3>
              <div className="flex gap-2">
                {[
                  { label: 'Accent', color: '#FF4400' },
                  { label: 'Surface', color: '#111113' },
                  { label: 'Text', color: '#F4F4E8' },
                  { label: 'Border', color: '#2D2D2D' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.04]">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[8px] font-mono text-white/30">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="h-[30px] px-4 rounded-[2px] text-[11px] font-mono font-medium border transition-all flex items-center gap-2"
              style={{
                backgroundColor: copied ? 'rgba(0,210,106,0.1)' : 'rgba(255,68,0,0.1)',
                borderColor: copied ? 'rgba(0,210,106,0.3)' : 'rgba(255,68,0,0.3)',
                color: copied ? '#00D26A' : '#FF4400',
              }}
            >
              {copied ? <><Check className="w-3 h-3" /> Copied!</> : 'Copy CSS'}
            </button>
          </div>
          <div className="relative rounded-[2px] bg-[#050505] border border-white/[0.06] overflow-hidden">
            <div className="absolute top-2 left-3 flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/10" />
              <div className="w-2 h-2 rounded-full bg-white/10" />
              <div className="w-2 h-2 rounded-full bg-white/10" />
            </div>
            <pre className="p-6 pt-8 text-[10px] font-mono text-white/40 leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto">
              {revosCSS}
            </pre>
          </div>
        </GlowCard>
      </section>

      {/* 03 Font Stack */}
      <section>
        <SectionHeader num="03" title="Font Stack" subtitle="3 font families for display, body, and code" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Display', font: "'Outfit', sans-serif", token: '--font-display', sample: 'REVOS CRM', weight: 900, size: '28px' },
            { name: 'Sans', font: "'Inter', sans-serif", token: '--font-sans', sample: 'Body text for interfaces', weight: 400, size: '14px' },
            { name: 'Mono', font: "'JetBrains Mono', monospace", token: '--font-mono', sample: 'const token = "#FF4400"', weight: 400, size: '12px' },
          ].map(({ name, font, token, sample, weight, size }) => (
            <GlowCard key={name} glow="#3B82F6">
              <h4 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">{name}</h4>
              <p className="text-white/60 mb-4" style={{ fontFamily: font, fontWeight: weight, fontSize: size }}>{sample}</p>
              <div className="pt-3 border-t border-white/[0.04] space-y-1">
                <code className="text-[9px] font-mono text-[#FF4400]/40 block">{token}</code>
                <code className="text-[9px] font-mono text-white/20 block">{font}</code>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 04 Motion Tokens */}
      <section>
        <SectionHeader num="04" title="Easing Tokens" subtitle="3 cubic-bezier curves for motion" />
        <GlowCard glow="#00D26A">
          <div className="grid grid-cols-3 gap-6">
            {[
              { name: 'Spring', token: '--ease-spring', value: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', desc: 'Bouncy entrances' },
              { name: 'Smooth', token: '--ease-smooth', value: 'cubic-bezier(0.4, 0, 0.2, 1)', desc: 'General transitions' },
              { name: 'Decel', token: '--ease-decel', value: 'cubic-bezier(0, 0, 0.2, 1)', desc: 'Exits and fades' },
            ].map(({ name, token, value, desc }) => (
              <div key={name}>
                <h4 className="text-[11px] font-medium text-white/50 mb-1">{name}</h4>
                <p className="text-[10px] text-white/25 mb-2">{desc}</p>
                <code className="text-[9px] font-mono text-[#FF4400]/40 block mb-1">{token}</code>
                <code className="text-[8px] font-mono text-white/15">{value}</code>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
