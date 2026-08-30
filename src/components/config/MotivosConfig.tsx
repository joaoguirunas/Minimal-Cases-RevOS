import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { useMotivosPerda } from '@/hooks/useMotivosPerda';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';

interface MotivosConfigProps {
  selectedTenantId?: string;
}

const MotivosConfig = ({ selectedTenantId }: MotivosConfigProps) => {
  const { t } = useTranslation();
  const { motivos, loading, addMotivo, updateMotivo, deleteMotivo } = useMotivosPerda(selectedTenantId);
  const [novoMotivo, setNovoMotivo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');

  const handleAddMotivo = async () => {
    if (!novoMotivo.trim()) { toast.error(t('lossReasons.enterName')); return; }
    try {
      await addMotivo(novoMotivo.trim());
      setNovoMotivo('');
      toast.success(t('lossReasons.addSuccess'));
    } catch {
      toast.error(t('lossReasons.addError'));
    }
  };

  const handleEdit = (id: string, nome: string) => {
    setEditingId(id);
    setEditingNome(nome);
  };

  const handleSaveEdit = async () => {
    if (!editingNome.trim()) { toast.error(t('lossReasons.enterName')); return; }
    try {
      await updateMotivo(editingId!, editingNome.trim());
      setEditingId(null);
      setEditingNome('');
      toast.success(t('lossReasons.updateSuccess'));
    } catch {
      toast.error(t('lossReasons.updateError'));
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingNome('');
  };

  const handleDelete = async (id: string, nome: string) => {
    if (confirm(t('lossReasons.confirmDelete', { name: nome }))) {
      try {
        await deleteMotivo(id);
        toast.success(t('lossReasons.deleteSuccess'));
      } catch {
        toast.error(t('lossReasons.deleteError'));
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-[2px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground">
          {t('settings.sections.lossReasons.title')}
        </h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">
          {t('lossReasons.description')}
        </p>
      </div>

      {/* Add new */}
      <div className="border border-border rounded-[2px] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
          {t('lossReasons.addNew')}
        </p>
        <div className="flex gap-2">
          <Input
            value={novoMotivo}
            onChange={(e) => setNovoMotivo(e.target.value)}
            placeholder={t('lossReasons.placeholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMotivo()}
            className="h-[30px] text-[13px]"
          />
          <Button
            size="sm"
            onClick={handleAddMotivo}
            disabled={!novoMotivo.trim()}
            className="h-[30px] text-xs gap-1.5 flex-shrink-0 rounded-[4px]"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            {t('lossReasons.add')}
          </Button>
        </div>
      </div>

      {/* List */}
      {motivos.length === 0 ? (
        <div className="border border-border rounded-[2px] p-8 text-center">
          <p className="text-[13px] text-muted-foreground/50">{t('lossReasons.noReasons')}</p>
        </div>
      ) : (
        <div className="border border-border rounded-[2px] overflow-hidden">
          {motivos.map((motivo, index) => (
            <div
              key={motivo.id}
              className={cn(
                "flex items-center px-5 py-3 hover:bg-muted transition-colors",
                index < motivos.length - 1 && "border-b border-border"
              )}
            >
              {editingId === motivo.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingNome}
                    onChange={(e) => setEditingNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="h-[30px] text-[13px] flex-1"
                    autoFocus
                  />
                  <Button variant="ghost" size="sm" onClick={handleSaveEdit} className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-foreground">
                    <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-foreground">
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-[13px] font-normal text-foreground flex-1 truncate">
                    {motivo.name}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(motivo.id, motivo.name)}
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground"
                    >
                      <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(motivo.id, motivo.name)}
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MotivosConfig;
