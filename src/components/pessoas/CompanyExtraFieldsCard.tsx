import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Edit2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeadFieldDefinitionsByEntity, type LeadFieldDefinition } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValuesByEntity, useUpsertLeadFieldValue, getTypedLeadValue } from "@/hooks/useLeadFieldValues";

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface FieldOption { value: string; label: string }

function normalizeOptions(raw: unknown): FieldOption[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((opt) => {
    if (typeof opt === "string") return { value: opt, label: opt };
    const o = opt as { value?: string; label?: string };
    return { value: o.value ?? String(opt), label: o.label ?? String(opt) };
  });
}

function displayValue(value: unknown, fieldType: string, options?: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (fieldType === "boolean") return value === true || value === "true" ? "Sim" : "Não";
  if ((fieldType === "select" || fieldType === "single_select") && options) {
    const normalized = normalizeOptions(options);
    const match = normalized.find((o) => o.value === String(value));
    if (match) return match.label;
  }
  return String(value);
}

// ─── Field Input ──────────────────────────────────────────────────────────────

interface FieldInputProps {
  field: LeadFieldDefinition;
  value: unknown;
  onChange: (val: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const strVal = value === null || value === undefined ? "" : String(value);

  switch (field.type) {
    case "boolean":
      return (
        <Switch
          checked={value === true || value === "true"}
          onCheckedChange={(checked) => onChange(checked)}
          className="scale-90"
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-[13px]"
        />
      );
    case "textarea":
      return (
        <Textarea
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="text-[13px] resize-none"
        />
      );
    case "select":
    case "single_select": {
      const options = normalizeOptions(field.options);
      return (
        <Select value={strVal || "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
          <SelectTrigger className="h-7 text-[13px]">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    default:
      return (
        <Input
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-[13px]"
        />
      );
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CompanyExtraFieldsCardProps {
  companyId: string;
}

export function CompanyExtraFieldsCard({ companyId }: CompanyExtraFieldsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const { data: fieldDefs = [], isLoading: isLoadingDefs } = useLeadFieldDefinitionsByEntity('empresa');
  const { data: fieldValues = [], isLoading: isLoadingVals } = useLeadFieldValuesByEntity('empresa', companyId);
  const upsertValue = useUpsertLeadFieldValue();

  // Build { field.key: typedValue } from the values table
  const valuesMap = useMemo(() => {
    const map: Record<string, unknown> = {};
    for (const v of fieldValues) {
      const def = fieldDefs.find((d) => d.id === v.field_definition_id);
      if (def) map[def.key] = getTypedLeadValue(v, def.type);
    }
    return map;
  }, [fieldValues, fieldDefs]);

  const isLoading = isLoadingDefs || isLoadingVals;

  if (!isLoading && fieldDefs.length === 0) return null;

  const handleEdit = () => {
    setDraft({ ...valuesMap });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        fieldDefs.map((field) => {
          const val = draft[field.key] ?? null;
          return upsertValue.mutateAsync({
            entityType: 'empresa',
            entityId: companyId,
            fieldDefinitionId: field.id,
            fieldType: field.type,
            value: val as string | number | boolean | null,
          });
        })
      );
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const currentValues = isEditing ? draft : valuesMap;
  const categories = Array.from(new Set(fieldDefs.map((f) => f.category)));

  return (
    <section className="border border-border rounded-[4px] bg-card">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Campos Personalizados
        </p>

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                size="sm" variant="ghost"
                onClick={handleCancel}
                disabled={saving}
                className="h-6 px-2 text-[11px] gap-1"
              >
                <X className="w-3 h-3" strokeWidth={1.5} />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-6 px-2 text-[11px] gap-1"
              >
                <Save className="w-3 h-3" strokeWidth={1.5} />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <Button
              size="sm" variant="ghost"
              onClick={handleEdit}
              className="h-6 px-2 text-[11px] gap-1 text-muted-foreground/50 hover:text-foreground"
            >
              <Edit2 className="w-3 h-3" strokeWidth={1.5} />
              Editar
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded-[4px]" />
            ))}
          </div>
        ) : (
          categories.map((cat) => {
            const catFields = fieldDefs.filter((f) => f.category === cat);
            const catLabel =
              cat === "qualificacao" ? "Qualificação"
              : cat === "contato"    ? "Contato"
              : cat === "comercial"  ? "Comercial"
              : "Personalizado";

            return (
              <div key={cat} className="space-y-2">
                {categories.length > 1 && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                    {catLabel}
                  </p>
                )}
                <div className="space-y-1.5">
                  {catFields.map((field) => {
                    const val = currentValues[field.key];
                    const hasValue = val !== null && val !== undefined && val !== "";

                    return (
                      <div
                        key={field.id}
                        className={cn(
                          "flex items-start gap-3",
                          field.type === "textarea" ? "flex-col" : "justify-between"
                        )}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                          <span className="text-[12px] text-muted-foreground/70 truncate">
                            {field.name}
                          </span>
                          {field.agent_managed && (
                            <Bot className="w-2.5 h-2.5 text-primary/50 flex-shrink-0" strokeWidth={1.5} />
                          )}
                        </div>

                        {isEditing ? (
                          <div className={cn(
                            field.type === "textarea" ? "w-full" : "flex-1 min-w-0 max-w-[180px]"
                          )}>
                            <FieldInput
                              field={field}
                              value={val}
                              onChange={(v) => setDraft((prev) => ({ ...prev, [field.key]: v }))}
                            />
                          </div>
                        ) : (
                          <span className={cn(
                            "text-[13px] text-right",
                            hasValue ? "text-foreground" : "text-muted-foreground/30"
                          )}>
                            {displayValue(val, field.type, field.options)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default CompanyExtraFieldsCard;
