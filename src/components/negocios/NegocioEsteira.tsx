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
  Mail, MessageSquare, ShoppingCart, Smartphone, XCircle, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLeadEsteira, type TimelineEntry } from '@/hooks/useEsteiraLead';
import { toast } from 'sonner';

const money = (v: number | null) =>
  v === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtAt = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : '—';
};

// ── Ícone/cor por entrada da timeline ──────────────────────────────────────────

function entryVisual(e: TimelineEntry): { icon: React.ElementType; cls: string } {
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
  const { data, isLoading } = useLeadEsteira(leadId, peopleId);
  const cart = data?.cart ?? null;
  const timeline = data?.timeline ?? [];
  const sentCount = timeline.filter((t) => t.kind === 'toque' && t.status === 'sent').length;
  const pendingCount = timeline.filter((t) => t.kind === 'toque' && t.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando esteira…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* ── Carrinho ─────────────────────────────────────────────────────── */}
      <div className="rounded-[4px] border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[13px] font-medium text-foreground">Carrinho</span>
            {cart && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 border border-border rounded-[2px] px-1.5 py-0.5">
                {cart.source === 'yampi' ? 'Yampi' : 'Zoppy (histórico)'}
              </span>
            )}
          </div>
          {cart?.createdAt && (
            <span className="text-[11px] text-muted-foreground/60">{fmtAt(cart.createdAt)}</span>
          )}
        </div>

        {!cart ? (
          <p className="text-[12px] text-muted-foreground">Nenhum carrinho encontrado para este contato.</p>
        ) : (
          <>
            <div className="divide-y divide-border rounded-[4px] border border-border overflow-hidden">
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
      <div className="rounded-[4px] border border-border bg-card p-5 space-y-4">
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
            <div className="space-y-3">
              {timeline.map((e) => {
                const { icon: Icon, cls } = entryVisual(e);
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
                          {e.title}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground/60 whitespace-nowrap">{fmtAt(e.at)}</span>
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
        )}
      </div>
    </div>
  );
}
