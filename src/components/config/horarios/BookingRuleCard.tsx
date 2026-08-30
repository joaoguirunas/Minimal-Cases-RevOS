
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { RuleType, BookingRule } from '@/hooks/useBookingRuleSets';

export interface DraftRule extends Omit<BookingRule, 'id' | 'rule_set_id' | 'created_at'> {
  _key: string; // local key for list identity
}

interface Team {
  id: string;
  name: string;
  priority: number | null;
  team_type: string | null;
}

interface User {
  id: string;
  name: string;
}

interface Props {
  rule: DraftRule;
  index: number;
  total: number;
  teams: Team[];
  users: User[];
  onChange: (key: string, updated: Partial<DraftRule>) => void;
  onMoveUp: (key: string) => void;
  onMoveDown: (key: string) => void;
  onRemove: (key: string) => void;
}

const RULE_LABELS: Record<RuleType, string> = {
  team_priority: 'Equipe por prioridade',
  least_busy:    'Menos ocupado',
  random:        'Aleatório',
  round_robin:   'Rodízio',
  specific_user: 'Usuário específico',
};

const RULE_DESCRIPTIONS: Record<RuleType, string> = {
  team_priority: 'Distribui para consultores da equipe com maior prioridade',
  least_busy:    'Escolhe quem tem menos reuniões nos próximos X dias',
  random:        'Sorteia aleatoriamente entre os disponíveis',
  round_robin:   'Rodízio: quem recebeu reunião há mais tempo',
  specific_user: 'Sempre direciona para um usuário específico',
};

const BookingRuleCard = ({ rule, index, total, teams, users, onChange, onMoveUp, onMoveDown, onRemove }: Props) => {
  const cfg = rule.config as Record<string, any>;

  const setConfig = (patch: Record<string, any>) =>
    onChange(rule._key, { config: { ...cfg, ...patch } });

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-[4px] border border-border bg-card">
      {/* Drag handle / order */}
      <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
        <button
          onClick={() => onMoveUp(rule._key)}
          disabled={index === 0}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-20 transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <span className="text-[10px] text-muted-foreground/50 text-center leading-none font-mono">
          {index + 1}
        </span>
        <button
          onClick={() => onMoveDown(rule._key)}
          disabled={index === total - 1}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-20 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Type selector */}
      <div className="flex-1 min-w-0 space-y-2">
        <Select
          value={rule.rule_type}
          onValueChange={val => onChange(rule._key, { rule_type: val as RuleType, config: {} })}
        >
          <SelectTrigger className="h-[30px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RULE_LABELS) as RuleType[]).map(rt => (
              <SelectItem key={rt} value={rt} className="text-xs">
                {RULE_LABELS[rt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground/70 leading-tight">
          {RULE_DESCRIPTIONS[rule.rule_type]}
        </p>

        {/* Config fields by type */}
        {rule.rule_type === 'team_priority' && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
              Equipes (vazio = todas)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {teams.map(t => {
                const selected = ((cfg.team_ids as string[]) || []).includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      const current: string[] = cfg.team_ids || [];
                      setConfig({
                        team_ids: selected
                          ? current.filter(id => id !== t.id)
                          : [...current, t.id],
                      });
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted'
                    )}
                  >
                    {t.name}
                    {t.priority !== null && (
                      <span className={cn('ml-1', selected ? 'opacity-70' : 'opacity-40')}>
                        #{t.priority}
                      </span>
                    )}
                  </button>
                );
              })}
              {teams.length === 0 && (
                <span className="text-[10px] text-muted-foreground/50">Nenhuma equipe cadastrada</span>
              )}
            </div>
          </div>
        )}

        {rule.rule_type === 'least_busy' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Janela de dias:</span>
            <Input
              type="number"
              min={1}
              max={90}
              value={cfg.days_lookback ?? 7}
              onChange={e => setConfig({ days_lookback: parseInt(e.target.value) || 7 })}
              className="h-6 w-16 text-xs"
            />
            <span className="text-[10px] text-muted-foreground">dias</span>
          </div>
        )}

        {rule.rule_type === 'specific_user' && (
          <Select
            value={cfg.user_id || ''}
            onValueChange={val => setConfig({ user_id: val })}
          >
            <SelectTrigger className="h-[30px] text-xs">
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="w-6 h-6 shrink-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/8"
        onClick={() => onRemove(rule._key)}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

export default BookingRuleCard;
