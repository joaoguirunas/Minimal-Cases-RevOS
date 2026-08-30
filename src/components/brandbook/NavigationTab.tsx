import { useState } from 'react';
import { Search, Home, Users, BarChart3, FileText, Settings, ChevronLeft, ChevronRight, Heart, Bookmark, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { SectionHeader, GlowCard } from './shared';

export default function NavigationTab() {
  const [activeTab, setActiveTab] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="space-y-32">
      {/* 01 Search Modal */}
      <section>
        <SectionHeader num="01" title="Search Modal" subtitle="Cmd+K triggered search — configurable, keyboard navigable" />
        <GlowCard glow="#FF4400">
          <div className="max-w-md mx-auto">
            <div className="rounded-[2px] border border-white/[0.10] bg-[#111113] p-1 shadow-2xl">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
                <Search className="w-4 h-4 text-white/25" />
                <input className="flex-1 bg-transparent text-[12px] text-white/60 placeholder:text-white/20 outline-none" placeholder="Search contacts, deals, reports..." />
                <kbd className="px-1.5 py-0.5 rounded-[2px] bg-white/[0.04] border border-white/[0.06] text-[8px] font-mono text-white/20">ESC</kbd>
              </div>
              <div className="py-2">
                {['Recent: Ana Costa', 'Recent: Pipeline Q4', 'Action: Create Deal'].map((item, i) => (
                  <div key={item} className={`py-1.5 flex items-center gap-2 text-[10px] ${i === 0 ? 'bg-[#FF4400]/[0.12] text-white border-l-2 border-[#FF4400] pl-[10px] pr-3' : 'px-3 text-white/30 hover:bg-white/[0.06]'} cursor-pointer rounded-[2px] mx-1`}>
                    <Search className="w-3 h-3 text-white/15" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-[9px] font-mono text-white/15 mt-3">Trigger: ⌘K · Navigate: ↑↓ · Select: Enter</p>
          </div>
        </GlowCard>
      </section>

      {/* 02 Pagination */}
      <section>
        <SectionHeader num="02" title="Pagination" subtitle="Page navigation — 5-page, 20-page, disabled states" />
        <div className="space-y-4">
          {[
            { pages: 5, current: 2, label: '5 pages' },
            { pages: 7, current: 1, label: 'First page (prev disabled)' },
          ].map(({ pages, current, label }) => (
            <GlowCard key={label} glow="#3B82F6">
              <p className="text-[9px] font-mono text-white/20 mb-3">{label}</p>
              <div className="flex items-center gap-1">
                <button className={`w-7 h-7 rounded-[2px] border border-white/[0.06] flex items-center justify-center ${current === 1 ? 'opacity-30 cursor-not-allowed' : 'text-white/30 hover:text-white/50'}`} disabled={current === 1}>
                  <ChevronLeft className="w-3 h-3" />
                </button>
                {Array.from({ length: Math.min(pages, 5) }).map((_, i) => (
                  <button key={i} className={`w-7 h-7 rounded-[2px] text-[10px] font-mono flex items-center justify-center ${i + 1 === current ? 'bg-[#FF4400] text-white' : 'border border-white/[0.06] text-white/30'}`}>
                    {i + 1}
                  </button>
                ))}
                <button className="w-7 h-7 rounded-[2px] border border-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/50">
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 03 Breadcrumb */}
      <section>
        <SectionHeader num="03" title="Breadcrumb" subtitle="Navigation trail — 3-item default, 5-item deep nesting" />
        <div className="space-y-4">
          <GlowCard glow="#00D26A">
            <p className="text-[9px] font-mono text-white/20 mb-3">Default (3 items)</p>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] text-white/30">Dashboard</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] text-white/30">Contacts</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage className="text-[10px] text-white/60">Ana Costa</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </GlowCard>
          <GlowCard glow="#6C16F8">
            <p className="text-[9px] font-mono text-white/20 mb-3">Deep nesting (5 items)</p>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] text-white/30">Home</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] text-white/30">Settings</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] text-white/30">Integrations</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] text-white/30">WhatsApp</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage className="text-[10px] text-white/60">Configuration</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </GlowCard>
        </div>
      </section>

      {/* 04 Tabs */}
      <section>
        <SectionHeader num="04" title="Tabs" subtitle="Default + smooth sliding underline variant" />
        <GlowCard glow="#FF4400">
          <p className="text-[9px] font-mono text-white/20 mb-3">Sliding underline</p>
          <div className="relative border-b border-white/[0.06]">
            <div className="flex gap-0">
              {['Overview', 'Analytics', 'Reports', 'Settings'].map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)} className={`px-5 py-2.5 text-[11px] font-mono transition-all ${activeTab === i ? 'text-[#FF4400]' : 'text-white/30 hover:text-white/50'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="absolute bottom-0 h-[2px] bg-[#FF4400] transition-all duration-300" style={{ left: `${activeTab * 25}%`, width: '25%' }} />
          </div>
        </GlowCard>
      </section>

      {/* 05 Sidebar */}
      <section>
        <SectionHeader num="05" title="Sidebar" subtitle="Expanded 240px / collapsed icon-only states" />
        <div className="grid grid-cols-2 gap-8">
          <GlowCard glow="#3B82F6">
            <p className="text-[9px] font-mono text-white/20 mb-3">Expanded (240px)</p>
            <div className="w-[200px] rounded-[2px] border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
              {[
                { icon: Home, label: 'Dashboard', active: true },
                { icon: Users, label: 'Contacts', active: false },
                { icon: BarChart3, label: 'Analytics', active: false },
                { icon: FileText, label: 'Reports', active: false },
                { icon: Settings, label: 'Settings', active: false },
              ].map(({ icon: Icon, label, active }) => (
                <div key={label} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[2px] text-[10px] ${active ? 'bg-[#FF4400]/10 text-[#FF4400]' : 'text-white/30 hover:bg-white/[0.03]'}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </GlowCard>
          <GlowCard glow="#6C16F8">
            <p className="text-[9px] font-mono text-white/20 mb-3">Collapsed (icon-only)</p>
            <div className="w-[48px] rounded-[2px] border border-white/[0.06] bg-white/[0.02] p-2 space-y-1">
              {[
                { icon: Home, active: true },
                { icon: Users, active: false },
                { icon: BarChart3, active: false },
                { icon: FileText, active: false },
                { icon: Settings, active: false },
              ].map(({ icon: Icon, active }, i) => (
                <div key={i} className={`w-8 h-8 rounded-[2px] flex items-center justify-center ${active ? 'bg-[#FF4400]/10 text-[#FF4400]' : 'text-white/20 hover:bg-white/[0.03]'}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </section>

      {/* 06 Bottom Bar */}
      <section>
        <SectionHeader num="06" title="Bottom Bar" subtitle="Mobile navigation — 5 items with active state" />
        <GlowCard glow="#EC4899">
          <div className="max-w-xs mx-auto">
            <div className="flex items-center justify-around py-2 rounded-[2px] border border-white/[0.06] bg-white/[0.02]">
              {[
                { icon: Home, label: 'Home', active: true },
                { icon: Heart, label: 'Likes', active: false },
                { icon: Menu, label: 'Menu', active: false },
                { icon: Bookmark, label: 'Saved', active: false },
                { icon: Settings, label: 'Config', active: false },
              ].map(({ icon: Icon, label, active }) => (
                <div key={label} className={`flex flex-col items-center gap-0.5 ${active ? 'text-[#FF4400]' : 'text-white/25'}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-[8px] font-mono">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
