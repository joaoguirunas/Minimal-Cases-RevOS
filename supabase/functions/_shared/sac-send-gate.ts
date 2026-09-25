/**
 * _shared/sac-send-gate.ts — a ÚNICA exceção à allowlist de teste do WhatsApp.
 *
 * Com a trava aberta em modo teste (test_allowlist), só números da lista recebem.
 * A resposta do SAC (direcionamento para o número de atendimento) é a exceção:
 * vai para quem ESCREVEU para nós nas últimas 24 h, e só depois de aprovada.
 * Tudo precisa bater — chamada interna, registro aprovado, mesma pessoa, mesmo
 * número, exatamente o texto aprovado — senão a allowlist continua valendo.
 * A trava geral (sends_locked) não é afetada.
 */
import { phoneMatches } from './whatsapp-send-lock.ts';
import { SAC_WA_URL } from './sac-redirect.ts';

export interface SacGateInput {
  callerIsService: boolean;
  row: { status: string; people_id: string; proposed_text: string | null } | null;
  bodyPeopleId: string | null | undefined;
  messages: { type?: string; text?: string; url?: string }[];
  personPhone: string | null | undefined;
  to: string;
  lastInboundAt: Date | null;
  now: Date;
}

const WINDOW_MS = 24 * 3600_000;

/** Cadastro às vezes guarda DDD + número sem o 55; a Meta sempre usa com 55. */
const withBR = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 10 || d.length === 11 ? `55${d}` : d; };

/** null = pode passar pela allowlist; string = motivo para NÃO passar. */
export function sacBypassReason(i: SacGateInput): string | null {
  if (!i.callerIsService) return 'chamada não é interna';
  if (!i.row) return 'direcionamento SAC não encontrado';
  if (i.row.status !== 'approved') return `direcionamento SAC em status ${i.row.status}`;
  if (!i.bodyPeopleId || i.row.people_id !== i.bodyPeopleId) return 'pessoa diferente da aprovada';
  const m = i.messages[0];
  const sameContent = i.messages.length === 1 && m.text === i.row.proposed_text &&
    (m.type === 'text' || (m.type === 'cta_url' && m.url === SAC_WA_URL));
  if (!sameContent) return 'mensagem diferente da aprovada';
  if (!i.personPhone || !phoneMatches(withBR(i.personPhone), withBR(i.to))) return 'número diferente do cliente';
  if (!i.lastInboundAt || i.now.getTime() - i.lastInboundAt.getTime() > WINDOW_MS) return 'fora da janela de 24 h';
  return null;
}
