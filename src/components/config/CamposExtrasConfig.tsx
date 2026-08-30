import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Save, X, ListPlus, Briefcase, User, Building2 } from "lucide-react";
import { usePipelines } from "@/hooks/usePipelines";
import {
  useAllLeadFieldDefinitions,
  useCreateLeadFieldDefinition,
  useUpdateLeadFieldDefinition,
  useDeleteLeadFieldDefinition,
  type LeadFieldDefinition,
  type LeadFieldEntityType,
  type LeadFieldCategory,
} from "@/hooks/useLeadFieldDefinitions";
import type { Json } from "@/integrations/supabase/types";

// ─── Entity type tabs ────────────────────────────────────────────────────────

const ENTITY_TABS: { value: LeadFieldEntityType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'negocio', label: 'Negócios',  icon: Briefcase,  desc: 'Campos extras nos cards de negócio (deals)' },
  { value: 'pessoa',  label: 'Clientes',  icon: User,       desc: 'Campos extras nos perfis de contato (pessoas)' },
  { value: 'empresa', label: 'Empresas',  icon: Building2,  desc: 'Campos extras nos perfis de empresa' },
];

// ─── Field types ─────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "text",          label: "Texto" },
  { value: "textarea",      label: "Texto Longo" },
  { value: "number",        label: "Número" },
  { value: "single_select", label: "Seleção Única" },
  { value: "select",        label: "Seleção Múltipla" },
  { value: "boolean",       label: "Sim/Não" },
  { value: "date",          label: "Data" },
] as const;

type FieldType = typeof FIELD_TYPES[number]['value'];

// ─── Categories per entity type ──────────────────────────────────────────────

const CATEGORIES_BY_ENTITY: Record<LeadFieldEntityType, { value: LeadFieldCategory; label: string }[]> = {
  negocio: [
    { value: 'qualificacao', label: 'Qualificação' },
    { value: 'comercial',    label: 'Comercial' },
    { value: 'custom',       label: 'Personalizado' },
    { value: 'outros',       label: 'Outros' },
  ],
  pessoa: [
    { value: 'contato',      label: 'Contato' },
    { value: 'qualificacao', label: 'Qualificação' },
    { value: 'comercial',    label: 'Comercial' },
    { value: 'custom',       label: 'Personalizado' },
    { value: 'outros',       label: 'Outros' },
  ],
  empresa: [
    { value: 'contato',      label: 'Contato' },
    { value: 'comercial',    label: 'Comercial' },
    { value: 'custom',       label: 'Personalizado' },
    { value: 'outros',       label: 'Outros' },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface FieldOption {
  label: string;
  value: string;
}

function parseOptions(text: string): FieldOption[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => ({ label: line, value: line.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }));
}

function optionsToText(options: FieldOption[]): string {
  return options.map(o => o.label).join('\n');
}

function typeLabel(type: string): string {
  return FIELD_TYPES.find(t => t.value === type)?.label ?? type;
}

function typeBadgeVariant(type: string): string {
  switch (type) {
    case 'boolean':       return 'bg-blue-500/10 text-blue-600 border-blue-200/30';
    case 'number':        return 'bg-amber-500/10 text-amber-600 border-amber-200/30';
    case 'single_select': return 'bg-purple-500/10 text-purple-600 border-purple-200/30';
    case 'select':        return 'bg-violet-500/10 text-violet-600 border-violet-200/30';
    case 'date':          return 'bg-green-500/10 text-green-600 border-green-200/30';
    case 'textarea':      return 'bg-cyan-500/10 text-cyan-600 border-cyan-200/30';
    default:              return 'bg-muted text-muted-foreground border-border';
  }
}

function generateKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ─── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  key: string;
  type: FieldType;
  category: LeadFieldCategory;
  pipeline_id: string;
  required: boolean;
  optionsText: string;
}

const buildEmptyForm = (entityType: LeadFieldEntityType): FormState => ({
  name: '',
  key: '',
  type: 'text',
  category: CATEGORIES_BY_ENTITY[entityType][0].value,
  pipeline_id: '',
  required: false,
  optionsText: '',
});

// ─── Component ───────────────────────────────────────────────────────────────

const CamposExtrasConfig = () => {
  const [activeEntity, setActiveEntity] = useState<LeadFieldEntityType>('negocio');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<FormState>(buildEmptyForm('negocio'));
  const [editForm, setEditForm] = useState<FormState>(buildEmptyForm('negocio'));
  const [keyTouched, setKeyTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: allFields = [], isLoading } = useAllLeadFieldDefinitions();
  const { pipelines } = usePipelines();
  const createField = useCreateLeadFieldDefinition();
  const updateField = useUpdateLeadFieldDefinition();
  const deleteField = useDeleteLeadFieldDefinition();

  const activePipelines = pipelines.filter(p => p.active || p.ativo);
  const categories = CATEGORIES_BY_ENTITY[activeEntity];

  // Filter fields for current entity type
  const entityFields = allFields.filter(f => f.entity_type === activeEntity);

  const handleEntityChange = (entity: LeadFieldEntityType) => {
    setActiveEntity(entity);
    setShowNewForm(false);
    setEditingId(null);
    setNewForm(buildEmptyForm(entity));
  };

  const handleNameChange = (name: string, form: FormState, setForm: (f: FormState) => void, touched: boolean) => {
    setForm({ ...form, name, key: touched ? form.key : generateKey(name) });
  };

  const handleCreate = async () => {
    if (!newForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const isSelectType = newForm.type === 'single_select' || newForm.type === 'select';
      await createField.mutateAsync({
        name: newForm.name.trim(),
        key: newForm.key.trim() || generateKey(newForm.name),
        type: newForm.type,
        category: newForm.category,
        entity_type: activeEntity,
        pipeline_id: activeEntity === 'negocio' ? (newForm.pipeline_id || null) : null,
        required: newForm.required,
        active: true,
        options: (isSelectType ? parseOptions(newForm.optionsText) : []) as unknown as Json,
        ordem: entityFields.length,
      });
      setNewForm(buildEmptyForm(activeEntity));
      setKeyTouched(false);
      setShowNewForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (field: LeadFieldDefinition) => {
    setEditingId(field.id);
    const opts = Array.isArray(field.options) ? (field.options as unknown as FieldOption[]) : [];
    setEditForm({
      name: field.name,
      key: field.key,
      type: field.type as FieldType,
      category: field.category as LeadFieldCategory,
      pipeline_id: field.pipeline_id ?? '',
      required: field.required,
      optionsText: optionsToText(opts),
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const isSelectType = editForm.type === 'single_select' || editForm.type === 'select';
      await updateField.mutateAsync({
        id,
        name: editForm.name.trim(),
        key: editForm.key.trim(),
        type: editForm.type,
        category: editForm.category,
        entity_type: activeEntity,
        pipeline_id: activeEntity === 'negocio' ? (editForm.pipeline_id || null) : null,
        required: editForm.required,
        options: (isSelectType ? parseOptions(editForm.optionsText) : []) as unknown as Json,
      });
      setEditingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (field: LeadFieldDefinition) => {
    await updateField.mutateAsync({ id: field.id, active: !field.active });
  };

  const handleDelete = async (field: LeadFieldDefinition) => {
    if (!window.confirm(`Excluir o campo "${field.name}"? Os valores preenchidos também serão removidos.`)) return;
    await deleteField.mutateAsync(field.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-[4px]" />
        ))}
      </div>
    );
  }

  // ─── Form renderer ─────────────────────────────────────────────────────────

  const renderForm = (
    form: FormState,
    setForm: (f: FormState) => void,
    onSave: () => void,
    onCancel: () => void,
    touched: boolean,
    setTouched: (v: boolean) => void,
  ) => {
    const isSelectType = form.type === 'single_select' || form.type === 'select';

    return (
      <div className="border border-border rounded-[4px] p-4 space-y-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Nome do campo *
            </Label>
            <Input
              value={form.name}
              onChange={e => handleNameChange(e.target.value, form, setForm, touched)}
              placeholder="Ex: Budget mensal"
              className="h-[30px] text-[13px]"
            />
          </div>

          {/* Key */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Identificador
            </Label>
            <Input
              value={form.key}
              onChange={e => { setTouched(true); setForm({ ...form, key: e.target.value }); }}
              placeholder="budget_mensal"
              className="h-[30px] text-[13px] font-mono"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Tipo
            </Label>
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as FieldType, optionsText: '' })}>
              <SelectTrigger className="h-[30px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Categoria
            </Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v as LeadFieldCategory })}>
              <SelectTrigger className="h-[30px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline — only for negocio */}
          {activeEntity === 'negocio' && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Pipeline
              </Label>
              <Select value={form.pipeline_id || '__global'} onValueChange={v => setForm({ ...form, pipeline_id: v === '__global' ? '' : v })}>
                <SelectTrigger className="h-[30px] text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global">Global (todos os pipelines)</SelectItem>
                  {activePipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome || p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Required toggle */}
          <div className="flex items-center gap-2 pt-5">
            <Switch
              id="required-toggle"
              checked={form.required}
              onCheckedChange={v => setForm({ ...form, required: v })}
            />
            <Label htmlFor="required-toggle" className="text-[13px] text-foreground cursor-pointer">
              Obrigatório
            </Label>
          </div>
        </div>

        {/* Options (select types) */}
        {isSelectType && (
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Opções (uma por linha)
            </Label>
            <Textarea
              value={form.optionsText}
              onChange={e => setForm({ ...form, optionsText: e.target.value })}
              placeholder={"Opção 1\nOpção 2\nOpção 3"}
              rows={4}
              className="text-[13px] resize-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={onSave} disabled={isSubmitting || !form.name.trim()} className="h-[30px] px-3 text-[13px] gap-1.5">
            <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-[30px] px-3 text-[13px]">
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            Cancelar
          </Button>
        </div>
      </div>
    );
  };

  // ─── Field row ─────────────────────────────────────────────────────────────

  const renderFieldRow = (field: LeadFieldDefinition) => {
    if (editingId === field.id) {
      return (
        <div key={field.id}>
          {renderForm(
            editForm,
            setEditForm,
            () => handleSaveEdit(field.id),
            () => setEditingId(null),
            true,
            () => {}
          )}
        </div>
      );
    }

    const pipelineName = field.pipeline_id
      ? (activePipelines.find(p => p.id === field.pipeline_id)?.nome ?? activePipelines.find(p => p.id === field.pipeline_id)?.name ?? 'Pipeline')
      : activeEntity === 'negocio' ? 'Global' : null;

    return (
      <div
        key={field.id}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 border border-border rounded-[4px] bg-card",
          !field.active && "opacity-50"
        )}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <span className="text-[13px] font-medium text-foreground truncate">{field.name}</span>
          <span className={cn(
            "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none",
            typeBadgeVariant(field.type)
          )}>
            {typeLabel(field.type)}
          </span>
          <span className="text-[11px] text-muted-foreground/50 font-mono">{field.key}</span>
        </div>

        {pipelineName && (
          <span className="text-[11px] text-muted-foreground/60 flex-shrink-0 hidden sm:block">{pipelineName}</span>
        )}

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Switch
            checked={field.active}
            onCheckedChange={() => handleToggleActive(field)}
            className="data-[state=checked]:bg-primary scale-90"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStartEdit(field)}
            className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground"
          >
            <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(field)}
            className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    );
  };

  // ─── Main render ───────────────────────────────────────────────────────────

  const activeTab = ENTITY_TABS.find(t => t.value === activeEntity)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-[15px] font-semibold text-foreground">Campos Personalizados</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">
            {activeTab.desc}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { setShowNewForm(true); setNewForm(buildEmptyForm(activeEntity)); setKeyTouched(false); }}
          className="gap-1.5 h-[30px] text-[13px]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Novo Campo
        </Button>
      </div>

      {/* Entity type tabs */}
      <div className="flex gap-1 p-0.5 bg-muted rounded-[4px] w-fit">
        {ENTITY_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeEntity === tab.value;
          const count = allFields.filter(f => f.entity_type === tab.value).length;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleEntityChange(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-[12px] font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full leading-none",
                  isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/60"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* New field form */}
      {showNewForm && renderForm(
        newForm,
        setNewForm,
        handleCreate,
        () => { setShowNewForm(false); setNewForm(buildEmptyForm(activeEntity)); },
        keyTouched,
        setKeyTouched
      )}

      {/* Fields grouped by category */}
      {categories.map(cat => {
        const catFields = entityFields.filter(f => f.category === cat.value);

        return (
          <div key={cat.value} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {cat.label}
            </p>
            {catFields.length === 0 ? (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground/40 py-3 px-3">
                <ListPlus className="w-4 h-4" strokeWidth={1.5} />
                Nenhum campo configurado
              </div>
            ) : (
              <div className="space-y-1.5">
                {catFields.map(renderFieldRow)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CamposExtrasConfig;
