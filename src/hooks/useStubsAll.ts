// DEFINITIVE SYSTEM STUBS - FINAL VERSION
import { toast } from 'sonner';

// Complete stub response with ALL properties
const stubResponse: any = {
  data: [],
  isLoading: false,
  loading: false,
  isError: false,
  isPending: false,
  isSuccess: true,
  error: null,
  count: 0,
  totalCount: 0,
  length: 0,
  refetch: (...args: any[]) => Promise.resolve({ data: [] }),
  
  // Collections
  pipelines: [],
  stages: [],
  times: [],
  usuarios: [],
  usuariosTimes: [],
  campanhas: [],
  negocios: [],
  empresas: [],
  pessoas: [],
  contatos: [],
  agendamentos: [],
  followups: [],
  
  // Campaign operations
  updateCampanha: { mutate: (...args: any[]) => {}, mutateAsync: (...args: any[]) => Promise.resolve(), isLoading: false, isPending: false },
  createCampanha: { mutate: (...args: any[]) => {}, mutateAsync: (...args: any[]) => Promise.resolve(), isLoading: false, isPending: false },
  deleteCampanha: { mutate: (...args: any[]) => {}, mutateAsync: (...args: any[]) => Promise.resolve(), isLoading: false, isPending: false },
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  removeContato: { mutate: (...args: any[]) => {}, mutateAsync: (...args: any[]) => Promise.resolve(), isLoading: false },
  isRemovingContato: false,
  
  // Team operations  
  criarTime: { mutate: (...args: any[]) => {}, mutateAsync: (...args: any[]) => Promise.resolve(), isLoading: false },
  adicionarUsuarioAoTime: { mutate: (...args: any[]) => {}, mutateAsync: (...args: any[]) => Promise.resolve(), isLoading: false },
  removerUsuarioDoTime: { mutate: (...args: any[]) => {}, mutateAsync: (...args: any[]) => Promise.resolve(), isLoading: false },
  atualizarTime: { mutate: (...args: any[]) => {}, mutateAsync: (...args: any[]) => Promise.resolve(), isLoading: false },
  fetchTimes: (...args: any[]) => Promise.resolve([]),
  fetchUsuarios: (...args: any[]) => Promise.resolve([]),
  fetchUsuariosTimes: (...args: any[]) => Promise.resolve([]),
  
  // Generic mutations
  mutate: (...args: any[]) => {},
  mutateAsync: (...args: any[]) => Promise.resolve(),
  
  // System  
  from: (...args: any[]) => stubResponse,
  select: (...args: any[]) => stubResponse,
  insert: (...args: any[]) => stubResponse,
  update: (...args: any[]) => stubResponse,
  delete: (...args: any[]) => stubResponse
};

// INTERFACES - Complete definitions
export interface Negocio {
  id: string;
  titulo?: string;
  valor?: number;
  pipeline_id: string;
  stage_id: string;
  person_id?: string;
  pessoa_id?: string;
  empresa_id?: string;
  responsavel_id?: string;
  responsavel?: string;
  time_responsavel?: string;
  status: string;
  created_at: string;
  updated_at: string;
  pessoa?: { id: string; nome: string; email?: string; whatsapp?: string; atendimento_ia?: boolean; status_atendimento?: string; };
  crm_pessoas?: { id: string; nome: string; email?: string; whatsapp?: string; };
  empresa?: { id: string; nome: string; nome_fantasia?: string; };
  crm_empresas?: { id: string; nome_fantasia: string; };
  responsavel_usuario?: { id: string; nome: string; };
  pipeline?: { id: string; nome: string; };
  stage?: { id: string; nome: string; cor?: string; ordem?: number; };
}

export interface Agendamento {
  id: string;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim?: string;
  status: 'agendado' | 'cancelado' | 'bloqueio manual' | 'compareceu' | 'nao_compareceu';
  usuario_id?: string;
  negocio?: { id: string; titulo: string; person?: { nome: string; score?: number; }; };
  created_at: string;
  criado_em?: string;
  local?: string;
  quantidade?: number;
}

export interface AgenteIA {
  id: string;
  nome: string;
  ativo?: boolean;
  descricao?: string;
  dados_entrada?: string;
  identidade?: string;
  regras_gerais?: string;
  prompt_base?: string;
  usa_etapas?: boolean;
  versao_atual?: number;
  created_at: string;
}

export interface Pipeline {
  id: string;
  nome: string;
  descricao?: string;
  ativo?: boolean;
  tenant_id?: string;
  stages?: Stage[];
}

export interface Stage {
  id: string;
  nome: string;
  pipeline_id?: string;
  ordem?: number;
  cor?: string;
  ativo?: boolean;
  tenant_id?: string;
}

export interface Time {
  id: string;
  nome: string;
  tipo?: "vendas" | "suporte" | "marketing" | "financeiro" | "";
  descricao?: string;
  prioridade?: number;
  ativo?: boolean;
}

export interface EtapaAgente {
  id: string;
  nome?: string;
  nome_etapa?: string;
  prompt_etapa?: string;
  ordem?: number;
  pipeline_id?: string;
  stage_id?: string;
  controle?: string;
  ativa?: boolean;
  agente_ia_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HistoricoAgente {
  id: string;
  data: string;
  versao: number;
  alteracoes: string;
}

export interface ChunkConhecimento {
  id: string;
  content: string;
  ordem_chunk?: number;
  embedding?: any;
  created_at?: string;
}

export interface AgendamentoFollowup {
  id: string;
  data: string;
  mensagem?: string;
  dias?: number;
  horas?: number;
  minutos?: number;
  tipo?: string;
  template_id?: string;
  ativo?: boolean;
}

export interface StageFollowup {
  id: string;
  stage_id: string;
  tipo?: string;
  arquivo_audio?: string;
  mensagem?: string;
  assunto?: string;
  template_id?: string;
  dias?: number;
  horas?: number;
  minutos?: number;
  ativo?: boolean;
}

export interface Pessoa {
  id: string;
  nome: string;
  email?: string;
  whatsapp?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  nome_fantasia?: string;
}

export interface DashboardFiltersType {
  dateRange?: any;
  pipeline?: string;
  pipelineId?: string;
  stage?: string;
  stageId?: string;
  status?: string;
  responsavel?: string;
  period?: string;
  dataInicio?: string;
  dataFim?: string;
  scores?: number[];
}

export interface DashboardNegociosDataType {
  totalLeads: number;
  valorTotal: number;
  leadsGanhos: number;
  leadsPerdidos: number;
  leadsEmAndamento: number;
  ticketMedio: number;
  taxaConversao: number;
  leadsPorEstagio: any[];
  leadsPorStatus: any[];
  motivosPerda: any[];
}

export interface AuthContextType {
  currentTenantId?: string;
  user?: any;
  signOut?: () => void;
}

// Universal function that returns stubResponse for any hook call
const createHook = () => (...args: any[]) => stubResponse;

// HOOK EXPORTS - All hooks return the same stubResponse
export const useAgendamentos = (...args: any[]) => stubResponse;
export const useAgendamentosFollowups = (...args: any[]) => stubResponse;
export const useAgentesIA = (...args: any[]) => stubResponse;
export const useBasesConhecimento = (...args: any[]) => stubResponse;
export const useDashboardNegocios = (...args: any[]) => stubResponse;
export const useDashboardCampanhas = (...args: any[]) => stubResponse;
export const useExportData = (...args: any[]) => stubResponse;
export const useHorarios = (...args: any[]) => stubResponse;
export const useNegocioArquivos = (...args: any[]) => stubResponse;
export const useNegocioNotas = (...args: any[]) => stubResponse;
export const usePessoas = (...args: any[]) => stubResponse;
export const usePipelines = (...args: any[]) => stubResponse;
export const useUsuarios = (...args: any[]) => stubResponse;
export const useTimes = (...args: any[]) => stubResponse;
export const useEmpresas = (...args: any[]) => stubResponse;
export const useNegocios = (...args: any[]) => ({ ...stubResponse, data: stubResponse.data || [] });
export const useNegocio = (...args: any[]) => ({ ...stubResponse, isError: false });
export const useNegociosDefinitive = (...args: any[]) => stubResponse;
export const useConversas = (...args: any[]) => stubResponse;
export const useConversasSimples = (...args: any[]) => stubResponse;
export const useConversasPessoas = (...args: any[]) => stubResponse;
export const useCampanhas = (...args: any[]) => ({ ...stubResponse, createCampanha: stubResponse.mutate, isCreating: false, contatos: [], removeContato: stubResponse.mutate, isRemovingContato: false });
export const useCampanhaContatos = (...args: any[]) => ({ ...stubResponse, contatos: stubResponse.data });
export const useFollowups = (...args: any[]) => stubResponse;
export const useStageFollowups = (...args: any[]) => stubResponse;
export const useNegociosPaginados = (...args: any[]) => ({ ...stubResponse, totalCount: 0 });
export const useEmpresasPaginadas = (...args: any[]) => ({ ...stubResponse, pagination: { page: 1, perPage: 20, total: 0, totalPages: 0 } });
export const usePessoasPaginadas = (...args: any[]) => ({ ...stubResponse, pessoas: [], pagination: { page: 1, perPage: 20, total: 0, totalPages: 0 } });
export const useIntelligentSupabase = (...args: any[]) => stubResponse;
export const useComplianceMonitor = (...args: any[]) => stubResponse;
export const useUsuariosDoTenant = (...args: any[]) => stubResponse;
export const useUsuariosTimes = (...args: any[]) => stubResponse;
export const useTeamMembers = (...args: any[]) => stubResponse;
export const useNegociosPorEtapa = (...args: any[]) => ({ data: { data: [], count: 0, hasMore: false }, count: 0, hasMore: false, isLoading: false, refetch: () => Promise.resolve({ data: { data: [], count: 0 } }) });
export const useDeletarPessoaStub = (...args: any[]) => stubResponse;
export const useEmpresasPorPessoa = (...args: any[]) => stubResponse;
export const useAssociarPessoaEmpresa = (...args: any[]) => stubResponse;
export const useDesassociarPessoaEmpresa = (...args: any[]) => stubResponse;
export const useUpdateNegocio = (...args: any[]) => stubResponse;
export const useMensagensPorPessoaStub = (...args: any[]) => stubResponse;
export const useEnviarMensagem = (...args: any[]) => stubResponse;
export const useMotivosPerda = (...args: any[]) => ({ motivos: [] });

// Mutation hooks
export const useCriarPessoa = (...args: any[]) => stubResponse;
export const useAtualizarPessoa = (...args: any[]) => stubResponse;
export const useCriarEmpresa = (...args: any[]) => stubResponse;
export const useAtualizarEmpresa = (...args: any[]) => stubResponse;
export const useDeletarEmpresa = (...args: any[]) => stubResponse;
export const useCriarNegocio = (...args: any[]) => stubResponse;
export const useCriarAgendamento = (...args: any[]) => stubResponse;
export const useUpdateAgendamento = (...args: any[]) => stubResponse;
export const useDeleteAgendamento = (...args: any[]) => stubResponse;
export const useUpdateNegocioStage = (...args: any[]) => stubResponse;

// Agent hooks
export const useSalvarAgente = createHook();
export const useExcluirAgente = createHook();
export const useEtapasAgente = createHook();
export const useCriarAgente = createHook();
export const useHistoricoAgente = createHook();
export const useRestaurarVersao = createHook();

// Knowledge base hooks
export const useBaseConhecimentoDetails = createHook();
export const useChunksConhecimento = createHook();
export const useUpdateBaseConhecimento = createHook();
export const useDeleteBaseConhecimento = createHook();
export const useCreateBaseConhecimento = createHook();

// Followup hooks
export const useCreateFollowup = createHook();
export const useUpdateFollowup = createHook();
export const useDeleteFollowup = createHook();
export const useCreateAgendamentoFollowup = createHook();
export const useUpdateAgendamentoFollowup = createHook();
export const useDeleteAgendamentoFollowup = createHook();

// Schedule hooks
export const getDiaSemanaLabel = (dia: number) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dia];
export const useCriarHorario = createHook();
export const useUpdateHorario = createHook();
export const useDeleteHorario = createHook();

// Additional utility hooks
export const useEstatisticasMensagens = createHook();
export const useExportConversasCSV = createHook();
export const useIncrementarContadorResumo = createHook();
export const useLLMConnections = createHook();
export const useNegocioDefinitive = createHook();

// Additional specific exports
export const useNegocioAbandonado = createHook();

export const tenants = [];

// Main hook that returns stubResponse
export const useStubsAll = () => stubResponse;

export default stubResponse;
