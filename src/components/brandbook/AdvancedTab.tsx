import { useState } from 'react';
import { Check } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { SectionHeader, GlowCard } from './shared';

export default function AdvancedTab() {
  const [activeAdvTab, setActiveAdvTab] = useState(0);
  const [stepperH, setStepperH] = useState(2);
  const [stepperV, setStepperV] = useState(1);

  return (
    <div className="space-y-32">
      {/* 01 Tabs Component */}
      <section>
        <SectionHeader num="01" title="Tabs" subtitle="Project overview with key metrics and tab navigation" />
        <GlowCard glow="#FF4400">
          <div className="rounded-[2px] border border-white/[0.06] overflow-hidden">
            <div className="border-b border-white/[0.06] flex">
              {['Overview', 'Metrics', 'Activity', 'Settings'].map((tab, i) => (
                <button key={tab} onClick={() => setActiveAdvTab(i)} className={`flex-1 py-2.5 text-[10px] font-mono transition-all border-b-2 ${activeAdvTab === i ? 'text-[#FF4400] border-[#FF4400]' : 'text-white/25 border-transparent hover:text-white/40'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-5">
              {activeAdvTab === 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Active Deals', value: '247', color: '#FF4400' },
                    { label: 'Win Rate', value: '72%', color: '#00D26A' },
                    { label: 'Avg Cycle', value: '28d', color: '#3B82F6' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded-[2px] bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-[9px] font-mono text-white/20 uppercase tracking-wider">{label}</p>
                      <p className="text-[20px] font-['Outfit'] font-black mt-1" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
              {activeAdvTab === 1 && <p className="text-[11px] text-white/30">Metrics panel content — charts and KPIs</p>}
              {activeAdvTab === 2 && <p className="text-[11px] text-white/30">Activity feed — recent actions and events</p>}
              {activeAdvTab === 3 && <p className="text-[11px] text-white/30">Settings panel — configuration options</p>}
            </div>
          </div>
        </GlowCard>
      </section>

      {/* 02 Accordion */}
      <section>
        <SectionHeader num="02" title="Accordion" subtitle="FAQ-style collapsible sections" />
        <GlowCard glow="#3B82F6">
          <Accordion type="single" collapsible defaultValue="item-1" className="space-y-0">
            {[
              { id: 'item-1', q: 'What is REVOS?', a: 'REVOS is an AI-powered CRM platform designed for modern sales teams. It combines automation, analytics, and omnichannel communication.' },
              { id: 'item-2', q: 'How long is implementation?', a: 'Typical implementation takes 2-4 weeks, including data migration, custom pipeline setup, and team training.' },
              { id: 'item-3', q: 'Do I need programming knowledge?', a: 'No. REVOS is designed for non-technical users with a visual builder interface. API access available for developers.' },
              { id: 'item-4', q: 'How secure is my data?', a: 'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We are SOC2 Type II compliant.' },
            ].map(({ id, q, a }) => (
              <AccordionItem key={id} value={id} className="border-white/[0.06]">
                <AccordionTrigger className="text-[12px] text-white/60 hover:text-white/80 py-3">{q}</AccordionTrigger>
                <AccordionContent className="text-[10px] text-white/30 leading-relaxed pb-3">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </GlowCard>
      </section>

      {/* 03 Horizontal Stepper */}
      <section>
        <SectionHeader num="03" title="Stepper (Horizontal)" subtitle="5-step workflow with active state tracking" />
        <GlowCard glow="#00D26A">
          <div className="flex items-center justify-between mb-6">
            {[
              { step: 'Discovery', num: 1 },
              { step: 'Architecture', num: 2 },
              { step: 'Implementation', num: 3 },
              { step: 'QA Review', num: 4 },
              { step: 'Deploy', num: 5 },
            ].map(({ step, num }, i) => (
              <div key={step} className="flex items-center gap-0 flex-1">
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <button
                    onClick={() => setStepperH(num)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border-2 transition-all ${
                      num < stepperH ? 'bg-[#00D26A] border-[#00D26A] text-white' :
                      num === stepperH ? 'bg-[#FF4400]/10 border-[#FF4400] text-[#FF4400]' :
                      'border-white/[0.1] text-white/20'
                    }`}
                  >
                    {num < stepperH ? <Check className="w-3 h-3" /> : num}
                  </button>
                  <span className={`text-[9px] font-mono ${num === stepperH ? 'text-[#FF4400]' : num < stepperH ? 'text-[#00D26A]/60' : 'text-white/20'}`}>{step}</span>
                </div>
                {i < 4 && (
                  <div className={`flex-1 h-px mx-1 ${num < stepperH ? 'bg-[#00D26A]' : 'bg-white/[0.06]'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-[9px] font-mono text-white/15 text-center">Click a step to navigate · Completed steps show checkmark</p>
        </GlowCard>
      </section>

      {/* 04 Vertical Stepper */}
      <section>
        <SectionHeader num="04" title="Stepper (Vertical)" subtitle="4-step vertical workflow with descriptions" />
        <GlowCard glow="#6C16F8">
          <div className="max-w-sm space-y-0">
            {[
              { step: 'Onboarding', desc: 'Team signup and account setup' },
              { step: 'Data Integration', desc: 'Import contacts and deals from existing tools' },
              { step: 'Training', desc: 'Interactive sessions for your sales team' },
              { step: 'Go Live', desc: 'Production deployment with monitoring' },
            ].map(({ step, desc }, i) => {
              const num = i + 1;
              const isActive = num === stepperV;
              const isDone = num < stepperV;
              const color = isDone ? '#00D26A' : isActive ? '#FF4400' : undefined;
              return (
                <div key={step} className="flex gap-4 cursor-pointer" onClick={() => setStepperV(num)}>
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border-2 transition-all ${
                      isDone ? 'bg-[#00D26A] border-[#00D26A] text-white' :
                      isActive ? 'bg-[#FF4400]/10 border-[#FF4400] text-[#FF4400]' :
                      'border-white/[0.1] text-white/20'
                    }`}>
                      {isDone ? <Check className="w-3 h-3" /> : num}
                    </div>
                    {i < 3 && <div className={`w-px h-10 ${isDone ? 'bg-[#00D26A]' : 'bg-white/[0.06]'}`} />}
                  </div>
                  <div className="pt-1">
                    <p className={`text-[11px] font-medium ${isActive ? 'text-[#FF4400]' : isDone ? 'text-[#00D26A]/70' : 'text-white/30'}`}>{step}</p>
                    <p className="text-[9px] text-white/20 mt-0.5">{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlowCard>
      </section>
    </div>
  );
}
