import React from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { LpFormField, LpFormStep } from "@/hooks/useLpForms";
import type { CatalogGroup } from "@/hooks/useLpFormCatalog";
import { LpFieldEditor } from "./LpFieldEditor";
import { cn } from "@/lib/utils";

export interface SortableStepItemProps {
  step: LpFormStep;
  stepI: number;
  totalSteps: number;
  fields: LpFormField[];
  catalogGroups: CatalogGroup[];
  stepsForCanvas: LpFormStep[];
  globalIdx: (f: LpFormField) => number;
  renameStep: (id: string, title: string) => void;
  removeStep: (id: string) => void;
  updateField: (idx: number, f: LpFormField) => void;
  deleteField: (idx: number) => void;
  moveField: (idx: number, dir: number) => void;
  firstStepWarning: boolean;
}

export function SortableStepItem({
  step, stepI, totalSteps, fields, catalogGroups, stepsForCanvas,
  globalIdx, renameStep, removeStep, updateField, deleteField, moveField, firstStepWarning,
}: SortableStepItemProps) {
  // Sortable for step reordering — tagged as type 'step' so the unified handler
  // in LpFormBuilder can distinguish step drags from field drags.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    data: { type: "step" },
  });

  // Droppable zone on the fields container so fields can be dragged into an empty step.
  const { setNodeRef: setDropRef, isOver: isFieldOver } = useDroppable({
    id: `step-drop-${step.id}`,
    data: { type: "step-container", stepId: step.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const stepFields = fields.filter((f) => f.step_id === step.id);

  return (
    <div ref={setNodeRef} style={style} className="group/step">
      {/* Step header — clean, flat */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        {/* Drag handle for step reorder */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-transparent group-hover/step:text-muted-foreground/30 hover:!text-muted-foreground/60 transition-colors shrink-0 touch-none"
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <div className="w-5 h-5 rounded flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold shrink-0">
          {stepI + 1}
        </div>
        <input
          value={step.title}
          onChange={(e) => renameStep(step.id, e.target.value)}
          className="flex-1 bg-transparent text-xs font-semibold text-foreground focus:outline-none min-w-0 placeholder:text-muted-foreground"
          placeholder="Nome do passo..."
        />
        <button
          onClick={() => removeStep(step.id)}
          className="p-1 rounded text-transparent group-hover/step:text-muted-foreground/30 hover:!text-red-500 transition-colors shrink-0"
          title="Remover passo"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Step 1 warning */}
      {stepI === 0 && firstStepWarning && (
        <div className="px-3 py-1.5 mx-2 mb-1 rounded-[4px] bg-amber-500/10 flex items-center gap-1.5">
          <span className="text-[10px] text-amber-600 font-semibold">
            ⚠ Etapa 1 deve ter Nome + Telefone ou Nome + E-mail
          </span>
        </div>
      )}

      {/* Step fields — own SortableContext so fields are draggable within the step.
          The outer DndContext in LpFormBuilder handles the actual onDragEnd logic. */}
      <div
        ref={setDropRef}
        className={cn(
          "pl-4 pr-2 pb-2 space-y-0.5 min-h-[32px] rounded-[4px] transition-colors",
          isFieldOver && "bg-primary/5 ring-1 ring-inset ring-primary/20"
        )}
      >
        {stepFields.length === 0 ? (
          <div className={cn(
            "py-3 text-center border border-dashed rounded-[4px] mx-2 transition-colors",
            isFieldOver ? "border-primary/50 bg-primary/5" : "border-border"
          )}>
            <p className="text-[10px] text-muted-foreground/60">
              Adicione campos do catálogo
            </p>
          </div>
        ) : (
          <SortableContext items={stepFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {stepFields.map((field) => {
              const idx = globalIdx(field);
              return (
                <SortableFieldItem
                  key={field.id}
                  id={field.id}
                  stepId={step.id}
                  field={field}
                  allFields={fields}
                  catalogGroups={catalogGroups}
                  formMode="steps"
                  steps={stepsForCanvas}
                  onUpdate={(updated) => updateField(idx, updated)}
                  onDelete={() => deleteField(idx)}
                  onMoveUp={() => moveField(idx, -1)}
                  onMoveDown={() => moveField(idx, 1)}
                  isFirst={idx === 0}
                  isLast={idx === fields.length - 1}
                />
              );
            })}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export interface SortableFieldItemProps {
  id: string;
  /** Present only in steps mode — used as dnd data so the handler knows the field's container. */
  stepId?: string;
  field: LpFormField;
  allFields: LpFormField[];
  catalogGroups: CatalogGroup[];
  formMode: "classic" | "steps" | "chatbot";
  steps: LpFormStep[];
  onUpdate: (updated: LpFormField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function SortableFieldItem({
  id, stepId, field, allFields, catalogGroups, formMode, steps,
  onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: SortableFieldItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "field", stepId },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <LpFieldEditor
        field={field}
        allFields={allFields}
        catalogGroups={catalogGroups}
        formMode={formMode}
        steps={steps}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        isFirst={isFirst}
        isLast={isLast}
        dragListeners={listeners as Record<string, unknown>}
        dragAttributes={attributes as Record<string, unknown>}
      />
    </div>
  );
}
