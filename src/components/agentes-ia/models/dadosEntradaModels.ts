// Modelos de dados de entrada para agentes IA
// Baseado nas tabelas reais: leads, clients_people, clients_companies, crm_field_definitions

export interface CampoContexto {
  id: string;
  chave: string;    // variável: "lead_id"
  label: string;    // rótulo: "Lead ID"
  descricao: string;
  ativo: boolean;
}

export interface SecaoContexto {
  id: string;
  titulo: string;
  descricao?: string;
  ativo: boolean;
  campos: CampoContexto[];
}

export const SECOES_CONTEXTO_PADRAO: SecaoContexto[] = [
  {
    id: 'mensagem',
    titulo: 'MENSAGEM DO CLIENTE',
    ativo: true,
    campos: [
      { id: 'mensagem', chave: 'mensagem', label: 'Mensagem', descricao: 'Última mensagem enviada pelo lead', ativo: true },
    ],
  },
  {
    id: 'lead',
    titulo: 'NEGÓCIO / LEAD',
    descricao: 'Tabela leads',
    ativo: true,
    campos: [
      { id: 'lead_id', chave: 'lead_id', label: 'Lead ID', descricao: 'UUID do negócio no CRM (leads.id)', ativo: true },
      { id: 'lead_titulo', chave: 'lead_titulo', label: 'Título', descricao: 'Título do negócio (leads.title)', ativo: true },
      { id: 'lead_control', chave: 'lead_control', label: 'Controle do Agente', descricao: 'Determina qual Etapa do prompt é executada (leads.control)', ativo: true },
      { id: 'pipeline_etapas', chave: 'pipeline_etapas', label: 'Etapas do Pipeline', descricao: 'Lista de etapas do kanban com IDs e nomes — use para mover_kanban', ativo: true },
      { id: 'lead_etapa_nome', chave: 'lead_etapa_nome', label: 'Etapa Atual (Kanban)', descricao: 'Nome da etapa atual no pipeline (leads_stages.name)', ativo: true },
      { id: 'lead_status', chave: 'lead_status', label: 'Status', descricao: 'in_progress | won | lost | archived (leads.status)', ativo: false },
      { id: 'lead_valor', chave: 'lead_valor', label: 'Valor', descricao: 'Valor do negócio em R$ (leads.value)', ativo: false },
      { id: 'lead_responsavel_id', chave: 'lead_responsavel_id', label: 'Responsável (ID)', descricao: 'UUID do vendedor responsável (leads.user_id)', ativo: false },
      { id: 'lead_responsavel_nome', chave: 'lead_responsavel_nome', label: 'Responsável (Nome)', descricao: 'Nome do vendedor responsável (settings_users.name)', ativo: false },
      { id: 'lead_responsavel_email', chave: 'lead_responsavel_email', label: 'Responsável (Email)', descricao: 'Email do vendedor responsável (settings_users.email)', ativo: false },
      { id: 'lead_responsavel_telefone', chave: 'lead_responsavel_telefone', label: 'Responsável (Telefone)', descricao: 'Telefone do vendedor responsável (settings_users.phone)', ativo: false },
      { id: 'lead_ultima_interacao', chave: 'lead_ultima_interacao', label: 'Última Interação', descricao: 'Data da última interação (leads.last_interaction_at)', ativo: false },
      { id: 'lead_utm_source', chave: 'lead_utm_source', label: 'UTM Source', descricao: 'Origem do tráfego (leads.utm_source)', ativo: false },
      { id: 'lead_temperatura', chave: 'lead_temperatura', label: 'Temperatura', descricao: 'Temperatura de pré-venda do lead (pre_sale_temperature)', ativo: false },
      { id: 'lead_prob_fechamento', chave: 'lead_prob_fechamento', label: 'Prob. de Fechamento', descricao: 'Probabilidade estimada de fechamento (%)', ativo: false },
    ],
  },
  {
    id: 'origem',
    titulo: 'ORIGEM / CANAL',
    descricao: 'Canal de aquisição e dados de indicação — tabela leads',
    ativo: false,
    campos: [
      { id: 'origem_lista', chave: 'origem_lista', label: 'Origem da Lista', descricao: 'Canal: recomendacao | pessoal | evento | network (leads.origem_lista)', ativo: true },
      { id: 'recomendante', chave: 'recomendante', label: 'Recomendante', descricao: 'Nome de quem indicou o lead (leads.recomendante)', ativo: true },
      { id: 'relacao_recomendante', chave: 'relacao_recomendante', label: 'Relação do Recomendante', descricao: 'Relação do recomendante com o profissional (leads.relacao_recomendante)', ativo: true },
      { id: 'relacao_corretor', chave: 'relacao_corretor', label: 'Relação com o Corretor', descricao: 'Relação do lead com o profissional — canal pessoal (leads.relacao_corretor)', ativo: true },
      { id: 'nome_evento', chave: 'nome_evento', label: 'Nome do Evento', descricao: 'Nome do evento de origem — canais evento e network (leads.nome_evento)', ativo: false },
    ],
  },
  {
    id: 'pessoa',
    titulo: 'DADOS DA PESSOA',
    descricao: 'Tabela clients_people',
    ativo: true,
    campos: [
      { id: 'pessoa_id', chave: 'pessoa_id', label: 'Pessoa ID', descricao: 'ID único da pessoa', ativo: true },
      { id: 'nome', chave: 'nome', label: 'Nome', descricao: 'Nome completo', ativo: true },
      { id: 'email', chave: 'email', label: 'Email', descricao: 'Email principal', ativo: true },
      { id: 'whatsapp', chave: 'whatsapp', label: 'WhatsApp', descricao: 'Número do WhatsApp', ativo: true },
      { id: 'score', chave: 'score', label: 'Score Atual', descricao: 'Score calculado da pessoa', ativo: false },
      { id: 'resumo_conversa', chave: 'resumo_conversa', label: 'Resumo da Conversa', descricao: 'Resumo acumulativo das interações (conversation_summary)', ativo: false },
      { id: 'momento', chave: 'momento', label: 'Momento', descricao: 'Momento atual do lead (moment em clients_people)', ativo: false },
      { id: 'objetivo', chave: 'objetivo', label: 'Objetivo', descricao: 'Objetivo do lead (goal em clients_people)', ativo: false },
      { id: 'instagram_handle', chave: 'instagram_handle', label: 'Instagram', descricao: 'Handle do Instagram da pessoa', ativo: false },
      { id: 'document', chave: 'document', label: 'CPF / Documento', descricao: 'Documento de identidade da pessoa', ativo: false },
    ],
  },
  {
    id: 'empresa',
    titulo: 'DADOS DA EMPRESA',
    descricao: 'Tabela clients_companies',
    ativo: false,
    campos: [
      { id: 'empresa_nome', chave: 'empresa_nome', label: 'Nome Fantasia', descricao: 'Nome fantasia da empresa (clients_companies.trade_name)', ativo: true },
      { id: 'empresa_website', chave: 'empresa_website', label: 'Website', descricao: 'Site da empresa', ativo: false },
      { id: 'empresa_cnpj', chave: 'empresa_cnpj', label: 'CNPJ', descricao: 'CNPJ / tax ID da empresa', ativo: false },
    ],
  },
  {
    id: 'score',
    titulo: 'DADOS DO SCORE',
    descricao: 'Score matrix e enquadramentos',
    ativo: false,
    campos: [
      { id: 'score_number', chave: 'score_number', label: 'Score Number', descricao: 'Número do score calculado (1-10)', ativo: true },
      { id: 'score_framing_name', chave: 'score_framing_name', label: 'Enquadramento', descricao: 'Ex: Qualificado, Premium', ativo: true },
      { id: 'score_investment_name', chave: 'score_investment_name', label: 'Investimento', descricao: 'Faixa de investimento do lead', ativo: false },
      { id: 'score_objective_name', chave: 'score_objective_name', label: 'Objetivo', descricao: 'Objetivo categorizado pelo score', ativo: false },
    ],
  },
  {
    id: 'agendamento',
    titulo: 'AGENDAMENTO',
    descricao: 'Reuniões e disponibilidade — tabela meetings + RPC get_available_slots',
    ativo: false,
    campos: [
      { id: 'reunioes_proximas', chave: 'reunioes_proximas', label: 'Próximas Reuniões', descricao: 'JSON com próximas reuniões agendadas: [{titulo, data, status}]', ativo: true },
      { id: 'slots_disponiveis', chave: 'slots_disponiveis', label: 'Slots Disponíveis', descricao: 'JSON com horários livres do responsável (populado após chamar buscar_slots)', ativo: false },
    ],
  },
  {
    id: 'metadados',
    titulo: 'METADADOS',
    descricao: 'Timestamps e dados de controle',
    ativo: false,
    campos: [
      { id: 'criado_em', chave: 'criado_em', label: 'Criado em', descricao: 'Data de criação do lead', ativo: true },
      { id: 'atualizado_em', chave: 'atualizado_em', label: 'Atualizado em', descricao: 'Data da última atualização', ativo: false },
    ],
  },
];

export const gerarContextoPorSecoes = (secoes: SecaoContexto[]): string => {
  const partes: string[] = [];

  for (const secao of secoes) {
    if (!secao.ativo) continue;
    const camposAtivos = secao.campos.filter(c => c.ativo);
    if (camposAtivos.length === 0) continue;

    partes.push(`## ====================================`);
    partes.push(`## ${secao.titulo}`);
    partes.push(`## ====================================`);
    for (const campo of camposAtivos) {
      partes.push(`${campo.label}: {{${campo.chave}}}`);
    }
    partes.push('');
  }

  return partes.join('\n').trim();
};

export const PRESETS = {
  // Inclui todos os campos exceto qualificação (Q1-Q26) — específico de fluxos avançados
  PADRAO_COMPLETO: (): SecaoContexto[] =>
    SECOES_CONTEXTO_PADRAO.map(s => ({
      ...s,
      ativo: s.id !== 'qualificacao',
      campos: s.campos.map(c => ({ ...c, ativo: true })),
    })),

  SO_BASICOS: (): SecaoContexto[] => {
    const basicosIds = new Set(['mensagem', 'lead_id', 'lead_titulo', 'lead_control', 'pessoa_id', 'nome', 'email', 'whatsapp']);
    const secoesAtivas = new Set(['mensagem', 'lead', 'pessoa']);
    return SECOES_CONTEXTO_PADRAO.map(s => ({
      ...s,
      ativo: secoesAtivas.has(s.id),
      campos: s.campos.map(c => ({ ...c, ativo: basicosIds.has(c.id) })),
    }));
  },

  LIMPAR: (): SecaoContexto[] =>
    SECOES_CONTEXTO_PADRAO.map(s => ({
      ...s,
      ativo: false,
      campos: s.campos.map(c => ({ ...c, ativo: false })),
    })),
};
