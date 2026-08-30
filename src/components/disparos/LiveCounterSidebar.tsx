import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Contact {
  id?: string;
  people_id?: string;
  lead_id?: string;
  name: string;
  whatsapp?: string;
  score_matrix_id?: string;
  lead?: {
    id: string;
    status?: string;
  };
}

interface LiveCounterSidebarProps {
  count: number;
  contacts: Contact[];
  isLoading: boolean;
  onRefresh?: () => void;
}

export default function LiveCounterSidebar({
  count,
  contacts,
  isLoading,
  onRefresh,
}: LiveCounterSidebarProps) {
  const [displayCount, setDisplayCount] = React.useState(0);

  React.useEffect(() => {
    if (count === displayCount) return;
    const duration = 500;
    const steps = 20;
    const increment = (count - displayCount) / steps;
    const stepDuration = duration / steps;
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayCount(count);
        clearInterval(timer);
      } else {
        setDisplayCount(prev => Math.round(prev + increment));
      }
    }, stepDuration);
    return () => clearInterval(timer);
  }, [count]);

  const leadStatuses = {
    active: contacts.filter(c => c.lead?.status === 'in_progress' || c.lead?.status === 'ativo').length,
    won: contacts.filter(c => c.lead?.status === 'won').length,
    conversionRate: count > 0
      ? ((contacts.filter(c => c.lead?.status === 'won').length / count) * 100).toFixed(1)
      : '0.0',
  };

  return (
    <Card className="border border-border bg-card rounded-[4px] overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-muted px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Pessoas Selecionadas</p>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-[30px] w-[30px] p-0"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-10 w-24" />
        ) : (
          <div className="text-4xl font-bold text-foreground animate-in fade-in-50 zoom-in-95 duration-200">
            {displayCount.toLocaleString('pt-BR')}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">contatos encontrados</p>
      </div>

      {/* ── Stats ── */}
      <div className="px-4 py-3 border-b border-border">
        <div className="grid grid-cols-3 gap-2">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <Skeleton key={i} className="h-14 rounded-[4px]" />
            ))
          ) : (
            <>
              <div className="text-center p-2.5 rounded-[4px] bg-muted">
                <div className="text-xl font-semibold text-foreground">{leadStatuses.active}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Ativos</div>
              </div>
              <div className="text-center p-2.5 rounded-[4px] bg-muted">
                <div className="text-xl font-semibold text-foreground">{leadStatuses.won}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Ganhos</div>
              </div>
              <div className="text-center p-2.5 rounded-[4px] bg-muted">
                <div className="text-xl font-semibold text-foreground">{leadStatuses.conversionRate}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Conversão</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Contact Preview ── */}
      <div className="px-4 py-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Preview
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-11 rounded-[4px]" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-6">
            <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-xs font-medium text-muted-foreground">Nenhum contato</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Selecione um pipeline</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {contacts.slice(0, 5).map((contact, idx) => {
              const initials = contact.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              const avatarColor =
                contact.lead?.status === 'won' ? 'bg-green-500' :
                contact.lead?.status === 'lost' ? 'bg-red-500' :
                (contact.lead?.status === 'in_progress' || contact.lead?.status === 'ativo') ? 'bg-blue-500' :
                'bg-muted-foreground/40';

              return (
                <div
                  key={contact.id ?? idx}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[4px] border border-border bg-card hover:bg-accent transition-colors animate-in fade-in-50 slide-in-from-left-1 duration-200"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0',
                      avatarColor
                    )}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{contact.name}</p>
                    {contact.whatsapp && (
                      <p className="text-[11px] text-muted-foreground">{contact.whatsapp}</p>
                    )}
                  </div>
                  {contact.lead?.status && (
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', avatarColor)} />
                  )}
                </div>
              );
            })}

            {contacts.length > 5 && (
              <p className="text-center text-xs text-muted-foreground pt-1.5">
                + {contacts.length - 5} contatos
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
