import { useMemo, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Code2, Copy, Check, Loader2, AlertCircle, CheckCircle2,
  Wrench, MessageSquareText, Clock, Coins, Building2, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTestExecutionLog, useTestPersonState, type TestExecutionLog } from '@/hooks/useTestSession';
import { useLeadFieldDefinitionsByEntity, type LeadFieldDefinition } from '@/hooks/useLeadFieldDefinitions';
import { useLeadFieldValues, getTypedLeadValue } from '@/hooks/useLeadFieldValues';

const CUSTOM_CATEGORY_LABEL: Record<string, string> = {
  qualificacao: 'Qualificação',
  contato: 'Contato',
  comercial: 'Comercial',
  custom: 'Personalizados',
  outros: 'Outros',
};

function ContactStateSection({ peopleId, leadId, pipelineId }: { peopleId: string | null; leadId: string | null; pipelineId: string | null }) {
  const { data: state, isLoading: stateLoading } = useTestPersonState(peopleId);
  const { data: definitions = [], isLoading: defsLoading } = useLeadFieldDefinitionsByEntity('negocio', pipelineId ?? undefined);
  const { data: values = [], isLoading: valuesLoading } = useLeadFieldValues(leadId ?? '');

  const valuesByDef = useMemo(
    () => new Map(values.map(v => [v.field_definition_id, v])),
    [values],
  );

  const groupedCustom = useMemo(() => {
    const map = new Map<string, LeadFieldDefinition[]>();
    for (const def of definitions) {
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    return [...map.entries()];
  }, [definitions]);

  const formatCustomValue = (def: LeadFieldDefinition): string => {
    const raw = getTypedLeadValue(valuesByDef.get(def.id), def.type);
    if (raw === null || raw === '') return '—';
    if (def.type === 'boolean') return raw ? 'Sim' : 'Não';
    return String(raw);
  };

  const isLoading = stateLoading || defsLoading || valuesLoading;

  return (
    <div className="rounded-[6px] border border-border bg-card overflow-hidden mb-4">
      <div className="px-3 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-[12px] font-semibold text-foreground">Estado do contato</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/30" />
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {state && state.qualificationFields.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ListChecks className="w-2.5 h-2.5" />
                Campos de qualificação (goal/moment/q1-qN)
              </p>
              <div className="space-y-1">
                {state.qualificationFields.map(f => (
                  <div key={f.key} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{f.key}</span>
                    <span className="text-[11px] text-foreground text-right break-words max-w-[65%]">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedCustom.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Campos personalizados</p>
              {groupedCustom.map(([category, defs]) => (
                <div key={category}>
                  <p className="text-[10px] text-muted-foreground/40 mb-1">{CUSTOM_CATEGORY_LABEL[category] ?? category}</p>
                  <div className="space-y-1">
                    {defs.map(def => (
                      <div key={def.id} className="flex items-start justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground/70 truncate">{def.name}</span>
                        <span className="text-[11px] font-medium text-foreground text-right break-words max-w-[55%]">{formatCustomValue(def)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!state || state.qualificationFields.length === 0) && groupedCustom.length === 0 && (
            <p className="text-[11px] text-muted-foreground/40 italic">Nenhum campo preenchido ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}

interface TestDevPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  pipelineId: string | null;
  peopleId: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-[26px] px-2 text-[11px] gap-1.5 shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
}

const STATUS_CHIP: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  completed: { label: 'Concluído', className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-300/20', icon: CheckCircle2 },
  error: { label: 'Erro', className: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-300/20', icon: AlertCircle },
  running: { label: 'Rodando', className: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-300/20', icon: Loader2 },
};

const ExecutionItem = ({ exec }: { exec: TestExecutionLog }) => {
  const statusInfo = STATUS_CHIP[exec.execution_status] ?? STATUS_CHIP.completed;
  const StatusIcon = statusInfo.icon;

  return (
    <AccordionItem value={exec.id} className="border border-border rounded-[6px] mb-2 overflow-hidden">
      <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/40 [&[data-state=open]]:bg-muted/30">
        <div className="flex items-center gap-2.5 w-full text-left pr-2">
          <span className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none shrink-0',
            statusInfo.className,
          )}>
            <StatusIcon className={cn('w-2.5 h-2.5', exec.execution_status === 'running' && 'animate-spin')} />
            {statusInfo.label}
          </span>

          <span className="text-[12px] font-medium text-foreground truncate">
            {exec.agent_name ?? 'Agente'}
          </span>

          <span className="text-[10px] text-muted-foreground/50 shrink-0 ml-auto flex items-center gap-3">
            {exec.usage && (
              <span className="flex items-center gap-1" title="Tokens totais">
                <Coins className="w-2.5 h-2.5" />
                {exec.usage.total_tokens.toLocaleString('pt-BR')}
              </span>
            )}
            {exec.execution_duration_ms != null && (
              <span className="flex items-center gap-1" title="Duração">
                <Clock className="w-2.5 h-2.5" />
                {(exec.execution_duration_ms / 1000).toFixed(1)}s
              </span>
            )}
            <span>
              {formatDistanceToNow(new Date(exec.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </span>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-3 pb-3 pt-0 space-y-3">
        {exec.execution_status === 'error' && exec.error_message && (
          <div className="rounded-[4px] border border-rose-500/20 bg-rose-500/5 px-2.5 py-2">
            <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-0.5">Erro</p>
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 font-mono break-all">{exec.error_message}</p>
          </div>
        )}

        {/* Prompt enviado */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
              <Code2 className="w-3 h-3 text-muted-foreground/60" />
              Prompt enviado ao modelo
            </p>
            <CopyButton text={exec.prompt_rendered} />
          </div>
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-muted/40 border border-border rounded-[4px] p-2.5 max-h-[280px] overflow-y-auto scrollbar-thin-modal text-foreground/80">
            {exec.prompt_rendered || '(vazio)'}
          </pre>
        </div>

        {/* Tools chamadas */}
        {exec.tool_call_details.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
              <Wrench className="w-3 h-3 text-muted-foreground/60" />
              Tools chamadas ({exec.tool_call_details.length})
            </p>
            <div className="space-y-1.5">
              {exec.tool_call_details.map((t, i) => (
                <div key={i} className="rounded-[4px] border border-border bg-muted/20 p-2 space-y-1">
                  <p className="text-[11px] font-mono font-semibold text-primary">{t.name}</p>
                  <div>
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground/50 mb-0.5">Args</p>
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-words text-foreground/70">
                      {JSON.stringify(t.args, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground/50 mb-0.5">Resultado</p>
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-words text-foreground/70">
                      {t.result}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resposta final */}
        {exec.response_text && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquareText className="w-3 h-3 text-muted-foreground/60" />
              Resposta final
            </p>
            <p className="text-[11px] whitespace-pre-wrap bg-muted/20 border border-border rounded-[4px] p-2.5 text-foreground/80">
              {exec.response_text}
            </p>
          </div>
        )}

        {/* Tokens */}
        {exec.usage && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 pt-1 border-t border-border">
            <span>prompt: {exec.usage.prompt_tokens.toLocaleString('pt-BR')}</span>
            <span>completion: {exec.usage.completion_tokens.toLocaleString('pt-BR')}</span>
            {exec.usage.cached_tokens != null && (
              <span>cached: {exec.usage.cached_tokens.toLocaleString('pt-BR')}</span>
            )}
            <span className="font-medium text-foreground/60">total: {exec.usage.total_tokens.toLocaleString('pt-BR')}</span>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export function TestDevPanel({ open, onOpenChange, peopleId, leadId, pipelineId }: TestDevPanelProps) {
  const { data: executions = [], isLoading } = useTestExecutionLog(open ? peopleId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[760px] flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="text-[14px] flex items-center gap-2">
            <Code2 className="w-4 h-4 text-muted-foreground/60" />
            Modo Dev — Execuções do Agente
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground/60">
            Prompt renderizado, tools chamadas e tokens de cada execução do Testador — atualiza em tempo real.
          </p>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin-modal p-4">
          {open && <ContactStateSection peopleId={peopleId} leadId={leadId} pipelineId={pipelineId} />}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
            </div>
          ) : executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Code2 className="w-8 h-8 text-muted-foreground/15" strokeWidth={1.5} />
              <p className="text-[13px] text-muted-foreground/40">Nenhuma execução ainda</p>
              <p className="text-[11px] text-muted-foreground/30">Envie uma mensagem no chat para ver a execução aqui</p>
            </div>
          ) : (
            <Accordion type="single" collapsible defaultValue={executions[0]?.id}>
              {executions.map(exec => <ExecutionItem key={exec.id} exec={exec} />)}
            </Accordion>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
