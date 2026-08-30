import { Check, ArrowRight, Star, Play } from 'lucide-react';
import { SectionHeader, GlowCard } from './shared';

export default function LpSectionsTab() {
  return (
    <div className="space-y-32">
      {/* 01 Section Shell */}
      <section>
        <SectionHeader num="01" title="Section Shell" subtitle="Layout wrapper — dark/light variants, full-bleed option" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlowCard glow="#FF4400">
            <h3 className="text-[10px] font-mono text-white/30 mb-3 uppercase tracking-[0.08em]">Dark Variant</h3>
            <div className="rounded-[2px] bg-[#050505] border border-white/[0.06] p-6">
              <span className="text-[9px] font-mono text-[#FF4400]/40 tracking-[0.15em] uppercase">01 · Section Name</span>
              <p className="text-[14px] font-semibold text-white/60 mt-3">Section content area</p>
              <p className="text-[10px] text-white/25 mt-1">py-24 md:py-32 · max-w-[1400px]</p>
            </div>
          </GlowCard>
          <GlowCard glow="#F59E0B">
            <h3 className="text-[10px] font-mono text-white/30 mb-3 uppercase tracking-[0.08em]">Light Variant</h3>
            <div className="rounded-[2px] bg-[#F5F4E7] border border-black/[0.06] p-6">
              <span className="text-[9px] font-mono text-black/30 tracking-[0.15em] uppercase">02 · Section Name</span>
              <p className="text-[14px] font-semibold text-black/70 mt-3">Section content area</p>
              <p className="text-[10px] text-black/30 mt-1">py-24 md:py-32 · max-w-[1400px]</p>
            </div>
          </GlowCard>
        </div>
      </section>

      {/* 02 Section Header */}
      <section>
        <SectionHeader num="02" title="LP Section Header" subtitle="Numbered section labels — mono 11px, tracking 0.2em" />
        <GlowCard glow="#FF4400">
          <div className="space-y-6">
            {['01 · PROBLEM', '02 · SOLUTION', '03 · HOW IT WORKS', '04 · PRICING'].map((label) => (
              <div key={label} className="flex items-center gap-4">
                <span className="text-[11px] font-mono text-[#FF4400]/60 tracking-[0.2em] uppercase">{label}</span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 03 Accent Button */}
      <section>
        <SectionHeader num="03" title="Accent Button" subtitle="3 variants — primary, dark, ghost — with arrow glyph" />
        <GlowCard glow="#FF4400">
          <div className="flex flex-wrap gap-4">
            <button className="h-[42px] px-5 min-w-[200px] rounded-[2px] bg-[#FF4400] text-white text-[11px] font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-[#FF4400]/90 transition-all">
              Start Now <span>↗</span>
            </button>
            <button className="h-[42px] px-5 min-w-[200px] rounded-[2px] bg-[#0a0a0a] text-white border border-white/[0.1] text-[11px] font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-white/[0.05] transition-all">
              Learn More <span>↗</span>
            </button>
            <button className="h-[42px] px-5 min-w-[200px] rounded-[2px] bg-transparent text-white/50 text-[11px] font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:text-white transition-all">
              Watch Demo <span>↗</span>
            </button>
          </div>
        </GlowCard>
      </section>

      {/* 04 Stat Card */}
      <section>
        <SectionHeader num="04" title="Stat Card" subtitle="3 sizes — sm (xl), md (3xl), lg (4xl) — dark/light/accent" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { value: '10x', label: 'Faster', size: 'text-xl', color: '#FF4400' },
            { value: 'R$ 1.2M', label: 'Revenue', size: 'text-3xl', color: '#00D26A' },
            { value: '94%', label: 'Retention', size: 'text-4xl', color: '#3B82F6' },
          ].map(({ value, label, size, color }) => (
            <GlowCard key={label} glow={color}>
              <p className={`${size} font-['Outfit'] font-black text-white/90 mb-1`}>{value}</p>
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.1em]">{label}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 05 Quote Block */}
      <section>
        <SectionHeader num="05" title="Quote Block" subtitle="Testimonial component with avatar, quote mark, attribution" />
        <GlowCard glow="#6C16F8">
          <div className="relative p-6 rounded-[2px] bg-white/[0.01] border border-white/[0.04]">
            <span className="absolute top-2 left-4 text-[48px] font-black text-white/[0.06] select-none leading-none">"</span>
            <p className="text-[14px] text-white/60 leading-relaxed mt-6 mb-6">REVOS transformed our sales pipeline. The AI automation saved us 40+ hours per week and increased our close rate by 35%.</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#6C16F8]/10 border border-[#6C16F8]/20 flex items-center justify-center">
                <span className="text-[11px] font-bold text-[#6C16F8]/60">JS</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-white/50">João Silva</p>
                <p className="text-[9px] text-white/25">CEO, TechCorp</p>
              </div>
            </div>
          </div>
        </GlowCard>
      </section>

      {/* 06 Hero Section */}
      <section>
        <SectionHeader num="06" title="Hero Section" subtitle="Full-bleed hero with headline, watermark, video preview, ticker" />
        <GlowCard glow="#FF4400">
          <div className="rounded-[2px] border border-white/[0.06] overflow-hidden relative">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
              <span className="text-[120px] font-['Outfit'] font-black text-white/[0.02] tracking-[-0.05em]">REVOS</span>
            </div>
            <div className="relative p-8 min-h-[280px] flex flex-col justify-end">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-mono text-[#FF4400]/40 mb-2 uppercase tracking-wider">CRM Intelligence</p>
                  <h2 className="text-[28px] font-['Outfit'] font-black text-white/90 leading-[0.95] mb-4">
                    Eliminate your <span className="text-[#FF4400]">bottleneck</span>
                  </h2>
                  <button className="h-[36px] px-5 rounded-[2px] bg-[#FF4400] text-white text-[10px] font-bold uppercase tracking-wider">See how it works ↗</button>
                </div>
                <div className="rounded-[2px] border border-white/[0.06] bg-white/[0.02] aspect-[16/10] flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#FF4400]/10 border border-[#FF4400]/30 flex items-center justify-center">
                    <Play className="w-4 h-4 text-[#FF4400]" fill="rgba(255,68,0,0.3)" />
                  </div>
                </div>
              </div>
            </div>
            {/* Ticker */}
            <div className="h-8 bg-white/[0.02] border-t border-white/[0.04] flex items-center overflow-hidden px-4">
              <div className="flex gap-6 animate-[ticker_20s_linear_infinite] whitespace-nowrap">
                {[...'React,Supabase,Tailwind,Vercel,shadcn,Recharts'.split(','), ...'React,Supabase,Tailwind,Vercel,shadcn,Recharts'.split(',')].map((t, i) => (
                  <span key={`${t}-${i}`} className="text-[9px] font-mono text-white/20 uppercase">{t}</span>
                ))}
              </div>
              <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
            </div>
          </div>
        </GlowCard>
      </section>

      {/* 07 Pricing Table */}
      <section>
        <SectionHeader num="07" title="Pricing Table" subtitle="3-tier pricing grid with toggle (monthly/annual)" />
        <GlowCard glow="#00D26A">
          <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-[2px] overflow-hidden">
            {[
              { tier: 'Starter', price: 'R$ 97', features: ['5 users', '1 pipeline', 'Basic analytics', 'Email support'], popular: false },
              { tier: 'Growth', price: 'R$ 297', features: ['25 users', '5 pipelines', 'Advanced analytics', 'AI automation', 'Priority support'], popular: true },
              { tier: 'Enterprise', price: 'Custom', features: ['Unlimited users', 'Unlimited pipelines', 'Custom integrations', 'Dedicated CSM', 'SLA guarantee'], popular: false },
            ].map(({ tier, price, features, popular }) => (
              <div key={tier} className={`p-5 ${popular ? 'bg-white/[0.03]' : 'bg-[#0a0a0a]'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-white/60">{tier}</span>
                  {popular && <span className="px-2 py-0.5 rounded-full bg-[#FF4400]/10 border border-[#FF4400]/20 text-[8px] font-mono text-[#FF4400] uppercase">Popular</span>}
                </div>
                <p className="text-[24px] font-['Outfit'] font-black text-white/80 mb-4">{price}<span className="text-[10px] font-normal text-white/25">/mês</span></p>
                <div className="space-y-2 mb-5">
                  {features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-[#00D26A]" />
                      <span className="text-[10px] text-white/40">{f}</span>
                    </div>
                  ))}
                </div>
                <button className={`w-full h-[30px] rounded-[2px] text-[10px] font-mono font-medium uppercase tracking-wider flex items-center justify-center gap-1 ${popular ? 'bg-[#FF4400] text-white' : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}>
                  Get started <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 08 FAQ Accordion */}
      <section>
        <SectionHeader num="08" title="FAQ Section" subtitle="Expandable accordion with numbered items" />
        <GlowCard glow="#F59E0B">
          <div className="divide-y divide-white/[0.06]">
            {[
              { q: 'What is REVOS CRM?', a: 'An intelligent CRM platform with AI-powered automation and analytics.' },
              { q: 'How long to implement?', a: 'Typical setup takes 2-4 weeks including data migration and team onboarding.' },
              { q: 'Is my data secure?', a: 'Yes — all data is encrypted at rest and in transit. SOC2 compliant.' },
              { q: 'Can I integrate with existing tools?', a: 'REVOS connects with 100+ tools including WhatsApp, Slack, Google Calendar.' },
            ].map(({ q, a }, i) => (
              <div key={q} className="py-4">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-[2px] bg-[#FF4400]/10 flex items-center justify-center text-[9px] font-mono text-[#FF4400]/60 font-bold shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[12px] font-medium text-white/60">{q}</span>
                </div>
                <p className="text-[10px] text-white/30 ml-9 mt-2 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 09 Testimonials Grid */}
      <section>
        <SectionHeader num="09" title="Testimonials" subtitle="Review grid with star ratings and highlight card" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-[2px] overflow-hidden">
          {[
            { name: 'Ana Costa', role: 'Head of Sales', text: 'Revenue increased 40% in 3 months.', highlight: false },
            { name: 'Pedro Lima', role: 'CEO', text: 'Best CRM we ever used. Period.', highlight: true },
            { name: 'Maria Santos', role: 'SDR Manager', text: 'Automation saved us 30hrs/week.', highlight: false },
            { name: 'Lucas Oliveira', role: 'RevOps', text: 'The analytics are next-level.', highlight: false },
          ].map(({ name, role, text, highlight }) => (
            <div key={name} className={`p-5 min-h-[180px] flex flex-col justify-between ${highlight ? 'bg-[#FF4400]' : 'bg-[#0a0a0a]'}`}>
              <div>
                <div className="flex gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="w-3 h-3" fill={highlight ? 'white' : '#FF4400'} stroke="none" />)}
                </div>
                <p className={`text-[11px] leading-relaxed mb-4 ${highlight ? 'text-white/90' : 'text-white/40'}`}>{text}</p>
              </div>
              <div>
                <p className={`text-[10px] font-medium ${highlight ? 'text-white' : 'text-white/50'}`}>{name}</p>
                <p className={`text-[9px] ${highlight ? 'text-white/70' : 'text-white/20'}`}>{role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
