
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Star, GitBranch, Copy, Check, Link2, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useBookingRuleSets, useDeleteBookingRuleSet, BookingRuleSet } from '@/hooks/useBookingRuleSets';
import { supabase } from '@/integrations/supabase/client';
import BookingRuleSetEditor from './BookingRuleSetEditor';

const RULE_TYPE_LABELS: Record<string, string> = {
  team_priority: 'Equipe',
  least_busy:    'Menos ocupado',
  random:        'Aleatório',
  round_robin:   'Rodízio',
  specific_user: 'Usuário fixo',
};

const DURATIONS = [15, 30, 45, 60];

// ── URL Simulator ─────────────────────────────────────────────────────────────

interface LeadOption { id: string; label: string }

const UrlSimulator = ({ ruleSets }: { ruleSets: BookingRuleSet[] }) => {
  const [search,       setSearch]       = useState('');
  const [leads,        setLeads]        = useState<LeadOption[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [duration,     setDuration]     = useState(30);
  const [ruleSetId,    setRuleSetId]    = useState<string>('default');
  const [copied,       setCopied]       = useState(false);

  // Debounced lead search
  useEffect(() => {
    if (search.length < 2) { setLeads([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await (supabase as any)
        .from('leads')
        .select('id, title, clients_people(name)')
        .ilike('title', `%${search}%`)
        .limit(8);
      setLeads(
        (data || []).map((d: any) => ({
          id: d.id,
          label: `${d.title || '(sem título)'}${d.clients_people?.name ? ' — ' + d.clients_people.name : ''}`,
        }))
      );
      setSearching(false);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const defaultRuleSet = ruleSets.find(rs => rs.is_default);
  const selectedRuleSet = ruleSetId === 'default'
    ? defaultRuleSet
    : ruleSets.find(rs => rs.id === ruleSetId);

  // Always include ?r= — use url_id (1, 2, 3…) if available, fallback to UUID
  const ruleSetParam = selectedRuleSet
    ? (selectedRuleSet.url_id != null ? String(selectedRuleSet.url_id) : selectedRuleSet.id)
    : null;
  const ruleSetUrlParam = ruleSetParam ? `&r=${ruleSetParam}` : '';

  const generatedUrl = selectedLead
    ? `${window.location.origin}/agendar/${selectedLead.id}?d=${duration}${ruleSetUrlParam}`
    : null;

  const copyUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground" />
          Simulador de URL
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Gere a URL de agendamento para enviar ao cliente ou configurar no agente de IA.
        </p>
      </div>

      <div className="rounded-[4px] border border-border bg-muted p-4 space-y-4">
        {/* Lead search */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
            1. Selecione o negócio/lead
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
            <Input
              value={selectedLead ? selectedLead.label : search}
              onChange={e => {
                setSelectedLead(null);
                setSearch(e.target.value);
              }}
              onFocus={() => search.length >= 2 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Buscar negócio pelo título..."
              className="h-[30px] pl-8 text-xs"
            />
            {searching && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
            )}
            {showDropdown && leads.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-[4px] overflow-hidden">
                {leads.map(lead => (
                  <button
                    key={lead.id}
                    onMouseDown={() => {
                      setSelectedLead(lead);
                      setSearch('');
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors truncate"
                  >
                    {lead.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedLead && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              {selectedLead.label}
              <button
                onClick={() => { setSelectedLead(null); setSearch(''); }}
                className="ml-1 text-muted-foreground/50 hover:text-muted-foreground"
              >×</button>
            </p>
          )}
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
            2. Duração
          </p>
          <div className="flex gap-1.5">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={cn(
                  'flex-1 py-1.5 rounded-[4px] text-xs font-medium border transition-colors',
                  duration === d
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {d}min
              </button>
            ))}
          </div>
        </div>

        {/* Rule set */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
            3. Conjunto de regras
          </p>
          <div className="relative">
            <select
              value={ruleSetId}
              onChange={e => setRuleSetId(e.target.value)}
              className="w-full h-[30px] text-xs bg-card border border-border rounded-[4px] px-2 pr-7 appearance-none text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="default">
                Padrão{defaultRuleSet ? ` (${defaultRuleSet.name})` : ''}
              </option>
              {ruleSets.filter(rs => !rs.is_default).map(rs => (
                <option key={rs.id} value={rs.id}>{rs.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
          </div>
          {selectedRuleSet && (
            <div className="flex items-center gap-1 flex-wrap">
              {(selectedRuleSet.booking_rules || []).map((r, i) => (
                <span key={r.id} className="flex items-center gap-0.5">
                  {i > 0 && <span className="text-[9px] text-muted-foreground/40">→</span>}
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {RULE_TYPE_LABELS[r.rule_type] || r.rule_type}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Generated URL */}
        <div className="space-y-2">
          <Separator />

          {/* URL de agendamento */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              URL de agendamento
            </p>
            <div className="flex items-center gap-2">
              <code className={cn(
                'flex-1 text-[10px] px-2.5 py-2 rounded-[4px] truncate font-mono border',
                generatedUrl
                  ? 'bg-card border-border text-foreground'
                  : 'bg-muted border-border text-muted-foreground/40 italic'
              )}>
                {generatedUrl || `${window.location.origin}/agendar/{leadId}?d=${duration}...`}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="w-[30px] h-[30px] shrink-0"
                disabled={!generatedUrl}
                onClick={() => generatedUrl && copyUrl(generatedUrl)}
                title="Copiar URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              Envie esta URL para o cliente ou configure no agente de IA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const BookingDistribuicaoConfig = () => {
  const { data: ruleSets = [], isLoading } = useBookingRuleSets();
  const deleteSet = useDeleteBookingRuleSet();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BookingRuleSet | null>(null);
  const [copiedId,   setCopiedId]   = useState<string | null>(null);

  const openNew   = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit  = (rs: BookingRuleSet) => { setEditTarget(rs); setEditorOpen(true); };
  const closeEdit = () => { setEditorOpen(false); setEditTarget(null); };

  const copyUrl = (rs: BookingRuleSet) => {
    const rParam = rs.url_id != null ? rs.url_id : rs.id;
    navigator.clipboard.writeText(`${window.location.origin}/agendar/{leadId}?d=30&r=${rParam}`);
    setCopiedId(rs.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-[4px] bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Rule sets ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              Conjuntos de regras
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Define qual consultor recebe cada agendamento público.
            </p>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1.5 h-[30px] text-xs shrink-0">
            <Plus className="w-3.5 h-3.5" />
            Novo conjunto
          </Button>
        </div>

        {ruleSets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-[4px]">
            <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum conjunto de regras</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {ruleSets.map(rs => {
              const ruleCount = (rs.booking_rules || []).length;
              return (
                <div
                  key={rs.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-[4px] border transition-colors',
                    rs.is_default
                      ? 'border-primary/30 bg-primary/[0.02]'
                      : 'border-border bg-card'
                  )}
                >
                  {rs.is_default
                    ? <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" />
                    : <div className="w-3.5 h-3.5 shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {rs.url_id != null && (
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 shrink-0">
                          #{rs.url_id}
                        </span>
                      )}
                      <span className="text-sm font-medium text-foreground">{rs.name}</span>
                      {rs.is_default && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-400/60 text-amber-600 dark:text-amber-400">
                          Padrão
                        </Badge>
                      )}
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                        {ruleCount} {ruleCount === 1 ? 'regra' : 'regras'}
                      </Badge>
                    </div>
                    {rs.description && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{rs.description}</p>
                    )}
                    {ruleCount > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {(rs.booking_rules || []).map((r, i) => (
                          <span key={r.id} className="flex items-center gap-0.5">
                            {i > 0 && <span className="text-[9px] text-muted-foreground/40">→</span>}
                            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                              {RULE_TYPE_LABELS[r.rule_type] || r.rule_type}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="w-[30px] h-[30px] text-muted-foreground hover:text-foreground"
                      title="Copiar URL de exemplo" onClick={() => copyUrl(rs)}>
                      {copiedId === rs.id
                        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-[30px] h-[30px] text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(rs)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon"
                      className="w-[30px] h-[30px] text-muted-foreground hover:text-rose-500 hover:bg-rose-500/8"
                      disabled={rs.is_default} onClick={() => deleteSet.mutate(rs.id)}
                      title={rs.is_default ? 'O conjunto padrão não pode ser removido' : 'Remover'}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* ── URL Simulator ──────────────────────────────────────────────── */}
      <UrlSimulator ruleSets={ruleSets} />

      <BookingRuleSetEditor open={editorOpen} onClose={closeEdit} existing={editTarget} />
    </div>
  );
};

export default BookingDistribuicaoConfig;
