import { useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { PromptEditor } from './PromptEditor';
import { PromptShortcutsBar, type VariavelGrupo } from './PromptShortcutsBar';
import { useLeadFieldDefinitions } from '@/hooks/useLeadFieldDefinitions';
import type { PromptEditorRef } from './PromptEditor';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Etapa {
  id: string;
  controle: number;
  prompt: string;
  nome?: string;
}

interface PromptEtapaEditorProps {
  etapas: Etapa[];
  onChange: (etapas: Etapa[]) => void;
}

// ── Sortable item ─────────────────────────────────────────────────────────────

interface SortableEtapaProps {
  etapa: Etapa;
  canRemove: boolean;
  onRemove: () => void;
  onUpdate: (field: keyof Etapa, value: string | number) => void;
  onInsert: (text: string) => void;
  editorRef: (ref: PromptEditorRef | null) => void;
  customGroups?: VariavelGrupo[];
}

const SortableEtapa = ({ etapa, canRemove, onRemove, onUpdate, onInsert, editorRef, customGroups }: SortableEtapaProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: etapa.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('border border-white/[0.06] rounded-[4px] overflow-hidden', isDragging && 'z-10')}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-white/[0.06]">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
          tabIndex={-1}
          aria-label="Mover"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <span
          className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold shrink-0"
          title={`Control = ${etapa.controle}`}
        >
          {etapa.controle}
        </span>

        <Input
          value={etapa.nome || `Controle ${etapa.controle}`}
          onChange={(e) => onUpdate('nome', e.target.value)}
          placeholder="Nome do controle"
          className="h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-medium flex-1"
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={!canRemove}
          className="h-[30px] w-[30px] p-0 ml-auto text-muted-foreground/50 hover:text-destructive shrink-0 rounded-[4px] transition-colors duration-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Shortcuts */}
      <PromptShortcutsBar onInsert={onInsert} customGroups={customGroups} />

      {/* Editor */}
      <PromptEditor
        ref={editorRef}
        value={etapa.prompt}
        onChange={(v) => onUpdate('prompt', v)}
        disabled={false}
        placeholder={`Prompt do controle ${etapa.controle}...`}
        minHeight={320}
      />
    </div>
  );
};

// ── Main editor ───────────────────────────────────────────────────────────────

export const PromptEtapaEditor = ({ etapas, onChange }: PromptEtapaEditorProps) => {
  const editorRefs = useRef<Map<string, PromptEditorRef>>(new Map());

  const { data: fieldDefs = [] } = useLeadFieldDefinitions();
  const customGroups = useMemo<VariavelGrupo[]>(() => {
    if (fieldDefs.length === 0) return [];
    return [{
      grupo: 'Campos Customizados',
      vars: fieldDefs.map(f => ({ chave: `lead.${f.slug}`, label: f.label })),
    }];
  }, [fieldDefs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = etapas.findIndex(e => e.id === active.id);
    const newIndex = etapas.findIndex(e => e.id === over.id);
    const reordered = arrayMove(etapas, oldIndex, newIndex);
    // Re-assign controle values to match new position (1-based)
    onChange(reordered.map((e, i) => ({ ...e, controle: i + 1 })));
  };

  const handleAddEtapa = () => {
    const nextControle = etapas.length + 1;
    onChange([...etapas, {
      id: `etapa-${Date.now()}`,
      controle: nextControle,
      prompt: '',
      nome: `Controle ${nextControle}`,
    }]);
  };

  const handleRemoveEtapa = (id: string) => {
    if (etapas.length === 1) return;
    const filtered = etapas.filter(e => e.id !== id);
    onChange(filtered.map((e, i) => ({ ...e, controle: i + 1 })));
  };

  const handleUpdate = (id: string, field: keyof Etapa, value: string | number) => {
    onChange(etapas.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={etapas.map(e => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {etapas.map((etapa) => (
            <SortableEtapa
              key={etapa.id}
              etapa={etapa}
              canRemove={etapas.length > 1}
              onRemove={() => handleRemoveEtapa(etapa.id)}
              onUpdate={(field, value) => handleUpdate(etapa.id, field, value)}
              onInsert={(text) => editorRefs.current.get(etapa.id)?.insertAtCursor(text)}
              editorRef={(ref) => { if (ref) editorRefs.current.set(etapa.id, ref); }}
              customGroups={customGroups}
            />
          ))}

          <Button
            onClick={handleAddEtapa}
            variant="outline"
            className="w-full gap-2 h-[30px] text-xs border-dashed rounded-[4px] transition-colors duration-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Controle
          </Button>
        </div>
      </SortableContext>
    </DndContext>
  );
};
