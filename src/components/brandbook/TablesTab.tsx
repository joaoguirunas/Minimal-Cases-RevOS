import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SectionHeader, GlowCard } from './shared';

export default function TablesTab() {
  return (
    <div className="space-y-32">
      {/* 01 Standard Table */}
      <section>
        <SectionHeader num="01" title="Standard Table" subtitle="5-column data table with status badges and score" />
        <GlowCard glow="#FF4400">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">ID</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Name</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Role</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { id: '#001', name: 'Ana Costa', role: 'Sales Lead', status: 'Active', statusColor: '#00D26A', score: 92 },
                { id: '#002', name: 'Pedro Lima', role: 'SDR', status: 'Active', statusColor: '#00D26A', score: 87 },
                { id: '#003', name: 'Maria Santos', role: 'Account Exec', status: 'Away', statusColor: '#F59E0B', score: 78 },
                { id: '#004', name: 'Lucas Oliveira', role: 'RevOps', status: 'Active', statusColor: '#00D26A', score: 95 },
                { id: '#005', name: 'Julia Mendes', role: 'CSM', status: 'Inactive', statusColor: '#EF4444', score: 64 },
              ].map(({ id, name, role, status, statusColor, score }) => (
                <TableRow key={id} className="border-white/[0.04] hover:bg-white/[0.02]">
                  <TableCell className="text-[10px] font-mono text-white/30">{id}</TableCell>
                  <TableCell className="text-[11px] text-white/60 font-medium">{name}</TableCell>
                  <TableCell className="text-[10px] text-white/35">{role}</TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono" style={{ backgroundColor: `${statusColor}10`, color: statusColor, border: `1px solid ${statusColor}20` }}>
                      {status}
                    </span>
                  </TableCell>
                  <TableCell className="text-[10px] font-mono text-white/40 text-right">{score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlowCard>
      </section>

      {/* 02 Table with Export */}
      <section>
        <SectionHeader num="02" title="Table with Export" subtitle="Metrics table with export button" />
        <GlowCard glow="#3B82F6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-mono text-white/30 uppercase tracking-[0.08em]">Performance Metrics</h3>
            <Button variant="outline" size="sm" className="h-[26px] rounded-[2px] text-[9px] gap-1">
              <Download className="w-3 h-3" /> Export
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Metric</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider text-right">Value</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { metric: 'Response Time', value: '142ms', change: '-12%', up: false },
                { metric: 'Throughput', value: '1.2K/s', change: '+8%', up: true },
                { metric: 'Error Rate', value: '0.3%', change: '-0.1%', up: false },
                { metric: 'Uptime', value: '99.98%', change: '+0.02%', up: true },
              ].map(({ metric, value, change, up }) => (
                <TableRow key={metric} className="border-white/[0.04]">
                  <TableCell className="text-[11px] text-white/50">{metric}</TableCell>
                  <TableCell className="text-[10px] font-mono text-white/60 text-right">{value}</TableCell>
                  <TableCell className={`text-[10px] font-mono text-right ${up ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>{change}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlowCard>
      </section>

      {/* 03 Table with Filters */}
      <section>
        <SectionHeader num="03" title="Table with Filters" subtitle="Searchable table with filter input" />
        <GlowCard glow="#00D26A">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
              <Input placeholder="Search metrics..." className="h-[30px] pl-8 rounded-[2px] text-[10px] bg-white/[0.02] border-white/[0.06]" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Metric</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider text-right">Value</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { metric: 'Leads Generated', value: '2,847', change: '+15.3%' },
                { metric: 'Conversion Rate', value: '4.2%', change: '+0.5%' },
                { metric: 'Avg Deal Size', value: 'R$ 12.4K', change: '+8.7%' },
                { metric: 'Sales Cycle', value: '28 days', change: '-3 days' },
              ].map(({ metric, value, change }) => (
                <TableRow key={metric} className="border-white/[0.04]">
                  <TableCell className="text-[11px] text-white/50">{metric}</TableCell>
                  <TableCell className="text-[10px] font-mono text-white/60 text-right">{value}</TableCell>
                  <TableCell className="text-[10px] font-mono text-emerald-400/70 text-right">{change}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlowCard>
      </section>

      {/* 04 Pagination */}
      <section>
        <SectionHeader num="04" title="Table with Pagination" subtitle="Page navigation controls" />
        <GlowCard glow="#6C16F8">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Item</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { item: 'Pipeline A', value: 'R$ 245K' },
                { item: 'Pipeline B', value: 'R$ 180K' },
                { item: 'Pipeline C', value: 'R$ 320K' },
              ].map(({ item, value }) => (
                <TableRow key={item} className="border-white/[0.04]">
                  <TableCell className="text-[11px] text-white/50">{item}</TableCell>
                  <TableCell className="text-[10px] font-mono text-white/60 text-right">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-center gap-1 mt-4">
            <button className="w-7 h-7 rounded-[2px] border border-white/[0.06] flex items-center justify-center text-white/25 hover:text-white/50">
              <ChevronLeft className="w-3 h-3" />
            </button>
            {[1, 2, 3].map((p) => (
              <button key={p} className={`w-7 h-7 rounded-[2px] text-[10px] font-mono flex items-center justify-center ${p === 1 ? 'bg-[#FF4400] text-white' : 'border border-white/[0.06] text-white/30'}`}>
                {p}
              </button>
            ))}
            <button className="w-7 h-7 rounded-[2px] border border-white/[0.06] flex items-center justify-center text-white/25 hover:text-white/50">
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </GlowCard>
      </section>

      {/* 05 Empty State */}
      <section>
        <SectionHeader num="05" title="Table Empty State" subtitle="No data display" />
        <GlowCard glow="#F59E0B">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">ID</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Name</TableHead>
                <TableHead className="text-[9px] font-mono text-white/25 uppercase tracking-wider text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center">
                  <p className="text-[12px] text-white/30 mb-1">No data</p>
                  <p className="text-[10px] text-white/15">No results match your filters</p>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </GlowCard>
      </section>

      {/* 06 Compact Metrics */}
      <section>
        <SectionHeader num="06" title="Compact Metrics" subtitle="Condensed table for dense data displays" />
        <GlowCard glow="#EC4899">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="text-[8px] font-mono text-white/20 uppercase tracking-wider py-1.5">Metric</TableHead>
                <TableHead className="text-[8px] font-mono text-white/20 uppercase tracking-wider py-1.5 text-right">Value</TableHead>
                <TableHead className="text-[8px] font-mono text-white/20 uppercase tracking-wider py-1.5 text-right">Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { m: 'MQL', v: '1,247', d: '+12%' },
                { m: 'SQL', v: '489', d: '+8%' },
                { m: 'SAL', v: '234', d: '+15%' },
                { m: 'Closed', v: '87', d: '+22%' },
              ].map(({ m, v, d }) => (
                <TableRow key={m} className="border-white/[0.03]">
                  <TableCell className="text-[10px] text-white/40 py-1.5">{m}</TableCell>
                  <TableCell className="text-[9px] font-mono text-white/50 py-1.5 text-right">{v}</TableCell>
                  <TableCell className="text-[9px] font-mono text-emerald-400/60 py-1.5 text-right">{d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlowCard>
      </section>
    </div>
  );
}
