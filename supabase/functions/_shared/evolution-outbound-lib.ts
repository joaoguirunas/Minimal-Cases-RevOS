/**
 * EVOLUTION OUTBOUND — pure logic
 *
 * Decisão de dispatch (Meta vs Evolution) a partir de uma linha de
 * `settings_whatsapp_channels`, e substituição de variáveis `{{n}}` em corpo
 * de template Evolution (que não passa por aprovação Meta — é texto livre).
 * Decoupled de Supabase / do Deno.serve handler pra poder ser testado direto
 * (whatsapp-outbound/index.ts importa daqui). Espelha o padrão de
 * evolution-inbound-lib.ts / kiwify-inbound/logic.ts.
 */

// ── Dispatch de canal ─────────────────────────────────────────────────────────

export interface ChannelRow {
  id: string;
  phone_number_id: string | null;
  access_token: string | null;
  provider: string | null;
  evolution_base_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
}

export interface EvolutionDispatchCreds {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export type ChannelDispatch =
  | { provider: 'meta'; accessToken: string; phoneNumberId: string }
  | { provider: 'evolution'; evolutionCreds: EvolutionDispatchCreds | null; phoneNumberId: string };

/**
 * Traduz uma linha de `settings_whatsapp_channels` pra decisão de dispatch.
 * Evolution: `phoneNumberId` carrega o `id` (uuid) do canal — não um
 * `phone_number_id` Meta real — só pra reusar os mesmos guards de "resolvido?"
 * do caller. `evolutionCreds` vem `null` quando a linha está incompleta
 * (não deveria acontecer — a CHECK constraint da migration garante os 3
 * campos evolution_* juntos — mas o caller decide o que fazer, não este fn).
 */
export function resolveChannelDispatch(channel: ChannelRow, envAccessToken: string): ChannelDispatch {
  if (channel.provider === 'evolution') {
    const complete = !!(channel.evolution_base_url && channel.evolution_api_key && channel.evolution_instance_name);
    return {
      provider: 'evolution',
      evolutionCreds: complete
        ? {
          baseUrl: channel.evolution_base_url!,
          apiKey: channel.evolution_api_key!,
          instanceName: channel.evolution_instance_name!,
        }
        : null,
      phoneNumberId: channel.id,
    };
  }
  return {
    provider: 'meta',
    accessToken: channel.access_token || envAccessToken,
    phoneNumberId: channel.phone_number_id || '',
  };
}

// ── Degradação de botões interativos (Baileys não tem equivalente nativo) ─────

/** Evolution/Baileys não tem botões nativos equivalentes ao Meta — degrada pra texto numerado. */
export function buildInteractiveFallbackText(body: string, buttons: string[]): string {
  return buttons.length > 0
    ? `${body}\n\n${buttons.map((b, i) => `${i + 1}. ${b}`).join('\n')}`
    : body;
}

// ── Template Evolution (texto livre, sem aprovação Meta) ──────────────────────

export interface TplComponent {
  type: string;
  text?: string;
}

/** Extrai o corpo bruto (componente BODY) do `json_data` de `whatsapp_templates`. */
export function resolveTemplateBodyText(components: TplComponent[]): string {
  return components.find((c) => c.type === 'BODY')?.text ?? '';
}

export interface TemplateParam {
  /** `parameter_name` quando o parâmetro é nomeado (ex: Sends PRO, `{{nome}}`); senão índice posicional ("1", "2", ...). */
  name: string;
  text: string;
}

/**
 * Valores das variáveis já hidratados pelo caller (igual já faz pro Meta):
 * prefere `components[]` (formato novo, shape solto vindo do payload do
 * caller) sobre `variable_values` (legado posicional).
 *
 * Dois formatos de `components[].parameters[]` convivem no sistema:
 * - Posicional (whatsapp-outbound/ai-agent-execute): `{text}`, sem nome —
 *   vira `{{1}}`, `{{2}}` pela ordem do array.
 * - Nomeado (Sends PRO, `buildTemplateComponents`): `{text, parameter_name}` —
 *   vira `{{parameter_name}}` (ex: `{{nome}}`, `{{recomendante}}`).
 */
export function resolveTemplateParams(
  components: Array<Record<string, unknown>> | undefined,
  legacyValues: string[] | undefined,
): TemplateParam[] {
  const bodyComponent = components?.find((c) => String(c.type ?? '').toLowerCase() === 'body');
  const bodyParams = bodyComponent?.parameters as Array<{ text?: string; parameter_name?: string }> | undefined;
  if (bodyParams && bodyParams.length > 0) {
    return bodyParams.map((p, idx) => ({ name: p.parameter_name ?? String(idx + 1), text: p.text ?? '' }));
  }
  return (legacyValues ?? []).map((v, idx) => ({ name: String(idx + 1), text: v ?? '' }));
}

/** Substitui `{{name}}` pelo valor hidratado de cada parâmetro (nomeado ou posicional). */
export function substituteTemplateVars(text: string, params: TemplateParam[]): string {
  let result = text;
  for (const p of params) {
    result = result.replaceAll(`{{${p.name}}}`, p.text);
  }
  return result;
}
