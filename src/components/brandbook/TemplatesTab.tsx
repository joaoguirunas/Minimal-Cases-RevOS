import { SectionHeader, GlowCard } from './shared';

export default function TemplatesTab() {
  return (
    <div className="space-y-32">
      {/* 01 Page Shell */}
      <section>
        <SectionHeader num="01" title="Page Shell" subtitle="Standard page anatomy — nav, header, sections, footer" />
        <GlowCard glow="#FF4400">
          <div className="rounded-[2px] border border-white/[0.06] overflow-hidden">
            {/* Nav */}
            <div className="h-10 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-['Outfit'] font-bold"><span className="text-white">REV</span><span className="text-[#FF4400]">OS</span></span>
                <span className="text-[8px] font-mono text-white/20">CRM</span>
              </div>
              <div className="flex gap-3">
                {['Dashboard', 'Contacts', 'Deals'].map((n) => (
                  <span key={n} className="text-[8px] font-mono text-white/25 hover:text-white/50 cursor-pointer">{n}</span>
                ))}
              </div>
            </div>
            {/* Header */}
            <div className="h-16 bg-white/[0.01] border-b border-white/[0.04] flex items-center px-4">
              <div>
                <h3 className="text-[12px] font-semibold text-white/60">Page Title</h3>
                <p className="text-[9px] text-white/20">Subtitle description here</p>
              </div>
            </div>
            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="h-12 rounded-[2px] bg-white/[0.02] border border-white/[0.04] flex items-center px-3">
                <span className="text-[8px] font-mono text-white/15">Section Divider</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-20 rounded-[2px] bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
                    <span className="text-[8px] font-mono text-white/10">Card {n}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div className="h-8 bg-white/[0.01] border-t border-white/[0.04] flex items-center justify-center px-4">
              <span className="text-[7px] font-mono text-white/10">REVOS © 2026 · Brand Identity System · Confidential</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/[0.04] grid grid-cols-4 gap-4">
            {['Sticky Nav', 'Page Header', 'Section Dividers', 'Footer'].map((part) => (
              <div key={part} className="text-[9px] font-mono text-white/20 text-center">{part}</div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 02 Dashboard Grid */}
      <section>
        <SectionHeader num="02" title="Dashboard Grid" subtitle="Bento-style asymmetric grid — 4-column CSS Grid" />
        <GlowCard glow="#3B82F6">
          <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">grid-template-columns: repeat(4, 1fr)</h3>
          <div className="grid grid-cols-4 gap-px bg-white/[0.04] rounded-[2px] overflow-hidden">
            <div className="col-span-3 h-28 bg-[#0a0a0a] p-3 flex flex-col justify-between">
              <span className="text-[8px] font-mono text-[#FF4400]/40">HERO / KPI</span>
              <span className="text-[20px] font-['Outfit'] font-black text-white/50">R$ 1.2M</span>
            </div>
            <div className="h-28 bg-[#0a0a0a] p-3">
              <span className="text-[8px] font-mono text-[#3B82F6]/40">STAT</span>
            </div>
            <div className="col-span-2 h-24 bg-[#0a0a0a] p-3">
              <span className="text-[8px] font-mono text-[#00D26A]/40">CHART AREA</span>
            </div>
            <div className="col-span-2 row-span-2 h-[calc(96px+96px+1px)] bg-[#0a0a0a] p-3">
              <span className="text-[8px] font-mono text-[#6C16F8]/40">SIDEBAR</span>
            </div>
            <div className="h-24 bg-[#0a0a0a] p-3">
              <span className="text-[8px] font-mono text-white/15">CARD</span>
            </div>
            <div className="h-24 bg-[#0a0a0a] p-3">
              <span className="text-[8px] font-mono text-white/15">CARD</span>
            </div>
          </div>
        </GlowCard>
      </section>

      {/* 03 Content Grid */}
      <section>
        <SectionHeader num="03" title="Content Grid" subtitle="Responsive auto-fit grid — min 340px columns" />
        <GlowCard glow="#00D26A">
          <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">grid-template-columns: repeat(auto-fit, minmax(340px, 1fr))</h3>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-24 rounded-[2px] bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
                <span className="text-[9px] font-mono text-white/15">Cell {n}</span>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 04 Hairline Grid Pattern */}
      <section>
        <SectionHeader num="04" title="Hairline Grid" subtitle="gap-px pattern — parent bg reveals 1px grid lines" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlowCard glow="#FF4400">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Dark Variant</h3>
            <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-[2px] overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-16 bg-[#0a0a0a] flex items-center justify-center">
                  <span className="text-[8px] font-mono text-white/10">{n}</span>
                </div>
              ))}
            </div>
            <code className="text-[9px] font-mono text-white/15 mt-3 block">parent: bg-white/[0.06] · children: bg-canvas</code>
          </GlowCard>
          <GlowCard glow="#F59E0B">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Accent Variant</h3>
            <div className="grid grid-cols-3 gap-px bg-[#FF4400]/20 rounded-[2px] overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-16 bg-[#0a0a0a] flex items-center justify-center">
                  <span className="text-[8px] font-mono text-[#FF4400]/15">{n}</span>
                </div>
              ))}
            </div>
            <code className="text-[9px] font-mono text-white/15 mt-3 block">parent: bg-accent/20 · children: bg-canvas</code>
          </GlowCard>
        </div>
      </section>
    </div>
  );
}
