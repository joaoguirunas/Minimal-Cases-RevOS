/**
 * Interface para dados da pessoa usados na substituição de variáveis
 */
interface PessoaData {
  name?: string;
  nome?: string;
  email?: string;
  whatsapp?: string;
  document?: string;
  notes?: string;
  score?: number;
  status?: string;
  type?: string;
  income?: string;
  moment?: string;
  goal?: string;
  conversation_summary?: string;
  [key: string]: any;
}

/**
 * Metadados opcionais de uma variável posicional (coluna `whatsapp_templates.variables`).
 * Quando a posição N está mapeada para 'atendente_nome', a resolução usa
 * `context.senderName` (usuário logado que está enviando) em vez da
 * convenção padrão (nome/telefone/email da pessoa).
 */
interface TemplateVarContext {
  senderName?: string;
}

function resolveSpecialRole(
  roleKey: string,
  varRoles: Record<string, string> | undefined,
  context: TemplateVarContext | undefined,
): string | undefined {
  const role = varRoles?.[roleKey];
  if (role === 'atendente_nome') return context?.senderName || '';
  return undefined;
}

/**
 * Substitui variáveis do template pelos dados reais da pessoa
 * Suporta formatos: {{nome}}, {{1}}, {{name}}, etc.
 */
const replaceTemplateVariables = (
  text: string,
  pessoa?: PessoaData,
  varRoles?: Record<string, string>,
  context?: TemplateVarContext,
): string => {
  if (!text || !pessoa) return text;

  // Obter o nome (suporta ambos os formatos: name ou nome)
  const nomePessoa = pessoa.name || pessoa.nome;

  const primeiroNome = nomePessoa?.split(' ')[0] || '';

  // Mapeamento completo de variáveis para campos da pessoa
  const variableMap: Record<string, string | undefined> = {
    // Nome
    'nome_cliente': nomePessoa,
    'nome': nomePessoa,
    'name': nomePessoa,
    'primeiro_nome': primeiroNome,
    'first_name': primeiroNome,
    // Gupshup templates often reuse generic names like order_id for the customer name
    'order_id': nomePessoa,
    'customer_name': nomePessoa,
    'client_name': nomePessoa,

    // Contato
    'email': pessoa.email,
    'whatsapp': pessoa.whatsapp,
    'telefone': pessoa.whatsapp,
    'phone': pessoa.whatsapp,

    // Notas
    'notas': pessoa.notes,
    'notes': pessoa.notes,

    // Pontuação e Status
    'pontuacao': pessoa.score?.toString(),
    'score': pessoa.score?.toString(),
    'status': pessoa.status,

    // Documento
    'documento': pessoa.document,
    'document': pessoa.document,
    'cpf': pessoa.document,

    // Outros campos
    'tipo': pessoa.type,
    'type': pessoa.type,
    'renda': pessoa.income,
    'income': pessoa.income,
    'momento': pessoa.moment,
    'moment': pessoa.moment,
    'objetivo': pessoa.goal,
    'goal': pessoa.goal,
    'meta': pessoa.goal,
    'resumo': pessoa.conversation_summary,
    'conversation_summary': pessoa.conversation_summary,
    'link_reuniao':    pessoa.link_reuniao     || pessoa.meeting_link    || pessoa.google_meet_link,
    'meeting_link':    pessoa.meeting_link     || pessoa.google_meet_link || pessoa.link_reuniao,
    'google_meet_link': pessoa.google_meet_link || pessoa.meeting_link   || pessoa.link_reuniao,

    // Variáveis numéricas (compatibilidade)
    '1': nomePessoa,
    '2': pessoa.whatsapp,
    '3': pessoa.email,
  };

  // Substituir todas as variáveis encontradas
  return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    const special = resolveSpecialRole(variable, varRoles, context);
    if (special !== undefined) return special || match;
    const lowerVar = variable.toLowerCase();
    const value = variableMap[lowerVar];
    return value || match; // Mantém a variável original se não encontrar valor
  });
};

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Extract variable names from a text string, in order of appearance, deduplicated. */
function extractVarNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); names.push(m[1]); }
  }
  return names;
}

/** Resolve a variable name or positional index to its value from pessoa data. */
function resolveVarToValue(
  v: string,
  pessoa?: PessoaData,
  varRoles?: Record<string, string>,
  context?: TemplateVarContext,
): string {
  const special = resolveSpecialRole(v, varRoles, context);
  if (special !== undefined) return special;
  if (!pessoa) return '';
  const nomePessoa = pessoa.name || pessoa.nome || '';
  const primeiroNome = nomePessoa.split(' ')[0];
  const lower = v.toLowerCase();
  const map: Record<string, string> = {
    '1': nomePessoa, '2': pessoa.whatsapp || '', '3': pessoa.email || '',
    'nome': nomePessoa, 'name': nomePessoa, 'nome_cliente': nomePessoa,
    'primeiro_nome': primeiroNome, 'first_name': primeiroNome,
    'order_id': nomePessoa, 'customer_name': nomePessoa, 'client_name': nomePessoa,
    'email': pessoa.email || '',
    'whatsapp': pessoa.whatsapp || '', 'telefone': pessoa.whatsapp || '', 'phone': pessoa.whatsapp || '',
    'documento': pessoa.document || '', 'document': pessoa.document || '', 'cpf': pessoa.document || '',
    'score': pessoa.score?.toString() || '', 'pontuacao': pessoa.score?.toString() || '',
    'status': pessoa.status || '',
    'notas': pessoa.notes || '', 'notes': pessoa.notes || '',
    'tipo': pessoa.type || '', 'type': pessoa.type || '',
    'renda': pessoa.income || '', 'income': pessoa.income || '',
    'momento': pessoa.moment || '', 'moment': pessoa.moment || '',
    'objetivo': pessoa.goal || '', 'goal': pessoa.goal || '', 'meta': pessoa.goal || '',
    'resumo': pessoa.conversation_summary || '', 'conversation_summary': pessoa.conversation_summary || '',
    'link_reuniao':    pessoa.link_reuniao     || pessoa.meeting_link    || pessoa.google_meet_link    || '',
    'meeting_link':    pessoa.meeting_link     || pessoa.google_meet_link || pessoa.link_reuniao        || '',
    'google_meet_link': pessoa.google_meet_link || pessoa.meeting_link   || pessoa.link_reuniao        || '',
  };
  return map[lower] ?? (pessoa[v] !== undefined ? String(pessoa[v]) : '');
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the full Meta API `components` array for a template message.
 * Handles HEADER (text), BODY, and BUTTONS (URL with variables).
 * Supports both standard components[] format and Gupshup legacy containerMeta.
 * Mirrors the N8N "Prepara Template1" node logic exactly.
 */
export const buildMetaTemplateComponents = (
  jsonData: any,
  pessoa?: PessoaData,
  varRoles?: Record<string, string>,
  context?: { senderName?: string },
): Array<Record<string, unknown>> => {
  if (!jsonData) return [];

  // Meta API v22+ requires parameter_name for NAMED templates.
  // Always include it — Meta ignores it on POSITIONAL templates but rejects its absence on NAMED.
  const makeParam = (varName: string) => {
    const param: Record<string, string> = { type: 'text', text: resolveVarToValue(varName, pessoa, varRoles, context) };
    param.parameter_name = varName;
    return param;
  };

  // ── Standard components[] format ─────────────────────────────────────────
  if (jsonData.components && Array.isArray(jsonData.components)) {
    const result: Array<Record<string, unknown>> = [];

    for (const component of jsonData.components) {
      const ctype = (component.type as string)?.toUpperCase();

      if (ctype === 'HEADER' && component.format === 'TEXT' && component.text) {
        const vars = extractVarNames(component.text);
        if (vars.length > 0) {
          result.push({ type: 'header', parameters: vars.map(makeParam) });
        }
      }

      if (ctype === 'BODY' && component.text) {
        const vars = extractVarNames(component.text);
        if (vars.length > 0) {
          result.push({ type: 'body', parameters: vars.map(makeParam) });
        }
      }

      if (ctype === 'BUTTONS' && Array.isArray(component.buttons)) {
        component.buttons.forEach((button: any, btnIndex: number) => {
          if (button.type === 'URL' && button.url) {
            const vars = extractVarNames(button.url);
            vars.forEach(v => {
              result.push({
                type: 'button',
                sub_type: 'url',
                index: String(btnIndex),
                parameters: [makeParam(v)],
              });
            });
          }
        });
      }
    }

    return result;
  }

  // ── Gupshup legacy containerMeta format ──────────────────────────────────
  let containerMeta: any = {};
  try {
    if (jsonData.containerMeta) {
      containerMeta = typeof jsonData.containerMeta === 'string'
        ? JSON.parse(jsonData.containerMeta)
        : jsonData.containerMeta;
    }
  } catch {}

  const bodyText = containerMeta.data || jsonData.data || '';
  if (!bodyText) return [];

  const vars = extractVarNames(bodyText);
  if (vars.length === 0) return [];
  return [{ type: 'body', parameters: vars.map(makeParam) }];
};

/**
 * Extrai os valores resolvidos das variáveis posicionais {{1}}, {{2}}, {{3}} do corpo do template.
 * Retorna array ordenado para uso como "parameters" na Meta Template API.
 */
export const extractTemplateVariableValues = (
  jsonData: any,
  pessoa?: PessoaData,
  varRoles?: Record<string, string>,
  context?: TemplateVarContext,
): string[] => {
  if (!jsonData || !pessoa) return [];
  const components = buildMetaTemplateComponents(jsonData, pessoa, varRoles, context);
  const body = components.find(c => c.type === 'body');
  if (!body) return [];
  return ((body.parameters as any[]) || []).map((p: any) => p.text ?? '');
};

/**
 * Extrai os nomes das variáveis do body do template (para parameter_format=NAMED).
 * Retorna os nomes na ordem de aparição (ex: ['order_id', 'email']).
 */
export const extractTemplateVariableNames = (jsonData: any): string[] => {
  if (!jsonData) return [];

  let bodyText = '';
  if (jsonData.components && Array.isArray(jsonData.components)) {
    const body = jsonData.components.find((c: any) => c.type === 'BODY');
    bodyText = body?.text || '';
  } else {
    let containerMeta: any = {};
    try {
      if (jsonData.containerMeta) {
        containerMeta = typeof jsonData.containerMeta === 'string'
          ? JSON.parse(jsonData.containerMeta)
          : jsonData.containerMeta;
      }
    } catch {}
    bodyText = containerMeta.data || jsonData.data || '';
  }

  const namedMatches = [...bodyText.matchAll(/\{\{(\w+)\}\}/g)];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const m of namedMatches) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      names.push(m[1]);
    }
  }
  return names;
};

/**
 * Extrai o conteúdo completo de um template WhatsApp (HEADER, BODY, FOOTER, BUTTONS)
 * e substitui variáveis pelos dados reais da pessoa
 * 
 * Suporta dois formatos:
 * - API WhatsApp padrão: json_data.components[]
 * - Gupshup legado: json_data.containerMeta
 */
export const extractTemplateContent = (
  jsonData: any,
  pessoa?: PessoaData,
  varRoles?: Record<string, string>,
  context?: TemplateVarContext,
): string => {
  if (!jsonData) return '';

  const parts: string[] = [];

  // FORMATO 1: API WhatsApp padrão (components array)
  if (jsonData.components && Array.isArray(jsonData.components)) {
    // HEADER
    const header = jsonData.components.find((c: any) => c.type === 'HEADER');
    if (header?.text) {
      parts.push(`*${replaceTemplateVariables(header.text, pessoa, varRoles, context)}*`);
    }

    // BODY
    const body = jsonData.components.find((c: any) => c.type === 'BODY');
    if (body?.text) {
      parts.push(replaceTemplateVariables(body.text, pessoa, varRoles, context));
    }

    // FOOTER
    const footer = jsonData.components.find((c: any) => c.type === 'FOOTER');
    if (footer?.text) {
      parts.push(`_${replaceTemplateVariables(footer.text, pessoa, varRoles, context)}_`);
    }
    
    // BUTTONS
    const buttons = jsonData.components.find((c: any) => c.type === 'BUTTONS');
    if (buttons?.buttons && Array.isArray(buttons.buttons)) {
      const buttonTexts = buttons.buttons
        .map((btn: any) => `▸ ${btn.text}`)
        .join('\n');
      if (buttonTexts) {
        parts.push(buttonTexts);
      }
    }
    
    if (parts.length > 0) {
      return parts.join('\n\n');
    }
  }
  
  // FORMATO 2: Gupshup legado (containerMeta)
  let containerMeta: any = {};
  try {
    if (jsonData.containerMeta) {
      containerMeta = typeof jsonData.containerMeta === 'string' 
        ? JSON.parse(jsonData.containerMeta) 
        : jsonData.containerMeta;
    }
  } catch (e) {
    console.error('Erro ao parsear containerMeta:', e);
  }

  // HEADER
  if (containerMeta.header) {
    parts.push(`*${replaceTemplateVariables(containerMeta.header, pessoa)}*`);
  }

  // BODY - usar o data do containerMeta ou fallback para json_data.data
  const bodyText = containerMeta.data || jsonData.data;
  if (bodyText) {
    parts.push(replaceTemplateVariables(bodyText, pessoa));
  }

  // FOOTER
  if (containerMeta.footer) {
    parts.push(`_${replaceTemplateVariables(containerMeta.footer, pessoa)}_`);
  }

  // BUTTONS - formatar como lista
  if (containerMeta.buttons && Array.isArray(containerMeta.buttons)) {
    const buttonTexts = containerMeta.buttons
      .map((btn: any) => `▸ ${btn.text}`)
      .join('\n');
    if (buttonTexts) {
      parts.push(buttonTexts);
    }
  }

  return parts.join('\n\n');
};
