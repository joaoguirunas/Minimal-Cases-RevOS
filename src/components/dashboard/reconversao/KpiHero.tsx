import { Clock, DollarSign, Target, Users, Zap } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { StatCard } from '@/components/ui/stat-card';
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import type { Agregado } from '@/lib/bi/reconversao';
import { chartTheme } from '@/lib/chartTheme';

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);
const horas = (h: number | null) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

export default function KpiHero({ agregado: a }: { agregado: Agregado }) {
  const { atual, deltas, porNivel } = a;
  const nivelTotal = porNivel.cupom + porNivel.clique + porNivel.janela || 1;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr] gap-4">
        <StatCard size="hero" icon={DollarSign} label="Receita recuperada" value={fmtBRL(atual.receita)}
          delta={{ value: deltas.receita, label: 'vs. período anterior' }}
          sub={atual.ticketMedio !== null ? `ticket médio ${fmtBRL(atual.ticketMedio)} · ${atual.reconvertidos} pedidos` : 'nenhum pedido atribuído ainda'}>
          {a.porDia.length > 1 && (
            <div className="h-12 -mx-1 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a.porDia} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <Area type="monotone" dataKey="receita" stroke={chartTheme.colors.primary} strokeWidth={1.5} fill={chartTheme.colors.primary} fillOpacity={0.08} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </StatCard>
        <StatCard icon={Target} label="Reconvertidos por nós" value={String(atual.reconvertidos)}
          delta={{ value: deltas.reconvertidos }} sub={`${atual.organicos} orgânicos fora da conta`}>
          <div className="space-y-1.5 mt-1">
            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted" aria-hidden>
              <div className="bg-emerald-500" style={{ width: `${(porNivel.cupom / nivelTotal) * 100}%` }} />
              <div className="bg-sky-500" style={{ width: `${(porNivel.clique / nivelTotal) * 100}%` }} />
              <div className="bg-amber-500" style={{ width: `${(porNivel.janela / nivelTotal) * 100}%` }} />
            </div>
            <div className="flex gap-3 text-[11px] text-muted-foreground tabular-nums">
              <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />cupom {porNivel.cupom}</span>
              <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 mr-1" />clique {porNivel.clique}</span>
              <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />janela {porNivel.janela}</span>
            </div>
          </div>
        </StatCard>
        <StatCard icon={Zap} label="Taxa de reconversão" value={pct(atual.taxa)} delta={{ value: deltas.taxa }}
          sub={`${atual.reconvertidos} de ${atual.leadsTocados} leads tocados`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard size="compact" icon={Users} label="Leads tocados" value={String(atual.leadsTocados)} sub="receberam ≥ 1 toque no período" />
        <StatCard size="compact" label="Toques enviados" value={String(atual.toques.total)}
          sub={`e-mail ${atual.toques.email} · WhatsApp ${atual.toques.whatsapp} · SMS ${atual.toques.sms}`} />
        <StatCard size="compact" icon={Clock} label="Tempo até converter" value={horas(atual.horasMedias)}
          delta={{ value: deltas.horas, invert: true }} sub="média do último toque ao pagamento" />
      </div>
    </div>
  );
}
