import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Zap, Hash } from 'lucide-react';

export interface VariavelGrupo {
  grupo: string;
  vars: Array<{ chave: string; label: string }>;
}

interface PromptShortcutsBarProps {
  onInsert: (text: string) => void;
  customGroups?: VariavelGrupo[];
}

// ─── Variables grouped by entity ──────────────────────────────────────────────
const VARIAVEIS_GRUPOS = [
  {
    grupo: 'Mensagem',
    vars: [
      { chave: 'mensagem', label: 'Mensagem do lead' },
    ],
  },
  {
    grupo: 'Lead / Negócio',
    vars: [
      { chave: 'lead_id', label: 'ID do lead (UUID)' },
      { chave: 'lead_titulo', label: 'Título do negócio' },
      { chave: 'lead_control', label: 'Controle do agente (atual)' },
      { chave: 'lead_status', label: 'Status: in_progress | won | lost' },
      { chave: 'lead_valor', label: 'Valor do negócio (R$)' },
      { chave: 'lead_etapa_nome', label: 'Nome da etapa do pipeline' },
      { chave: 'lead_etapa_id',  label: 'UUID da etapa do pipeline' },
      { chave: 'lead_responsavel_id', label: 'UUID do vendedor responsável' },
      { chave: 'lead_responsavel_nome', label: 'Nome do vendedor responsável' },
      { chave: 'pipeline_etapas', label: 'Lista de etapas do pipeline (JSON)' },
      { chave: 'lead_ultima_interacao', label: 'Data da última interação' },
      { chave: 'lead_utm_source', label: 'UTM Source (origem do tráfego)' },
    ],
  },
  {
    grupo: 'Pessoa',
    vars: [
      { chave: 'pessoa_id', label: 'ID da pessoa (UUID)' },
      { chave: 'nome', label: 'Nome completo' },
      { chave: 'email', label: 'Email' },
      { chave: 'whatsapp', label: 'WhatsApp' },
      { chave: 'cargo', label: 'Cargo' },
      { chave: 'linkedin', label: 'LinkedIn' },
      { chave: 'score', label: 'Score calculado' },
      { chave: 'origem', label: 'Origem do lead' },
      { chave: 'momento', label: 'Momento (pesquisando, decidindo...)' },
      { chave: 'objetivo', label: 'Objetivo principal' },
      { chave: 'resumo_conversa', label: 'Resumo histórico da conversa' },
    ],
  },
  {
    grupo: 'Empresa',
    vars: [
      { chave: 'empresa_id', label: 'UUID da empresa' },
      { chave: 'empresa_nome', label: 'Nome da empresa' },
      { chave: 'empresa_segmento', label: 'Segmento' },
      { chave: 'empresa_porte', label: 'Porte' },
      { chave: 'empresa_website', label: 'Website' },
    ],
  },
  {
    grupo: 'Score',
    vars: [
      { chave: 'score_number', label: 'Score (número)' },
      { chave: 'score_framing_name', label: 'Enquadramento (ex: Qualificado)' },
      { chave: 'score_investment_name', label: 'Faixa de investimento' },
      { chave: 'score_objective_name', label: 'Objetivo pelo score' },
    ],
  },
  {
    grupo: 'Qualificação (Q1–Q26)',
    vars: [
      { chave: 'q1_main_bottleneck',         label: 'Q1 Gargalo Principal' },
      { chave: 'q2_lead_volume_month',       label: 'Q2 Volume Leads/Mês' },
      { chave: 'q3_team_size',               label: 'Q3 Tamanho da Equipe' },
      { chave: 'q4_crm_maturity',            label: 'Q4 Maturidade CRM' },
      { chave: 'q5_crm_name',                label: 'Q5 CRM/Ferramentas Atual' },
      { chave: 'q6_trigger',                 label: 'Q6 Gatilho' },
      { chave: 'q7_problem_impact',          label: 'Q7 Impacto do Problema' },
      { chave: 'q8_engagement_level',        label: 'Q8 Nível de Engajamento' },
      { chave: 'q9_decision_authority',      label: 'Q9 Autoridade de Decisão' },
      { chave: 'q10_stakeholders',           label: 'Q10 Stakeholders' },
      { chave: 'q11_budget_approved',        label: 'Q11 Budget Aprovado' },
      { chave: 'q12_timeline',               label: 'Q12 Timeline' },
      { chave: 'q13_urgency_reason',         label: 'Q13 Motivo da Urgência' },
      { chave: 'q14_data_ready',             label: 'Q14 Dados Prontos' },
      { chave: 'q15_minimum_volume',         label: 'Q15 Volume Mínimo' },
      { chave: 'q16_expected_roi',           label: 'Q16 ROI Esperado' },
      { chave: 'q17_objections',             label: 'Q17 Objeções' },
      { chave: 'q18_real_fit',               label: 'Q18 Fit Real' },
      { chave: 'q19_qualification_status',   label: 'Q19 Status de Qualificação' },
      { chave: 'q20_rejection_reason',       label: 'Q20 Motivo de Rejeição' },
      { chave: 'q21_interest_level',         label: 'Q21 Nível de Interesse (0-10)' },
      { chave: 'q22_close_probability',      label: 'Q22 Probabilidade Fechamento (%)' },
      { chave: 'q23_behavioral_tags',        label: 'Q23 Tags Comportamentais' },
      { chave: 'q24_last_update_by_agent',   label: 'Q24 Última Atualização Agente' },
      { chave: 'q25_disc_profile',           label: 'Q25 Perfil DISC' },
      { chave: 'conversation_summary',       label: 'Q26 Resumo da Conversa' },
    ],
  },
  {
    grupo: 'Agendamento',
    vars: [
      { chave: 'reunioes_proximas',     label: 'Próximas Reuniões (JSON)' },
      { chave: 'reuniao_ultima_data',   label: 'Data da Última Reunião' },
      { chave: 'reuniao_ultima_status', label: 'Status da Última Reunião' },
      { chave: 'slots_disponiveis',     label: 'Slots Disponíveis (JSON)' },
    ],
  },
];

// ─── Prompt engineering structures ────────────────────────────────────────────
const ESTRUTURAS = [
  {
    label: 'Chain of Thought',
    descricao: 'Raciocínio passo a passo antes de responder',
    snippet: `Pense passo a passo antes de responder:

1. Analise a mensagem: "{{mensagem}}"
2. Contexto: controle atual = {{lead_control}} | etapa pipeline = {{lead_etapa_nome}} | score = {{score_number}}
3. O que já foi qualificado: gargalo={{q1_main_bottleneck}} | budget={{q11_budget_approved}} | interesse={{q21_interest_level}}/10
4. Há reunião agendada? {{reunioes_proximas}}
5. Determine a melhor abordagem para este momento
6. Formule sua resposta

Resposta:`,
  },
  {
    label: 'Few-Shot Examples',
    descricao: 'Exemplos para calibrar tom e padrão de resposta',
    snippet: `EXEMPLOS DE COMO RESPONDER:

Situação: Lead com interesse mas objeção de preço
Mensagem: "Achei caro, vou pensar..."
Resposta correta: "Faz sentido querer avaliar bem. {{nome}}, posso te perguntar — o que seria considerado um investimento justo para resolver {{q1_main_bottleneck}}? (Budget atual: {{q11_budget_approved}})"

Situação: Lead não responde há dias (reengajamento)
Mensagem: (sem resposta)
Resposta correta: "{{nome}}, só queria confirmar se ainda faz sentido conversarmos. Da última vez você mencionou [problema]. Esse ponto continua sendo uma prioridade?"

Situação: Lead quer mais informações técnicas
Mensagem: "Como funciona a integração?"
Resposta correta: Perguntar primeiro sobre a stack atual antes de explicar qualquer coisa

---
Agora responda para: "{{mensagem}}"`,
  },
  {
    label: 'Guia de Tools Nativos',
    descricao: 'Quando e como chamar cada ferramenta do agente',
    snippet: `REGRAS PARA USO DE FERRAMENTAS (TOOLS):

Após formular sua resposta textual, identifique se alguma ação de CRM é necessária e chame a ferramenta correspondente — o sistema executará automaticamente.

ENRIQUECIMENTO:
- Coletou informação de qualificação → \`salvar_qualificacao\` (p_field_key + p_value)
- Confirmou dados do negócio → \`atualizar_lead\` {title, value, status}
- Obteve dados da pessoa → \`atualizar_pessoa\` {name, email, cargo}
- Identificou a empresa → \`atualizar_empresa\` {trade_name, website, tax_id}

PIPELINE:
- Lead pronto para avançar de etapa → \`atualizar_etapa\` (leads_stages_id da etapa destino)
- Mudar prompt sem trocar etapa → \`atualizar_control\` (control="2" ou valor desejado)
- Lead pediu atendimento humano → \`bloquear_ia\` (sem parâmetros)

AGENDAMENTO:
- Verificar disponibilidade → \`consultar_disponibilidade\` (p_user_id + p_date)
- Horário confirmado → \`criar_agendamento\` (title, start_time, end_time)
- Consultar reuniões existentes → \`consultar_agenda\` (query_params)
- Lead pediu nova data → \`remarcar_agendamento\` (meeting_id, start_time, end_time)
- Lead quer cancelar → \`cancelar_agendamento\` (meeting_id, reason)

REGISTRO:
- Informação relevante → \`criar_nota\` (title + content)

Controle atual: {{lead_control}} | Etapa: {{lead_etapa_nome}} ({{lead_etapa_id}}) | Score: {{score_number}}`,
  },
  {
    label: 'Condicional por Controle',
    descricao: 'Comportamento diferente por valor do controle do agente',
    snippet: `Execute o bloco correspondente ao campo control do lead:

SE control = "1":
  Objetivo: [descrever objetivo do controle 1]
  Perguntas: [listar perguntas]
  Avanço: Quando [condição] → chame \`atualizar_control\` com control="2"

SE control = "2":
  Objetivo: [descrever objetivo do controle 2]
  Perguntas: [listar perguntas]
  Avanço: Quando [condição] → chame \`atualizar_control\` com control="3"

SE control = "3":
  Objetivo: [descrever objetivo do controle 3]
  Ação final: [o que fazer ao concluir]

Controle atual do lead: {{lead_control}}`,
  },
  {
    label: 'Fallback / Tratamento de Erros',
    descricao: 'Comportamento em casos edge e situações inesperadas',
    snippet: `REGRAS DE FALLBACK:

SE a mensagem for incompreensível ou muito curta:
  → Peça clareza: "Poderia elaborar um pouco mais? Quero entender melhor."

SE o lead demonstrar desinteresse explícito ("não quero", "me tire da lista"):
  → mensagem: resposta respeitosa de encerramento
  → chame \`atualizar_lead\` com fields { status: "lost" }

SE detectar urgência alta ou pedido de falar com humano:
  → mensagem: "Vou conectar você com nosso time agora."
  → chame \`bloquear_ia\` (desativa o agente, transfere para humano)

SE não souber a resposta ou o contexto for insuficiente:
  → NUNCA invente informações
  → Pergunte o que falta

NUNCA: pressione indevidamente, minta, prometa o que não pode cumprir.`,
  },
  {
    label: 'Bloco de Contexto',
    descricao: 'Delimitador claro para separar contexto do prompt',
    snippet: `=========================================
CONTEXTO DO LEAD
=========================================
Nome: {{nome}} | Empresa: {{empresa_nome}} | WhatsApp: {{whatsapp}}
Controle do Agente: {{lead_control}} | Etapa Pipeline: {{lead_etapa_nome}}
Score: {{score_number}} ({{score_framing_name}}) | Status Qualif.: {{q19_qualification_status}}
Última interação: {{lead_ultima_interacao}}

Qualificação coletada:
- Gargalo: {{q1_main_bottleneck}}
- Budget: {{q11_budget_approved}} | Timeline: {{q12_timeline}}
- Interesse: {{q21_interest_level}}/10 | Prob. Fechamento: {{q22_close_probability}}%
- Decisor: {{q9_decision_authority}} | DISC: {{q25_disc_profile}}

Próximas reuniões: {{reunioes_proximas}}

Mensagem recebida: "{{mensagem}}"
=========================================
INSTRUÇÃO:`,
  },
];

export const PromptShortcutsBar = ({ onInsert, customGroups }: PromptShortcutsBarProps) => {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-card border-b border-white/[0.06]">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
          Inserir:
        </span>

        {/* Variáveis */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground">
              <Hash className="h-3 w-3" />
              Variáveis
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
            {VARIAVEIS_GRUPOS.map((grupo, gi) => (
              <div key={gi}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {grupo.grupo}
                </DropdownMenuLabel>
                {grupo.vars.map((v) => (
                  <DropdownMenuItem
                    key={v.chave}
                    onClick={() => onInsert(`{{${v.chave}}}`)}
                    className="text-xs cursor-pointer gap-2"
                  >
                    <span className="font-mono text-primary/80 shrink-0">{`{{${v.chave}}}`}</span>
                    <span className="text-muted-foreground text-[10px] ml-auto truncate">{v.label}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
            {customGroups && customGroups.length > 0 && customGroups.map((grupo, gi) => (
              <div key={`custom-${gi}`}>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {grupo.grupo}
                </DropdownMenuLabel>
                {grupo.vars.map((v) => (
                  <DropdownMenuItem
                    key={v.chave}
                    onClick={() => onInsert(`{{${v.chave}}}`)}
                    className="text-xs cursor-pointer gap-2"
                  >
                    <span className="font-mono text-primary/80 shrink-0">{`{{${v.chave}}}`}</span>
                    <span className="text-muted-foreground text-[10px] ml-auto truncate">{v.label}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Estruturas */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground">
              <Zap className="h-3 w-3" />
              Estruturas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Padrões de Prompt
            </DropdownMenuLabel>
            {ESTRUTURAS.map((s, idx) => (
              <DropdownMenuItem
                key={idx}
                onClick={() => onInsert(s.snippet)}
                className="cursor-pointer flex-col items-start gap-0.5 py-2"
              >
                <span className="text-xs font-medium text-foreground">{s.label}</span>
                <span className="text-[10px] text-muted-foreground">{s.descricao}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
  );
};
