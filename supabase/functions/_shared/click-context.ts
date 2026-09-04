// supabase/functions/_shared/click-context.ts
/** Texto curto, em pt-BR, dos cliques da pessoa em links nossos — injetado no prompt do agente. */

export interface ClickContextLink {
  source: string; label: string | null; template_name: string | null; channel: string | null;
  clicks: number; first_clicked_at: string | null; last_clicked_at: string | null;
}

const LABEL_PT: Record<string, string> = {
  link_checkout: 'link do carrinho',
  link_novo_checkout: 'link de novo checkout',
  wa_button_url: 'botão do template',
  yampi_enviar_link_carrinho: 'link do carrinho',
  yampi_enviar_link_pagamento: 'link de pagamento',
  enviar_link_compra: 'link de compra',
};
const CHANNEL_PT: Record<string, string> = { whatsapp: 'WhatsApp', email: 'e-mail', sms: 'SMS' };

export function describeLinkOrigin(l: Pick<ClickContextLink, 'source' | 'label' | 'template_name' | 'channel'>): string {
  if (l.source === 'agente') return `agente · ${LABEL_PT[l.label ?? ''] ?? 'link'}`;
  const canal = CHANNEL_PT[l.channel ?? ''] ?? (l.source === 'esteira_whatsapp' ? 'WhatsApp' : l.source === 'esteira_email' ? 'e-mail' : l.source === 'esteira_sms' ? 'SMS' : 'link');
  return l.template_name ? `${canal} · ${l.template_name}` : canal;
}

export function relativePt(from: Date, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
}

export function describeClicksForAgent(links: ClickContextLink[], now = new Date()): string {
  const clicked = links.filter((l) => l.clicks > 0 && l.last_clicked_at)
    .sort((a, b) => Date.parse(b.last_clicked_at!) - Date.parse(a.last_clicked_at!)).slice(0, 3);
  if (clicked.length === 0) return 'Cliques em links nossos: nenhum até agora.';
  const partes = clicked.map((l) => {
    const rel = relativePt(new Date(l.last_clicked_at!), now);
    return `abriu o link (${describeLinkOrigin(l)}) ${l.clicks}x${l.clicks > 1 ? `, último ${rel}` : ` ${rel}`}`;
  });
  return `Cliques em links nossos: ${partes.join('; ')}. Se ainda não comprou, ele já viu o carrinho — pergunte o que travou em vez de só reenviar o link.`;
}
