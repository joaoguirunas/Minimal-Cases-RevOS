/**
 * _shared/grupo-atendimento.ts — aviso de handoff no grupo do time.
 *
 * Quando o agente passa a conversa para um humano, a pessoa vai para o topo da
 * fila do Omni e o sino acende — mas só vê quem está com o CRM aberto. O time
 * vive no WhatsApp. Este aviso leva o caso até onde as pessoas estão: nome,
 * motivo, resumo e o link direto da conversa, para alguém tocar e já assumir.
 *
 * Sai pelo número da Evolution (o que fala com o time, nunca com cliente), no
 * grupo escolhido em Integrações → WhatsApp (não-oficial). Sem grupo escolhido
 * ou sem canal conectado, não faz nada: o handoff em si (fila + sino) já
 * aconteceu antes e não depende disto.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createEvolutionClient } from './evolution-client.ts';

export interface AvisoAtendimentoInput {
  peopleId: string;
  nome: string;
  whatsapp?: string | null;
  /** Por que o agente passou a conversa — ex.: "cancelamento: quer cancelar o pedido 32844". */
  motivo: string;
  /** Resumo curto da conversa, escrito pelo agente no momento do handoff. */
  resumo?: string | null;
}

export type AvisoAtendimentoResultado =
  | { enviado: true; grupo: string }
  | { enviado: false; motivo: 'sem_grupo' | 'falha_envio'; detalhe?: string };

/** Telefone BR legível: 5538991971527 → (38) 99197-1527. */
function formatarFone(v: string | null | undefined): string {
  const d = String(v ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export async function avisarGrupoAtendimento(
  supabase: SupabaseClient,
  input: AvisoAtendimentoInput,
): Promise<AvisoAtendimentoResultado> {
  const { data: canal } = await supabase
    .from('settings_whatsapp_channels')
    .select('evolution_base_url, evolution_api_key, evolution_instance_name, evolution_group_atendimento_jid, evolution_group_atendimento_nome')
    .eq('provider', 'evolution')
    .eq('active', true)
    .not('evolution_group_atendimento_jid', 'is', null)
    .limit(1)
    .maybeSingle() as unknown as {
      data: {
        evolution_base_url: string; evolution_api_key: string; evolution_instance_name: string;
        evolution_group_atendimento_jid: string; evolution_group_atendimento_nome: string | null;
      } | null;
    };

  if (!canal?.evolution_group_atendimento_jid) return { enviado: false, motivo: 'sem_grupo' };

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

  const client = createEvolutionClient({ baseUrl: canal.evolution_base_url, apiKey: canal.evolution_api_key });
  // `to` vai cru: é JID de grupo (…@g.us). formatRecipient reduziria a dígitos
  // e mandaria para um número que não existe.
  const res = await client.messages.sendText({
    instance: canal.evolution_instance_name,
    to: canal.evolution_group_atendimento_jid,
    text: linhas.join('\n'),
  });

  if (!res.ok) {
    return { enviado: false, motivo: 'falha_envio', detalhe: res.message ?? String(res.error) };
  }
  return { enviado: true, grupo: canal.evolution_group_atendimento_nome ?? canal.evolution_group_atendimento_jid };
}
