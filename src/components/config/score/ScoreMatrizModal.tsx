import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateScoreMatrix, useUpdateScoreMatrix } from "@/hooks/useScoreMatrix";
import type { ScoreMatrix } from "@/hooks/useScoreMatrix";
import type { ScoreCategory, ScoreCategoryItem } from "@/hooks/useScoreCategories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Hash, FileText, User, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CopyableId from "@/components/common/CopyableId";

interface ScoreMatrizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ScoreMatrix | null;
  categories: ScoreCategory[];
  allItems: ScoreCategoryItem[];
}

export const ScoreMatrizModal = ({
  open,
  onOpenChange,
  item,
  categories,
  allItems,
}: ScoreMatrizModalProps) => {
  const createMatrix = useCreateScoreMatrix();
  const updateMatrix = useUpdateScoreMatrix();

  const [name, setName] = useState("");
  // selections: { [category_id]: Set<item_id> }
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [scoreNumber, setScoreNumber] = useState<number>(0);
  const [detailScore, setDetailScore] = useState("");
  const [profileScore, setProfileScore] = useState("");
  const [preDescriptionScore, setPreDescriptionScore] = useState("");

  const getItemsForCategory = (catId: string) =>
    allItems.filter((i) => i.category_id === catId && i.active);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name || "");
      setScoreNumber(item.score_number);
      setDetailScore(item.detail_score || "");
      setProfileScore(item.profile_score || "");
      setPreDescriptionScore(item.pre_description_score || "");
      // Build selections from category_selections
      const sels: Record<string, Set<string>> = {};
      for (const [catId, itemIds] of Object.entries(item.category_selections || {})) {
        sels[catId] = new Set(itemIds);
      }
      setSelections(sels);
    } else {
      setName("");
      setScoreNumber(0);
      setDetailScore("");
      setProfileScore("");
      setPreDescriptionScore("");
      setSelections({});
    }
  }, [open, item]);

  const toggleItem = (catId: string, itemId: string, checked: boolean) => {
    setSelections((prev) => {
      const current = new Set(prev[catId] || []);
      if (checked) current.add(itemId);
      else current.delete(itemId);
      return { ...prev, [catId]: current };
    });
  };

  const selectAll = (catId: string) => {
    const ids = getItemsForCategory(catId).map((i) => i.id);
    setSelections((prev) => ({ ...prev, [catId]: new Set(ids) }));
  };

  const clearAll = (catId: string) => {
    setSelections((prev) => ({ ...prev, [catId]: new Set() }));
  };

  const totalSelected = Object.values(selections).reduce((s, set) => s + set.size, 0);
  const isFormValid = totalSelected > 0 && scoreNumber >= 1 && scoreNumber <= 10;

  const buildCategorySelections = (): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    for (const cat of categories) {
      const items = Array.from(selections[cat.id] || []);
      if (items.length > 0) result[cat.id] = items;
    }
    return result;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const matrixData = {
      name: name || undefined,
      category_selections: buildCategorySelections(),
      score_number: scoreNumber,
      detail_score: detailScore,
      profile_score: profileScore,
      pre_description_score: preDescriptionScore,
    };

    if (item) {
      updateMatrix.mutate({ id: item.id, ...matrixData }, { onSuccess: () => onOpenChange(false) });
    } else {
      createMatrix.mutate(matrixData, { onSuccess: () => onOpenChange(false) });
    }
  };

  const showValidationAlert =
    !isFormValid &&
    (totalSelected > 0 || scoreNumber > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Hash className="h-6 w-6 text-primary" />
            {item ? "Editar Combinação" : "Nova Combinação de Score"}
          </DialogTitle>
          <DialogDescription>
            Selecione itens em uma ou mais categorias e defina o score correspondente
          </DialogDescription>
          {item?.id && (
            <div className="mt-2">
              <CopyableId id={item.id} label="ID da Matriz" />
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Nome + Preview */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Nome da Combinação</CardTitle>
                <CardDescription className="text-xs">Identifique esta combinação</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Ex: Score Alto - Investidor Agressivo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Itens selecionados</p>
                <div className="grid grid-cols-2 gap-3 max-h-[120px] overflow-y-auto">
                  {categories.map((cat) => (
                    <div key={cat.id} className="text-center">
                      <div className="text-xl font-bold text-primary">
                        {selections[cat.id]?.size || 0}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate" title={cat.name}>
                        {cat.name}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {showValidationAlert && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {totalSelected === 0
                  ? "Selecione ao menos um item de qualquer categoria"
                  : "Defina um score entre 1 e 10"}
              </AlertDescription>
            </Alert>
          )}

          {/* Dynamic category sections */}
          {categories.map((cat) => {
            const catItems = getItemsForCategory(cat.id);
            if (catItems.length === 0) return null;
            const catSelections = selections[cat.id] || new Set();
            return (
              <Card key={cat.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">{cat.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Selecione os itens de {cat.name.toLowerCase()} que se aplicam
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => selectAll(cat.id)}>
                        Todos
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => clearAll(cat.id)}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {catItems.map((catItem) => (
                      <div
                        key={catItem.id}
                        className="flex items-start space-x-3 p-3 rounded-[2px] hover:bg-muted transition-colors"
                      >
                        <Checkbox
                          id={`${cat.id}-${catItem.id}`}
                          checked={catSelections.has(catItem.id)}
                          onCheckedChange={(checked) =>
                            toggleItem(cat.id, catItem.id, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={`${cat.id}-${catItem.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium text-sm">{catItem.name}</div>
                          {catItem.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {catItem.description}
                            </div>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Score Value */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                Valor do Score
              </CardTitle>
              <CardDescription className="text-xs">
                Defina o score de 1 a 10 para esta combinação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                min="1"
                max="10"
                placeholder="Ex: 8"
                value={scoreNumber || ""}
                onChange={(e) => setScoreNumber(parseInt(e.target.value) || 0)}
                className="max-w-xs"
              />
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Informações Adicionais
              </CardTitle>
              <CardDescription className="text-xs">Campos opcionais para contexto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <User className="h-3.5 w-3.5" />
                  Perfil do Lead
                </label>
                <Textarea
                  placeholder="Descreva o perfil típico do lead com este score"
                  value={profileScore}
                  onChange={(e) => setProfileScore(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Pré-descrição</label>
                <Textarea
                  placeholder="Informações contextuais sobre este score"
                  value={preDescriptionScore}
                  onChange={(e) => setPreDescriptionScore(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Detalhes</label>
                <Textarea
                  placeholder="Detalhes e observações adicionais"
                  value={detailScore}
                  onChange={(e) => setDetailScore(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="sticky bottom-0 bg-background border-t border-border pt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {!isFormValid && "Preencha todos os campos obrigatórios"}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid || createMatrix.isPending || updateMatrix.isPending}
              >
                {item ? "Atualizar" : "Criar Combinação"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
