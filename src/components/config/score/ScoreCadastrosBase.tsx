import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useScoreCategories,
  useCreateScoreCategory,
  useReorderScoreCategories,
} from '@/hooks/useScoreCategories';
import { ScoreCategoryCard } from './ScoreCategoryCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export const ScoreCadastrosBase = () => {
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const { data: categories = [], isLoading } = useScoreCategories();
  const createCategory = useCreateScoreCategory();
  const reorderCategories = useReorderScoreCategories();

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    createCategory.mutate(
      { name: newCatName.trim() },
      {
        onSuccess: () => {
          setNewCatName('');
          setNewCatOpen(false);
        },
      }
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...categories];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    reorderCategories.mutate(reordered.map((c, i) => ({ id: c.id, order_index: i })));
  };

  const handleMoveDown = (index: number) => {
    if (index === categories.length - 1) return;
    const reordered = [...categories];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    reorderCategories.mutate(reordered.map((c, i) => ({ id: c.id, order_index: i })));
  };

  return (
    <>
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'} cadastradas
          </p>
          <Button size="sm" onClick={() => setNewCatOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Categoria
          </Button>
        </div>

        {/* Category Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[13px]">Carregando categorias...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((cat, index) => (
              <ScoreCategoryCard
                key={cat.id}
                category={cat}
                isFirst={index === 0}
                isLast={index === categories.length - 1}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Category Modal */}
      <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="cat-name">Nome da categoria *</Label>
              <Input
                id="cat-name"
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                placeholder="Ex: Região, Tipo de Negócio..."
                className="rounded-[4px] mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewCatOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCategory}
                disabled={!newCatName.trim() || createCategory.isPending}
              >
                {createCategory.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
