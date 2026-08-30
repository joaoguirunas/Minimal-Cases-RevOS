
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit2, Trash2, Check, X, StickyNote } from 'lucide-react';
import { useNegocioNotas, useCriarNota, useAtualizarNota, useDeletarNota } from '@/hooks/useNegocioNotas';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NegocioNotasProps {
  negocioId: string;
}

const NegocioNotas = ({ negocioId }: NegocioNotasProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newTitulo, setNewTitulo] = useState('');
  const [newConteudo, setNewConteudo] = useState('');
  const [editTitulo, setEditTitulo] = useState('');
  const [editConteudo, setEditConteudo] = useState('');

  const { data: notas = [], isLoading } = useNegocioNotas(negocioId);
  const criarNota = useCriarNota();
  const atualizarNota = useAtualizarNota();
  const deletarNota = useDeletarNota();

  const handleCreate = async () => {
    if (!newTitulo.trim()) return;
    try {
      await criarNota.mutateAsync({ negocioId, titulo: newTitulo.trim(), conteudo: newConteudo.trim() });
      setNewTitulo('');
      setNewConteudo('');
      setIsCreating(false);
      toast.success("Nota criada!");
    } catch {
      toast.error("Erro ao criar nota");
    }
  };

  const handleStartEdit = (nota: any) => {
    setEditingId(nota.id);
    setEditTitulo(nota.titulo);
    setEditConteudo(nota.conteudo || '');
  };

  const handleUpdate = async () => {
    if (!editingId || !editTitulo.trim()) return;
    try {
      await atualizarNota.mutateAsync({ id: editingId, titulo: editTitulo.trim(), conteudo: editConteudo.trim() });
      setEditingId(null);
      toast.success("Nota atualizada!");
    } catch {
      toast.error("Erro ao atualizar nota");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletarNota.mutateAsync(id);
      setConfirmDeleteId(null);
      toast.success("Nota excluída");
    } catch {
      toast.error("Erro ao excluir nota");
    }
  };

  const cancelCreate = () => {
    setIsCreating(false);
    setNewTitulo('');
    setNewConteudo('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitulo('');
    setEditConteudo('');
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="border border-border rounded-[2px] overflow-hidden animate-pulse">
            <div className="px-4 py-3 space-y-2">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Notas {notas.length > 0 && <span className="ml-1 normal-case font-normal">({notas.length})</span>}
        </p>
        {!isCreating && (
          <Button
            onClick={() => setIsCreating(true)}
            variant="outline"
            className="h-[30px] px-2.5 text-xs gap-1 border-border rounded-[4px]"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Nova nota
          </Button>
        )}
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="border border-border rounded-[2px] overflow-hidden">
          <div className="px-4 py-3 space-y-3 bg-background">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Título</label>
              <Input
                placeholder="Título da nota..."
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                className="h-8 text-[13px]"
                autoFocus
                onKeyDown={(e) => e.key === 'Escape' && cancelCreate()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Conteúdo</label>
              <Textarea
                placeholder="Escreva o conteúdo da nota..."
                value={newConteudo}
                onChange={(e) => setNewConteudo(e.target.value)}
                className="text-[13px] resize-none min-h-[80px]"
                rows={3}
              />
            </div>
            <div className="flex gap-1.5 justify-end">
              <Button variant="ghost" className="h-[30px] px-2.5 text-xs rounded-[4px]" onClick={cancelCreate}>
                Cancelar
              </Button>
              <Button
                className="h-[30px] px-2.5 text-xs gap-1 rounded-[4px]"
                onClick={handleCreate}
                disabled={criarNota.isPending || !newTitulo.trim()}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {notas.length === 0 && !isCreating && (
        <div className="border border-border rounded-[2px] overflow-hidden">
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <StickyNote className="w-7 h-7 text-muted-foreground/20 mb-2" strokeWidth={1} />
            <p className="text-[13px] font-medium text-foreground/50">Nenhuma nota</p>
            <p className="text-[12px] text-muted-foreground/40 mt-0.5">Adicione notas importantes sobre este negócio.</p>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notas.length > 0 && (
        <div className="border border-border rounded-[2px] overflow-hidden divide-y divide-white/[0.04]">
          {notas.map((nota: any) => (
            <div key={nota.id} className={cn("bg-card", editingId === nota.id && "bg-background")}>

              {editingId === nota.id ? (
                /* Edit form */
                <div className="px-4 py-3 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Título</label>
                    <Input
                      value={editTitulo}
                      onChange={(e) => setEditTitulo(e.target.value)}
                      className="h-8 text-[13px]"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Conteúdo</label>
                    <Textarea
                      value={editConteudo}
                      onChange={(e) => setEditConteudo(e.target.value)}
                      className="text-[13px] resize-none min-h-[80px]"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <Button variant="ghost" className="h-[30px] px-2.5 text-xs rounded-[4px]" onClick={cancelEdit}>
                      Cancelar
                    </Button>
                    <Button
                      className="h-[30px] px-2.5 text-xs gap-1 rounded-[4px]"
                      onClick={handleUpdate}
                      disabled={atualizarNota.isPending || !editTitulo.trim()}
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                /* Note view */
                <div className="px-4 py-3 group">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[13px] font-medium text-foreground leading-snug">{nota.titulo}</p>
                    {/* Actions — shown on hover, unless confirm delete is active */}
                    <div className={cn(
                      "flex items-center gap-0.5 flex-none transition-opacity",
                      confirmDeleteId === nota.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      {confirmDeleteId === nota.id ? (
                        <>
                          <span className="text-[11px] text-muted-foreground/60 mr-1">Excluir?</span>
                          <Button
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(nota.id)}
                            disabled={deletarNota.isPending}
                          >
                            <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground/60"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground"
                            onClick={() => handleStartEdit(nota)}
                          >
                            <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-destructive"
                            onClick={() => setConfirmDeleteId(nota.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {nota.conteudo && (
                    <p className="text-[12px] text-muted-foreground/60 whitespace-pre-wrap leading-relaxed mb-2">
                      {nota.conteudo}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/35">
                    {format(new Date(nota.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NegocioNotas;
