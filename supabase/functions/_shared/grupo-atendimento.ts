/**
 * _shared/grupo-atendimento.ts — avisos do agente nos grupos do time.
 *
 * O número da Evolution não fala com cliente: fala com o time, em dois grupos
 * escolhidos em Integrações → WhatsApp (não-oficial):
 *
 *   · atendimento — handoff humano. A pessoa já foi para o topo da fila e o sino
 *     acendeu, mas isso só alcança quem está com o CRM aberto; o time vive no
 *     WhatsApp. Leva nome, motivo, resumo e o link direto da conversa.
 *   · fornecedor  — alteração de pedido ainda não despachado. Leva o número do
 *     pedido, o que foi comprado e o que o cliente quer no lugar.
 *
 * Sem grupo escolhido ou sem canal conectado, não envia nada e diz por quê —
 * quem chama decide o que fazer (o handoff, por exemplo, nunca depende disto).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createEvolutionClient } from './evolution-client.ts';

export type GrupoDoTime = 'atendimento' | 'fornecedor';

export type EnvioGrupoResultado =
  | { enviado: true; grupo: string }
  | { enviado: false; motivo: 'sem_grupo' | 'falha_envio'; detalhe?: string };

/** Telefone BR legível: 5538991971527 → (38) 99197-1527. */
export function formatarFone(v: string | null | undefined): string {
  const d = String(v ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Manda um texto pronto para o grupo do time escolhido nas Integrações. */
export async function enviarParaGrupoDoTime(
  supabase: SupabaseClient,
  tipo: GrupoDoTime,
  texto: string,
): Promise<EnvioGrupoResultado> {
  const colJid = tipo === 'atendimento' ? 'evolution_group_atendimento_jid' : 'evolution_group_fornecedor_jid';
  const colNome = tipo === 'atendimento' ? 'evolution_group_atendimento_nome' : 'evolution_group_fornecedor_nome';

  const { data } = await supabase
    .from('settings_whatsapp_channels')
    .select(`evolution_base_url, evolution_api_key, evolution_instance_name, ${colJid}, ${colNome}`)
    .eq('provider', 'evolution')
    .eq('active', true)
    .not(colJid, 'is', null)
    .limit(1)
    .maybeSingle();
  const canal = (data ?? null) as Record<string, string | null> | null;
  const jid = canal?.[colJid] ?? null;
  if (!canal || !jid) return { enviado: false, motivo: 'sem_grupo' };

  const client = createEvolutionClient({
    baseUrl: String(canal.evolution_base_url),
    apiKey: String(canal.evolution_api_key),
  });
  // `to` vai cru: é JID de grupo (…@g.us). formatRecipient reduziria a dígitos
  // e mandaria para um número que não existe.
  const res = await client.messages.sendText({
    instance: String(canal.evolution_instance_name),
    to: jid,
    text: texto,
  });
  if (!res.ok) return { enviado: false, motivo: 'falha_envio', detalhe: res.message ?? String(res.error) };
  return { enviado: true, grupo: canal[colNome] ?? jid };
}

// ── Atendimento: handoff humano ──────────────────────────────────────────────

export interface AvisoAtendimentoInput {
  peopleId: string;
  nome: string;
  whatsapp?: string | null;
  /** Por que o agente passou a conversa — ex.: "cancelamento: quer cancelar o pedido 32844". */
  motivo: string;
  /** Resumo curto da conversa, escrito pelo agente no momento do handoff. */
  resumo?: string | null;
}

export async function avisarGrupoAtendimento(
  supabase: SupabaseClient,
  input: AvisoAtendimentoInput,
): Promise<EnvioGrupoResultado> {
  const { data: cfg } = await supabase.from('_app_config').select('value').eq('key', 'crm_url').maybeSingle();
  const crmUrl = String((cfg as { value?: string } | null)?.value ?? 'https://crm.minimalcases.com.br').replace(/\/+$/, '');
  // Link direto da conversa. Sem sessão, o CRM manda pro login e volta pra cá
  // depois (ProtectedRoute guarda o destino).
  const link = `${crmUrl}/omni?pessoaId=${encodeURIComponent(input.peopleId)}`;

  const fone = formatarFone(input.whatsapp);
  const linhas = [
    `🔔 *Atendimento humano*`,
    ``,
    `*Cliente:* ${input.nome || 'sem nome'}${fone ? ` · ${fone}` : ''}`,
    `*Motivo:* ${input.motivo}`,
  ];
  const resumo = String(input.resumo ?? '').trim();
  if (resumo) linhas.push(``, `*Resumo:*`, resumo);
  linhas.push(``, `👉 Assumir a conversa: ${link}`);

  return enviarParaGrupoDoTime(supabase, 'atendimento', linhas.join('\n'));
}

// ── Fornecedor: alteração de pedido não despachado ──────────────────────────

export interface AvisoFornecedorInput {
  numeroPedido: string;
  nome: string;
  whatsapp?: string | null;
  /** Data do pagamento (dd/mm), para o fornecedor situar o pedido na fila dele. */
  pagoEm?: string | null;
  /** O que está no pedido hoje — títulos dos itens como vieram da loja. */
  itensAtuais: string[];
  /** O que o cliente quer no lugar, já confirmado com ele. */
  alteracao: string;
}

export async function avisarGrupoFornecedor(
  supabase: SupabaseClient,
  input: AvisoFornecedorInput,
): Promise<EnvioGrupoResultado> {
  const fone = formatarFone(input.whatsapp);
  const linhas = [
    `📦 *Alteração de pedido*`,
    ``,
    `*Pedido:* #${input.numeroPedido}`,
    `*Cliente:* ${input.nome || 'sem nome'}${fone ? ` · ${fone}` : ''}`,
  ];
  if (input.pagoEm) linhas.push(`*Pago em:* ${input.pagoEm}`);
  if (input.itensAtuais.length > 0) {
    linhas.push(``, `*Como está hoje:*`, ...input.itensAtuais.map((i) => `• ${i}`));
  }
  linhas.push(``, `*O cliente quer:*`, input.alteracao, ``, `Ainda não foi despachado — dá pra ajustar antes do envio.`);

  return enviarParaGrupoDoTime(supabase, 'fornecedor', linhas.join('\n'));
}
