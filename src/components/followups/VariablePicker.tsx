import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Braces } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Variable definitions ──────────────────────────────────────────────────────

export interface FollowupVariable {
  key:   string;
  label: string;
  category: string;
}

// Tabs config
const TABS = [
  { id: 'lead',        label: 'Lead',        accent: 'text-violet-600 bg-violet-500/10 border-violet-500/30' },
  { id: 'pessoa',      label: 'Pessoa',       accent: 'text-blue-600   bg-blue-500/10   border-blue-500/30'   },
  { id: 'empresa',     label: 'Empresa',      accent: 'text-orange-600 bg-orange-500/10 border-orange-500/30' },
  { id: 'agendamento', label: 'Agendamento',  accent: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// All variables grouped by tab
const VARIABLES_BY_TAB: Record<TabId, { key: string; label: string }[]> = {
  lead: [
    // Negócio
    { key: '{{lead.titulo}}',               label: 'Título do negócio' },
    { key: '{{lead.status}}',               label: 'Status (aberto / ganho / perdido)' },
    { key: '{{lead.valor}}',                label: 'Valor (R$)' },
    { key: '{{lead.descricao}}',            label: 'Descrição' },
    { key: '{{lead.motivo_perda}}',         label: 'Motivo da perda' },
    { key: '{{lead.created_at}}',           label: 'Data de criação' },
    { key: '{{lead.last_interaction_at}}',  label: 'Última interação' },
    { key: '{{lead.won_at}}',              label: 'Data de ganho' },
    { key: '{{lead.lost_at}}',             label: 'Data de perda' },
    // Pipeline / Etapa
    { key: '{{pipeline.nome}}',             label: 'Nome do pipeline' },
    { key: '{{etapa.nome}}',               label: 'Nome da etapa atual' },
    { key: '{{etapa.ordem}}',              label: 'Ordem da etapa' },
    { key: '{{etapa.cor}}',               label: 'Cor da etapa (hex)' },
    // UTM
    { key: '{{lead.utm.source}}',           label: 'UTM Source' },
    { key: '{{lead.utm.medium}}',           label: 'UTM Medium' },
    { key: '{{lead.utm.campaign}}',         label: 'UTM Campaign' },
    { key: '{{lead.utm.term}}',             label: 'UTM Term' },
    { key: '{{lead.utm.content}}',          label: 'UTM Content' },
    { key: '{{lead.gclid}}',               label: 'Google Click ID (gclid)' },
  ],

  pessoa: [
    // Identificação
    { key: '{{pessoa.nome}}',              label: 'Nome completo' },
    { key: '{{pessoa.email}}',             label: 'E-mail' },
    { key: '{{pessoa.telefone}}',          label: 'Telefone' },
    { key: '{{pessoa.whatsapp}}',          label: 'WhatsApp' },
    { key: '{{pessoa.documento}}',         label: 'CPF / Documento' },
    { key: '{{pessoa.fonte}}',             label: 'Fonte de origem' },
    { key: '{{pessoa.status}}',            label: 'Status' },
    { key: '{{pessoa.tipo}}',              label: 'Tipo' },
    // Score e análise
    { key: '{{pessoa.score}}',             label: 'Score' },
    { key: '{{pessoa.disc_perfil}}',       label: 'Perfil DISC (D/I/S/C)' },
    { key: '{{pessoa.disc_analise}}',      label: 'Análise DISC detalhada' },
    { key: '{{pessoa.resumo_conversa}}',   label: 'Resumo da conversa' },
    // Qualificação
    { key: '{{pessoa.qualificacao.bottleneck}}',               label: 'Q1 Gargalo principal' },
    { key: '{{pessoa.qualificacao.volume_leads_mes}}',         label: 'Q2 Volume de leads/mês' },
    { key: '{{pessoa.qualificacao.tamanho_time}}',             label: 'Q3 Tamanho do time' },
    { key: '{{pessoa.qualificacao.crm_atual}}',                label: 'Q5 CRM atual' },
    { key: '{{pessoa.qualificacao.urgencia}}',                 label: 'Q13 Urgência' },
    { key: '{{pessoa.qualificacao.orcamento_aprovado}}',       label: 'Q11 Orçamento aprovado?' },
    { key: '{{pessoa.qualificacao.prazo}}',                    label: 'Q12 Prazo de decisão' },
    { key: '{{pessoa.qualificacao.autoridade_decisao}}',       label: 'Q9 Autoridade de decisão' },
    { key: '{{pessoa.qualificacao.roi_esperado}}',             label: 'Q16 ROI esperado' },
    { key: '{{pessoa.qualificacao.objecoes}}',                 label: 'Q17 Objeções' },
    { key: '{{pessoa.qualificacao.nivel_interesse}}',          label: 'Q21 Nível de interesse (0–10)' },
    { key: '{{pessoa.qualificacao.probabilidade_fechamento}}', label: 'Q22 Probabilidade de fechamento (%)' },
    { key: '{{pessoa.qualificacao.status_qualificacao}}',      label: 'Q19 Status de qualificação' },
    { key: '{{pessoa.qualificacao.motivo_rejeicao}}',          label: 'Q20 Motivo de rejeição' },
    { key: '{{pessoa.qualificacao.tags_comportamentais}}',     label: 'Q23 Tags comportamentais' },
  ],

  empresa: [
    { key: '{{empresa.nome_fantasia}}',    label: 'Nome fantasia' },
    { key: '{{empresa.razao_social}}',     label: 'Razão social' },
    { key: '{{empresa.cnpj}}',             label: 'CNPJ' },
    { key: '{{empresa.email}}',            label: 'E-mail' },
    { key: '{{empresa.telefone}}',         label: 'Telefone' },
    { key: '{{empresa.site}}',             label: 'Website' },
    { key: '{{empresa.endereco}}',         label: 'Endereço' },
  ],

  agendamento: [
    { key: '{{agendamento.titulo}}',           label: 'Título da reunião' },
    { key: '{{agendamento.status}}',           label: 'Status (confirmado / cancelado…)' },
    { key: '{{agendamento.inicio}}',           label: 'Data e hora de início' },
    { key: '{{agendamento.fim}}',              label: 'Data e hora de fim' },
    { key: '{{agendamento.duracao_minutos}}',  label: 'Duração (minutos)' },
    { key: '{{agendamento.link_reuniao}}',     label: 'Link da reunião (Meet / Teams)' },
    { key: '{{agendamento.local}}',            label: 'Local' },
    { key: '{{agendamento.notas}}',            label: 'Notas do agendamento' },
    { key: '{{agendamento.resultado}}',        label: 'Resultado (pós-reunião)' },
    { key: '{{agendamento.participantes}}',    label: 'Participantes (lista de e-mails)' },
    { key: '{{agendamento.fonte}}',            label: 'Fonte (schedule_pro / manual…)' },
    { key: '{{agendamento.google_event_id}}',  label: 'ID do evento Google Calendar' },
    { key: '{{agendamento.consultor_id}}',     label: 'UUID do consultor responsável' },
  ],
};

// Flat list export (backward compat for anything using FOLLOWUP_VARIABLES)
export const FOLLOWUP_VARIABLES: FollowupVariable[] = Object.entries(VARIABLES_BY_TAB).flatMap(
  ([category, vars]) => vars.map(v => ({ ...v, category }))
);

// ── Component ─────────────────────────────────────────────────────────────────

interface VariablePickerProps {
  onInsert:  (variable: string) => void;
  size?:     'sm' | 'xs';
  className?: string;
}

export const VariablePicker = ({ onInsert, size = 'sm', className }: VariablePickerProps) => {
  const [open, setOpen]       = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('lead');

  const vars = VARIABLES_BY_TAB[activeTab];
  const tab  = TABS.find(t => t.id === activeTab)!;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn(
            'gap-1.5 font-normal text-muted-foreground border-dashed hover:border-solid hover:text-foreground',
            size === 'xs' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-[12px]',
            className
          )}
        >
          <Braces className={cn(size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5')} strokeWidth={1.5} />
          Variáveis
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 overflow-hidden" align="start" sideOffset={4}>
        {/* Header */}
        <div className="px-3 py-2 border-b border-border bg-card">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Inserir variável
          </p>
          <p className="text-[11px] text-muted-foreground/40 mt-0.5">
            Clique para inserir no cursor
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-card">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                activeTab === t.id
                  ? cn('border-b-2 -mb-px', t.accent)
                  : 'text-muted-foreground/40 hover:text-muted-foreground/70'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Variable list */}
        <div className="max-h-64 overflow-y-auto">
          {vars.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => { onInsert(v.key); setOpen(false); }}
              className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-white/[0.035] transition-colors border-b border-border last:border-0 group"
            >
              <span className="text-[12px] text-foreground/70 group-hover:text-foreground/90 leading-snug flex-1 min-w-0">
                {v.label}
              </span>
              <code className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 leading-none transition-colors',
                activeTab === 'lead'        && 'text-violet-600 bg-violet-500/8 border-violet-500/20',
                activeTab === 'pessoa'      && 'text-blue-600   bg-blue-500/8   border-blue-500/20',
                activeTab === 'empresa'     && 'text-orange-600 bg-orange-500/8 border-orange-500/20',
                activeTab === 'agendamento' && 'text-emerald-600 bg-emerald-500/8 border-emerald-500/20',
              )}>
                {v.key}
              </code>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-border bg-card">
          <p className="text-[10px] text-muted-foreground/30">
            {vars.length} variável{vars.length !== 1 ? 'is' : ''} · resolvidas no disparo pelo channel handler (WA via API, AS via fila, webhook via N8N)
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ── Textarea cursor insert helper ─────────────────────────────────────────────

export const insertAtTextareaCursor = (
  textarea: HTMLTextAreaElement | null,
  text: string,
  currentValue: string,
  setValue: (v: string) => void,
) => {
  if (!textarea) {
    setValue(currentValue + text);
    return;
  }
  const start  = textarea.selectionStart ?? currentValue.length;
  const end    = textarea.selectionEnd   ?? currentValue.length;
  const before = currentValue.substring(0, start);
  const after  = currentValue.substring(end);
  const next   = before + text + after;
  setValue(next);
  setTimeout(() => {
    textarea.selectionStart = start + text.length;
    textarea.selectionEnd   = start + text.length;
    textarea.focus();
  }, 0);
};
