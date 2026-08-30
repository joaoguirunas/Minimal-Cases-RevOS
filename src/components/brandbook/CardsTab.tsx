import { MoreHorizontal, Users, Archive, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader, GlowCard } from './shared';

export default function CardsTab() {
  return (
    <div className="space-y-32">
      {/* 01 Card Variants */}
      <section>
        <SectionHeader num="01" title="Card Variants" subtitle="3 surface treatments — default, elevated, outlined" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlowCard glow="#FF4400">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Default</h3>
            <div className="p-4 rounded-[2px] bg-white/[0.02] border border-white/[0.06]">
              <p className="text-[12px] font-medium text-white/60 mb-1">Default Card</p>
              <p className="text-[10px] text-white/30">Standard surface with subtle background and border.</p>
            </div>
          </GlowCard>
          <GlowCard glow="#3B82F6">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Elevated</h3>
            <div className="p-4 rounded-[2px] bg-white/[0.03] border border-white/[0.06] shadow-lg shadow-black/20">
              <p className="text-[12px] font-medium text-white/60 mb-1">Elevated Card</p>
              <p className="text-[10px] text-white/30">Shadow lift for emphasis and focus.</p>
            </div>
          </GlowCard>
          <GlowCard glow="#00D26A">
            <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Outlined</h3>
            <div className="p-4 rounded-[2px] bg-transparent border border-white/[0.10]">
              <p className="text-[12px] font-medium text-white/60 mb-1">Outlined Card</p>
              <p className="text-[10px] text-white/30">Transparent background with prominent border.</p>
            </div>
          </GlowCard>
        </div>
      </section>

      {/* 02 Action Cards */}
      <section>
        <SectionHeader num="02" title="Action Cards" subtitle="Cards with interactive elements — status, actions, metadata" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlowCard glow="#FF4400">
            <div className="p-5 rounded-[2px] bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-[13px] font-semibold text-white/70">Project Alpha</h4>
                  <p className="text-[10px] text-white/30">AI Automation Pipeline</p>
                </div>
                <Badge className="bg-[#00D26A]/10 text-[#00D26A] border-[#00D26A]/20 text-[9px] rounded-[2px]">Active</Badge>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-white/20" />
                  <span className="text-[9px] font-mono text-white/25">12 squads</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-white/25">3 pending reviews</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-[26px] rounded-[2px] text-[9px]">Open</Button>
                <Button variant="ghost" size="sm" className="h-[26px] rounded-[2px] text-[9px] text-white/30">
                  <Archive className="w-3 h-3 mr-1" /> Archive
                </Button>
              </div>
            </div>
          </GlowCard>
          <GlowCard glow="#F59E0B">
            <div className="p-5 rounded-[2px] bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-[13px] font-semibold text-white/70">Report Q4</h4>
                  <p className="text-[10px] text-white/30">Financial Analysis</p>
                </div>
                <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 text-[9px] rounded-[2px]">Draft</Badge>
              </div>
              <p className="text-[10px] text-white/25 mb-4">Last edited 2 hours ago · 3 collaborators</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-[26px] rounded-[2px] text-[9px]">
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-[26px] rounded-[2px] text-[9px] text-rose-400/50">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </GlowCard>
        </div>
      </section>

      {/* 03 KPI Cards */}
      <section>
        <SectionHeader num="03" title="KPI Cards" subtitle="Big number metric cards with trend indicators" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Revenue', value: 'R$ 1.2M', change: '+12.5%', up: true, color: '#FF4400' },
            { label: 'Active Users', value: '8,432', change: '+5.2%', up: true, color: '#00D26A' },
            { label: 'Churn Rate', value: '3.1%', change: '-0.8%', up: false, color: '#EF4444' },
            { label: 'NPS Score', value: '72', change: '+3', up: true, color: '#3B82F6' },
          ].map(({ label, value, change, up, color }) => (
            <GlowCard key={label} glow={color}>
              <p className="text-[9px] font-mono text-white/25 mb-2 uppercase tracking-[0.08em]">{label}</p>
              <p className="text-[24px] font-['Outfit'] font-black text-white/90 leading-none mb-1.5">{value}</p>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? '↑' : '↓'}</span>
                <span className={`text-[10px] font-mono ${up ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>{change}</span>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* 04 Profile Card */}
      <section>
        <SectionHeader num="04" title="Profile Card" subtitle="Contact card with avatar, role, and actions" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { name: 'Ana Costa', role: 'Head of Sales', score: 92, color: '#FF4400' },
            { name: 'Pedro Lima', role: 'SDR Manager', score: 87, color: '#3B82F6' },
            { name: 'Maria Santos', role: 'Account Exec', score: 78, color: '#00D26A' },
          ].map(({ name, role, score, color }) => (
            <GlowCard key={name} glow={color}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}25` }}>
                  {name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-white/60">{name}</p>
                  <p className="text-[9px] text-white/25">{role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-white/20">Score:</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color }}>{score}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-[22px] rounded-[2px] text-[8px]">
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>
    </div>
  );
}
