import { useQuery } from '@tanstack/react-query';

export interface SimulatedMessage {
  id: number;
  lead_id: string;
  people_id: string;
  user_id: string | null;
  followup_id: string | null;
  content: string;
  from_contact: 'humano' | 'ia';
  channel: 'instagram' | 'whatsapp' | 'email';
  message_type: 'texto' | 'imagem' | 'audio';
  audio_url: string | null;
  transcription: string | null;
  audio_duration: number | null;
  llm: string | null;
  tokens_qty: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SimulatedPessoa {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  whatsapp: string;
  document: string;
  status: string;
  score: number;
  type: string;
  moment: string;
  goal: string;
  conversation_summary?: string;
}

// Dados simulados de conversa com Eduardo Freitas via Instagram DM
const SIMULATED_MESSAGES: SimulatedMessage[] = [
  {
    id: 1,
    lead_id: 'eduardo-freitas-lead-id',
    people_id: 'eduardo-freitas-id',
    user_id: null,
    followup_id: null,
    content: 'Oi, tudo bem? Gostaria de saber mais sobre suas soluções para vendas.',
    from_contact: 'humano',
    channel: 'instagram',
    message_type: 'texto',
    audio_url: null,
    transcription: null,
    audio_duration: null,
    llm: null,
    tokens_qty: null,
    metadata: { profile_pic: 'https://via.placeholder.com/48' },
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 120 * 60000).toISOString(),
  },
  {
    id: 2,
    lead_id: 'eduardo-freitas-lead-id',
    people_id: 'eduardo-freitas-id',
    user_id: null,
    followup_id: null,
    content: 'Oi Eduardo! 👋 Tudo certo! Fico feliz em poder ajudar. Qual é o seu principal desafio com vendas no momento?',
    from_contact: 'ia',
    channel: 'instagram',
    message_type: 'texto',
    audio_url: null,
    transcription: null,
    audio_duration: null,
    llm: 'gpt-4',
    tokens_qty: 45,
    metadata: { bot_name: 'Assistant', confidence: 0.95 },
    created_at: new Date(Date.now() - 110 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 110 * 60000).toISOString(),
  },
  {
    id: 3,
    lead_id: 'eduardo-freitas-lead-id',
    people_id: 'eduardo-freitas-id',
    user_id: null,
    followup_id: null,
    content: 'Estou com dificuldade em qualificar leads. Recebo muitos contatos mas a conversão é baixa. 😕',
    from_contact: 'humano',
    channel: 'instagram',
    message_type: 'texto',
    audio_url: null,
    transcription: null,
    audio_duration: null,
    llm: null,
    tokens_qty: null,
    metadata: { profile_pic: 'https://via.placeholder.com/48' },
    created_at: new Date(Date.now() - 100 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 100 * 60000).toISOString(),
  },
  {
    id: 4,
    lead_id: 'eduardo-freitas-lead-id',
    people_id: 'eduardo-freitas-id',
    user_id: null,
    followup_id: null,
    content: 'Entendi perfeitamente! A qualificação de leads é essencial. Com a nossa plataforma SENDS PRO, você consegue:\n\n✅ Automatizar o contato inicial\n✅ Criar fluxos de qualificação inteligentes\n✅ Rastrear comportamento de clientes\n✅ Aumentar conversão em até 3x\n\nGostaria de agendar uma demonstração?',
    from_contact: 'ia',
    channel: 'instagram',
    message_type: 'texto',
    audio_url: null,
    transcription: null,
    audio_duration: null,
    llm: 'gpt-4',
    tokens_qty: 78,
    metadata: { bot_name: 'Assistant', confidence: 0.98, cta: 'demo' },
    created_at: new Date(Date.now() - 90 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 90 * 60000).toISOString(),
  },
  {
    id: 5,
    lead_id: 'eduardo-freitas-lead-id',
    people_id: 'eduardo-freitas-id',
    user_id: null,
    followup_id: null,
    content: 'Ótimo! Quando você poderia fazer uma demo? Prefiro na quarta ou quinta à noite.',
    from_contact: 'humano',
    channel: 'instagram',
    message_type: 'texto',
    audio_url: null,
    transcription: null,
    audio_duration: null,
    llm: null,
    tokens_qty: null,
    metadata: { profile_pic: 'https://via.placeholder.com/48' },
    created_at: new Date(Date.now() - 80 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 80 * 60000).toISOString(),
  },
  {
    id: 6,
    lead_id: 'eduardo-freitas-lead-id',
    people_id: 'eduardo-freitas-id',
    user_id: null,
    followup_id: null,
    content: 'Perfeito! Deixa eu verificar a disponibilidade do time para quarta ou quinta à noite. Você tem algum horário preferido? (19h, 20h ou 21h)?',
    from_contact: 'ia',
    channel: 'instagram',
    message_type: 'texto',
    audio_url: null,
    transcription: null,
    audio_duration: null,
    llm: 'gpt-4',
    tokens_qty: 55,
    metadata: { bot_name: 'Assistant', confidence: 0.96, cta: 'scheduling' },
    created_at: new Date(Date.now() - 70 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 70 * 60000).toISOString(),
  },
  {
    id: 7,
    lead_id: 'eduardo-freitas-lead-id',
    people_id: 'eduardo-freitas-id',
    user_id: null,
    followup_id: null,
    content: 'Quarta às 19h é ótimo para mim!',
    from_contact: 'humano',
    channel: 'instagram',
    message_type: 'texto',
    audio_url: null,
    transcription: null,
    audio_duration: null,
    llm: null,
    tokens_qty: null,
    metadata: { profile_pic: 'https://via.placeholder.com/48' },
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: 8,
    lead_id: 'eduardo-freitas-lead-id',
    people_id: 'eduardo-freitas-id',
    user_id: null,
    followup_id: null,
    content: '✅ Ótimo! Sua demo está marcada para quarta-feira às 19h00.\n\nVou enviar o link de videoconferência 1 hora antes. Qualquer dúvida, é só chamar!\n\nAté logo! 🚀',
    from_contact: 'ia',
    channel: 'instagram',
    message_type: 'texto',
    audio_url: null,
    transcription: null,
    audio_duration: null,
    llm: 'gpt-4',
    tokens_qty: 62,
    metadata: { bot_name: 'Assistant', confidence: 0.99, cta: 'scheduled' },
    created_at: new Date(Date.now() - 50 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 50 * 60000).toISOString(),
  },
];

const SIMULATED_PESSOA: SimulatedPessoa = {
  id: 'eduardo-freitas-id',
  tenant_id: 'default-tenant',
  name: 'Eduardo Freitas',
  email: 'eduardo.freitas@empresa.com.br',
  whatsapp: '+55 11 9 9999-9999',
  document: '123.456.789-00',
  status: 'active',
  score: 78,
  type: 'pessoa',
  moment: 'discovery',
  goal: 'Aumentar conversão de vendas',
  conversation_summary:
    'Eduardo é um gestor de vendas interessado em automação de leads e qualificação. Demonstrou interesse em demo. Agendada para quarta-feira às 19h.',
};

/**
 * Hook para simular conversa com Eduardo Freitas
 * Útil para testes, demos e desenvolvimento
 * @param pessoaId - ID da pessoa (se omitido, usa dados simulados)
 * @param enabled - Se deve usar dados simulados
 * @returns Mensagens e pessoa simuladas
 */
export function useSimularConversa(pessoaId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['simular-conversa-eduardo', pessoaId],
    queryFn: async () => ({
      mensagens: SIMULATED_MESSAGES,
      pessoa: SIMULATED_PESSOA,
    }),
    enabled,
    staleTime: Infinity,
  });
}

export function getSimularConversaData() {
  return {
    mensagens: SIMULATED_MESSAGES,
    pessoa: SIMULATED_PESSOA,
  };
}
