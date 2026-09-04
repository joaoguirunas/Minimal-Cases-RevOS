/**
 * NegocioEsteira — aba "Esteira" do lead (EST-UI).
 *
 * Detalhes do carrinho (itens, total, link de recuperação — Yampi ao vivo,
 * fallback histórico Zoppy) + timeline unificada: eventos da loja (checkout,
 * carrinho abandonado, Pix, compra) intercalados com os toques da esteira
 * (E1–E6 por e-mail, WhatsApp e SMS — enviados, agendados e falhos).
 */

import {
  AlertTriangle, CheckCircle2, Clock, CreditCard, ExternalLink, Loader2,
  Mail, MessageSquare, MousePointerClick, ShoppingCart, Smartphone, XCircle, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CHANNEL_TITLES, useCancelPendingTouches, useLeadEsteira, type TimelineEntry } from '@/hooks/useEsteiraLead';
import { useTrackedClicksRealtime } from '@/hooks/useTrackedLinks';
import { groupByDay } from '@/lib/esteira/timeline';
import { toast } from 'sonner';

const money = (v: number | null) =>
  v === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtAt = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : '—';
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, 'HH:mm') : '—';
};

const fmtRelative = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? formatDistanceToNow(d, { locale: ptBR, addSuffix: true }) : null;
};

// ── Ícone/cor por entrada da timeline ──────────────────────────────────────────

function entryVisual(e: TimelineEntry): { icon: React.ElementType; cls: string } {
  if (e.kind === 'clique') return { icon: MousePointerClick, cls: 'text-sky-500' };
  if (e.kind === 'toque') {
    const icon = e.type === 'email' ? Mail : e.type === 'sms' ? Smartphone : MessageSquare;
    if (e.status === 'sent') return { icon, cls: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' };
    if (e.status === 'failed') return { icon: XCircle, cls: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (e.status === 'cancelled') return { icon, cls: 'text-muted-foreground border-border bg-muted' };
    return { icon: Clock, cls: 'text-amber-500 border-amber-500/30 bg-amber-500/10' };
  }
  switch (e.type) {
    case 'checkout_iniciado': return { icon: Zap, cls: 'text-blue-400 border-blue-400/30 bg-blue-400/10' };
    case 'carrinho_abandonado': return { icon: ShoppingCart, cls: 'text-primary border-primary/30 bg-primary/10' };
    case 'pix_gerado':
    case 'boleto_gerado': return { icon: CreditCard, cls: 'text-amber-500 border-amber-500/30 bg-amber-500/10' };
    case 'pedido_pago': return { icon: CheckCircle2, cls: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' };
    case 'pedido_cancelado':
    case 'pagamento_recusado': return { icon: AlertTriangle, cls: 'text-red-500 border-red-500/30 bg-red-500/10' };
    default: return { icon: Zap, cls: 'text-muted-foreground border-border bg-muted' };
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NegocioEsteira({ leadId, peopleId }: { leadId: string; peopleId?: string }) {
  useTrackedClicksRealtime();
  const { data, isLoading } = useLeadEsteira(leadId, peopleId);
  const cart = data?.cart ?? null;
  const timeline = data?.timeline ?? [];
  const sentCount = timeline.filter((t) => t.kind === 'toque' && t.status === 'sent').length;
  const pendingCount = timeline.filter((t) => t.kind === 'toque' && t.status === 'pending').length;
  const next = timeline.filter((t) => t.kind === 'toque' && t.status === 'pending').sort((a, b) => (a.at < b.at ? -1 : 1))[0];
  const total = sentCount + pendingCount + timeline.filter((t) => t.kind === 'toque' && t.status === 'failed').length;
  const cancel = useCancelPendingTouches(leadId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando esteira…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* ── Cabeçalho: progresso + ações ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground">{total > 0 ? `${sentCount} de ${total} toques enviados` : 'Sem toques agendados'}</p>
          <p className="text-[11.5px] text-muted-foreground truncate">
            {(() => {
              if (!next) return pendingCount === 0 && total > 0 ? 'Esteira concluída' : '';
              const rel = fmtRelative(next.at);
              const label = next.templateName ?? next.title;
              return `Próximo: ${label}${rel ? ` · ${rel}` : ''}`;
            })()}
          </p>
          {total > 0 && <div className="mt-2 h-1 w-full max-w-[280px] rounded-full bg-muted overflow-hidden" aria-hidden><div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((sentCount / total) * 100)}%` }} /></div>}
        </div>
        {cart?.url && <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => { navigator.clipboard.writeText(cart.url!); toast.success('Link copiado'); }}>Copiar link do carrinho</Button>}
        {pendingCount > 0 && (
          <Button variant="outline" size="sm" className="h-8 text-[12px] text-destructive hover:text-destructive" disabled={cancel.isPending}
            onClick={() => { if (window.confirm(`Pausar ${pendingCount} toque(s) pendente(s) deste lead? Eles serão cancelados.`)) cancel.mutate(pendingCount, { onSuccess: (n) => toast.success(`${n} toque(s) cancelado(s)`), onError: (e) => { const msg = (e as Error).message; toast.error(msg === 'SEM_PERMISSAO' || /permission|policy|RLS/i.test(msg) ? 'Sem permissão para pausar — peça a um gestor' : msg); } }); }}>
            Pausar toques
          </Button>
        )}
      </div>

      {/* ── Carrinho ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {cart?.image && (
              <img src={cart.image} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[13px] font-medium text-foreground">Carrinho</span>
                {cart && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 border border-border rounded-full px-1.5 py-0.5">
                    {cart.source === 'yampi' ? 'Yampi' : 'Zoppy (histórico)'}
                  </span>
                )}
              </div>
              {cart && (cart.variations.length > 0 || cart.etapaAbandono) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {cart.variations.map((v) => (
                    <Chip key={v.name}>{v.name}: {v.value}</Chip>
                  ))}
                  {cart.etapaAbandono && <Chip tone="warning">parou em: {cart.etapaAbandono}</Chip>}
                </div>
              )}
            </div>
          </div>
          {cart?.createdAt && (
            <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">{fmtAt(cart.createdAt)}</span>
          )}
        </div>

        {!cart ? (
          <p className="text-[12px] text-muted-foreground">Nenhum carrinho encontrado para este contato.</p>
        ) : (
          <>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {cart.items.length === 0 ? (
                <p className="text-[12px] text-muted-foreground px-3 py-2.5">Itens não disponíveis no payload.</p>
              ) : cart.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                  <span className="text-foreground truncate">
                    {it.quantity > 1 ? `${it.quantity}× ` : ''}{it.title}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap ml-3">{money(it.price)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 text-[12.5px] bg-muted/40">
                <span className="font-medium text-foreground">Total</span>
                <span className="font-semibold text-foreground">{money(cart.total)}</span>
              </div>
            </div>
            {cart.url && (
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8 gap-1.5 text-[12px]" asChild>
                  <a href={cart.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Abrir carrinho de recuperação
                  </a>
                </Button>
                <Button
                  variant="outline" size="sm" className="h-8 text-[12px]"
                  onClick={() => { navigator.clipboard.writeText(cart.url!); toast.success('Link copiado'); }}
                >
                  Copiar link
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-foreground">Timeline da esteira</span>
          <span className="text-[11px] text-muted-foreground">
            {sentCount} toque{sentCount === 1 ? '' : 's'} enviado{sentCount === 1 ? '' : 's'}
            {pendingCount > 0 ? ` · ${pendingCount} agendado${pendingCount === 1 ? '' : 's'}` : ''}
          </span>
        </div>

        {timeline.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Nenhum evento ou toque registrado ainda.</p>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
            <div className="space-y-4">
              {groupByDay(timeline).map((g) => (
                <div key={g.label}>
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground/70 mb-2 mt-1">{g.label}</p>
                  <div className="space-y-3">
                    {g.items.map((e) => {
                      const { icon: Icon, cls } = entryVisual(e);
                      const title = e.kind === 'toque' && e.templateName
                        ? `${CHANNEL_TITLES[e.type] ?? e.type} · ${e.templateName}`
                        : e.title;
                      return (
                        <div key={e.id} className="relative flex items-start gap-3">
                          <span className={cn(
                            'absolute -left-5 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border',
                            cls,
                          )}>
                            <Icon className="h-3 w-3" strokeWidth={1.75} />
                          </span>
                          <div className="flex-1 min-w-0 pl-2">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className={cn(
                                'text-[12.5px] truncate',
                                e.kind === 'toque' ? 'text-foreground' : 'font-medium text-foreground',
                              )}>
                                {title}
                              </span>
                              <span className="text-[10.5px] text-muted-foreground/60 whitespace-nowrap">{fmtTime(e.at)}</span>
                            </div>
                            {e.detail && (
                              <span className={cn(
                                'text-[11px]',
                                e.status === 'failed' ? 'text-red-500' : 'text-muted-foreground/70',
                              )}>
                                {e.detail}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
