import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { ScoreBaseModal } from './ScoreBaseModal';
import { ConfirmarExclusaoModal } from '@/components/modals/ConfirmarExclusaoModal';

interface Item {
  id: string;
  name: string;
  active: boolean;
  order_index: number;
}

interface ScoreBaseCardProps {
  title: string;
  items: Item[];
  isLoading: boolean;
  onCreate: (item: { name: string; active: boolean }) => void;
  onUpdate: (item: Partial<Item> & { id: string }) => void;
  onDelete: (id: string) => void;
  onReorder?: (items: { id: string; order_index: number }[]) => void;
  isPending: boolean;
}

export const ScoreBaseCard = ({
  title,
  items,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  isPending,
}: ScoreBaseCardProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleOpenModal = (item?: Item) => {
    setEditingItem(item || null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = (data: { name: string; active: boolean }) => {
    if (editingItem) {
      onUpdate({ id: editingItem.id, ...data });
    } else {
      onCreate(data);
    }
    handleCloseModal();
  };

  const handleMoveUp = (index: number) => {
    if (index === 0 || !onReorder) return;
    
    const reordered = [...items];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      order_index: idx,
    }));
    
    onReorder(updates);
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1 || !onReorder) return;
    
    const reordered = [...items];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      order_index: idx,
    }));
    
    onReorder(updates);
  };

  const activeCount = items.filter(item => item.active).length;

  return (
    <>
      <Card className="overflow-hidden border-border">
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
              <p className="text-[12px] text-muted-foreground/70 mt-0.5">
                {activeCount} {activeCount === 1 ? 'item ativo' : 'itens ativos'} de {items.length} total
              </p>
            </div>
            <Button onClick={() => handleOpenModal()} size="sm" className="gap-1.5 h-[30px] text-[13px]">
              <Plus className="w-3.5 h-3.5" />
              Novo
            </Button>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-pulse">Carregando...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-base">Nenhum {title.toLowerCase()} cadastrado</p>
              <p className="text-sm mt-2">Clique em "Novo" para adicionar o primeiro item</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  {onReorder && <TableHead className="w-[80px]">Ordem</TableHead>}
                  <TableHead className="font-semibold">Nome</TableHead>
                  <TableHead className="w-[120px] font-semibold">Status</TableHead>
                  <TableHead className="w-[140px] text-right font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow 
                    key={item.id}
                    className="hover:bg-muted/50 transition-colors border-border"
                  >
                    {onReorder && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                          <div className="flex flex-col gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0 || isPending}
                              className="h-5 w-5 p-0 hover:bg-primary/10"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveDown(index)}
                              disabled={index === items.length - 1 || isPending}
                              className="h-5 w-5 p-0 hover:bg-primary/10"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.active
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }
                      >
                        {item.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(item)}
                          className="h-[30px] px-3 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1.5" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(item.id)}
                          className="h-[30px] px-3 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <ScoreBaseModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingItem ? `Editar ${title}` : `Novo ${title}`}
        item={editingItem}
        onSubmit={handleSubmit}
        isPending={isPending}
      />

      <ConfirmarExclusaoModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            onDelete(deleteId);
            setDeleteId(null);
          }
        }}
        title="Excluir Item"
        description="Tem certeza? Isso excluirá todas as combinações relacionadas na matriz de score."
      />
    </>
  );
};
