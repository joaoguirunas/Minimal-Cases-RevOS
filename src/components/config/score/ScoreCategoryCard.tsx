import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, Pencil, Trash2, Check, X, Lock } from 'lucide-react';
import { ScoreBaseCard } from './ScoreBaseCard';
import { ConfirmarExclusaoModal } from '@/components/modals/ConfirmarExclusaoModal';
import {
  useScoreCategoryItems,
  useCreateScoreCategoryItem,
  useUpdateScoreCategoryItem,
  useDeleteScoreCategoryItem,
  useReorderScoreCategoryItems,
  useUpdateScoreCategory,
  useDeleteScoreCategory,
  type ScoreCategory,
} from '@/hooks/useScoreCategories';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ScoreCategoryCardProps {
  category: ScoreCategory;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const BASE_SLUGS = ['objectives', 'investments', 'framings'];

export const ScoreCategoryCard = ({
  category,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: ScoreCategoryCardProps) => {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(category.name);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: items = [], isLoading } = useScoreCategoryItems(category.id);
  const createItem = useCreateScoreCategoryItem();
  const updateItem = useUpdateScoreCategoryItem();
  const deleteItem = useDeleteScoreCategoryItem();
  const reorderItems = useReorderScoreCategoryItems();
  const updateCategory = useUpdateScoreCategory();
  const deleteCategory = useDeleteScoreCategory();

  const isBaseCategory = category.slug !== null && BASE_SLUGS.includes(category.slug ?? '');

  const handleSaveName = () => {
    if (!nameValue.trim() || nameValue === category.name) {
      setNameValue(category.name);
      setEditingName(false);
      return;
    }
    updateCategory.mutate(
      { id: category.id, name: nameValue.trim() },
      { onSuccess: () => setEditingName(false) }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName();
    if (e.key === 'Escape') {
      setNameValue(category.name);
      setEditingName(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-border">
        {/* Category Header */}
        <div className="px-5 py-3 border-b border-border bg-muted flex items-center gap-3">
          {/* Reorder */}
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveUp}
              disabled={isFirst}
              className="h-5 w-5 p-0 hover:bg-primary/10"
            >
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              disabled={isLast}
              className="h-5 w-5 p-0 hover:bg-primary/10"
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>

          {/* Name */}
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-[30px] text-[13px] rounded-[4px] max-w-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveName}
                  className="h-[30px] w-[30px] p-0 text-success hover:text-success"
                  disabled={updateCategory.isPending}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setNameValue(category.name); setEditingName(false); }}
                  className="h-[30px] w-[30px] p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <span className="text-[13px] font-semibold text-foreground">{category.name}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            {!editingName && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingName(true)}
                className="h-[30px] w-[30px] p-0 hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => !isBaseCategory && setDeleteOpen(true)}
                      disabled={isBaseCategory}
                      className="h-[30px] w-[30px] p-0 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      {isBaseCategory ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {isBaseCategory && (
                  <TooltipContent>
                    <p>Categoria base — não pode ser excluída</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Items (reuse ScoreBaseCard) */}
        <div className="p-4">
          <ScoreBaseCard
            title={category.name}
            items={items.map((i) => ({
              id: i.id,
              name: i.name,
              active: i.active,
              order_index: i.order_index,
            }))}
            isLoading={isLoading}
            onCreate={(data) => createItem.mutate({ category_id: category.id, ...data })}
            onUpdate={(data) => updateItem.mutate({ ...data, category_id: category.id })}
            onDelete={(id) => deleteItem.mutate({ id, category_id: category.id })}
            onReorder={(reordered) =>
              reorderItems.mutate({ categoryId: category.id, items: reordered })
            }
            isPending={
              createItem.isPending || updateItem.isPending || deleteItem.isPending
            }
          />
        </div>
      </Card>

      <ConfirmarExclusaoModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          deleteCategory.mutate(category.id);
          setDeleteOpen(false);
        }}
        title="Excluir Categoria"
        description={`Excluir "${category.name}" apagará todos os itens desta categoria e removerá suas referências da Matriz de Score.`}
      />
    </>
  );
};
