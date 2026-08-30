import { useState, useMemo } from 'react';
import { Edit2, Check, X, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScoreCategories, useAllScoreCategoryItems } from '@/hooks/useScoreCategories';
import { useScoreMatrixById, useScoreMatrix } from '@/hooks/useScoreMatrix';
import { useUpdatePessoa } from '@/hooks/usePessoasReal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface NegocioScoreSectionProps {
  pessoaId: string;
  scoreMatrixId?: string | null;
  score?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getScoreStyle = (s: number) => {
  if (s >= 8) return {
    chip: 'text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20',
    color: 'text-[#00D26A]',
  };
  if (s >= 5) return {
    chip: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
    color: 'text-[#F59E0B]',
  };
  return {
    chip: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
    color: 'text-[#EF4444]',
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

export const NegocioScoreSection = ({
  pessoaId,
  scoreMatrixId,
  score,
}: NegocioScoreSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  // editSel: { [category_id]: item_id }
  const [editSel, setEditSel] = useState<Record<string, string>>({});

  const { data: allCategories = [] } = useScoreCategories();
  const { data: allItems = [] } = useAllScoreCategoryItems();
  const { data: savedMatrix } = useScoreMatrixById(scoreMatrixId);
  const updatePessoa = useUpdatePessoa();

  // All active categories, sorted by order_index
  const categories = useMemo(
    () => allCategories.filter(c => c.active !== false),
    [allCategories],
  );

  // Items grouped by category_id
  const itemsByCat = useMemo(() => {
    const map = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const arr = map.get(item.category_id) ?? [];
      arr.push(item);
      map.set(item.category_id, arr);
    }
    return map;
  }, [allItems]);

  // Derive current display selections from savedMatrix.category_selections
  const displaySel = useMemo(() => {
    if (!savedMatrix?.category_selections) return {};
    const sel: Record<string, string> = {};
    for (const [catId, items] of Object.entries(savedMatrix.category_selections)) {
      const first = (items as string[])?.[0];
      if (first) sel[catId] = first;
    }
    return sel;
  }, [savedMatrix]);

  // Build edit filters for matrix preview — only when all categories have a selection
  const editFilters = useMemo(() => {
    if (!isEditing) return undefined;
    const filled = Object.entries(editSel).filter(([, v]) => v);
    if (categories.length === 0 || filled.length !== categories.length) return undefined;
    return Object.fromEntries(filled);
  }, [isEditing, editSel, categories.length]);

  const { data: previewMatrices = [] } = useScoreMatrix(editFilters);
  const previewMatrix = editFilters ? (previewMatrices[0] ?? null) : null;

  const hasAllFields = categories.length > 0 && categories.every(c => !!displaySel[c.id]);
  const editHasAllFields = categories.length > 0 && categories.every(c => !!editSel[c.id]);

  const handleEdit = () => {
    setEditSel({ ...displaySel });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditSel({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!previewMatrix) {
      toast.error('Selecione uma combinação válida na matriz de score');
      return;
    }
    try {
      await updatePessoa.mutateAsync({
        id: pessoaId,
        score_matrix_id: previewMatrix.id,
        score: previewMatrix.score_number,
      });
      setIsEditing(false);
      toast.success('Enquadramento atualizado!');
    } catch {
      toast.error('Erro ao atualizar enquadramento');
    }
  };

  return (
    <div className="space-y-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Enquadramento & Score
        </p>
        {!isEditing && (
          <Button
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground"
            onClick={handleEdit}
          >
            <Edit2 className="w-3 h-3" strokeWidth={1.5} />
          </Button>
        )}
      </div>

      <div className="border border-border rounded-[2px] overflow-hidden">

        {/* ── Edit mode ── */}
        {isEditing ? (
          <div className="p-4 space-y-3">

            {categories.map(cat => {
              const items = itemsByCat.get(cat.id) ?? [];
              return (
                <div key={cat.id} className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    {cat.name}
                  </p>
                  <Select
                    value={editSel[cat.id] || undefined}
                    onValueChange={v =>
                      setEditSel(prev => ({ ...prev, [cat.id]: v === '__none' ? '' : v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder={`Selecionar ${cat.name.toLowerCase()}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="text-[13px] text-muted-foreground">
                        — Nenhum
                      </SelectItem>
                      {items.map(item => (
                        <SelectItem key={item.id} value={item.id} className="text-[13px]">
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}

            {/* Matrix preview */}
            {editHasAllFields && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-[4px] border text-[12px]',
                previewMatrix
                  ? cn('border-border bg-card', getScoreStyle(previewMatrix.score_number).chip)
                  : 'border-[#F59E0B]/20 bg-[#F59E0B]/10 text-[#F59E0B]',
              )}>
                <Award className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                {previewMatrix ? (
                  <span>
                    <span className="font-semibold">{previewMatrix.name || 'Matriz sem nome'}</span>
                    {' '}— Score {previewMatrix.score_number}/10
                  </span>
                ) : (
                  <span>Combinação não encontrada na matriz</span>
                )}
              </div>
            )}

            <div className="flex gap-1.5 justify-end pt-1">
              <Button
                variant="ghost"
                className="h-7 px-2.5 text-[12px] gap-1"
                onClick={handleCancel}
                disabled={updatePessoa.isPending}
              >
                <X className="w-3 h-3" strokeWidth={1.5} />
                Cancelar
              </Button>
              <Button
                className="h-7 px-2.5 text-[12px] gap-1"
                onClick={handleSave}
                disabled={updatePessoa.isPending || !previewMatrix}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                {updatePessoa.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>

        ) : (
          /* ── Display mode ── */
          <>
            {/* Score bar */}
            {score != null ? (
              (() => {
                const style = getScoreStyle(score);
                return (
                  <div className={cn(
                    'flex items-center justify-between px-4 py-3 border-b border-white/[0.04]',
                    style.chip,
                  )}>
                    <div className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                      <span className="text-[13px] font-semibold">
                        {savedMatrix?.name || 'Matriz sem nome'}
                      </span>
                    </div>
                    <span className={cn('text-[20px] font-bold leading-none', style.color)}>
                      {score}
                      <span className="text-[11px] font-normal opacity-60 ml-0.5">/10</span>
                    </span>
                  </div>
                );
              })()
            ) : hasAllFields ? (
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04] bg-[#F59E0B]/10 text-[#F59E0B] text-[12px]">
                <Award className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                <span>Combinação não encontrada na matriz de score</span>
              </div>
            ) : null}

            {/* Category rows — dynamic */}
            <div className="divide-y divide-white/[0.04]">
              {categories.map(cat => {
                const itemId = displaySel[cat.id];
                const items = itemsByCat.get(cat.id) ?? [];
                const itemName = items.find(i => i.id === itemId)?.name;
                return (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12px] text-muted-foreground/60">{cat.name}</span>
                    <span className={cn(
                      'text-[13px] truncate ml-3 max-w-[180px] text-right',
                      itemName ? 'font-medium text-foreground' : 'text-muted-foreground/30',
                    )}>
                      {itemName ?? '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {!scoreMatrixId && (
              <div className="px-4 py-2.5 border-t border-white/[0.04]">
                <button
                  onClick={handleEdit}
                  className="text-[12px] text-primary hover:underline"
                >
                  + Definir enquadramento
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
