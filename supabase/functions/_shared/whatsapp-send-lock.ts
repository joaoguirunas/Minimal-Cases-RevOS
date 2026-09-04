/**
 * Trava de disparo do WhatsApp — fail-safe.
 *
 * `whatsapp-outbound` é o único ponto por onde qualquer mensagem de WhatsApp
 * sai do CRM (agente de IA, templates da esteira, campanhas, lembretes de
 * reunião, envio manual do inbox). Esta trava fica lá, então destravar por
 * engano em um caminho não abre os outros.
 *
 * Dois níveis, ambos guardados em `omni_channel_configs.settings`
 * (channel = 'whatsapp'):
 *
 *   sends_locked   true (padrão)  → NADA sai, de nenhum caminho.
 *   test_allowlist ['5511...']    → com a trava aberta, só estes números
 *                                   recebem. Lista vazia = todos.
 *
 * O padrão é travado de propósito: se a linha de config sumir, se o campo vier
 * nulo ou se a leitura falhar, a resposta é bloquear. Só um `false` explícito
 * libera — igual à trava do Klaviyo (`isKlaviyoSendLocked`).
 */

export interface WhatsAppSendLock {
  locked: boolean;
  allowlist: string[];
  /** Motivo pronto pra log/resposta quando `locked` é true. */
  reason: string;
}

/** Só dígitos — a allowlist compara telefone sem +, espaço, parênteses ou hífen. */
export function normalizePhone(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '');
}

/**
 * Compara dois telefones brasileiros tolerando o nono dígito: a Meta devolve
 * `5511987654321` mas grava/recebe `551187654321` em números antigos, e o
 * operador pode digitar de qualquer um dos dois jeitos na allowlist.
 */
function phoneMatches(a: string, b: string): boolean {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  if (x === y) return true;
  const strip9 = (p: string) =>
    p.length === 13 && p.startsWith('55') && p[4] === '9' ? p.slice(0, 4) + p.slice(5) : p;
  return strip9(x) === strip9(y);
}

export async function getWhatsAppSendLock(supabase: {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
    };
  };
}): Promise<WhatsAppSendLock> {
  const LOCKED = (reason: string): WhatsAppSendLock => ({ locked: true, allowlist: [], reason });

  let row: Record<string, unknown> | null = null;
  try {
    const { data, error } = await supabase
      .from('omni_channel_configs')
      .select('settings')
      .eq('channel', 'whatsapp')
      .maybeSingle();
    if (error) return LOCKED('nao foi possivel ler a trava de envio do whatsapp');
    row = (data ?? null) as Record<string, unknown> | null;
  } catch {
    return LOCKED('nao foi possivel ler a trava de envio do whatsapp');
  }

  if (!row) return LOCKED('canal whatsapp ainda nao configurado (trava padrao ativa)');

  const settings = (row.settings ?? {}) as Record<string, unknown>;
  const raw = settings.sends_locked;
  // Só `false` (boolean ou string) destrava. undefined/null/qualquer outra coisa trava.
  const unlocked = raw === false || raw === 'false';
  if (!unlocked) return LOCKED('trava de envio do whatsapp ativa (sends_locked)');

  const allowlist = Array.isArray(settings.test_allowlist)
    ? (settings.test_allowlist as unknown[]).map((p) => normalizePhone(String(p))).filter(Boolean)
    : [];

  return { locked: false, allowlist, reason: '' };
}

/** true = pode enviar pra este número. Allowlist vazia libera geral. */
export function isAllowedRecipient(lock: WhatsAppSendLock, to: string): boolean {
  if (lock.locked) return false;
  if (lock.allowlist.length === 0) return true;
  return lock.allowlist.some((allowed) => phoneMatches(allowed, to));
}
