import { SectionHeader, GlowCard } from './shared';

function FlowNode({ x, y, label, type = 'action', color = '#FF4400' }: { x: number; y: number; label: string; type?: 'start' | 'end' | 'action' | 'decision'; color?: string }) {
  if (type === 'start' || type === 'end') {
    return (
      <g>
        <circle cx={x} cy={y} r={20} fill={`${color}15`} stroke={color} strokeWidth={1.5} />
        <text x={x} y={y + 4} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{label}</text>
      </g>
    );
  }
  if (type === 'decision') {
    return (
      <g>
        <polygon points={`${x},${y - 22} ${x + 35},${y} ${x},${y + 22} ${x - 35},${y}`} fill={`${color}10`} stroke={color} strokeWidth={1} />
        <text x={x} y={y + 3} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace">{label}</text>
      </g>
    );
  }
  return (
    <g>
      <rect x={x - 40} y={y - 14} width={80} height={28} rx={2} fill={`${color}10`} stroke={color} strokeWidth={1} />
      <text x={x} y={y + 3} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">{label}</text>
    </g>
  );
}

export default function FlowDiagramTab() {
  return (
    <div className="space-y-32">
      {/* 01 Flow Diagram */}
      <section>
        <SectionHeader num="01" title="Flow Diagram" subtitle="Interactive data-driven canvas with SVG connectors" />
        <GlowCard glow="#FF4400">
          <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">SaaS Onboarding Flow</h3>
          <div className="rounded-[2px] border border-white/[0.04] bg-white/[0.01] p-4">
            <svg viewBox="0 0 560 200" className="w-full h-auto">
              <defs>
                <marker id="arrowFF" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="rgba(255,68,0,0.4)" />
                </marker>
              </defs>
              <FlowNode x={50} y={100} label="START" type="start" color="#00D26A" />
              <line x1="70" y1="100" x2="110" y2="100" stroke="rgba(255,68,0,0.2)" markerEnd="url(#arrowFF)" />
              <FlowNode x={160} y={100} label="Signup" />
              <line x1="200" y1="100" x2="240" y2="100" stroke="rgba(255,68,0,0.2)" markerEnd="url(#arrowFF)" />
              <FlowNode x={290} y={100} label="Verified?" type="decision" color="#F59E0B" />
              <line x1="325" y1="100" x2="365" y2="100" stroke="rgba(255,68,0,0.2)" markerEnd="url(#arrowFF)" />
              <FlowNode x={415} y={100} label="Onboard" color="#3B82F6" />
              <line x1="455" y1="100" x2="490" y2="100" stroke="rgba(255,68,0,0.2)" markerEnd="url(#arrowFF)" />
              <FlowNode x={520} y={100} label="END" type="end" color="#00D26A" />
              {/* Rejection path */}
              <line x1="290" y1="122" x2="290" y2="170" stroke="rgba(255,68,0,0.15)" markerEnd="url(#arrowFF)" />
              <FlowNode x={290} y={175} label="Retry" color="#EF4444" />
              <text x="298" y="145" fill="rgba(255,255,255,0.15)" fontSize="7" fontFamily="monospace">no</text>
              <text x="340" y="95" fill="rgba(255,255,255,0.15)" fontSize="7" fontFamily="monospace">yes</text>
            </svg>
          </div>
        </GlowCard>
      </section>

      {/* 02 Flow Map */}
      <section>
        <SectionHeader num="02" title="Flow Map" subtitle="Grouped mindmap canvas — module relationships" />
        <GlowCard glow="#3B82F6">
          <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">CRM Architecture</h3>
          <div className="rounded-[2px] border border-white/[0.04] bg-white/[0.01] p-4">
            <svg viewBox="0 0 500 280" className="w-full h-auto">
              {/* Center node */}
              <rect x="200" y="120" width="100" height="40" rx="2" fill="rgba(255,68,0,0.1)" stroke="#FF4400" strokeWidth="1.5" />
              <text x="250" y="144" textAnchor="middle" fill="#FF4400" fontSize="10" fontFamily="Outfit" fontWeight="bold">REVOS CRM</text>
              {/* Branches */}
              {[
                { x: 60, y: 40, label: 'Contacts', color: '#3B82F6' },
                { x: 380, y: 40, label: 'Pipelines', color: '#00D26A' },
                { x: 60, y: 220, label: 'Inbox', color: '#6C16F8' },
                { x: 380, y: 220, label: 'Analytics', color: '#F59E0B' },
              ].map(({ x, y, label, color }) => (
                <g key={label}>
                  <line x1="250" y1="140" x2={x + 40} y2={y + 12} stroke={`${color}30`} strokeWidth="1" strokeDasharray="4 2" />
                  <rect x={x} y={y} width={80} height={24} rx="2" fill={`${color}10`} stroke={`${color}40`} />
                  <text x={x + 40} y={y + 15} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{label}</text>
                </g>
              ))}
            </svg>
          </div>
        </GlowCard>
      </section>

      {/* 03 Pipeline Diagram */}
      <section>
        <SectionHeader num="03" title="Pipeline Diagram" subtitle="Service pipeline with named ports and dashed connectors" />
        <GlowCard glow="#00D26A">
          <h3 className="text-[10px] font-mono text-white/30 mb-4 uppercase tracking-[0.08em]">Data Pipeline</h3>
          <div className="flex items-center gap-2 overflow-x-auto py-4">
            {[
              { name: 'Ingest', status: 'running', color: '#00D26A' },
              { name: 'Transform', status: 'running', color: '#3B82F6' },
              { name: 'Validate', status: 'running', color: '#F59E0B' },
              { name: 'Enrich', status: 'pending', color: '#6C16F8' },
              { name: 'Store', status: 'pending', color: '#FF4400' },
            ].map(({ name, status, color }, i) => (
              <div key={name} className="flex items-center gap-2 shrink-0">
                <div className="p-3 rounded-[2px] border bg-white/[0.02] min-w-[80px]" style={{ borderColor: `${color}30` }}>
                  <p className="text-[10px] font-mono font-medium" style={{ color }}>{name}</p>
                  <p className="text-[8px] font-mono text-white/20 mt-0.5">{status}</p>
                </div>
                {i < 4 && (
                  <div className="flex items-center gap-1">
                    <div className="w-6 border-t border-dashed" style={{ borderColor: `${color}30` }} />
                    <span className="text-[8px]" style={{ color: `${color}60` }}>→</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 04 Process Flow */}
      <section>
        <SectionHeader num="04" title="Process Flow" subtitle="Vertical linear flow — development lifecycle" />
        <GlowCard glow="#6C16F8">
          <div className="max-w-xs mx-auto space-y-0">
            {[
              { step: 'Discovery', desc: 'Research & requirements', color: '#FF4400' },
              { step: 'Architecture', desc: 'System design', color: '#3B82F6' },
              { step: 'Implementation', desc: 'Build & iterate', color: '#00D26A' },
              { step: 'QA Review', desc: 'Test & validate', color: '#F59E0B' },
              { step: 'Deploy', desc: 'Ship to production', color: '#6C16F8' },
            ].map(({ step, desc, color }, i) => (
              <div key={step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[9px] font-mono font-bold" style={{ borderColor: color, color }}>
                    {i + 1}
                  </div>
                  {i < 4 && <div className="w-px h-8" style={{ backgroundColor: `${color}20` }} />}
                </div>
                <div className="pt-1.5">
                  <p className="text-[11px] font-medium text-white/60">{step}</p>
                  <p className="text-[9px] text-white/25">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      {/* 05 Node Types */}
      <section>
        <SectionHeader num="05" title="Node Types" subtitle="Start, End, Action, Decision — visual reference" />
        <GlowCard glow="#FF4400">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { type: 'Start', shape: 'circle', color: '#00D26A' },
              { type: 'End', shape: 'circle', color: '#EF4444' },
              { type: 'Action', shape: 'rect', color: '#3B82F6' },
              { type: 'Decision', shape: 'diamond', color: '#F59E0B' },
            ].map(({ type, shape, color }) => (
              <div key={type} className="flex flex-col items-center gap-3 p-4 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
                <svg width="60" height="50" viewBox="0 0 60 50">
                  {shape === 'circle' && <circle cx="30" cy="25" r="18" fill={`${color}15`} stroke={color} strokeWidth="1.5" />}
                  {shape === 'rect' && <rect x="5" y="10" width="50" height="30" rx="2" fill={`${color}10`} stroke={color} strokeWidth="1" />}
                  {shape === 'diamond' && <polygon points="30,5 55,25 30,45 5,25" fill={`${color}10`} stroke={color} strokeWidth="1" />}
                  <text x="30" y="28" textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{type}</text>
                </svg>
                <span className="text-[10px] font-mono text-white/30">{type}</span>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
