import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeadFieldDefinitions, type LeadFieldDefinition } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues, useUpsertLeadFieldValue, type LeadFieldValue } from "@/hooks/useLeadFieldValues";

interface Props {
  leadId: string;
  pipelineId: string;
  category?: 'qualificacao' | 'outros' | 'all';
}

interface FieldOption {
  label: string;
  value: string;
}

// Handles both string[] and { value, label }[] option formats
function getOptions(field: LeadFieldDefinition): FieldOption[] {
  if (!Array.isArray(field.options)) return [];
  return (field.options as unknown[]).map(opt => {
    if (typeof opt === 'string') return { value: opt, label: opt };
    const o = opt as { value?: string; label?: string };
    return { value: o.value ?? String(opt), label: o.label ?? String(opt) };
  });
}

function getValueForField(
  field: LeadFieldDefinition,
  valuesMap: Map<string, LeadFieldValue>,
): string | number | boolean | null {
  const v = valuesMap.get(field.id);
  if (!v) return null;
  switch (field.type) {
    case 'text':
    case 'single_select':
    case 'select':
    case 'textarea':
      return v.value_text ?? null;
    case 'number':
      return v.value_number ?? null;
    case 'boolean':
      return v.value_boolean ?? null;
    case 'date':
      return v.value_date ?? null;
    default:
      return null;
  }
}

interface FieldRowProps {
  field: LeadFieldDefinition;
  currentValue: string | number | boolean | null;
  leadId: string;
  isSaving: boolean;
  onSave: (fieldId: string, type: string, value: string | number | boolean | null) => void;
}

const FieldRow = ({ field, currentValue, isSaving, onSave }: FieldRowProps) => {
  const [localValue, setLocalValue] = useState<string | number | boolean | null>(currentValue);
  const [isDirty, setIsDirty] = useState(false);

  const handleBlurSave = () => {
    if (isDirty) {
      onSave(field.id, field.type, localValue);
      setIsDirty(false);
    }
  };

  const handleChange = (val: string | number | boolean | null) => {
    setLocalValue(val);
    setIsDirty(true);
  };

  const handleImmediateSave = (val: boolean) => {
    setLocalValue(val);
    setIsDirty(false);
    onSave(field.id, field.type, val);
  };

  const handleSelectSave = (val: string) => {
    setLocalValue(val === '__none' ? null : val);
    setIsDirty(false);
    onSave(field.id, field.type, val === '__none' ? null : val);
  };

  const isTextarea = field.type === 'textarea';

  return (
    <div className={cn(
      "py-2 border-b border-white/[0.04] last:border-0",
      isTextarea ? "space-y-1.5" : "flex items-center justify-between gap-3",
    )}>
      <div className={isTextarea ? undefined : "shrink-0 max-w-[45%]"}>
        <span className="text-[12px] text-muted-foreground/65 leading-tight">
          {field.name}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
        </span>
      </div>

      <div className={isTextarea ? "w-full" : "flex-1 min-w-0 flex justify-end"}>
        {field.type === 'boolean' ? (
          <div className="flex items-center gap-2">
            <Switch
              checked={localValue === true}
              onCheckedChange={handleImmediateSave}
              className="scale-90"
            />
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />}
          </div>
        ) : field.type === 'single_select' || field.type === 'select' ? (
          <div className="flex items-center gap-2">
            <Select
              value={(localValue as string) ?? ''}
              onValueChange={handleSelectSave}
            >
              <SelectTrigger className="h-7 text-[12px] border-border bg-transparent">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {getOptions(field).map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />}
          </div>
        ) : field.type === 'textarea' ? (
          <div className="flex items-start gap-2">
            <Textarea
              value={localValue !== null && localValue !== undefined ? String(localValue) : ''}
              onChange={e => handleChange(e.target.value || null)}
              onBlur={handleBlurSave}
              rows={3}
              className="text-[12px] border-border bg-transparent resize-none"
              placeholder={field.required ? 'Obrigatório' : 'Não preenchido'}
            />
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50 mt-1 flex-shrink-0" />}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              value={localValue !== null && localValue !== undefined ? String(localValue) : ''}
              onChange={e => handleChange(
                field.type === 'number'
                  ? (e.target.value === '' ? null : Number(e.target.value))
                  : e.target.value || null
              )}
              onBlur={handleBlurSave}
              className="h-7 text-[12px] border-border bg-transparent"
              placeholder={field.required ? 'Obrigatório' : 'Não preenchido'}
            />
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />}
          </div>
        )}
      </div>
    </div>
  );
};

const CamposExtrasSection = ({ leadId, pipelineId, category = 'all' }: Props) => {
  const { data: definitions = [], isLoading: isLoadingDefs } = useLeadFieldDefinitions(pipelineId || undefined);
  const { data: values = [], isLoading: isLoadingVals } = useLeadFieldValues(leadId);
  const upsert = useUpsertLeadFieldValue();

  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  const filteredDefs = category === 'all'
    ? definitions
    : definitions.filter(d => d.category === category);

  const valuesMap = new Map<string, LeadFieldValue>(
    values.map(v => [v.field_definition_id, v])
  );

  const handleSave = async (
    fieldDefinitionId: string,
    fieldType: string,
    value: string | number | boolean | null,
  ) => {
    setSavingFields(prev => new Set(prev).add(fieldDefinitionId));
    try {
      await upsert.mutateAsync({
        entityType: 'negocio',
        entityId: leadId,
        fieldDefinitionId,
        fieldType: fieldType as 'text' | 'number' | 'single_select' | 'select' | 'textarea' | 'boolean' | 'date',
        value,
      });
    } finally {
      setSavingFields(prev => {
        const next = new Set(prev);
        next.delete(fieldDefinitionId);
        return next;
      });
    }
  };

  if (isLoadingDefs || isLoadingVals) {
    return (
      <div className="flex items-center gap-2 py-3 text-[12px] text-muted-foreground/40">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Carregando campos...
      </div>
    );
  }

  if (filteredDefs.length === 0) {
    return null;
  }

  const sectionLabel =
    category === 'qualificacao' ? 'Campos de Qualificação'
    : category === 'outros'    ? 'Outros Campos'
    : 'Campos Personalizados';

  return (
    <section className="border border-border rounded-[2px] bg-card">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {sectionLabel}
        </p>
      </div>
      <div className="px-4 pb-2">
        {filteredDefs.map(field => (
          <FieldRow
            key={field.id}
            field={field}
            currentValue={getValueForField(field, valuesMap)}
            leadId={leadId}
            isSaving={savingFields.has(field.id)}
            onSave={handleSave}
          />
        ))}
      </div>
    </section>
  );
};

export default CamposExtrasSection;
