import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Zap, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useCannedResponses, useCreateCannedResponse, useUpdateCannedResponse, useDeleteCannedResponse, type CannedResponse } from '@/hooks/useCannedResponses';

interface Props {
  open: boolean;
  onClose: () => void;
}

const emptyForm = { title: '', shortcut: '', content: '' };

export const CannedResponsesModal = ({ open, onClose }: Props) => {
  const { data: responses = [] } = useCannedResponses();
  const create = useCreateCannedResponse();
  const update = useUpdateCannedResponse();
  const remove = useDeleteCannedResponse();

  const [form, setForm]         = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    if (editingId) {
      await update.mutateAsync({ id: editingId, ...form });
    } else {
      await create.mutateAsync(form);
    }
    resetForm();
  };

  const handleEdit = (r: CannedResponse) => {
    setForm({ title: r.title, shortcut: r.shortcut || '', content: r.content });
    setEditingId(r.id);
    setShowForm(true);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Zap className="w-4 h-4 text-yellow-500" />
            Respostas Padrão
          </DialogTitle>
          <p className="text-[12px] text-muted-foreground/70 mt-0.5">
            Digite <kbd className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">/</kbd> no compositor para usar
          </p>
        </DialogHeader>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {responses.length === 0 && !showForm && (
            <p className="text-[13px] text-muted-foreground/60 text-center py-6">Nenhuma resposta cadastrada ainda.</p>
          )}
          {responses.map(r => (
            <div key={r.id} className="group flex items-start gap-2 rounded-[2px] border border-border bg-card px-3 py-2.5 hover:bg-accent/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[13px] font-medium truncate">{r.title}</span>
                  {r.shortcut && (
                    <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-card text-muted-foreground border border-border">
                      /{r.shortcut}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground/70 truncate">{r.content}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(r)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                {confirmDelete === r.id ? (
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                      onClick={async () => { await remove.mutateAsync(r.id); setConfirmDelete(null); }}>
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => setConfirmDelete(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:text-destructive"
                    onClick={() => setConfirmDelete(r.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Formulário inline */}
        {showForm && (
          <div className="border-t px-4 py-3 space-y-2.5 bg-card">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {editingId ? 'Editar resposta' : 'Nova resposta'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground/70">Título *</label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Saudação inicial"
                  className="h-[30px] text-[13px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground/70">Atalho (opcional)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-[13px]">/</span>
                  <Input
                    value={form.shortcut}
                    onChange={e => setForm(f => ({ ...f, shortcut: e.target.value.replace(/\s/g, '').toLowerCase() }))}
                    placeholder="ola"
                    className="h-[30px] text-[13px] pl-5"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground/70">Mensagem *</label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Texto completo da resposta..."
                className="text-[13px] min-h-[80px] resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm} className="h-[30px] text-[12px]">Cancelar</Button>
              <Button size="sm" onClick={handleSave}
                disabled={!form.title.trim() || !form.content.trim() || create.isPending || update.isPending}
                className="h-[30px] text-[12px]">
                {create.isPending || update.isPending ? 'Salvando…' : editingId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t px-4 py-2.5 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-[30px] text-[12px] gap-1.5"
            onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-3.5 h-3.5" />Nova resposta
          </Button>
          <Button variant="ghost" size="sm" className="h-[30px] text-[12px]" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
