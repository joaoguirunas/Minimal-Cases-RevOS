import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Copy, CheckCheck, Wrench,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ── Q Fields ─────────────────────────────────────────────────────────────────

const Q_FIELDS = [
  { key: 'q1_main_bottleneck',         label: 'Q1 — Gargalo Principal' },
  { key: 'q2_lead_volume_month',       label: 'Q2 — Volume Leads/Mês' },
  { key: 'q3_team_size',               label: 'Q3 — Tamanho da Equipe' },
  { key: 'q4_crm_maturity',            label: 'Q4 — Maturidade CRM' },
  { key: 'q5_crm_name',                label: 'Q5 — CRM/Ferramentas Atual' },
  { key: 'q6_trigger',                 label: 'Q6 — Gatilho' },
  { key: 'q7_problem_impact',          label: 'Q7 — Impacto do Problema' },
  { key: 'q8_engagement_level',        label: 'Q8 — Nível de Engajamento' },
  { key: 'q9_decision_authority',      label: 'Q9 — Autoridade de Decisão' },
  { key: 'q10_stakeholders',           label: 'Q10 — Stakeholders' },
  { key: 'q11_budget_approved',        label: 'Q11 — Budget Aprovado' },
  { key: 'q12_timeline',               label: 'Q12 — Timeline' },
  { key: 'q13_urgency_reason',         label: 'Q13 — Motivo da Urgência' },
  { key: 'q14_data_ready',             label: 'Q14 — Dados Prontos' },
  { key: 'q15_minimum_volume',         label: 'Q15 — Volume Mínimo' },
  { key: 'q16_expected_roi',           label: 'Q16 — ROI Esperado' },
  { key: 'q17_objections',             label: 'Q17 — Objeções' },
  { key: 'q18_real_fit',               label: 'Q18 — Fit Real' },
  { key: 'q19_qualification_status',   label: 'Q19 — Status de Qualificação' },
  { key: 'q20_rejection_reason',       label: 'Q20 — Motivo de Rejeição' },
  { key: 'q21_interest_level',         label: 'Q21 — Nível de Interesse (0-10)' },
  { key: 'q22_close_probability',      label: 'Q22 — Probabilidade Fechamento (%)' },
  { key: 'q23_behavioral_tags',        label: 'Q23 — Tags Comportamentais' },
  { key: 'q24_last_update_by_agent',   label: 'Q24 — Última Atualização Agente' },
  { key: 'q25_disc_profile',           label: 'Q25 — Perfil DISC' },
  { key: 'conversation_summary',       label: 'Q26 — Resumo da Conversa' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolWidgetPanelProps {
  pipelines: Array<{ id: string; nome: string }>;
  stages: Array<{ id: string; nome: string; pipeline_id: string; ordem: number }>;
  agentPipelineId?: string;
}

// ── Snippet preview ───────────────────────────────────────────────────────────

const SnippetPreview = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-2.5 rounded-[4px] bg-card border border-white/[0.06] overflow-hidden">
      <pre className="px-2.5 py-2 text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </pre>
      <div className="border-t border-white/[0.06] px-2 py-1 flex justify-end">
        <button
          onClick={handle}
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[9px] border transition-all',
            copied
              ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
              : 'border-white/[0.06] bg-background text-muted-foreground/60 hover:text-foreground hover:border-border',
          )}
        >
          {copied
            ? <><CheckCheck className="h-2.5 w-2.5" /> ok</>
            : <><Copy className="h-2.5 w-2.5" /> copiar</>}
        </button>
      </div>
    </div>
  );
};

// ── Individual Tool Widgets ───────────────────────────────────────────────────

const ph = (v: string) => v || '[preencha]';

const SalvarQualificacaoWidget = () => {
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const snippet =
    `Após coletar a informação, chame \`salvar_qualificacao\`:\n- p_field_key: "${ph(field)}"\n- p_value: "${ph(value)}"`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Campo Q</p>
        <Select value={field} onValueChange={setField}>
          <SelectTrigger className="h-[30px] text-xs">
            <SelectValue placeholder="Selecione o campo…" />
          </SelectTrigger>
          <SelectContent>
            {Q_FIELDS.map(q => (
              <SelectItem key={q.key} value={q.key} className="text-xs">
                {q.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Valor coletado</p>
        <Input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="valor coletado na conversa"
          className="h-[30px] text-xs"
        />
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const AtualizarLeadWidget = () => {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  const lines = [
    `Quando confirmar dados do negócio, chame \`atualizar_lead\`:`,
    `- fields: {`,
    title  ? `    title: "${title}",`  : `    title: "${ph('')}",`,
    value  ? `    value: ${value},`    : `    value: ${ph('')},`,
    status ? `    status: "${status}"` : `    status: "${ph('')}"`,
    `  }`,
  ].join('\n');
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Título</p>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do negócio" className="h-[30px] text-xs" />
        </div>
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Valor (R$)</p>
          <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" className="h-[30px] text-xs" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Status</p>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-[30px] text-xs"><SelectValue placeholder="Manter atual" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="in_progress" className="text-xs">in_progress</SelectItem>
            <SelectItem value="won"         className="text-xs">won</SelectItem>
            <SelectItem value="lost"        className="text-xs">lost</SelectItem>
            <SelectItem value="archived"    className="text-xs">archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SnippetPreview text={lines} />
    </div>
  );
};

const AtualizarPessoaWidget = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('');
  const snippet =
    `Ao obter dados do contato, chame \`atualizar_pessoa\`:\n- fields: {\n    name: "${ph(name)}",\n    email: "${ph(email)}",\n    notes: "${ph(cargo)}"\n  }`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Nome</p>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" className="h-[30px] text-xs" />
      </div>
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">E-mail</p>
        <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" className="h-[30px] text-xs" />
      </div>
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Cargo (notes)</p>
        <Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="CEO, Diretor…" className="h-[30px] text-xs" />
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const AtualizarEmpresaWidget = () => {
  const [tradeName, setTradeName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [website, setWebsite] = useState('');
  const snippet =
    `Quando identificar a empresa, chame \`atualizar_empresa\`:\n- company_id: "{{empresa_id}}"\n- fields: {\n    trade_name: "${ph(tradeName)}",\n    tax_id: "${ph(taxId)}",\n    website: "${ph(website)}"\n  }`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Nome fantasia</p>
        <Input value={tradeName} onChange={e => setTradeName(e.target.value)} placeholder="Empresa Ltda" className="h-[30px] text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">CNPJ</p>
          <Input value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="00.000.000/0001-00" className="h-[30px] text-xs" />
        </div>
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Website</p>
          <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="empresa.com.br" className="h-[30px] text-xs" />
        </div>
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const BloquearIAWidget = () => {
  const snippet =
    `Se o lead pedir atendimento humano ou sair do escopo, chame \`bloquear_ia\` (sem parâmetros).\nDepois informe: "Vou transferir para nossa equipe. Em breve entrarão em contato."`;
  return <SnippetPreview text={snippet} />;
};

const AtualizarEtapaWidget = ({
  pipelines,
  stages,
  agentPipelineId,
}: ToolWidgetPanelProps) => {
  const [pipelineId, setPipelineId] = useState(agentPipelineId || '');
  const [stageId, setStageId] = useState('');

  const filteredStages = stages
    .filter(s => s.pipeline_id === pipelineId)
    .sort((a, b) => a.ordem - b.ordem);

  const stageName = stages.find(s => s.id === stageId)?.nome ?? '';
  const snippet =
    `Para mover o lead de etapa, chame \`atualizar_etapa\`:\n- leads_stages_id: "${ph(stageId)}"${stageName ? ` // ${stageName}` : ''}`;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Pipeline</p>
        <Select value={pipelineId} onValueChange={v => { setPipelineId(v); setStageId(''); }}>
          <SelectTrigger className="h-[30px] text-xs"><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent>
            {pipelines.map(p => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {pipelineId && (
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Etapa destino</p>
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger className="h-[30px] text-xs"><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {filteredStages.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <SnippetPreview text={snippet} />
    </div>
  );
};

const AtualizarControlWidget = () => {
  const [control, setControl] = useState('');
  const snippet =
    `Para redirecionar o fluxo de prompts, chame \`atualizar_control\`:\n- control: "${ph(control)}"\n\nO control determina qual etapa de prompt executa na próxima interação.`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Valor do controle</p>
        <Input value={control} onChange={e => setControl(e.target.value)} placeholder="agendamento, nurturing, 2…" className="h-[30px] text-xs" />
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const CriarAgendamentoWidget = () => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const snippet =
    `Após confirmar data/hora, chame \`criar_agendamento\`:\n- title: "${ph(title)}"\n- people_id: "{{pessoa_id}}"\n- user_id: "{{lead_responsavel_id}}"\n- start_time: "${ph(start)}"\n- end_time: "${ph(end)}"\n- description: contexto da reunião`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Título</p>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder='Reunião com {{nome}}' className="h-[30px] text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Início</p>
          <Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="h-[30px] text-xs" />
        </div>
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Fim</p>
          <Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="h-[30px] text-xs" />
        </div>
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const ConsultarDisponibilidadeWidget = () => {
  const [date, setDate] = useState('');
  const [period, setPeriod] = useState('');
  const snippet =
    `Para verificar horários, chame \`consultar_disponibilidade\`:\n- p_user_id: "{{lead_responsavel_id}}"\n- p_date: "${ph(date)}"\n- p_period: "${ph(period)}"\n- p_slot_minutes: 30`;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Data (YYYY-MM-DD)</p>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-[30px] text-xs" />
        </div>
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Período</p>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-[30px] text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="morning"   className="text-xs">morning</SelectItem>
              <SelectItem value="afternoon" className="text-xs">afternoon</SelectItem>
              <SelectItem value="evening"   className="text-xs">evening</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const RemarcarAgendamentoWidget = () => {
  const [meetingId, setMeetingId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const snippet =
    `Quando o lead pedir reagendamento, confirme a nova data e chame \`remarcar_agendamento\`:\n- meeting_id: "${ph(meetingId)}"\n- start_time: "${ph(start)}"\n- end_time: "${ph(end)}"\n- notes: motivo do reagendamento (opcional)`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Meeting ID</p>
        <Input value={meetingId} onChange={e => setMeetingId(e.target.value)} placeholder="UUID da reunião" className="h-[30px] text-xs font-mono" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Novo início</p>
          <Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="h-[30px] text-xs" />
        </div>
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Novo fim</p>
          <Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="h-[30px] text-xs" />
        </div>
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const CancelarAgendamentoWidget = () => {
  const [meetingId, setMeetingId] = useState('');
  const [reason, setReason] = useState('');
  const snippet =
    `Quando confirmar cancelamento, chame \`cancelar_agendamento\`:\n- meeting_id: "${ph(meetingId)}"\n- reason: "${ph(reason)}"`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Meeting ID</p>
        <Input value={meetingId} onChange={e => setMeetingId(e.target.value)} placeholder="UUID da reunião" className="h-[30px] text-xs font-mono" />
      </div>
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Motivo</p>
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Lead solicitou cancelamento…" className="h-[30px] text-xs" />
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const AgendarRetornoWidget = () => {
  const [motivo, setMotivo] = useState('');
  const [templateId, setTemplateId] = useState('');
  const snippet =
    `Quando o lead pedir para ser chamado depois, chame \`agendar_retorno\`:\n` +
    `- scheduled_for: "<ISO com offset, resolvido a partir de {{agora}}/{{hoje}}>"\n` +
    `- motivo: "${ph(motivo)}"\n` +
    (templateId ? `- template_id: "${templateId}"\n` : '') +
    `\nExiste no máximo UM retorno pendente por lead — chamar de novo reagenda o existente.\n` +
    `Se o lead retomar a conversa antes do horário, chame \`cancelar_retorno\`:\n` +
    `- motivo: "lead retomou a conversa"`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Motivo do retorno</p>
        <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="pediu para retomar depois da reunião dele" className="h-[30px] text-xs" />
      </div>
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Template (opcional)</p>
        <Input value={templateId} onChange={e => setTemplateId(e.target.value)} placeholder="id do template configurado em Agendar Retorno" className="h-[30px] text-xs font-mono" />
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const CriarNotaWidget = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const snippet =
    `Para registrar informação relevante, chame \`criar_nota\`:\n- title: "${ph(title)}"\n- content: ${ph(content)}`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Título</p>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resumo da conversa" className="h-[30px] text-xs" />
      </div>
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Conteúdo</p>
        <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="texto completo da nota…" rows={3} className="text-xs resize-none" />
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

const ConsultarAgendaWidget = () => {
  const [params, setParams] = useState('');
  const snippet =
    `Para ver reuniões existentes, chame \`consultar_agenda\`:\n- query_params: "${ph(params)}"`;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Query params</p>
        <Input value={params} onChange={e => setParams(e.target.value)} placeholder="status=eq.agendado&order=start_time.asc&limit=3" className="h-[30px] text-xs font-mono" />
      </div>
      <SnippetPreview text={snippet} />
    </div>
  );
};

// ── Tool Category ─────────────────────────────────────────────────────────────

interface ToolDef {
  name: string;
  desc: string;
  Widget: React.ComponentType<ToolWidgetPanelProps>;
}

interface CategoryDef {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  tools: ToolDef[];
}

const makeCategories = (props: ToolWidgetPanelProps): CategoryDef[] => [
  {
    label: 'Enriquecimento',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/8',
    borderColor: 'border-violet-500/20',
    tools: [
      { name: 'salvar_qualificacao', desc: 'Salva campo Q1–Q35', Widget: () => <SalvarQualificacaoWidget /> },
      { name: 'atualizar_lead',      desc: 'Atualiza título, valor ou status', Widget: () => <AtualizarLeadWidget /> },
      { name: 'atualizar_pessoa',    desc: 'Atualiza nome, cargo ou e-mail', Widget: () => <AtualizarPessoaWidget /> },
      { name: 'atualizar_empresa',   desc: 'Atualiza dados da empresa', Widget: () => <AtualizarEmpresaWidget /> },
      { name: 'bloquear_ia',         desc: 'Transfere para atendimento humano', Widget: () => <BloquearIAWidget /> },
    ],
  },
  {
    label: 'Pipeline & Controle',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/8',
    borderColor: 'border-blue-500/20',
    tools: [
      { name: 'atualizar_etapa',   desc: 'Move o lead para outra etapa', Widget: () => <AtualizarEtapaWidget {...props} /> },
      { name: 'atualizar_control', desc: 'Muda o controle sem trocar etapa', Widget: () => <AtualizarControlWidget /> },
    ],
  },
  {
    label: 'Agendamento',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/8',
    borderColor: 'border-orange-500/20',
    tools: [
      { name: 'criar_agendamento',         desc: 'Cria uma reunião no sistema', Widget: () => <CriarAgendamentoWidget /> },
      { name: 'consultar_disponibilidade', desc: 'Retorna slots livres de um consultor', Widget: () => <ConsultarDisponibilidadeWidget /> },
      { name: 'remarcar_agendamento',      desc: 'Reagenda para nova data/hora', Widget: () => <RemarcarAgendamentoWidget /> },
      { name: 'cancelar_agendamento',      desc: 'Cancela uma reunião existente', Widget: () => <CancelarAgendamentoWidget /> },
      { name: 'consultar_agenda',          desc: 'Lista reuniões com filtros', Widget: () => <ConsultarAgendaWidget /> },
      { name: 'agendar_retorno',           desc: 'Agenda um retorno ad-hoc (+ cancelar_retorno)', Widget: () => <AgendarRetornoWidget /> },
    ],
  },
  {
    label: 'Registro',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/8',
    borderColor: 'border-emerald-500/20',
    tools: [
      { name: 'criar_nota', desc: 'Adiciona nota interna ao negócio', Widget: () => <CriarNotaWidget /> },
    ],
  },
];

// ── ToolWidgetPanel ───────────────────────────────────────────────────────────

export const ToolWidgetPanel = (props: ToolWidgetPanelProps) => {
  const [panelOpen, setPanelOpen] = useState(true);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});

  const categories = makeCategories(props);
  const totalTools = categories.reduce((acc, c) => acc + c.tools.length, 0);

  const toggleCat  = (label: string) => setOpenCats(p  => ({ ...p,  [label]: !p[label] }));
  const toggleTool = (name: string)  => setOpenTools(p => ({ ...p, [name]: !p[name] }));

  return (
    <div className="border border-white/[0.06] rounded-[4px] overflow-hidden">
      {/* Panel header */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        className="flex items-center gap-2 w-full px-3 py-2.5 bg-card border-b border-white/[0.06] hover:bg-muted transition-all duration-300 text-left"
      >
        <Wrench className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-xs font-semibold text-foreground flex-1">Ferramentas disponíveis</span>
        <span className="text-[9px] text-muted-foreground/50 mr-1">{totalTools} tools</span>
        {panelOpen
          ? <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
      </button>

      {panelOpen && (
        <div className="divide-y divide-border/20 overflow-y-auto max-h-[calc(100vh-200px)]">
          {categories.map((cat) => {
            const catOpen = openCats[cat.label] !== false; // open by default
            return (
              <div key={cat.label}>
                {/* Category header */}
                <button
                  onClick={() => toggleCat(cat.label)}
                  className="flex items-center gap-1.5 w-full px-3 py-2 hover:bg-card transition-all duration-300 text-left"
                >
                  {catOpen
                    ? <ChevronDown  className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                    : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />}
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', cat.color)}>
                    {cat.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground/30 ml-1">{cat.tools.length}</span>
                </button>

                {catOpen && (
                  <div className="pb-1">
                    {cat.tools.map((tool) => {
                      const toolOpen = openTools[tool.name] ?? false;
                      return (
                        <div
                          key={tool.name}
                          className={cn(
                            'mx-2 mb-1 rounded-[4px] border overflow-hidden',
                            cat.bgColor,
                            cat.borderColor,
                          )}
                        >
                          {/* Tool row */}
                          <button
                            onClick={() => toggleTool(tool.name)}
                            className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-white/5 transition-all duration-300"
                          >
                            <div className="flex-1 min-w-0">
                              <code className={cn('text-[10px] font-mono font-semibold block leading-tight mb-0.5', cat.color)}>
                                {tool.name}
                              </code>
                              <span className="text-[9px] text-muted-foreground/70 leading-relaxed">
                                {tool.desc}
                              </span>
                            </div>
                            {toolOpen
                              ? <ChevronDown  className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                              : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />}
                          </button>

                          {/* Widget (expandido) */}
                          {toolOpen && (
                            <div className="px-2 pb-2 pt-0.5 border-t border-black/5">
                              <tool.Widget {...props} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="px-3 py-2 bg-card">
            <p className="text-[9px] text-muted-foreground/40 leading-relaxed">
              Clique em uma tool para expandir, preencha os campos e copie o snippet gerado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
