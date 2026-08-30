import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, Hash } from "lucide-react";
import { useScoreMatrix, useDeleteScoreMatrix, type ScoreMatrix as ScoreMatrixType } from "@/hooks/useScoreMatrix";
import { useScoreCategories, useAllScoreCategoryItems } from "@/hooks/useScoreCategories";
import { ScoreMatrizModal } from "./ScoreMatrizModal";
import { ConfirmarExclusaoModal } from "@/components/modals/ConfirmarExclusaoModal";
import CopyableId from "@/components/common/CopyableId";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ScoreMatriz = () => {
  // filters: { [category_id]: item_id }
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScoreMatrixType | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<ScoreMatrixType | null>(null);

  const { data: categories = [] } = useScoreCategories();
  const { data: allItems = [] } = useAllScoreCategoryItems();
  const { data: matrices, isLoading } = useScoreMatrix(filters);
  const deleteMatrix = useDeleteScoreMatrix();

  const activeCategories = categories.filter((c) => c.active);

  const getItemsForCategory = (catId: string) =>
    allItems.filter((i) => i.category_id === catId && i.active);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const handleClearFilters = () => setFilters({});

  const handleOpenModal = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: ScoreMatrixType) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 8) return "bg-green-500 text-white";
    if (score >= 5) return "bg-yellow-500 text-white";
    return "bg-red-500 text-white";
  };

  return (
    <>
      <Card className="border-border">
        <CardHeader className="border-b border-border py-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[13px] font-semibold">Matriz de Score</CardTitle>
              <CardDescription className="text-[12px] mt-0.5">
                Combinações para cálculo automático de score
              </CardDescription>
            </div>
            <Button onClick={handleOpenModal} size="sm" className="gap-1.5 h-[30px] text-[13px]">
              <Plus className="h-3.5 w-3.5" />
              Nova Combinação
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Dynamic filters — one Select per active category */}
          {activeCategories.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-6">
              {activeCategories.map((cat) => {
                const catItems = getItemsForCategory(cat.id);
                return (
                  <Select
                    key={cat.id}
                    value={filters[cat.id] || "all"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        [cat.id]: value === "all" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="w-[190px] text-[13px]">
                      <SelectValue placeholder={`Todos — ${cat.name}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos — {cat.name}</SelectItem>
                      {catItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })}
              {hasActiveFilters && (
                <Button variant="outline" onClick={handleClearFilters} className="h-10">
                  Limpar Filtros
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          <div className="rounded-[2px] border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left p-4 font-semibold text-sm w-24">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-primary" />
                        Score
                      </div>
                    </th>
                    <th className="text-left p-4 font-semibold text-sm w-[180px]">Nome</th>
                    {activeCategories.map((cat) => (
                      <th key={cat.id} className="text-left p-4 font-semibold text-sm">
                        {cat.name}
                      </th>
                    ))}
                    <th className="text-right p-4 font-semibold text-sm w-20">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={3 + activeCategories.length}
                        className="text-center p-12 text-muted-foreground"
                      >
                        Carregando combinações...
                      </td>
                    </tr>
                  ) : matrices && matrices.length > 0 ? (
                    matrices.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border hover:bg-muted/50 transition-all duration-200 group"
                      >
                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className={`font-bold text-sm ${getScoreBadgeColor(item.score_number)}`}
                          >
                            {item.score_number}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-foreground">{item.name || "-"}</div>
                        </td>
                        {activeCategories.map((cat) => {
                          const resolved = item.resolved_categories?.find(
                            (r) => r.categoryId === cat.id
                          );
                          return (
                            <td key={cat.id} className="p-4">
                              <div className="flex flex-wrap gap-1.5">
                                {resolved && resolved.itemNames.length > 0 ? (
                                  resolved.itemNames.map((name) => (
                                    <Badge key={name} variant="secondary" className="text-xs font-medium">
                                      {name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-4">
                          <div className="flex items-center justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewItem(item)}
                              className="opacity-70 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3 + activeCategories.length} className="text-center p-12">
                        <div className="text-muted-foreground">
                          <Hash className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p className="font-medium">Nenhuma combinação cadastrada</p>
                          <p className="text-sm mt-1">Clique em "Nova Combinação" para começar</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <ScoreMatrizModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        item={editingItem}
        categories={activeCategories}
        allItems={allItems}
      />

      <ConfirmarExclusaoModal
        open={!!itemToDelete}
        onOpenChange={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            deleteMatrix.mutate(itemToDelete);
            setItemToDelete(null);
          }
        }}
        title="Excluir Combinação"
        description="Tem certeza que deseja excluir esta combinação de score?"
      />

      {/* View Detail Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Detalhes da Combinação
              </DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (viewItem) {
                      handleEdit(viewItem);
                      setViewItem(null);
                    }
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (viewItem) {
                      setItemToDelete(viewItem.id);
                      setViewItem(null);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
            <DialogDescription>
              Visualização completa das informações da combinação de score
            </DialogDescription>
            {viewItem?.id && (
              <div className="mt-2">
                <CopyableId id={viewItem.id} label="ID da Combinação" />
              </div>
            )}
          </DialogHeader>

          {viewItem && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome</label>
                  <p className="mt-1 text-base font-medium">{viewItem.name || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Score</label>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={`font-bold text-base ${getScoreBadgeColor(viewItem.score_number)}`}
                    >
                      {viewItem.score_number}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Dynamic category sections */}
              {(viewItem.resolved_categories ?? []).map((rc) => (
                <div key={rc.categoryId}>
                  <label className="text-sm font-medium text-muted-foreground">{rc.categoryName}</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rc.itemNames.length > 0 ? (
                      rc.itemNames.map((name) => (
                        <Badge key={name} variant="secondary">{name}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum item selecionado</span>
                    )}
                  </div>
                </div>
              ))}

              {viewItem.profile_score && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Perfil do Lead</label>
                  <p className="mt-2 text-sm p-3 bg-muted rounded-[2px]">{viewItem.profile_score}</p>
                </div>
              )}
              {viewItem.pre_description_score && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pré-descrição</label>
                  <p className="mt-2 text-sm p-3 bg-muted rounded-[2px]">{viewItem.pre_description_score}</p>
                </div>
              )}
              {viewItem.detail_score && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Detalhes</label>
                  <p className="mt-2 text-sm p-3 bg-muted rounded-[2px]">{viewItem.detail_score}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
