// src/lib/bi/segments.ts
/** Segmentos RFM (mesmos nomes do banco, `_rfm_segment`) com cor e ação sugerida. */
export const SEGMENTS: { name: string; tone: string; action: string }[] = [
  { name: 'Campeões', tone: '#059669', action: 'Compram muito e há pouco tempo. Lançamentos e acesso antecipado.' },
  { name: 'Leais', tone: '#10b981', action: 'Voltam sempre. Programa de indicação e brindes.' },
  { name: 'Potenciais leais', tone: '#34d399', action: 'Compra recente e de valor. Incentive a 2ª compra.' },
  { name: 'Novos clientes', tone: '#0ea5e9', action: 'Primeira compra recente. Boas-vindas e acompanhamento da entrega.' },
  { name: 'Promissores', tone: '#38bdf8', action: 'Compra recente de valor menor. Sugira acessórios.' },
  { name: 'Precisam de atenção', tone: '#f59e0b', action: 'Estão esfriando. Oferta personalizada.' },
  { name: 'Quase dormindo', tone: '#fbbf24', action: 'Sumindo. Lembrete com novidade da linha do celular deles.' },
  { name: 'Não pode perder', tone: '#dc2626', action: 'Compravam muito e pararam. Contato do comercial + cupom forte.' },
  { name: 'Em risco', tone: '#ef4444', action: 'Já voltaram antes e pararam. Cupom de reativação.' },
  { name: 'Hibernando', tone: '#94a3b8', action: 'Uma compra antiga. Campanhas sazonais.' },
  { name: 'Perdidos', tone: '#64748b', action: 'Muito tempo sem comprar. Só campanhas grandes (Black Friday).' },
];

export function segmentMeta(name: string) {
  return SEGMENTS.find((s) => s.name === name) ?? { name, tone: '#94a3b8', action: '' };
}
