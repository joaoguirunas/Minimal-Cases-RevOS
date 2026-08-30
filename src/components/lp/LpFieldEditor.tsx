import { useState } from "react";
import {
  Trash2,
  GripVertical,
  Plus,
  Lock,
  ChevronRight,
  Type,
  Mail,
  Phone,
  Hash,
  List,
  CheckSquare,
  AlignLeft,
  Upload,
  EyeOff,
  Calendar,
  Link,
  ToggleLeft,
  CircleDot,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LpFormField, LpFormStep } from "@/hooks/useLpForms";
import type { CatalogGroup } from "@/hooks/useLpFormCatalog";

// ── Type icon map ────────────────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  text:     { icon: Type, label: "Texto" },
  email:    { icon: Mail, label: "E-mail" },
  tel:      { icon: Phone, label: "Telefone" },
  phone:    { icon: Phone, label: "Telefone" },
  number:   { icon: Hash, label: "Número" },
  select:   { icon: List, label: "Seleção" },
  checkbox: { icon: CheckSquare, label: "Checkbox" },
  radio:    { icon: CircleDot, label: "Radio" },
  textarea: { icon: AlignLeft, label: "Texto longo" },
  file:     { icon: Upload, label: "Arquivo" },
  hidden:   { icon: EyeOff, label: "Oculto" },
  date:     { icon: Calendar, label: "Data" },
  url:      { icon: Link, label: "URL" },
  switch:   { icon: ToggleLeft, label: "Switch" },
};

// ── CRM field display helper ─────────────────────────────────────────────────
const NS_META: Record<string, { icon: string; label: string }> = {
  pessoa:  { icon: "👤", label: "Pessoa" },
  empresa: { icon: "🏢", label: "Empresa" },
  score:   { icon: "⭐", label: "Score PRO™" },
  utm:     { icon: "📊", label: "UTM" },
  custom:  { icon: "🔧", label: "Personalizado" },
};

function formatCrmField(crm_field: string | undefined): string {
  if (!crm_field) return "";
  const [ns, ...rest] = crm_field.split(".");
  const key = rest.join(".");
  const meta = NS_META[ns];
  if (!meta) return crm_field;
  return `${meta.icon} ${meta.label} › ${key}`;
}

interface LpFieldEditorProps {
  field: LpFormField;
  allFields: LpFormField[];
  catalogGroups?: CatalogGroup[];
  steps?: LpFormStep[];
  formMode?: "classic" | "steps" | "chatbot";
  onUpdate: (updated: LpFormField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
}

export function LpFieldEditor({
  field,
  onUpdate,
  onDelete,
  formMode,
  steps,
  dragListeners,
  dragAttributes,
}: LpFieldEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOptions = ["select", "radio", "checkbox"].includes(field.type);
  const isScoreField = !!field.crm_field?.startsWith("score.");
  const isHidden = field.type === "hidden";
  const isMissingMapping = !isHidden && !field.crm_field;
  const typeMeta = TYPE_META[field.type] ?? { icon: Type, label: field.type };
  const TypeIcon = typeMeta.icon;

  function patch(partial: Partial<LpFormField>) {
    onUpdate({ ...field, ...partial });
  }

  return (
    <div
      className={cn(
        "group/field rounded-[4px] transition-colors",
        expanded
          ? "bg-card border border-border"
          : isMissingMapping
            ? "hover:bg-muted/50 border border-yellow-400/40"
            : "hover:bg-muted/50 border border-transparent"
      )}
    >
      {/* ── Collapsed row (always visible) ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Drag handle — subtle, visible on hover */}
        <button
          {...(dragAttributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          {...(dragListeners as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-transparent group-hover/field:text-muted-foreground/30 hover:!text-muted-foreground/60 shrink-0 touch-none transition-colors"
          title="Arrastar para reordenar"
          type="button"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Expand chevron */}
        <ChevronRight className={cn(
          "w-3 h-3 text-muted-foreground/40 transition-transform shrink-0",
          expanded && "rotate-90"
        )} />

        {/* Type badge */}
        <div className="flex items-center gap-1 shrink-0">
          <TypeIcon className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground/60 font-medium uppercase">
            {typeMeta.label}
          </span>
        </div>

        {/* Field label */}
        <span className={cn(
          "text-xs font-medium truncate flex-1 min-w-0",
          field.label ? "text-foreground" : "text-muted-foreground italic"
        )}>
          {field.label || "Sem rótulo"}
        </span>

        {/* CRM mapping badge */}
        {field.crm_field ? (
          <span className="text-[10px] text-muted-foreground/50 font-mono truncate max-w-[140px] shrink-0">
            {field.crm_field}
          </span>
        ) : !isHidden ? (
          <span className="text-[10px] text-yellow-500/70 font-medium shrink-0">
            sem mapeamento
          </span>
        ) : null}

        {/* Required indicator */}
        {field.required && (
          <span className="text-[10px] text-primary font-bold shrink-0">*</span>
        )}

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 text-transparent group-hover/field:text-muted-foreground/30 hover:!text-destructive transition-colors shrink-0"
          title="Remover campo"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Expanded editing panel ── */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border ml-[22px] mr-[26px]">
          {/* Label */}
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Rótulo</p>
            <Input
              value={field.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="Rótulo do campo"
              className="h-[30px] text-sm rounded-[4px] font-medium"
            />
          </div>

          {/* CRM mapping info */}
          {field.crm_field ? (
            <p className="text-xs text-muted-foreground">
              {formatCrmField(field.crm_field)}
            </p>
          ) : !isHidden ? (
            <p className="text-xs text-yellow-500/80">
              ⚠ Sem mapeamento CRM — adicione via catálogo
            </p>
          ) : null}

          {/* Step assignment select — visible in steps mode */}
          {formMode === "steps" && steps && steps.length > 0 && !isHidden && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Etapa</p>
              <Select
                value={field.step_id ?? "none"}
                onValueChange={(v) => patch({ step_id: v === "none" ? undefined : v })}
              >
                <SelectTrigger className="h-[30px] text-sm rounded-[4px]">
                  <SelectValue placeholder="Sem etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem etapa</SelectItem>
                  {steps.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Placeholder */}
          {!isHidden && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Placeholder</p>
              <Input
                value={field.placeholder ?? ""}
                onChange={(e) => patch({ placeholder: e.target.value })}
                placeholder="Texto de ajuda..."
                className="h-[30px] text-sm rounded-[4px] text-muted-foreground"
              />
            </div>
          )}

          {/* Hidden field value */}
          {isHidden && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Valor</p>
              <Input
                value={field.placeholder ?? ""}
                onChange={(e) => patch({ placeholder: e.target.value })}
                placeholder="Valor fixo do campo oculto"
                className="h-[30px] text-sm rounded-[4px]"
              />
            </div>
          )}

          {/* Options for select / radio / checkbox */}
          {hasOptions && isScoreField ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-muted-foreground/50" />
                <p className="text-xs font-medium text-muted-foreground">
                  Opções do Score PRO™ <span className="text-muted-foreground/50">· gerenciadas em Configurações</span>
                </p>
              </div>
              {(field.options ?? []).length === 0 ? (
                <p className="text-xs text-yellow-500/80">
                  ⚠ Nenhuma opção configurada — configure o Score PRO em Configurações &gt; Score
                </p>
              ) : (
                <div className="space-y-1">
                  {(field.options ?? []).map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center px-2 py-1.5 rounded bg-muted">
                      <span className="text-sm text-foreground/70 flex-1 truncate">{opt.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : hasOptions ? (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Opções</p>
              <div className="space-y-1.5">
                {(field.options ?? []).map((opt, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={opt.label}
                      onChange={(e) => {
                        const opts = [...(field.options ?? [])];
                        opts[idx] = {
                          ...opts[idx],
                          label: e.target.value,
                          value: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                        };
                        patch({ options: opts });
                      }}
                      placeholder={`Opção ${idx + 1}`}
                      className="h-[30px] text-sm rounded-[4px] flex-1"
                    />
                    <button
                      onClick={() =>
                        patch({
                          options: (field.options ?? []).filter((_, i) => i !== idx),
                        })
                      }
                      className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  patch({
                    options: [
                      ...(field.options ?? []),
                      { value: "", label: "", tags: [] },
                    ],
                  })
                }
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar opção
              </button>
            </div>
          ) : null}

          {/* File constraints */}
          {field.type === "file" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tipos aceitos</p>
                <Input
                  value={field.accept ?? ""}
                  onChange={(e) => patch({ accept: e.target.value || undefined })}
                  placeholder="image/*,application/pdf"
                  className="h-[30px] text-sm rounded-[4px]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tamanho máx. (MB)</p>
                <Input
                  type="number"
                  value={field.max_size_mb ?? ""}
                  onChange={(e) =>
                    patch({ max_size_mb: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                  placeholder="10"
                  min={1}
                  className="h-[30px] text-sm rounded-[4px]"
                />
              </div>
            </div>
          )}

          {/* Number constraints */}
          {field.type === "number" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Mínimo</p>
                <Input
                  type="number"
                  value={field.min ?? ""}
                  onChange={(e) =>
                    patch({ min: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                  placeholder="—"
                  className="h-[30px] text-sm rounded-[4px]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Máximo</p>
                <Input
                  type="number"
                  value={field.max ?? ""}
                  onChange={(e) =>
                    patch({ max: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                  placeholder="—"
                  className="h-[30px] text-sm rounded-[4px]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Passo</p>
                <Input
                  type="number"
                  value={field.step ?? ""}
                  onChange={(e) =>
                    patch({ step: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                  placeholder="1"
                  className="h-[30px] text-sm rounded-[4px]"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
