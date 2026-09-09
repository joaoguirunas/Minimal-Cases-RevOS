/** Bloco "Comercial" da aba Esteira: Assumir · Gerar cupom (5/10/15/20) · cupom ativo · Abrir conversa. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Copy, MessageSquare, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimLead, useCommercialScope, useCreateCommercialCoupon, useLeadCoupon } from '@/hooks/useComercial';
import { COMMERCIAL_PERCENTS, couponExpiryLabel, priceWithCoupon } from '@/lib/comercial/coupon';

const money = (v: number | null) => v === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props { leadId: string; peopleId?: string | null; ownerId?: string | null; ownerName?: string | null; cartTotal: number | null }

export default function NegocioComercialCard({ leadId, peopleId, ownerId, ownerName, cartTotal }: Props) {
  const { isComercial, currentUserId } = useCommercialScope();
  const claim = useClaimLead();
  const create = useCreateCommercialCoupon();
  const { data: coupon } = useLeadCoupon(leadId);
  const [percent, setPercent] = useState<number>(10);
  const [days, setDays] = useState<number>(3);
  const [preview, setPreview] = useState<string | null>(null);
  const navigate = useNavigate();

  const mine = !!ownerId && ownerId === currentUserId;
  const semDono = !ownerId;
  if (!isComercial && semDono) return null;   // admin só vê o bloco quando há dono

  const ativo = coupon && coupon.expires_at && new Date(coupon.expires_at) > new Date() ? coupon : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Ticket className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-[13px] font-medium text-foreground">Comercial</span>
        {ownerId && <Chip tone="info">{mine ? 'Seu carrinho' : `Com ${ownerName ?? 'outro comercial'}`}</Chip>}
      </div>

      {isComercial && semDono && (
        <Button size="sm" className="h-8 text-[12px]" disabled={claim.isPending}
          onClick={() => claim.mutate(leadId, { onSuccess: (r) => r.ok ? toast.success('Carrinho é seu') : toast.error(r.reason === 'ja_assumido' ? 'Outro comercial pegou este carrinho' : 'Carrinho fora do pool') })}>
          Assumir carrinho
        </Button>
      )}

      {(mine || !isComercial) && ownerId && (
        <>
          {ativo ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="font-mono font-semibold">{ativo.code}</span>
              <Chip>{ativo.percent ?? '?'}%</Chip>
              {cartTotal !== null && ativo.percent && <span className="text-muted-foreground">{money(cartTotal)} → <span className="text-foreground font-medium">{money(priceWithCoupon(cartTotal, ativo.percent))}</span></span>}
              <span className="text-muted-foreground">vence {couponExpiryLabel(ativo.expires_at)}</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { navigator.clipboard.writeText(ativo.code); toast.success('Cupom copiado'); }}><Copy className="w-3.5 h-3.5" /></Button>
            </div>
          ) : mine && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Desconto</p>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {COMMERCIAL_PERCENTS.map((p) => (
                    <button key={p} type="button" onClick={() => setPercent(p)}
                      className={`px-3 h-8 text-[12px] ${percent === p ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>{p}%</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Validade (dias)</p>
                <input type="number" min={1} max={7} value={days} onChange={(e) => setDays(Math.min(7, Math.max(1, Number(e.target.value) || 3)))} className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-[12px]" />
              </div>
              {cartTotal !== null && <span className="text-[12px] text-muted-foreground pb-2">{money(cartTotal)} → {money(priceWithCoupon(cartTotal, percent))}</span>}
              <Button size="sm" className="h-8 text-[12px]" disabled={create.isPending}
                onClick={() => create.mutate({ lead_id: leadId, percent, validity_days: days }, {
                  onSuccess: (r) => { setPreview(r.message_preview); toast.success(r.reused ? 'Cupom já existia — reaproveitado' : `Cupom ${r.code} criado`); },
                  onError: (e) => toast.error(e.message),
                })}>
                Gerar cupom
              </Button>
            </div>
          )}
          {(preview || ativo) && peopleId && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]"
              onClick={() => navigate(`/omni?pessoaId=${peopleId}${preview ? `&draft=${encodeURIComponent(preview)}` : ''}`)}>
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />Abrir conversa
            </Button>
          )}
        </>
      )}
    </div>
  );
}
