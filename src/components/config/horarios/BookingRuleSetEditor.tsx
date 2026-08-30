
import { useState, useEffect } from 'react';
import { Plus, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useTeams } from '@/hooks/useTeamsNew';
import { useUsers } from '@/hooks/useUsersNew';
import {
  useCreateBookingRuleSet,
  useUpdateBookingRuleSet,
  useUpsertBookingRules,
  BookingRuleSet,
} from '@/hooks/useBookingRuleSets';
import BookingRuleCard, { DraftRule } from './BookingRuleCard';
import type { RuleType } from '@/hooks/useBookingRuleSets';

interface Props {
  open: boolean;
  onClose: () => void;
  existing?: BookingRuleSet | null;
}

const newDraft = (): DraftRule => ({
  _key: Math.random().toString(36).slice(2),
  order_index: 0,
  rule_type: 'team_priority',
  config: { team_ids: [] },
  is_active: true,
});

const BookingRuleSetEditor = ({ open, onClose, existing }: Props) => {
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [rules, setRules]         = useState<DraftRule[]>([]);
  const [copied, setCopied]       = useState(false);

  const { data: teams = [] } = useTeams();
  const { data: users = [] } = useUsers();

  const create  = useCreateBookingRuleSet();
  const update  = useUpdateBookingRuleSet();
  const upsert  = useUpsertBookingRules();

  const saving = create.isPending || update.isPending || upsert.isPending;

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setDesc(existing.description || '');
      setIsDefault(existing.is_default);
      setRules(
        (existing.booking_rules || []).map(r => ({
          _key: Math.random().toString(36).slice(2),
          order_index: r.order_index,
          rule_type: r.rule_type as RuleType,
          config: r.config as Record<string, unknown>,
          is_active: r.is_active,
        }))
      );
    } else {
      setName('');
      setDesc('');
      setIsDefault(false);
      setRules([newDraft()]);
    }
  }, [open, existing]);

  const addRule = () =>
    setRules(prev => [...prev, { ...newDraft(), order_index: prev.length }]);

  const changeRule = (key: string, patch: Partial<DraftRule>) =>
    setRules(prev => prev.map(r => (r._key === key ? { ...r, ...patch } : r)));

  const removeRule = (key: string) =>
    setRules(prev => prev.filter(r => r._key !== key));

  const moveUp = (key: string) =>
    setRules(prev => {
      const idx = prev.findIndex(r => r._key === key);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });

  const moveDown = (key: string) =>
    setRules(prev => {
      const idx = prev.findIndex(r => r._key === key);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });

  const handleSave = async () => {
    if (!name.trim()) return;

    const payload = { name: name.trim(), description: description.trim() || undefined, is_default: isDefault };
    const orderedRules = rules.map((r, i) => ({
      order_index: i + 1,
      rule_type: r.rule_type,
      config: r.config,
      is_active: r.is_active,
    }));

    if (existing) {
      await update.mutateAsync({ id: existing.id, ...payload });
      await upsert.mutateAsync({ ruleSetId: existing.id, rules: orderedRules });
    } else {
      const created = await create.mutateAsync(payload);
      await upsert.mutateAsync({ ruleSetId: (created as any).id, rules: orderedRules });
    }

    onClose();
  };

  const exampleUrl = existing
    ? `${window.location.origin}/agendar/{leadId}?r=${existing.id}`
    : null;

  const copyUrl = () => {
    if (!exampleUrl) return;
    navigator.clipboard.writeText(exampleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar conjunto' : 'Novo conjunto de regras'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Inbound Geral"
              className="h-8 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Descreva quando usar este conjunto"
              className="h-8 text-sm"
            />
          </div>

          {/* Is default */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Conjunto padrão</p>
              <p className="text-[11px] text-muted-foreground">
                Usado quando a URL não especifica um conjunto
              </p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <Separator />

          {/* Rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Regras de distribuição
              </p>
              <Button variant="outline" size="sm" onClick={addRule} className="h-6 text-xs gap-1 px-2">
                <Plus className="w-3 h-3" />
                Adicionar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              As regras são aplicadas em ordem. A primeira que retornar um candidato disponível é usada.
            </p>
            <div className="space-y-1.5">
              {rules.map((r, idx) => (
                <BookingRuleCard
                  key={r._key}
                  rule={r}
                  index={idx}
                  total={rules.length}
                  teams={teams.map(t => ({ id: t.id, name: t.nome || t.name || '', priority: t.prioridade ?? t.priority ?? null, team_type: t.tipo || t.team_type || null }))}
                  users={users.map(u => ({ id: u.id, name: u.name || u.nome || '' }))}
                  onChange={changeRule}
                  onMoveUp={moveUp}
                  onMoveDown={moveDown}
                  onRemove={removeRule}
                />
              ))}
            </div>
          </div>

          {/* URL example */}
          {exampleUrl && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                  URL de exemplo
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] bg-muted px-2 py-1.5 rounded-[4px] truncate text-muted-foreground">
                    {exampleUrl}
                  </code>
                  <Button variant="outline" size="icon" className="w-7 h-7 shrink-0" onClick={copyUrl}>
                    {copied
                      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookingRuleSetEditor;
