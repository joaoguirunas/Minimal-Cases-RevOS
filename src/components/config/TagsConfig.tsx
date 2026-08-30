import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Check, X, Tag } from 'lucide-react';
import { useLeadTags, type LeadTag } from '@/hooks/useLeadTags';
import { toast } from 'sonner';

interface EditState {
  name: string;
  color: string;
}

const EMPTY_EDIT: EditState = { name: '', color: '#3B82F6' };

export default function TagsConfig() {
  const { tags, isLoading, addTag, updateTag, deleteTag, isMutating } = useLeadTags(false);

  const [form, setForm] = useState<EditState>(EMPTY_EDIT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY_EDIT);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome da tag'); return; }
    try {
      await addTag({ name: form.name.trim(), color: form.color });
      setForm(EMPTY_EDIT);
      toast.success('Tag adicionada');
    } catch {
      // error toast handled by hook
    }
  };

  const startEdit = (tag: LeadTag) => {
    setEditingId(tag.id);
    setEditState({ name: tag.name, color: tag.color });
  };

  const handleSaveEdit = async () => {
    if (!editState.name.trim()) { toast.error('Informe o nome da tag'); return; }
    try {
      await updateTag(editingId!, { name: editState.name.trim(), color: editState.color });
      setEditingId(null);
      toast.success('Tag atualizada');
    } catch {
      // error toast handled by hook
    }
  };

  const handleToggleActive = async (tag: LeadTag) => {
    try {
      await updateTag(tag.id, { active: !tag.active });
    } catch {
      // error toast handled by hook
    }
  };

  const handleDelete = async (tag: LeadTag) => {
    if (!confirm(`Remover tag "${tag.name}"? Ela será desmarcada de todos os leads que a usam.`)) return;
    try {
      await deleteTag(tag.id);
      toast.success('Tag removida');
    } catch {
      // error toast handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-[2px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          Tags
        </h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">
          Tags globais pra marcar leads no CRM e filtrar no CRM/Omni. A visibilidade de
          cada tag por equipe é definida em Times.
        </p>
      </div>

      {/* Add form */}
      <div className="border border-border rounded-[2px] p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Nova tag
        </p>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ex: Turma 1"
              className="h-[30px] text-[13px]"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Cor</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-10 h-[30px] p-1 cursor-pointer"
              />
              <Input
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="#3B82F6"
                className="h-[30px] w-[100px] text-[13px] font-mono"
              />
            </div>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!form.name.trim() || isMutating}
          className="h-[30px] text-xs gap-1.5 rounded-[4px]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Adicionar tag
        </Button>
      </div>

      {/* List */}
      {tags.length === 0 ? (
        <div className="border border-border rounded-[2px] p-8 text-center">
          <p className="text-[13px] text-muted-foreground/50">Nenhuma tag cadastrada</p>
        </div>
      ) : (
        <div className="border border-border rounded-[2px] overflow-hidden">
          {tags.map((tag, index) => (
            <div
              key={tag.id}
              className={cn(
                'px-4 py-3 hover:bg-muted/40 transition-colors',
                index < tags.length - 1 && 'border-b border-border',
              )}
            >
              {editingId === tag.id ? (
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={editState.color}
                    onChange={(e) => setEditState((s) => ({ ...s, color: e.target.value }))}
                    className="w-10 h-[28px] p-1 cursor-pointer shrink-0"
                  />
                  <Input
                    value={editState.name}
                    onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Nome"
                    className="h-[28px] text-[12px] flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <Button variant="ghost" size="sm" onClick={handleSaveEdit} disabled={isMutating}
                    className="h-[28px] w-[28px] p-0 text-muted-foreground/60 hover:text-foreground shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}
                    className="h-[28px] w-[28px] p-0 text-muted-foreground/60 hover:text-foreground shrink-0">
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-tight truncate">{tag.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={tag.active}
                      onCheckedChange={() => handleToggleActive(tag)}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="sm" onClick={() => startEdit(tag)}
                      className="h-[28px] w-[28px] p-0 text-muted-foreground/50 hover:text-foreground">
                      <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(tag)}
                      className="h-[28px] w-[28px] p-0 text-muted-foreground/50 hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
