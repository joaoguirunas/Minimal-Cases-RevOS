import { format } from 'date-fns';

/** Bloco "Comercial" da aba Esteira: percentuais de desconto permitidos. */
export const COMMERCIAL_PERCENTS = [5, 10, 15, 20] as const;

/** Preço final com cupom percentual aplicado, arredondado em centavos. */
export function priceWithCoupon(total: number | null, percent: number): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  return Math.round(total * (1 - percent / 100) * 100) / 100;
}

/** Label dd/MM da validade do cupom, ou "—" quando ausente/inválida. */
export function couponExpiryLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, 'dd/MM') : '—';
}
