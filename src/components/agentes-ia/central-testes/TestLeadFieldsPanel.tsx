import { useMemo } from 'react';
import { Loader2, ListChecks } from 'lucide-react';
import {
  useLeadFieldDefinitionsByEntity,
  type LeadFieldDefinition,
} from '@/hooks/useLeadFieldDefinitions';
import {
  useLeadFieldValues,
  getTypedLeadValue,
  type LeadFieldValue,
} from '@/hooks/useLeadFieldValues';

const CATEGORY_LABEL: Record<string, string> = {
  qualificacao: 'Qualificação',
  contato: 'Contato',
  comercial: 'Comercial',
  custom: 'Personalizados',
  outros: 'Outros',
};

function formatValue(def: LeadFieldDefinition, valuesByDef: Map<string, LeadFieldValue>): string {
  const raw = getTypedLeadValue(valuesByDef.get(def.id), def.type);
  if (raw === null || raw === '') return '—';
  if (def.type === 'boolean') return raw ? 'Sim' : 'Não';
  return String(raw);
}

interface TestLeadFieldsPanelProps {
  leadId: string | null;
  pipelineId: string | null;
}

export function TestLeadFieldsPanel({ leadId, pipelineId }: TestLeadFieldsPanelProps) {
  const { data: definitions = [], isLoading: defsLoading } = useLeadFieldDefinitionsByEntity(
    'negocio',
    pipelineId ?? undefined,
  );
  const { data: values = [], isLoading: valuesLoading } = useLeadFieldValues(leadId ?? '');

  const valuesByDef = useMemo(
    () => new Map(values.map((v) => [v.field_definition_id, v])),
    [values],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, LeadFieldDefinition[]>();
    for (const def of definitions) {
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    return [...map.entries()];
  }, [definitions]);

  const isLoading = defsLoading || valuesLoading;

  if (!isLoading && definitions.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2.5 border-b border-t border-border flex items-center gap-1.5">
        <ListChecks className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Campos personalizados
        </span>
      </div>

      <div className="px-3 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([category, defs]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                  {CATEGORY_LABEL[category] ?? category}
                </p>
                <div className="space-y-1">
                  {defs.map((def) => (
                    <div key={def.id} className="flex items-start justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground/80 truncate">
                        {def.name}
                      </span>
                      <span className="text-[11px] font-medium text-foreground text-right break-words max-w-[55%]">
                        {formatValue(def, valuesByDef)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
