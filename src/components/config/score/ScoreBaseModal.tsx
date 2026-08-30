import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Item {
  id: string;
  name: string;
  active: boolean;
}

interface ScoreBaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  item: Item | null;
  onSubmit: (data: { name: string; active: boolean }) => void;
  isPending: boolean;
}

export const ScoreBaseModal = ({
  open,
  onOpenChange,
  title,
  item,
  onSubmit,
  isPending,
}: ScoreBaseModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    active: true,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        active: item.active,
      });
    } else {
      setFormData({
        name: '',
        active: true,
      });
    }
  }, [item, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Digite o nome"
              required
              className="rounded-[4px]"
            />
          </div>

          <div>
            <Label htmlFor="active">Status</Label>
            <Select
              value={formData.active ? 'active' : 'inactive'}
              onValueChange={(value) =>
                setFormData({ ...formData, active: value === 'active' })
              }
            >
              <SelectTrigger id="active" className="rounded-[4px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !formData.name.trim()}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};