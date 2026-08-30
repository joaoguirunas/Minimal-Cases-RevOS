import { Play, Check, Star, ArrowRight } from 'lucide-react';
import { SectionHeader, GlowCard } from './shared';

export default function SectionsTab() {
  return (
    <div className="space-y-32">
      {/* 01 Hero Section */}
      <section>
        <SectionHeader num="01" title="Hero Section" subtitle="Full-bleed hero with headline, CTA, video preview" />
        <GlowCard glow="#FF4400">
          <div className="rounded-[2px] border border-white/[0.06] overflow-hidden relative min-h-[240px] flex flex-col justify-end p-6">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[100px] font-['Outfit'] font-black text-white/[0.02] tracking-[-0.05em]">REVOS</span>
            </div>
            <div className="relative grid grid-cols-2 gap-6">
              <div>
                <h2 className="text-[24px] font-['Outfit'] font-black text-white/90 leading-[0.95] mb-3">
                  Eliminate your <span className="text-[#FF4400]">[bottleneck]</span>
                </h2>
                <p className="text-[10px] text-white/30 mb-4">AI-powered CRM that closes deals while you sleep</p>
                <div className="flex gap-2">
                  <button className="h-[30px] px-4 rounded-[2px] bg-[#FF4400] text-white text-[10px] font-bold uppercase tracking-wider">See how it works</button>
                  <button className="h-[30px] px-3 rounded-[2px] border border-white/[0.08] text-white/40 text-[10px] flex items-center gap-1">
                    <Play className="w-3 h-3" /> 90 SEC
                  </button>
                </div>
              </div>
              <div className="rounded-[2px] border border-white/[0.06] bg-white/[0.02] aspect-[16/10] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-[#FF4400]/10 border border-[#FF4400]/30 flex items-center justify-center">
                  <Play className="w-3 h-3 text-[#FF4400]" fill="rgba(255,68,0,0.2)" />
                </div>
              </div>
            </div>
          </div>
        </GlowCard>
      </section>

      {/* 02 Logo Ticker */}
      <section>
        <SectionHeader num="02" title="Logo Ticker" subtitle="Scrolling partner/tech logos — 12 items, infinite loop" />
        <GlowCard glow="#3B82F6">
          <div className="overflow-hidden py-3 border-y border-white/[0.04]">
            <div className="flex gap-10 animate-[ticker_25s_linear_infinite] whitespace-nowrap">
              {[...['React', 'Supabase', 'Tailwind', 'Vercel', 'Docker', 'Claude', 'Stripe', 'GitHub', 'AWS', 'Slack', 'Zapier', 'Notion'], ...['React', 'Supabase', 'Tailwind', 'Vercel', 'Docker', 'Claude', 'Stripe', 'GitHub', 'AWS', 'Slack', 'Zapier', 'Notion']].map((t, i) => (
                <span key={`${t}-${i}`} className="text-[11px] font-mono text-white/20 uppercase tracking-wider shrink-0">{t}</span>
              ))}
            </div>
          </div>
          <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
        </GlowCard>
      </section>

      {/* 03 Stats Section */}
      <section>
        <SectionHeader num="03" title="Stats Section" subtitle="Key metrics display — 4 big numbers with labels" />
        <GlowCard glow="#00D26A">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '10x', label: 'Faster pipeline' },
              { value: '94%', label: 'Client retention' },
              { value: '40+', label: 'Integrations' },
              { value: 'R$ 1.2M', label: 'Revenue generated' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-[28px] font-['Outfit'] font-black text-white/80">{value}</p>
                <p className="text-[10px] font-mono text-white/25 uppercase tracking-[0.08em] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 04 Services Table */}
      <section>
        <SectionHeader num="04" title="Services Section" subtitle="Table layout — ID, service, description, capabilities" />
        <GlowCard glow="#FF4400">
          <div className="divide-y divide-white/[0.06]">
            {[
              { id: '01', name: 'CRM Intelligence', desc: 'AI-powered contact management', tags: ['Leads', 'Scoring', 'Automation'] },
              { id: '02', name: 'Pipeline Automation', desc: 'Visual deal tracking & forecasting', tags: ['Kanban', 'Forecast', 'Analytics'] },
              { id: '03', name: 'Omni Channel', desc: 'WhatsApp, Email, Instagram unified', tags: ['WhatsApp', 'Email', 'Instagram'] },
              { id: '04', name: 'BI & Reports', desc: 'Real-time dashboards and KPIs', tags: ['Dashboards', 'KPIs', 'Export'] },
            ].map(({ id, name, desc, tags }) => (
              <div key={id} className="grid grid-cols-[40px_160px_1fr_1fr] gap-4 py-3 hover:bg-white/[0.015] transition-colors">
                <span className="text-[10px] font-mono text-[#FF4400]/40">{id}</span>
                <span className="text-[11px] font-medium text-white/60">{name}</span>
                <span className="text-[10px] text-white/30">{desc}</span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-[2px] text-[8px] font-mono text-white/25 border border-white/[0.06]">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 05 How It Works */}
      <section>
        <SectionHeader num="05" title="How It Works" subtitle="Step-by-step timeline — staircase pattern" />
        <GlowCard glow="#3B82F6">
          <div className="space-y-0">
            {[
              { week: 'Week 1', title: 'Discovery', desc: 'Understand your sales process' },
              { week: 'Week 2', title: 'Architecture', desc: 'Design custom CRM pipeline' },
              { week: 'Week 3-4', title: 'Implementation', desc: 'Build and configure platform' },
              { week: 'Week 5', title: 'QA & Training', desc: 'Test and train your team' },
              { week: 'Week 6', title: 'Launch', desc: 'Go live with full support' },
            ].map(({ week, title, desc }, i) => (
              <div key={title} className="flex gap-4 py-3 border-b border-white/[0.04] last:border-0" style={{ paddingLeft: `${i * 24}px` }}>
                <span className="text-[9px] font-mono text-[#FF4400]/40 shrink-0 w-16">{week}</span>
                <div>
                  <p className="text-[11px] font-medium text-white/60">{title}</p>
                  <p className="text-[10px] text-white/25">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 06 Testimonials */}
      <section>
        <SectionHeader num="06" title="Testimonials Grid" subtitle="Star ratings, highlight card, gap-px pattern" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/[0.06] rounded-[2px] overflow-hidden">
          {[
            { name: 'Ana Costa', text: 'Revenue up 40% in 3 months', highlight: false },
            { name: 'Pedro Lima', text: 'Best CRM we ever used', highlight: true },
            { name: 'Maria Santos', text: 'Automation saved 30hrs/week', highlight: false },
          ].map(({ name, text, highlight }) => (
            <div key={name} className={`p-5 min-h-[150px] flex flex-col justify-between ${highlight ? 'bg-[#FF4400]' : 'bg-[#0a0a0a]'}`}>
              <div>
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} className="w-2.5 h-2.5" fill={highlight ? 'white' : '#FF4400'} stroke="none" />)}
                </div>
                <p className={`text-[11px] leading-relaxed ${highlight ? 'text-white/90' : 'text-white/40'}`}>{text}</p>
              </div>
              <p className={`text-[10px] font-medium mt-3 ${highlight ? 'text-white' : 'text-white/50'}`}>{name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 07 FAQ */}
      <section>
        <SectionHeader num="07" title="FAQ Section" subtitle="Expandable accordion items with numbered badges" />
        <GlowCard glow="#F59E0B">
          <div className="divide-y divide-white/[0.06]">
            {[
              'What is REVOS CRM?',
              'How long does implementation take?',
              'Do I need programming knowledge?',
              'How secure is my data?',
              'Can I integrate with existing tools?',
              'What support is included?',
            ].map((q, i) => (
              <div key={q} className="py-3 flex items-center gap-3">
                <span className="w-6 h-6 rounded-[2px] bg-[#FF4400]/10 flex items-center justify-center text-[8px] font-mono text-[#FF4400]/60 font-bold shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[11px] text-white/50 flex-1">{q}</span>
                <span className="text-[10px] text-white/15">+</span>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
