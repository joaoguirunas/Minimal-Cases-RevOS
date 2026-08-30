import { useState } from 'react';
import { OmniTabNav } from '@/components/conversas/OmniTabNav';
import { OmniMensagensContent } from '@/pages/OmniMensagens';
import { OmniAutomacoesLogContent } from '@/pages/OmniAutomacoes';
import { cn } from '@/lib/utils';

const SUB_TABS = ['Mensagens', 'Automações'] as const;

export default function OmniLogs() {
  const [tab, setTab] = useState(0);

  return (
    <div className="flex flex-col h-full bg-background">
      <OmniTabNav />

      <div className="flex border-b border-border px-4 gap-0 shrink-0">
        {SUB_TABS.map((label, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={cn(
              'px-4 h-[38px] text-[13px] border-b-2 transition-colors',
              tab === i
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 0 ? <OmniMensagensContent /> : <OmniAutomacoesLogContent />}
      </div>
    </div>
  );
}
