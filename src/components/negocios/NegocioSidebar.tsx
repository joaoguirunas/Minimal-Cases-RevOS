import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  User, Phone, Mail, Building2, DollarSign, Edit2, Check, X,
  Calendar, Target, Brain, FileText, Settings, ChevronsUpDown,
  Briefcase, Users, ChevronDown, Flame, Star, Tag as TagIcon,
  MessageSquareText
} from "lucide-react";
import { useLeadFieldDefinitionsByEntity } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValuesByEntity, getTypedLeadValue } from "@/hooks/useLeadFieldValues";
import { toast } from "sonner";
import EditableField from "@/components/common/EditableField";
import { NegocioScoreSection } from "@/components/negocios/NegocioScoreSection";
import { AtribuirTimeResponsavel } from "@/components/conversas/AtribuirTimeResponsavel";
import StatusAtendimento from "@/components/conversas/StatusAtendimento";
import CursoBadges from "@/components/negocios/CursoBadges";
import TagBadges from "@/components/negocios/TagBadges";
import { useLeadTags, useLeadTagsFor, useToggleLeadTag } from "@/hooks/useLeadTags";
import { useWhatsappChannels, useSetPersonActiveChannel } from "@/hooks/useWhatsappChannels";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneDisplay, formatPhoneForDatabase, validatePhone } from "@/utils/phoneUtils";

interface NegocioSidebarProps {
  negocio: any;
  pipelines: any[];
  stages: any[];
  companies: any[];
  times: any[];
  onUpdateNegocio: (data: any) => Promise<void>;
  onUpdatePessoa: (field: string, value: any) => Promise<void>;
  isLoadingCompanies?: boolean;
  isPendingNegocio?: boolean;
  isPendingPessoa?: boolean;
}

const NegocioSidebar = ({
  negocio,
  pipelines,
  stages,
  companies,
  times,
  onUpdateNegocio,
  onUpdatePessoa,
  isLoadingCompanies,
  isPendingNegocio,
  isPendingPessoa
}: NegocioSidebarProps) => {
  const [activeTab, setActiveTab] = useState("cliente");
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [showQualif, setShowQualif] = useState(false);

  const { data: fieldDefs = [] } = useLeadFieldDefinitionsByEntity('pessoa');
  const { data: fieldValues = [] } = useLeadFieldValuesByEntity('pessoa', negocio?.pessoa?.id);
  const [editValue, setEditValue] = useState(negocio?.value?.toString() || "0");
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState(negocio?.pessoa?.notes || "");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const { tags: allTags = [] } = useLeadTags(true);
  const { data: leadTags = [] } = useLeadTagsFor(negocio?.id);
  const toggleLeadTag = useToggleLeadTag();
  const { data: channelOptions = [] } = useWhatsappChannels();
  const setActiveChannel = useSetPersonActiveChannel();

  // Sync local state when negocio prop changes (e.g. navigating between deals)
  useEffect(() => {
    setEditValue(negocio?.value?.toString() || "0");
    setNotesContent(negocio?.pessoa?.notes || "");
    setIsEditingValue(false);
    setIsEditingNotes(false);
  }, [negocio?.id]);

  const pipelineId = negocio?.pipeline_id || negocio?.leads_pipelines_id;
  const filteredStages = stages.filter(s => s.pipeline_id === pipelineId || s.leads_pipelines_id === pipelineId);
  const currentStage = stages.find(s => s.id === negocio?.leads_stages_id);

  const formatCurrency = (value?: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatusChip = () => {
    switch (negocio?.status) {
      case 'won': return 'text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20';
      case 'lost': return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20';
      default: return 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20';
    }
  };

  const getStatusLabel = () => {
    switch (negocio?.status) {
      case 'won': return 'Ganho';
      case 'lost': return 'Perdido';
      default: return 'Em Andamento';
    }
  };

  const handleValueSave = async () => {
    try {
      await onUpdateNegocio({ value: parseFloat(editValue) || 0 });
      setIsEditingValue(false);
      toast.success("Valor atualizado!");
    } catch {
      toast.error("Erro ao atualizar valor");
    }
  };

  const handlePipelineChange = async (newPipelineId: string) => {
    if (newPipelineId === pipelineId) return;
    const newStages = stages
      .filter(s => s.pipeline_id === newPipelineId || s.leads_pipelines_id === newPipelineId)
      .sort((a, b) => (a.order_index || a.ordem || 0) - (b.order_index || b.ordem || 0));
    try {
      await onUpdateNegocio({ leads_pipelines_id: newPipelineId, leads_stages_id: newStages[0]?.id });
      toast.success("Pipeline atualizado!");
    } catch {
      toast.error("Erro ao atualizar pipeline");
    }
  };

  const handleStageChange = async (newStageId: string) => {
    if (newStageId === negocio?.leads_stages_id) return;
    try {
      await onUpdateNegocio({ leads_stages_id: newStageId });
      toast.success("Etapa atualizada!");
    } catch {
      toast.error("Erro ao atualizar etapa");
    }
  };

  const handleSaveWhatsApp = async (value: string) => {
    await onUpdatePessoa('whatsapp', formatPhoneForDatabase(value));
  };

  const validateWhatsApp = (value: string): string | null => {
    if (!value) return null;
    return validatePhone(value).error || null;
  };

  const validateEmail = (value: string): string | null => {
    if (!value) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : "E-mail inválido";
  };

  const handleSaveNotes = async () => {
    try {
      await onUpdatePessoa('notes', notesContent);
      setIsEditingNotes(false);
      toast.success("Observações salvas!");
    } catch {
      toast.error("Erro ao salvar observações");
    }
  };

  if (!negocio) return null;

  const sidebarTabs = [
    { value: 'cliente', icon: User, label: 'Cliente' },
    { value: 'lead', icon: Briefcase, label: 'Lead' },
  ];

  return (
    <div className="w-[320px] border-r border-border bg-card flex flex-col h-full flex-none">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">

        {/* ── Tab bar — same pattern as main content ── */}
        <div className="flex-none border-b border-border bg-card dark:bg-zinc-950">
          <TabsList className="flex w-full bg-transparent p-0 h-[45px] gap-0">
            {sidebarTabs.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 text-[13px] font-normal h-[45px]",
                  "border-b-2 border-transparent rounded-none transition-colors",
                  "text-muted-foreground/60 hover:text-foreground/80 bg-transparent",
                  "data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=active]:font-medium"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5 w-full overflow-hidden" style={{ contain: 'inline-size' }}>

            {/* ────────── CLIENTE TAB ────────── */}
            <TabsContent value="cliente" className="mt-0 space-y-5">

              {/* Status de atendimento */}
              {negocio.pessoa && (
                <StatusAtendimento pessoa={negocio.pessoa} />
              )}

              {/* Produto Kiwify */}
              {negocio.pessoa?.cursos?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Produto Kiwify
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <CursoBadges cursos={negocio.pessoa.cursos} max={4} />
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Tags
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  <TagBadges tags={leadTags} max={99} />
                  <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground gap-1"
                      >
                        <TagIcon className="w-3 h-3" strokeWidth={1.5} />
                        {leadTags.length === 0 ? "Marcar tag" : "Editar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-2" align="start">
                      {allTags.length === 0 ? (
                        <p className="text-[12px] text-muted-foreground/60 px-1 py-1.5">
                          Nenhuma tag disponível.
                        </p>
                      ) : (
                        <div className="space-y-0.5 max-h-64 overflow-y-auto">
                          {allTags.map((tag) => {
                            const checked = leadTags.some((t) => t.id === tag.id);
                            return (
                              <div
                                key={tag.id}
                                className="flex items-center gap-2 px-1.5 py-1 rounded-[2px] hover:bg-muted cursor-pointer"
                                onClick={() =>
                                  toggleLeadTag.mutate({ leadId: negocio.id, tagId: tag.id, assign: !checked })
                                }
                              >
                                <Checkbox checked={checked} disabled={toggleLeadTag.isPending} />
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                <span className="text-[13px] truncate">{tag.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Canal WhatsApp (Meta/Evolution) — canal que esse lead está usando agora */}
              {negocio.pessoa && channelOptions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1">
                    <MessageSquareText className="w-3 h-3" strokeWidth={1.5} />
                    Canal WhatsApp
                  </p>
                  <Select
                    value={negocio.pessoa.active_channel_id ?? "__none__"}
                    onValueChange={(value) =>
                      setActiveChannel.mutate({
                        peopleId: negocio.pessoa.id,
                        channelId: value === "__none__" ? null : value,
                      })
                    }
                    disabled={setActiveChannel.isPending}
                  >
                    <SelectTrigger className="h-8 bg-background text-[13px]">
                      <SelectValue placeholder="Nenhum (usa o canal padrão)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum (usa o canal padrão)</SelectItem>
                      {channelOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', c.provider === 'evolution' ? 'bg-emerald-500' : 'bg-blue-500')} />
                            {c.label} {c.provider === 'evolution' ? '(não-oficial)' : ''}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dados Pessoais */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Dados Pessoais</p>
                <div className="border border-border rounded-[2px] overflow-hidden divide-y divide-border">
                  <div className="px-4 py-2.5">
                    <EditableField
                      label="Nome"
                      value={negocio.pessoa?.name}
                      type="text"
                      onSave={(value) => onUpdatePessoa('name', value)}
                      icon={<User className="w-3 h-3" />}
                      isLoading={isPendingPessoa}
                    />
                  </div>
                  <div className="px-4 py-2.5">
                    <EditableField
                      label="WhatsApp"
                      value={formatPhoneDisplay(negocio.pessoa?.whatsapp || '')}
                      type="text"
                      onSave={handleSaveWhatsApp}
                      validation={validateWhatsApp}
                      icon={<Phone className="w-3 h-3" />}
                      placeholder="+55 (00) 900000000"
                      isLoading={isPendingPessoa}
                    />
                  </div>
                  <div className="px-4 py-2.5">
                    <EditableField
                      label="E-mail"
                      value={negocio.pessoa?.email}
                      type="email"
                      onSave={(value) => onUpdatePessoa('email', value)}
                      validation={validateEmail}
                      icon={<Mail className="w-3 h-3" />}
                      isLoading={isPendingPessoa}
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Observações</p>
                  {!isEditingNotes && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-[30px] px-2 text-xs text-muted-foreground/60 hover:text-foreground gap-1 rounded-[4px] transition-all duration-300"
                      onClick={() => { setNotesContent(negocio.pessoa?.notes || ""); setIsEditingNotes(true); }}
                    >
                      <Edit2 className="w-3 h-3" strokeWidth={1.5} />
                      Editar
                    </Button>
                  )}
                </div>
                <div className="border border-border rounded-[2px] overflow-hidden">
                  {isEditingNotes ? (
                    <div className="p-3 space-y-2">
                      <RichTextEditor
                        content={notesContent}
                        onChange={setNotesContent}
                        placeholder="Adicione observações sobre o cliente..."
                        minHeight="120px"
                      />
                      <div className="flex gap-1.5 justify-end pt-1">
                        <Button variant="ghost" size="sm" className="h-[30px] px-2.5 text-xs rounded-[4px]" onClick={() => setIsEditingNotes(false)}>
                          Cancelar
                        </Button>
                        <Button size="sm" className="h-[30px] px-2.5 text-xs gap-1 rounded-[4px]" onClick={handleSaveNotes} disabled={isPendingPessoa}>
                          <Check className="w-3 h-3" strokeWidth={1.5} />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="px-4 py-3 min-h-[56px] cursor-pointer hover:bg-white/[0.035] transition-all duration-300 rounded-[2px]"
                      onClick={() => { setNotesContent(negocio.pessoa?.notes || ""); setIsEditingNotes(true); }}
                    >
                      {negocio.pessoa?.notes ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-[13px]"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(negocio.pessoa.notes) }}
                        />
                      ) : (
                        <p className="text-[13px] text-muted-foreground/40 italic">Clique para adicionar observações...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Perfil DISC */}
              {negocio.pessoa?.disc_profile && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Perfil DISC</p>
                  <div className="border border-border rounded-[2px] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <span className="text-[13px] text-muted-foreground/70">Perfil</span>
                      <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20">
                        {negocio.pessoa.disc_profile}
                      </span>
                    </div>
                    {negocio.pessoa.disc_summary && (
                      <div className="px-4 py-3">
                        <p className="text-[12px] text-muted-foreground/60 leading-relaxed">{negocio.pessoa.disc_summary}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Score */}
              {negocio.pessoa && (
                <NegocioScoreSection
                  pessoaId={negocio.pessoa.id}
                  scoreMatrixId={negocio.pessoa.score_matrix_id}
                  score={negocio.pessoa.score}
                />
              )}

              {/* Qualificação IA */}
              {fieldDefs.filter(d => d.agent_managed).length > 0 && (
                <div className="space-y-2">
                  <div className="border border-border rounded-[2px] overflow-hidden">
                    <button
                      onClick={() => setShowQualif(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.035] transition-all duration-300"
                    >
                      <div className="flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5 text-violet-500/70" strokeWidth={1.5} />
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Qualificação IA</span>
                        {(() => {
                          const filled = fieldDefs.filter(d => d.agent_managed && fieldValues.find(v => v.field_definition_id === d.id)).length;
                          const total = fieldDefs.filter(d => d.agent_managed).length;
                          return filled > 0 ? (
                            <span className="text-[10px] text-muted-foreground/35">{filled}/{total}</span>
                          ) : null;
                        })()}
                      </div>
                      <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/40 transition-transform duration-200', showQualif && 'rotate-180')} strokeWidth={1.5} />
                    </button>
                    {showQualif && (
                      <div className="divide-y divide-border">
                        {fieldDefs.filter(d => d.agent_managed).map(def => {
                          const val = fieldValues.find(v => v.field_definition_id === def.id);
                          const typed = val ? getTypedLeadValue(val, def.type) : null;
                          const display = typed !== null && typed !== undefined && typed !== '' ? String(typed) : null;
                          return (
                            <div key={def.id} className={cn('px-4 py-2.5', display && String(display).length > 40 ? 'space-y-0.5' : 'flex items-start justify-between gap-3')}>
                              {display && String(display).length > 40 ? (
                                <>
                                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide font-medium block">{def.name}</span>
                                  <span className="text-[12px] text-foreground/75 leading-relaxed whitespace-pre-wrap break-words block">{display}</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[12px] text-muted-foreground/60 shrink-0">{def.name}</span>
                                  <span className={cn('text-[12px] text-right leading-snug shrink-0 max-w-[55%] break-words', display ? 'text-foreground/80' : 'text-muted-foreground/30')}>
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
                </div>
              )}
            </TabsContent>

            {/* ────────── LEAD TAB ────────── */}
            <TabsContent value="lead" className="mt-0 space-y-5">

              {/* Negócio */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Negócio</p>
                <div className="border border-border rounded-[2px] overflow-hidden">
                  {/* Valor */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-[13px] text-muted-foreground/70">Valor</span>
                    {isEditingValue ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleValueSave(); if (e.key === 'Escape') setIsEditingValue(false); }}
                          className="h-7 w-28 text-[13px]"
                          autoFocus
                        />
                        <Button variant="ghost" size="sm" className="h-[30px] w-[30px] p-0 rounded-[4px]" onClick={handleValueSave}>
                          <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-[30px] w-[30px] p-0 rounded-[4px]" onClick={() => setIsEditingValue(false)}>
                          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingValue(true)}
                        className="flex items-center gap-1.5 group text-left"
                      >
                        <span className="text-[13px] font-medium text-foreground">{formatCurrency(negocio.value)}</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  {/* Status */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-[13px] text-muted-foreground/70">Status</span>
                    <span className={cn(
                      "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none",
                      getStatusChip()
                    )}>
                      {getStatusLabel()}
                    </span>
                  </div>
                  {/* Customer Journey */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-[13px] text-muted-foreground/70">Jornada</span>
                    <Select
                      value={negocio.lifecycle_stage || 'lead'}
                      onValueChange={async (value) => {
                        try {
                          await onUpdateNegocio({ lifecycle_stage: value });
                        } catch {
                          // Column may not exist yet (migration pending)
                        }
                      }}
                    >
                      <SelectTrigger className="h-6 w-auto text-[11px] bg-transparent border-border gap-1 pl-2 pr-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead" className="text-[12px]">Lead</SelectItem>
                        <SelectItem value="mql" className="text-[12px]">MQL</SelectItem>
                        <SelectItem value="sql" className="text-[12px]">SQL</SelectItem>
                        <SelectItem value="opportunity" className="text-[12px]">Oportunidade</SelectItem>
                        <SelectItem value="customer" className="text-[12px]">Cliente</SelectItem>
                        <SelectItem value="churned" className="text-[12px]">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Temperatura */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-[13px] text-muted-foreground/70">Temperatura</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(level => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => onUpdateNegocio({
                            pre_sale_temperature: negocio.pre_sale_temperature === level ? null : level,
                          })}
                          className="p-0.5 transition-transform hover:scale-110"
                          title={`${level}/5`}
                        >
                          <Flame
                            className={cn(
                              "w-3.5 h-3.5 transition-colors",
                              level <= (negocio.pre_sale_temperature || 0)
                                ? "text-orange-500 fill-orange-500"
                                : "text-muted-foreground/20"
                            )}
                            strokeWidth={1.5}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Fechamento */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[13px] text-muted-foreground/70">Fechamento</span>
                    <div className="flex items-center gap-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(level => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => onUpdateNegocio({
                              close_probability: negocio.close_probability === level ? null : level,
                            })}
                            className="p-0.5 transition-transform hover:scale-110"
                            title={`${level * 20}%`}
                          >
                            <Star
                              className={cn(
                                "w-3.5 h-3.5 transition-colors",
                                level <= (negocio.close_probability || 0)
                                  ? "text-amber-500 fill-amber-500"
                                  : "text-muted-foreground/20"
                              )}
                              strokeWidth={1.5}
                            />
                          </button>
                        ))}
                      </div>
                      {negocio.close_probability ? (
                        <span className="text-[10px] font-medium text-muted-foreground/40">
                          {negocio.close_probability * 20}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Atribuição */}
              {times.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Atribuição</p>
                  <AtribuirTimeResponsavel negocio={negocio} compact />
                </div>
              )}

              {/* Pipeline & Etapa */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Pipeline & Etapa</p>
                <div className="border border-border rounded-[2px] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-[13px] text-muted-foreground/70">Pipeline</span>
                    <Select value={pipelineId || ''} onValueChange={handlePipelineChange}>
                      <SelectTrigger className="h-7 w-auto max-w-[140px] text-[12px] border-0 bg-transparent pr-6 pl-0 gap-1 focus:ring-0 shadow-none">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.filter(p => p.active || p.ativo).map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-[13px]">{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-[13px] text-muted-foreground/70">Etapa</span>
                    <Select value={negocio.leads_stages_id} onValueChange={handleStageChange}>
                      <SelectTrigger className="h-7 w-auto max-w-[140px] text-[12px] border-0 bg-transparent pr-6 pl-0 gap-1 focus:ring-0 shadow-none">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStages.map(s => (
                          <SelectItem key={s.id} value={s.id} className="text-[13px]">{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Progress */}
                  <div className="px-4 py-3">
                    <div className="flex gap-0.5">
                      {filteredStages.map((stage, index) => {
                        const currentIndex = filteredStages.findIndex(s => s.id === negocio.leads_stages_id);
                        return (
                          <div
                            key={stage.id}
                            className={cn(
                              "flex-1 h-1 rounded-full transition-colors",
                              index < currentIndex ? "bg-emerald-500" :
                              stage.id === negocio.leads_stages_id ? "bg-primary" :
                              "bg-muted-foreground/20"
                            )}
                            title={stage.nome}
                          />
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground/50 mt-1.5">
                      <span className="font-medium text-foreground/60">{currentStage?.nome || "Sem etapa"}</span>
                      {' '}· {filteredStages.findIndex(s => s.id === negocio.leads_stages_id) + 1}/{filteredStages.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Empresa */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Empresa</p>
                <div className="border border-border rounded-[2px] overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          role="combobox"
                          className="w-full justify-between h-7 text-[13px] p-0 font-normal hover:bg-transparent"
                          disabled={isLoadingCompanies}
                        >
                          <span className="flex items-center gap-1.5 text-left truncate">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground/50 flex-none" strokeWidth={1.5} />
                            <span className={cn("truncate", negocio.empresa ? "text-foreground" : "text-muted-foreground/40")}>
                              {negocio.empresa?.trade_name || "Selecionar empresa..."}
                            </span>
                          </span>
                          <ChevronsUpDown className="h-3 w-3 opacity-30 flex-none" strokeWidth={1.5} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar empresa..." className="text-[13px]" />
                          <CommandList>
                            <CommandEmpty className="text-[13px]">Nenhuma empresa encontrada.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value=""
                                onSelect={async () => {
                                  await onUpdateNegocio({ company_id: null });
                                  setCompanyPopoverOpen(false);
                                  toast.success("Empresa removida!");
                                }}
                              >
                                <X className="mr-2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                                <span className="text-[13px]">Sem empresa</span>
                              </CommandItem>
                              {companies.map((company) => (
                                <CommandItem
                                  key={company.id}
                                  value={company.trade_name}
                                  onSelect={async () => {
                                    await onUpdateNegocio({ company_id: company.id });
                                    setCompanyPopoverOpen(false);
                                    toast.success("Empresa atualizada!");
                                  }}
                                >
                                  <Check
                                    className={cn("mr-2 h-3.5 w-3.5", negocio.company_id === company.id ? "opacity-100" : "opacity-0")}
                                    strokeWidth={1.5}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium truncate">{company.trade_name}</p>
                                    {company.legal_name && (
                                      <p className="text-[11px] text-muted-foreground truncate">{company.legal_name}</p>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {negocio.empresa ? (
                    <>
                      {negocio.empresa.legal_name && (
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                          <span className="text-[12px] text-muted-foreground/60">Razão Social</span>
                          <span className="text-[12px] font-medium text-foreground truncate ml-3 max-w-[150px]">{negocio.empresa.legal_name}</span>
                        </div>
                      )}
                      {negocio.empresa.tax_id && (
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                          <span className="text-[12px] text-muted-foreground/60">CNPJ</span>
                          <span className="text-[12px] font-mono font-medium text-foreground">{negocio.empresa.tax_id}</span>
                        </div>
                      )}
                      {negocio.empresa.phone && (
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                          <span className="text-[12px] text-muted-foreground/60">Telefone</span>
                          <span className="text-[12px] font-medium text-foreground">{negocio.empresa.phone}</span>
                        </div>
                      )}
                      {negocio.empresa.email && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-[12px] text-muted-foreground/60">E-mail</span>
                          <span className="text-[12px] font-medium text-foreground truncate ml-3 max-w-[150px]">{negocio.empresa.email}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-[12px] text-muted-foreground/40 italic">Nenhuma empresa vinculada</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Controle */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Controle</p>
                <div className="border border-border rounded-[2px] overflow-hidden">
                  <div className="px-4 py-2.5">
                    <EditableField
                      label=""
                      value={negocio.controle}
                      type="text"
                      onSave={(value) => onUpdateNegocio({ controle: value })}
                      icon={<Settings className="w-3 h-3" strokeWidth={1.5} />}
                      placeholder="Adicionar controle..."
                      isLoading={isPendingNegocio}
                    />
                  </div>
                </div>
              </div>

              {/* Indicação / Evento */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Indicação / Evento</p>
                <div className="border border-border rounded-[2px] overflow-hidden divide-y divide-border">
                  <div className="px-4 py-2.5">
                    <EditableField
                      label="Recomendante"
                      value={negocio.recomendante}
                      type="text"
                      onSave={(value) => onUpdateNegocio({ recomendante: value || null })}
                      placeholder="Nome do recomendante..."
                      isLoading={isPendingNegocio}
                    />
                  </div>
                  <div className="px-4 py-2.5">
                    <EditableField
                      label="Relação c/ recomendante"
                      value={negocio.relacao_recomendante}
                      type="text"
                      onSave={(value) => onUpdateNegocio({ relacao_recomendante: value || null })}
                      placeholder="Ex: amigo, familiar..."
                      isLoading={isPendingNegocio}
                    />
                  </div>
                  <div className="px-4 py-2.5">
                    <EditableField
                      label="Relação c/ corretor"
                      value={negocio.relacao_corretor}
                      type="text"
                      onSave={(value) => onUpdateNegocio({ relacao_corretor: value || null })}
                      placeholder="Ex: cliente antigo, indicação..."
                      isLoading={isPendingNegocio}
                    />
                  </div>
                  <div className="px-4 py-2.5">
                    <EditableField
                      label="Nome do evento"
                      value={negocio.nome_evento}
                      type="text"
                      onSave={(value) => onUpdateNegocio({ nome_evento: value || null })}
                      placeholder="Ex: Feira do imóvel..."
                      isLoading={isPendingNegocio}
                    />
                  </div>
                  <div className="px-4 py-2.5">
                    <EditableField
                      label="Origem da lista"
                      value={negocio.origem_lista}
                      type="text"
                      onSave={(value) => onUpdateNegocio({ origem_lista: value || null })}
                      placeholder="Ex: Lista fria, base própria..."
                      isLoading={isPendingNegocio}
                    />
                  </div>
                </div>
              </div>

              {/* Datas */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Datas</p>
                <div className="border border-border rounded-[2px] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-[13px] text-muted-foreground/70">Criado em</span>
                    <span className="text-[12px] font-medium text-foreground/80">{formatDate(negocio.created_at)}</span>
                  </div>
                  <div className={cn(
                    "flex items-center justify-between px-4 py-3",
                    (negocio.won_at || negocio.lost_at) && "border-b border-border"
                  )}>
                    <span className="text-[13px] text-muted-foreground/70">Última interação</span>
                    <span className="text-[12px] font-medium text-foreground/80">{formatDate(negocio.last_interaction_at || negocio.updated_at)}</span>
                  </div>
                  {negocio.won_at && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-[13px] text-[#00D26A]">Ganho em</span>
                      <span className="text-[12px] font-medium text-[#00D26A]">{formatDate(negocio.won_at)}</span>
                    </div>
                  )}
                  {negocio.lost_at && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-[13px] text-[#EF4444]">Perdido em</span>
                      <span className="text-[12px] font-medium text-[#EF4444]">{formatDate(negocio.lost_at)}</span>
                    </div>
                  )}
                </div>
              </div>

            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
};

export default NegocioSidebar;
