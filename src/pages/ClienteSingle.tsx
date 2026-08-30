import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Save, Trash2, Building2, Check, ChevronsUpDown, X, Loader2,
  Mail, Phone, FileText, User, Bot, Instagram, AtSign, Globe,
  TrendingUp, Target, Lightbulb, BarChart2, MessageSquare, GitMerge,
} from 'lucide-react';
import { useAtualizarPessoaComplete } from '@/hooks/useAtualizarPessoaComplete';
import { useCompanies } from '@/hooks/useCompanies';
import { usePeopleCompanies, useUpdatePeopleCompanies } from '@/hooks/usePeopleCompanies';
import { PersonScoreSection } from '@/components/common/PersonScoreSection';
import { ExtraFieldsCard } from '@/components/pessoas/ExtraFieldsCard';
import ExcluirPessoaModal from '@/components/modals/ExcluirPessoaModal';
import { useDeletarPessoa } from '@/hooks/useDeletarPessoa';
import { useNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import type { PeopleCompany } from '@/hooks/usePeopleCompanies';

type ClientePessoaRow = Database['public']['Tables']['clients_people']['Row'];
type ClientePessoa = ClientePessoaRow & {
  score_matrix: { id: string; score_number: number | null } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

const SOURCE_OPTIONS = [
  { value: '', label: 'Não definido' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'cold_outreach', label: 'Prospecção ativa' },
  { value: 'evento', label: 'Evento' },
  { value: 'manual', label: 'Manual' },
  { value: 'outros', label: 'Outros' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Não definido' },
  { value: 'lead', label: 'Lead' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'parceiro', label: 'Parceiro' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'outros', label: 'Outros' },
];

const DISC_OPTIONS = [
  { value: '', label: 'Não definido' },
  { value: 'D', label: 'D — Dominância' },
  { value: 'I', label: 'I — Influência' },
  { value: 'S', label: 'S — Estabilidade' },
  { value: 'C', label: 'C — Conformidade' },
];

const SERVICE_STATUS_OPTIONS = [
  { value: 'open', label: 'Em aberto' },
  { value: 'in_service', label: 'Em atendimento' },
  { value: 'closed', label: 'Encerrado' },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border rounded-[4px] bg-card">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">{label}</Label>
      {children}
    </div>
  );
}

function IconInput({
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[30px] text-[13px] pl-8"
      />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const ClienteSingle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setNavigationState, clearNavigationState } = useNavigation();

  const { mutate: atualizarPessoa, isPending } = useAtualizarPessoaComplete();
  const { mutate: deletarPessoa, isPending: isDeletingPessoa } = useDeletarPessoa();
  const [showExcluirModal, setShowExcluirModal] = useState(false);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [hasInitializedForm, setHasInitializedForm] = useState(false);

  const { data: companies = [] } = useCompanies();
  const { data: personCompanies = [] } = usePeopleCompanies(id || '');
  const { mutate: updatePeopleCompanies } = useUpdatePeopleCompanies();

  // ── Data ─────────────────────────────────────────────────────────────────────

  const { data: pessoa, isLoading } = useQuery({
    queryKey: ['pessoa-single', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('clients_people')
        .select('*, score_matrix(id, score_number)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as ClientePessoa;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ── Form state ────────────────────────────────────────────────────────────────

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    telefone: '',
    documento: '',
    instagram_handle: '',
    status: 'active',
    service_status: 'open',
    observacoes: '',
    aceita_ligacao: true,
    ai_enabled: true,
    tipo: '',
    source: '',
    income: '',
    moment: '',
    goal: '',
    disc_profile: '',
    disc_summary: '',
    score_objective_id: '',
    score_investment_id: '',
    score_framing_id: '',
    score_matrix_id: null as string | null,
  });

  const set = (key: keyof typeof formData) => (value: string | boolean | null) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  // ── Effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (pessoa) {
      setNavigationState({
        showBackButton: true,
        leadName: pessoa.name || 'Cliente',
        onBack: () => navigate(-1),
      });
    }
  }, [pessoa, navigate, setNavigationState]);

  useEffect(() => {
    return () => { clearNavigationState(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setHasInitializedForm(false); }, [id]);

  useEffect(() => {
    if (pessoa && !hasInitializedForm) {
      setFormData({
        nome: pessoa.name || '',
        email: pessoa.email || '',
        whatsapp: pessoa.whatsapp || '',
        telefone: (pessoa as any).telefone || '',
        documento: pessoa.document || '',
        instagram_handle: pessoa.instagram_handle || '',
        status: pessoa.status || 'active',
        service_status: pessoa.service_status || 'open',
        observacoes: pessoa.notes || '',
        aceita_ligacao: pessoa.accepts_calls ?? true,
        ai_enabled: pessoa.ai_enabled ?? true,
        tipo: pessoa.type || '',
        source: pessoa.source || '',
        income: pessoa.income || '',
        moment: pessoa.moment || '',
        goal: pessoa.goal || '',
        disc_profile: pessoa.disc_profile || '',
        disc_summary: pessoa.disc_summary || '',
        score_objective_id: pessoa.score_objective_id || '',
        score_investment_id: pessoa.score_investment_id || '',
        score_framing_id: pessoa.score_framing_id || '',
        score_matrix_id: pessoa.score_matrix_id || null,
      });
      setHasInitializedForm(true);
    }
  }, [pessoa, hasInitializedForm]);

  useEffect(() => {
    setSelectedCompanyIds(personCompanies.map((pc: PeopleCompany) => pc.company_id).filter(Boolean));
  }, [personCompanies]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleToggleCompany = (companyId: string) => {
    setSelectedCompanyIds(prev =>
      prev.includes(companyId) ? prev.filter(i => i !== companyId) : [...prev, companyId]
    );
  };

  const handleSave = async () => {
    if (!formData.nome.trim() || !id) return;

    updatePeopleCompanies({ peopleId: id, companyIds: selectedCompanyIds });

    if (selectedCompanyIds.length > 0) {
      await supabase
        .from('leads')
        .update({ company_id: selectedCompanyIds[0] })
        .eq('people_id', id)
        .neq('status', 'lost');
    }

    atualizarPessoa({
      id,
      nome: formData.nome,
      email: formData.email || undefined,
      whatsapp: formData.whatsapp || undefined,
      telefone: formData.telefone || undefined,
      documento: formData.documento || undefined,
      instagram_handle: formData.instagram_handle || undefined,
      status: formData.status,
      service_status: formData.service_status || undefined,
      observacoes: formData.observacoes || undefined,
      aceita_ligacao: formData.aceita_ligacao,
      ai_enabled: formData.ai_enabled,
      tipo: formData.tipo || undefined,
      source: formData.source || undefined,
      income: formData.income || undefined,
      moment: formData.moment || undefined,
      goal: formData.goal || undefined,
      disc_profile: formData.disc_profile || undefined,
      disc_summary: formData.disc_summary || undefined,
      score_objective_id: formData.score_objective_id || undefined,
      score_investment_id: formData.score_investment_id || undefined,
      score_framing_id: formData.score_framing_id || undefined,
    }, {
      onSuccess: () => toast.success('Cliente atualizado!'),
    });
  };

  const handleScoreMatrixIdChange = useCallback((matId: string | null) => {
    setFormData(prev => ({ ...prev, score_matrix_id: matId }));
  }, []);

  // ── Loading / not found ───────────────────────────────────────────────────────

  if (isLoading || (pessoa && !hasInitializedForm)) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Carregando...</span>
      </div>
    );
  }

  if (!pessoa) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-foreground">Cliente não encontrado</p>
          <p className="text-[12px] text-muted-foreground/60">O cliente foi removido ou o link é inválido.</p>
          <Button size="sm" onClick={() => navigate('/crm/clients')} className="h-[30px] px-3 text-xs mt-1 rounded-[4px]">
            Voltar para Clientes
          </Button>
        </div>
      </div>
    );
  }

  const initials = getInitials(pessoa.name || '');
  const scoreNumber = pessoa.score_matrix?.score_number;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-72px)] flex flex-col overflow-hidden">

      {/* ── Top identity bar ────────────────────────────────────────────────── */}
      <div className="flex-none border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[12px] font-bold text-primary leading-none">{initials || '?'}</span>
            </div>
            <div className="min-w-0 overflow-hidden">
              <p className="text-[15px] font-semibold text-foreground truncate" title={pessoa.name}>{pessoa.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={cn(
                  "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none flex-shrink-0",
                  formData.status === 'active'
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/40 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground border-border"
                )}>
                  {formData.status === 'active' ? 'Ativo' : formData.status === 'archived' ? 'Arquivado' : 'Inativo'}
                </span>
                {scoreNumber != null && (
                  <span className={cn(
                    "inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] border leading-none flex-shrink-0",
                    scoreNumber >= 8
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/40 dark:text-emerald-400"
                      : scoreNumber >= 5
                      ? "bg-amber-500/10 text-amber-600 border-amber-200/40 dark:text-amber-400"
                      : "bg-red-500/10 text-red-600 border-red-200/40 dark:text-red-400"
                  )}>
                    Score {scoreNumber}
                  </span>
                )}
                {pessoa.instagram_handle && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground min-w-0" title={`@${pessoa.instagram_handle}`}>
                    <Instagram className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate max-w-[160px]">@{pessoa.instagram_handle}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowExcluirModal(true)}
              disabled={isPending || isDeletingPessoa}
              className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive rounded-[4px]"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || !formData.nome.trim()}
              className="h-[30px] px-3 text-xs gap-1.5 rounded-[4px]"
            >
              {isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
              }
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left column ─────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Informações básicas */}
              <Section title="Informações básicas">
                <FieldRow label="Nome *">
                  <Input
                    value={formData.nome}
                    onChange={e => set('nome')(e.target.value)}
                    placeholder="Nome completo"
                    className="h-[30px] text-[13px]"
                  />
                </FieldRow>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldRow label="E-mail">
                    <IconInput icon={Mail} type="email" value={formData.email} onChange={set('email')} placeholder="email@exemplo.com" />
                  </FieldRow>
                  <FieldRow label="WhatsApp">
                    <IconInput icon={Phone} value={formData.whatsapp} onChange={set('whatsapp')} placeholder="55 11 99999-9999" />
                  </FieldRow>
                  <FieldRow label="Telefone">
                    <IconInput icon={Phone} value={formData.telefone} onChange={set('telefone')} placeholder="(11) 99999-9999" />
                  </FieldRow>
                  <FieldRow label="Documento (CPF / CNPJ)">
                    <IconInput icon={FileText} value={formData.documento} onChange={set('documento')} placeholder="000.000.000-00" />
                  </FieldRow>
                </div>

                <FieldRow label="Observações">
                  <RichTextEditor
                    content={formData.observacoes}
                    onChange={html => set('observacoes')(html)}
                    placeholder="Observações adicionais sobre este cliente..."
                    minHeight="120px"
                  />
                </FieldRow>
              </Section>

              {/* Canais digitais */}
              <Section title="Canais digitais">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldRow label="Instagram (@usuário)">
                    <IconInput
                      icon={AtSign}
                      value={formData.instagram_handle}
                      onChange={set('instagram_handle')}
                      placeholder="usuario_sem_arroba"
                    />
                  </FieldRow>
                  <FieldRow label="Origem (source)">
                    <select
                      value={formData.source}
                      onChange={e => set('source')(e.target.value)}
                      className="w-full h-[30px] rounded-[4px] border border-input bg-background px-2.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {SOURCE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FieldRow>
                </div>

                {/* Instagram IDs — read-only, shown only if populated */}
                {(pessoa.instagram_id || pessoa.instagram_user_id) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pessoa.instagram_user_id && (
                      <FieldRow label="Instagram (@username)">
                        <div className="flex items-center gap-2 h-8 px-2.5 rounded-[4px] border border-white/[0.06] bg-muted">
                          <Instagram className="w-3.5 h-3.5 text-pink-500/70 flex-shrink-0" strokeWidth={1.5} />
                          <span className="text-[12px] text-foreground truncate">@{pessoa.instagram_user_id}</span>
                        </div>
                      </FieldRow>
                    )}
                    {pessoa.instagram_id && (
                      <FieldRow label="Instagram IGSID">
                        <div className="flex items-center gap-2 h-8 px-2.5 rounded-[4px] border border-white/[0.06] bg-muted">
                          <Instagram className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
                          <span className="text-[12px] text-muted-foreground font-mono truncate">{pessoa.instagram_id}</span>
                        </div>
                      </FieldRow>
                    )}
                  </div>
                )}
              </Section>

              {/* Perfil */}
              <Section title="Perfil do cliente">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldRow label="Tipo">
                    <select
                      value={formData.tipo}
                      onChange={e => set('tipo')(e.target.value)}
                      className="w-full h-[30px] rounded-[4px] border border-input bg-background px-2.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="DISC">
                    <select
                      value={formData.disc_profile}
                      onChange={e => set('disc_profile')(e.target.value)}
                      className="w-full h-[30px] rounded-[4px] border border-input bg-background px-2.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {DISC_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </FieldRow>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldRow label="Renda / Faturamento">
                    <IconInput icon={TrendingUp} value={formData.income} onChange={set('income')} placeholder="Ex: R$ 10k/mês" />
                  </FieldRow>
                  <FieldRow label="Momento atual">
                    <IconInput icon={Globe} value={formData.moment} onChange={set('moment')} placeholder="Ex: Crescendo, buscando escalar..." />
                  </FieldRow>
                </div>

                <FieldRow label="Objetivo / Meta">
                  <IconInput icon={Target} value={formData.goal} onChange={set('goal')} placeholder="Ex: Fechar 50 clientes em 6 meses" />
                </FieldRow>

                <FieldRow label="Análise DISC (detalhada)">
                  <Textarea
                    value={formData.disc_summary}
                    onChange={e => set('disc_summary')(e.target.value)}
                    placeholder="Análise de perfil comportamental..."
                    rows={3}
                    className="text-[13px] resize-none"
                  />
                </FieldRow>
              </Section>

              {/* Score */}
              <PersonScoreSection
                objectiveId={formData.score_objective_id}
                investmentId={formData.score_investment_id}
                framingId={formData.score_framing_id}
                onObjectiveChange={set('score_objective_id') as (v: string) => void}
                onInvestmentChange={set('score_investment_id') as (v: string) => void}
                onFramingChange={set('score_framing_id') as (v: string) => void}
                onScoreMatrixIdChange={handleScoreMatrixIdChange}
              />

              {/* Campos extras */}
              {id && <ExtraFieldsCard personId={id} />}
            </div>

            {/* ── Right sidebar ────────────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Empresas */}
              <section className="border border-border rounded-[4px] bg-card">
                <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Empresas vinculadas</p>
                </div>
                <div className="p-4 space-y-2">
                  {selectedCompanyIds.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedCompanyIds.map(companyId => {
                        const company = companies.find(c => c.id === companyId);
                        if (!company) return null;
                        return (
                          <div key={companyId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] bg-muted border border-white/[0.06]">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" strokeWidth={1.5} />
                            <span className="text-[13px] text-foreground flex-1 truncate">{company.trade_name}</span>
                            <button type="button" onClick={() => handleToggleCompany(companyId)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full h-[30px] text-xs gap-1.5 border-border text-muted-foreground justify-between rounded-[4px]">
                        <span>Vincular empresa...</span>
                        <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" strokeWidth={1.5} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar empresa..." className="text-[13px]" />
                        <CommandList>
                          <CommandEmpty className="text-[13px] text-muted-foreground py-3 text-center">Nenhuma empresa encontrada.</CommandEmpty>
                          <CommandGroup>
                            {companies.map(company => (
                              <CommandItem key={company.id} value={company.trade_name} onSelect={() => handleToggleCompany(company.id)} className="text-[13px]">
                                <Check className={cn("mr-2 h-3.5 w-3.5", selectedCompanyIds.includes(company.id) ? "opacity-100" : "opacity-0")} strokeWidth={1.5} />
                                <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                                {company.trade_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </section>

              {/* Configurações */}
              <section className="border border-border rounded-[4px] bg-card">
                <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Configurações</p>
                </div>
                <div className="p-4 space-y-4">

                  {/* Status */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Status</p>
                    <div className="flex gap-1 flex-wrap">
                      {(['active', 'inactive', 'archived'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set('status')(s)}
                          className={cn(
                            "text-[10px] font-medium px-2 py-1 rounded-[4px] border transition-colors",
                            formData.status === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-white/[0.06] text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {s === 'active' ? 'Ativo' : s === 'inactive' ? 'Inativo' : 'Arquivado'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status atendimento */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Status do atendimento</p>
                    <div className="flex gap-1 flex-wrap">
                      {SERVICE_STATUS_OPTIONS.map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => set('service_status')(o.value)}
                          className={cn(
                            "text-[10px] font-medium px-2 py-1 rounded-[4px] border transition-colors",
                            formData.service_status === o.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-white/[0.06] text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aceita ligação */}
                  <div className="flex items-center justify-between py-1 border-t border-white/[0.06] pt-3">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                      <Label className="text-[13px] text-foreground cursor-pointer">Aceita ligação</Label>
                    </div>
                    <Switch
                      checked={formData.aceita_ligacao}
                      onCheckedChange={v => set('aceita_ligacao')(v)}
                      className="scale-90"
                    />
                  </div>

                  {/* Agente IA */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                      <Label className="text-[13px] text-foreground cursor-pointer">Agente IA</Label>
                    </div>
                    <Switch
                      checked={formData.ai_enabled}
                      onCheckedChange={v => set('ai_enabled')(v)}
                      className="scale-90"
                    />
                  </div>
                </div>
              </section>

              {/* Merge history */}
              {pessoa?.merge_history && Array.isArray(pessoa.merge_history) && (pessoa.merge_history as unknown[]).length > 0 && (
                <Section title="Contatos unificados">
                  <div className="space-y-2">
                    {(pessoa.merge_history as Array<{ merged_at: string; duplicate_id: string; duplicate_name: string; messages_moved?: number; leads_moved?: number }>).map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-[4px] bg-muted border border-white/[0.06]">
                        <GitMerge className="w-3.5 h-3.5 text-primary/60 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                        <div className="min-w-0">
                          <p className="text-[12px] text-foreground truncate">
                            {entry.duplicate_name || 'Contato removido'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(entry.merged_at).toLocaleDateString('pt-BR')}
                            {entry.messages_moved ? ` \u2022 ${entry.messages_moved} msgs` : ''}
                            {entry.leads_moved ? ` \u2022 ${entry.leads_moved} neg\u00f3cios` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Danger zone */}
              <section className="border border-destructive/20 rounded-[4px] bg-card">
                <div className="px-4 pt-4 pb-3 border-b border-destructive/10">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-destructive/60">Zona de risco</p>
                </div>
                <div className="p-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExcluirModal(true)}
                    disabled={isPending || isDeletingPessoa}
                    className="w-full h-[30px] text-xs gap-1.5 border-destructive/30 rounded-[4px] text-destructive hover:bg-destructive/5 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Excluir cliente
                  </Button>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      <ExcluirPessoaModal
        open={showExcluirModal}
        onOpenChange={setShowExcluirModal}
        nomePessoa={pessoa?.name || ''}
        onConfirmar={() => {
          if (id) {
            deletarPessoa({ id }, {
              onSuccess: () => navigate('/crm/clients'),
            });
          }
        }}
      />
    </div>
  );
};

export default ClienteSingle;
