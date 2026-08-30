import { useState, useEffect, useRef } from "react";
import { ContactAvatar } from "@/components/ui/contact-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Building2, Phone, Mail, Briefcase,
  User, Clock, Bot, FileText, Edit3, Check, X,
  Target, StickyNote, Instagram, ChevronDown,
  MessageSquareText, Brain, Layers, CalendarPlus,
} from "lucide-react";
import { AgendamentoInlineTab } from "@/components/agendamento/AgendamentoInlineTab";
import { useLeadFieldDefinitionsByEntity } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValuesByEntity, getTypedLeadValue } from "@/hooks/useLeadFieldValues";
import { usePipelines } from "@/hooks/usePipelines";
import { useCriarNegocio } from "@/hooks/useConversasPessoas";
import { useEstatisticasMensagens } from "@/hooks/useEstatisticasMensagens";
import { useNavigate } from "react-router-dom";
import ConversasBadgeMidia from "./ConversasBadgeMidia";
import StatusAtendimento from "./StatusAtendimento";
import ControleIA from "./ControleIA";
import NegociosSection from "./NegociosSection";
import { AtribuirTimeResponsavel } from "./AtribuirTimeResponsavel";
import EditableField from "@/components/common/EditableField";
import WhatsAppInput from "@/components/common/WhatsAppInput";
import { MergeContactModal } from "@/components/modals/MergeContactModal";
import { MergeLeadsModal, LeadOption } from "@/components/modals/MergeLeadsModal";
import { useUpdatePessoa } from "@/hooks/usePessoasReal";
import { NegocioScoreSection } from "@/components/negocios/NegocioScoreSection";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { formatPhoneDisplay, formatPhoneForDatabase, validatePhone } from "@/utils/phoneUtils";
import { useCheckDuplicate, DuplicatePerson } from "@/hooks/useCheckDuplicate";
import { cn } from "@/lib/utils";

interface ConversasSidebarProps {
  pessoa: {
    id: string;
    nome: string;
    whatsapp?: string;
    email?: string;
    instagram_id?: string;
    instagram_user_id?: string;
    instagram_followers?: number | null;
    instagram_verified?: boolean | null;
    profile_picture?: string | null;
    notes?: string;
    status_atendimento?: string;
    atendimento_ia?: boolean;
    ai_enabled?: boolean;
    empresa?: { nome_fantasia: string };
    total_mensagens: number;
    resumo_conversa?: string;
    disc?: string;
    disc_resumo?: string;
    score?: number | null;
    score_matrix_id?: string | null;
    negocios?: Array<{
      id: string;
      valor?: number;
      status: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_term?: string;
      fbclid?: string;
      gclid?: string;
      teams_id?: string | null;
      user_id?: string | null;
      pipeline: { id: string; nome: string };
      stage: { id: string; nome: string };
    }>;
  };
  tenantId: string;
  onMerged?: (canonicalId: string) => void;
  onSendLink?: (url: string) => void;
}

type SidebarTab = 'contato' | 'negocios' | 'agendar';

const TABS: { key: SidebarTab; label: string; icon: React.ElementType }[] = [
  { key: 'contato',  label: 'Contato',  icon: User },
  { key: 'negocios', label: 'Negócios', icon: Briefcase },
  { key: 'agendar',  label: 'Agendar',  icon: CalendarPlus },
];

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const ConversasSidebar = ({ pessoa, tenantId, onMerged, onSendLink }: ConversasSidebarProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SidebarTab>('contato');
  const [showNovoNegocio, setShowNovoNegocio] = useState(false);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [valor, setValor] = useState("");

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(pessoa.nome);

  // Collapsible sections in Contato tab
  const [showResumo, setShowResumo] = useState(false);
  const [showDisc, setShowDisc] = useState(false);
  const [showCampos, setShowCampos] = useState(false);
  const [showQualif, setShowQualif] = useState(false);

  // Phone inline edit
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempPhoneDb, setTempPhoneDb] = useState('');

  // Merge modal
  type MergePending = {
    field: 'whatsapp' | 'email' | 'instagram';
    newDbValue: string;
    duplicate: DuplicatePerson;
  };
  type MergeLeadsPending = {
    leadA: LeadOption;   // current person's lead
    leadB: LeadOption;   // duplicate (canonical) person's lead
  };
  const [mergePending, setMergePending] = useState<MergePending | null>(null);
  const [mergeLeadsPending, setMergeLeadsPending] = useState<MergeLeadsPending | null>(null);
  const [merging, setMerging] = useState(false);
  const pendingMergeRef = useRef<{ canonicalId: string; duplicateId: string } | null>(null);
  const { check: checkDuplicate } = useCheckDuplicate();

  useEffect(() => {
    setTempName(pessoa.nome);
    setIsEditingName(false);
  }, [pessoa.id, pessoa.nome]);

  const { pipelines: allPipelines, stages } = usePipelines();
  const criarNegocio = useCriarNegocio();
  const atualizarPessoa = useUpdatePessoa();
  const { user, session } = useAuth();

  const pipelines = allPipelines.filter(p => p.active || p.ativo);
  const { data: estatisticas } = useEstatisticasMensagens(pessoa.id, tenantId);
  const stagesFiltradas = pipelineId ? stages.filter(s => s.pipeline_id === pipelineId) : [];

  // ── Negócios ─────────────────────────────────────────────────────────────────

  const { data: negociosFetched = [] } = useQuery({
    queryKey: ['negocios-sidebar', pessoa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, value, status, pre_sale_temperature, close_probability,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid,
          teams_id, user_id,
          pipeline:leads_pipelines!leads_leads_pipelines_id_fkey(id, name),
          stage:leads_stages!leads_leads_stages_id_fkey(id, name)
        `)
        .eq('people_id', pessoa.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((l: any) => ({
        id: l.id,
        valor: l.value,
        status: l.status,
        pre_sale_temperature: l.pre_sale_temperature,
        close_probability: l.close_probability,
        utm_source: l.utm_source,
        utm_medium: l.utm_medium,
        utm_campaign: l.utm_campaign,
        utm_content: l.utm_content,
        utm_term: l.utm_term,
        fbclid: l.fbclid,
        gclid: l.gclid,
        teams_id: l.teams_id,
        user_id: l.user_id,
        pipeline: { id: l.pipeline?.id ?? '', nome: l.pipeline?.name ?? '' },
        stage: { id: l.stage?.id ?? '', nome: l.stage?.name ?? '' },
      }));
    },
    enabled: !!pessoa.id,
    staleTime: 30000,
  });

  const negocios = negociosFetched;
  const negocioUTM = negocios[0];

  // Custom fields (pessoa entity) — read-only display in Contato tab
  const { data: fieldDefs = [] } = useLeadFieldDefinitionsByEntity('pessoa');
  const { data: fieldValues = [] } = useLeadFieldValuesByEntity('pessoa', pessoa.id);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCriarNegocio = async () => {
    if (!pipelineId || !stageId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!session?.user?.id || !user) {
      toast.error('Erro de autenticação.');
      await supabase.auth.signOut();
      return;
    }
    try {
      await criarNegocio.mutateAsync({
        pessoa_id: pessoa.id,
        tenant_id: tenantId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        valor: valor ? parseFloat(valor) : undefined
      });
      setPipelineId(""); setStageId(""); setValor("");
      setShowNovoNegocio(false);
    } catch {
      toast.error('Erro ao criar negócio');
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) { toast.error('Nome não pode ser vazio'); return; }
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s || !session || !user) { toast.error('Sessão expirada'); return; }
    try {
      await atualizarPessoa.mutateAsync({ id: pessoa.id, nome: tempName.trim() });
      await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['conversas-paginadas'], exact: false });
      setIsEditingName(false);
      toast.success('Nome atualizado!');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar nome');
      setTempName(pessoa.nome);
    }
  };

  const handleSaveWhatsAppDb = async (dbValue: string) => {
    await atualizarPessoa.mutateAsync({ id: pessoa.id, whatsapp: dbValue });
    await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false });
    setIsEditingPhone(false);
  };

  const handleSaveWhatsApp = async () => {
    if (!tempPhoneDb) { setIsEditingPhone(false); return; }
    const dup = await checkDuplicate({ excludeId: pessoa.id, whatsapp: tempPhoneDb });
    if (dup) {
      setMergePending({ field: 'whatsapp', newDbValue: tempPhoneDb, duplicate: dup });
      return;
    }
    await handleSaveWhatsAppDb(tempPhoneDb);
  };

  const handleSaveEmail = async (value: string) => {
    const dup = await checkDuplicate({ excludeId: pessoa.id, email: value });
    if (dup) {
      setMergePending({ field: 'email', newDbValue: value, duplicate: dup });
      return;
    }
    await atualizarPessoa.mutateAsync({ id: pessoa.id, email: value });
    await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false });
  };

  const handleSaveInstagramId = async (value: string) => {
    const dup = await checkDuplicate({ excludeId: pessoa.id, instagramHandle: value });
    if (dup) {
      setMergePending({ field: 'instagram', newDbValue: value, duplicate: dup });
      return;
    }
    await atualizarPessoa.mutateAsync({ id: pessoa.id, instagram_user_id: value || null });
    await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false });
  };

  const handleConfirmMerge = async () => {
    if (!mergePending) return;
    setMerging(true);
    try {
      const canonicalId = mergePending.duplicate.id;
      const duplicateId = pessoa.id;

      type LeadRow = {
        id: string;
        value: number | null;
        people_id: string;
        pipeline: { id: string; name: string } | null;
        stage: { id: string; name: string } | null;
      };

      // Fetch active leads for both people to check for conflict
      const { data: bothLeadsRaw } = await supabase
        .from('leads')
        .select(`
          id, value, people_id,
          pipeline:leads_pipelines!leads_leads_pipelines_id_fkey(id, name),
          stage:leads_stages!leads_leads_stages_id_fkey(id, name)
        `)
        .in('people_id', [canonicalId, duplicateId])
        .eq('status', 'in_progress');

      const bothLeads = (bothLeadsRaw ?? []) as unknown as LeadRow[];
      const currentLead = bothLeads.find((l) => l.people_id === duplicateId);
      const canonicalLead = bothLeads.find((l) => l.people_id === canonicalId);

      if (currentLead && canonicalLead) {
        // Both have active leads — ask user which to keep
        setMerging(false);
        setMergePending(null);
        setMergeLeadsPending({
          leadA: {
            id: currentLead.id,
            personName: pessoa.nome,
            pipelineName: currentLead.pipeline?.name ?? 'Pipeline',
            stageName: currentLead.stage?.name ?? 'Etapa',
            value: currentLead.value,
          },
          leadB: {
            id: canonicalLead.id,
            personName: mergePending.duplicate.name,
            pipelineName: canonicalLead.pipeline?.name ?? 'Pipeline',
            stageName: canonicalLead.stage?.name ?? 'Etapa',
            value: canonicalLead.value,
          },
        });
        // Store the merge context so we can execute after lead selection
        pendingMergeRef.current = { canonicalId, duplicateId };
        return;
      }

      // No conflict — proceed with merge directly
      await executeMerge(canonicalId, duplicateId, null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao unificar contatos');
      setMerging(false);
      setMergePending(null);
    }
  };

  const handleConfirmMergeLeads = async (keepLeadId: string) => {
    const ctx = pendingMergeRef.current;
    if (!ctx || !mergeLeadsPending) return;
    setMerging(true);
    try {
      const archiveLeadId = keepLeadId === mergeLeadsPending.leadA.id
        ? mergeLeadsPending.leadB.id
        : mergeLeadsPending.leadA.id;
      await executeMerge(ctx.canonicalId, ctx.duplicateId, archiveLeadId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao unificar contatos');
    } finally {
      setMerging(false);
      setMergeLeadsPending(null);
      pendingMergeRef.current = null;
    }
  };

  const executeMerge = async (canonicalId: string, duplicateId: string, archiveLeadId: string | null) => {
    // Call merge_persons — re-parents all data from duplicate → canonical
    const { error: mergeError } = await supabase.rpc('merge_persons', {
      p_canonical_id: canonicalId,
      p_duplicate_id: duplicateId,
    });
    if (mergeError) throw new Error(mergeError.message);

    // Archive the unwanted lead if applicable
    if (archiveLeadId) {
      await supabase.from('leads').update({ status: 'archived' }).eq('id', archiveLeadId);
    }

    // Invalidate all relevant caches
    await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false });
    await queryClient.invalidateQueries({ queryKey: ['negocios-sidebar'], exact: false });
    await queryClient.invalidateQueries({ queryKey: ['negocios'], exact: false });
    await queryClient.invalidateQueries({ queryKey: ['mensagens-por-pessoa-v2'], exact: false });

    toast.success('Contatos unificados com sucesso');
    setMerging(false);
    setMergePending(null);

    // Navigate to the canonical (surviving) person
    onMerged?.(canonicalId);
  };

  const handleSaveResumoConversa = async (value: string) => {
    await atualizarPessoa.mutateAsync({ id: pessoa.id, conversation_summary: value });
    await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false });
  };

  const handleSaveResumoDISC = async (value: string) => {
    await atualizarPessoa.mutateAsync({ id: pessoa.id, disc_summary: value });
    await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false });
  };

  const handleSaveNotes = async (value: string) => {
    await atualizarPessoa.mutateAsync({ id: pessoa.id, notes: value });
    await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'], exact: false });
  };

  const validateEmailField = (value: string) => {
    if (!value) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'E-mail inválido';
  };

  const validateWhatsAppField = (value: string) => {
    if (!value) return null;
    const result = validatePhone(value);
    return result.valid ? null : (result.error || 'WhatsApp inválido');
  };

  const getPerfilDisc = (perfil: string) => {
    const map: Record<string, string> = {
      'D': 'Dominante', 'I': 'Influente', 'S': 'Estável', 'C': 'Cauteloso'
    };
    return map[perfil] || 'Não identificado';
  };

  const formatTempoAbandono = (tempo?: number | { dias: number; horas: number; minutos: number }) => {
    if (!tempo) return 'N/A';
    if (typeof tempo === 'number') {
      const dias = Math.floor(tempo / 1440);
      const horas = Math.floor((tempo % 1440) / 60);
      const minutos = tempo % 60;
      const parts = [];
      if (dias > 0) parts.push(`${dias}d`);
      if (horas > 0) parts.push(`${horas}h`);
      if (minutos > 0) parts.push(`${minutos}m`);
      return parts.length > 0 ? parts.join(' ') : '< 1m';
    }
    const parts = [];
    if (tempo.dias > 0) parts.push(`${tempo.dias}d`);
    if (tempo.horas > 0) parts.push(`${tempo.horas}h`);
    if (tempo.minutos > 0) parts.push(`${tempo.minutos}m`);
    return parts.length > 0 ? parts.join(' ') : '< 1m';
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="w-[300px] border-l border-border bg-card flex flex-col h-full overflow-hidden">

      {/* ── Top strip: status + IA ── */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2 border-b border-border bg-card">
        <StatusAtendimento pessoa={pessoa} tenantId={tenantId} />
        <ControleIA pessoa={pessoa} tenantId={tenantId} />
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex items-center border-b border-border bg-card flex-shrink-0">
        {TABS.map(t => {
          const Icon   = t.icon;
          const active = tab === t.key;
          const badge  = t.key === 'negocios' && negocios.length > 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-1 py-2.5 text-[11px] font-medium border-b-2 -mb-[1px] transition-colors min-w-0',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{t.label}</span>
              {badge && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-2 right-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">

        {/* ── Contato ── */}
        {tab === 'contato' && (
          <div className="p-4 space-y-3">

            {/* Avatar + nome */}
            <div className="flex items-center gap-3">
              <ContactAvatar
                src={pessoa.profile_picture}
                name={pessoa.nome}
                size="lg"
                className="border border-border"
                fallbackClassName="bg-card text-muted-foreground"
              />
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="h-[30px] text-[13px] flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') { setTempName(pessoa.nome); setIsEditingName(false); }
                      }}
                    />
                    <Button size="sm" onClick={handleSaveName} disabled={atualizarPessoa.isPending} className="h-[30px] w-[30px] p-0">
                      <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setTempName(pessoa.nome); setIsEditingName(false); }} className="h-[30px] w-[30px] p-0">
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group min-w-0">
                    <span className="text-[13px] font-semibold text-foreground truncate min-w-0">{pessoa.nome}</span>
                    {pessoa.instagram_verified && (
                      <span title="Verificado" className="text-[#B8924B] text-[10px]">✓</span>
                    )}
                    {session && user && (
                      <Button
                        variant="ghost"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-50 transition-opacity shrink-0"
                        onClick={() => setIsEditingName(true)}
                      >
                        <Edit3 className="w-3 h-3" strokeWidth={1.5} />
                      </Button>
                    )}
                  </div>
                )}
                {pessoa.instagram_followers != null && (
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {pessoa.instagram_followers.toLocaleString('pt-BR')} seguidores
                  </p>
                )}
              </div>
            </div>

            {/* Canais badges */}
            <div>
              <SectionLabel>Canais</SectionLabel>
              <ConversasBadgeMidia
                whatsapp={pessoa.whatsapp}
                email={pessoa.email}
                instagram={pessoa.instagram_user_id || (pessoa.instagram_id ? pessoa.instagram_id : undefined)}
              />
            </div>

            {/* WhatsApp — custom phone editor with country selector */}
            <div className="flex items-start gap-3 p-3 bg-muted border border-border rounded-[4px]">
              <div className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5">
                <Phone className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">WhatsApp</p>
                {isEditingPhone ? (
                  <div className="space-y-2">
                    <WhatsAppInput
                      label=""
                      value={pessoa.whatsapp || ''}
                      onChange={(_display, db) => setTempPhoneDb(db)}
                      disabled={atualizarPessoa.isPending}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm" variant="ghost"
                        onClick={handleSaveWhatsApp}
                        disabled={atualizarPessoa.isPending || !tempPhoneDb}
                        className="h-6 w-6 p-0 hover:bg-primary/10 rounded-[4px]"
                      >
                        {atualizarPessoa.isPending
                          ? <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                          : <Check className="w-3 h-3 text-primary" />
                        }
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { setIsEditingPhone(false); setTempPhoneDb(''); }}
                        disabled={atualizarPessoa.isPending}
                        className="h-6 w-6 p-0 hover:bg-destructive/10 rounded-[4px]"
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <p className="text-sm text-foreground truncate">
                      {pessoa.whatsapp ? formatPhoneDisplay(pessoa.whatsapp) : <span className="text-muted-foreground/50">Não informado</span>}
                    </p>
                    {session && user && !atualizarPessoa.isPending && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { setTempPhoneDb(''); setIsEditingPhone(true); }}
                        className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-[4px]"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <EditableField
              label="Instagram (@username)"
              value={pessoa.instagram_user_id || ''}
              type="text"
              onSave={handleSaveInstagramId}
              icon={<Instagram className="w-3 h-3 text-pink-500/70" />}
              placeholder="Não informado"
              inputPlaceholder="usuario_sem_arroba"
              isLoading={atualizarPessoa.isPending}
            />

            {/* IGSID read-only */}
            {pessoa.instagram_id && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-card border border-border">
                <Instagram className="w-3 h-3 text-muted-foreground/30 flex-none" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">IGSID</span>
                <span className="text-[11px] text-muted-foreground/60 font-mono truncate">{pessoa.instagram_id}</span>
              </div>
            )}

            <EditableField
              label="E-mail"
              value={pessoa.email || ''}
              type="email"
              onSave={handleSaveEmail}
              validation={validateEmailField}
              icon={<Mail className="w-3 h-3" />}
              placeholder="Não informado"
              inputPlaceholder="email@exemplo.com"
              isLoading={atualizarPessoa.isPending}
            />

            {/* Empresa */}
            {pessoa.empresa && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-card border border-border">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground/40 flex-none" strokeWidth={1.5} />
                <span className="text-[12px] text-foreground truncate">{pessoa.empresa.nome_fantasia}</span>
              </div>
            )}

            {/* DISC */}
            {pessoa.disc && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] text-muted-foreground/70">Perfil DISC</span>
                <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none text-purple-600 dark:text-purple-400 bg-purple-500/8 border-purple-200/30">
                  {pessoa.disc} · {getPerfilDisc(pessoa.disc)}
                </span>
              </div>
            )}

            {/* UTM */}
            {negocioUTM?.utm_source && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] text-muted-foreground/70">Origem</span>
                <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none text-[#7A5C24] dark:text-[#D4B071] bg-[#B8924B]/8 border-[#B8924B]/25">
                  {negocioUTM.utm_source}
                </span>
              </div>
            )}

            {/* Sem resposta */}
            {estatisticas && !estatisticas.ultima_mensagem_cliente && estatisticas.tempo_abandono && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] text-muted-foreground/70">Sem resposta</span>
                <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="text-[12px] font-medium">{formatTempoAbandono(estatisticas.tempo_abandono)}</span>
                </div>
              </div>
            )}

            {/* Observações */}
            <EditableField
              label="Observações"
              value={pessoa.notes || ''}
              type="richtext"
              onSave={handleSaveNotes}
              icon={<StickyNote className="w-3 h-3" />}
              placeholder="Sem observações"
              inputPlaceholder="Adicione observações sobre o cliente..."
              isLoading={atualizarPessoa.isPending}
            />

            {/* ── Resumo da Conversa ── */}
            {(pessoa.resumo_conversa) && (
              <div className="border border-border rounded-[4px] overflow-hidden">
                <button
                  onClick={() => setShowResumo(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="w-3.5 h-3.5 text-[#B8924B]/70" strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wider">Resumo da Conversa</span>
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200', showResumo && 'rotate-180')} />
                </button>
                {showResumo && (
                  <div className="px-3 py-2.5">
                    <p className="text-[12px] text-foreground/75 leading-relaxed whitespace-pre-wrap">
                      {pessoa.resumo_conversa}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Perfil DISC ── */}
            {(pessoa.disc || pessoa.disc_resumo) && (
              <div className="border border-border rounded-[4px] overflow-hidden">
                <button
                  onClick={() => setShowDisc(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-purple-500/70" strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wider">Perfil DISC</span>
                    {pessoa.disc && (
                      <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-300/20 leading-none">
                        {pessoa.disc} · {getPerfilDisc(pessoa.disc)}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200', showDisc && 'rotate-180')} />
                </button>
                {showDisc && (
                  <div className="px-3 py-2.5 space-y-2">
                    {pessoa.disc && (
                      <div className="flex items-center gap-2">
                        {(['D','I','S','C'] as const).map(l => (
                          <div key={l} className={cn(
                            'flex-1 text-center py-1 rounded-[3px] text-[11px] font-bold border',
                            pessoa.disc === l
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-300/30'
                              : 'text-muted-foreground/30 border-border'
                          )}>
                            {l}
                          </div>
                        ))}
                      </div>
                    )}
                    {pessoa.disc_resumo && (
                      <p className="text-[12px] text-foreground/75 leading-relaxed whitespace-pre-wrap">
                        {pessoa.disc_resumo}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Enquadramento & Score ── */}
            <NegocioScoreSection
              pessoaId={pessoa.id}
              scoreMatrixId={pessoa.score_matrix_id}
              score={pessoa.score}
            />

            {/* ── Qualificação IA ── */}
            {fieldDefs.filter(d => d.agent_managed).length > 0 && (
              <div className="border border-border rounded-[4px] overflow-hidden">
                <button
                  onClick={() => setShowQualif(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-violet-500/70" strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wider">Qualificação IA</span>
                    {(() => {
                      const filled = fieldDefs.filter(d => d.agent_managed && fieldValues.find(v => v.field_definition_id === d.id)).length;
                      const total = fieldDefs.filter(d => d.agent_managed).length;
                      return filled > 0 ? (
                        <span className="text-[9px] text-muted-foreground/40 font-normal">{filled}/{total}</span>
                      ) : null;
                    })()}
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200', showQualif && 'rotate-180')} />
                </button>
                {showQualif && (
                  <div className="divide-y divide-border/30">
                    {fieldDefs.filter(d => d.agent_managed).map(def => {
                      const val = fieldValues.find(v => v.field_definition_id === def.id);
                      const typed = val ? getTypedLeadValue(val, def.type) : null;
                      const display = typed !== null && typed !== undefined && typed !== '' ? String(typed) : null;
                      return (
                        <div key={def.id} className={cn('px-3 py-2', display && String(display).length > 40 ? 'space-y-0.5' : 'flex items-start gap-2')}>
                          {display && String(display).length > 40 ? (
                            <>
                              <span className="text-[10px] text-muted-foreground/45 uppercase tracking-wide font-medium block">{def.name}</span>
                              <span className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words block">{display}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] text-muted-foreground/55 flex-1 min-w-0 leading-relaxed pt-px">{def.name}</span>
                              <span className={cn(
                                'text-[11px] text-right leading-relaxed shrink-0 max-w-[130px] break-words',
                                display ? 'text-foreground/80' : 'text-muted-foreground/30'
                              )}>
                                {display ?? '—'}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Campos Personalizados ── */}
            {fieldDefs.filter(d => !d.agent_managed).length > 0 && (
              <div className="border border-border rounded-[4px] overflow-hidden">
                <button
                  onClick={() => setShowCampos(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-emerald-500/70" strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wider">Campos Personalizados</span>
                    <span className="text-[9px] text-muted-foreground/40 font-normal">
                      {fieldDefs.filter(d => !d.agent_managed).length}
                    </span>
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200', showCampos && 'rotate-180')} />
                </button>
                {showCampos && (
                  <div className="divide-y divide-border/30">
                    {fieldDefs.filter(d => !d.agent_managed).map(def => {
                      const val = fieldValues.find(v => v.field_definition_id === def.id);
                      const typed = val ? getTypedLeadValue(val, def.type) : null;
                      const display = typed !== null && typed !== undefined && typed !== ''
                        ? String(typed)
                        : null;
                      return (
                        <div key={def.id} className="flex items-start gap-2 px-3 py-2">
                          <span className="text-[11px] text-muted-foreground/55 flex-1 min-w-0 leading-relaxed pt-px">{def.name}</span>
                          <span className={cn(
                            'text-[11px] text-right leading-relaxed shrink-0 max-w-[120px] break-words',
                            display ? 'text-foreground/80' : 'text-muted-foreground/30'
                          )}>
                            {display ?? '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Negócios ── */}
        {tab === 'negocios' && (
          <div className="p-4 space-y-3">
            {negocios.length > 0 ? (
              <>
                <NegociosSection negocios={negocios} tenantId={tenantId} />
                {negocios[0] && (
                  <div className="pt-2 border-t border-border">
                    <SectionLabel>Responsável</SectionLabel>
                    <AtribuirTimeResponsavel negocio={negocios[0]} compact />
                  </div>
                )}
              </>
            ) : (
              !showNovoNegocio && (
                <div className="flex flex-col items-center py-8 gap-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-muted-foreground/30" strokeWidth={1.5} />
                  </div>
                  <p className="text-[13px] text-muted-foreground">Nenhum negócio</p>
                </div>
              )
            )}

            {/* Criar negócio */}
            {!showNovoNegocio ? (
              <Button
                variant="outline"
                className="w-full h-[30px] text-[12px] gap-1 border-border"
                onClick={() => setShowNovoNegocio(true)}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                {negocios.length > 0 ? 'Criar outro negócio' : 'Criar negócio'}
              </Button>
            ) : (
              <div className="border border-border rounded-[4px] p-3 space-y-2 bg-card">
                <SectionLabel>Novo negócio</SectionLabel>
                <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); setStageId(""); }}>
                  <SelectTrigger className="h-[30px] text-[12px]">
                    <SelectValue placeholder="Pipeline..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-[12px]">{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId}>
                  <SelectTrigger className="h-[30px] text-[12px]">
                    <SelectValue placeholder="Etapa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stagesFiltradas.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-[12px]">{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="number"
                  placeholder="Valor (opcional)"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full h-[30px] rounded-[4px] border border-input bg-background px-3 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-1.5">
                  <Button
                    className="flex-1 h-[30px] text-[12px]"
                    onClick={handleCriarNegocio}
                    disabled={!pipelineId || !stageId || criarNegocio.isPending}
                  >
                    {criarNegocio.isPending ? 'Criando...' : 'Criar'}
                  </Button>
                  <Button variant="ghost" className="h-[30px] text-[12px]" onClick={() => setShowNovoNegocio(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Agendar ── */}
        {tab === 'agendar' && (
          <AgendamentoInlineTab
            personId={pessoa.id}
            personName={pessoa.nome}
            userId={user?.profile?.id ?? null}
            linkedLeadId={negocios[0]?.id ?? null}
            onSendLink={onSendLink}
          />
        )}


      </div>
    </div>

    {/* Merge contact modal */}
    {mergePending && (
      <MergeContactModal
        open={!!mergePending}
        onOpenChange={(o) => { if (!o) setMergePending(null); }}
        current={{
          id: pessoa.id,
          name: pessoa.nome,
          whatsapp: mergePending.field === 'whatsapp' ? mergePending.newDbValue : pessoa.whatsapp,
          email: mergePending.field === 'email' ? mergePending.newDbValue : pessoa.email,
          instagram_handle: mergePending.field === 'instagram' ? mergePending.newDbValue : undefined,
          instagram_user_id: pessoa.instagram_user_id,
          profile_picture: pessoa.profile_picture,
        }}
        duplicate={mergePending.duplicate}
        conflictField={mergePending.field}
        onConfirmMerge={handleConfirmMerge}
        onCancel={() => setMergePending(null)}
        isLoading={merging}
      />
    )}

    {/* Lead selection when both people have active leads */}
    {mergeLeadsPending && (
      <MergeLeadsModal
        open={!!mergeLeadsPending}
        onOpenChange={(o) => {
          if (!o) {
            setMergeLeadsPending(null);
            pendingMergeRef.current = null;
          }
        }}
        leadA={mergeLeadsPending.leadA}
        leadB={mergeLeadsPending.leadB}
        onConfirm={handleConfirmMergeLeads}
        isLoading={merging}
      />
    )}
    </>
  );
};

export default ConversasSidebar;
