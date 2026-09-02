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
    { value: 'cliente', icon: Briefcase, label: 'Lead' },
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
                                className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted cursor-pointer"
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
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Contato</p>
                <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
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
                      className="h-[30px] px-2 text-xs text-muted-foreground/60 hover:text-foreground gap-1 rounded-lg transition-all duration-300"
                      onClick={() => { setNotesContent(negocio.pessoa?.notes || ""); setIsEditingNotes(true); }}
                    >
                      <Edit2 className="w-3 h-3" strokeWidth={1.5} />
                      Editar
                    </Button>
                  )}
                </div>
                <div className="border border-border rounded-md overflow-hidden">
                  {isEditingNotes ? (
                    <div className="p-3 space-y-2">
                      <RichTextEditor
                        content={notesContent}
                        onChange={setNotesContent}
                        placeholder="Adicione observações sobre o cliente..."
                        minHeight="120px"
                      />
                      <div className="flex gap-1.5 justify-end pt-1">
                        <Button variant="ghost" size="sm" className="h-[30px] px-2.5 text-xs rounded-lg" onClick={() => setIsEditingNotes(false)}>
                          Cancelar
                        </Button>
                        <Button size="sm" className="h-[30px] px-2.5 text-xs gap-1 rounded-lg" onClick={handleSaveNotes} disabled={isPendingPessoa}>
                          <Check className="w-3 h-3" strokeWidth={1.5} />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="px-4 py-3 min-h-[56px] cursor-pointer hover:bg-white/[0.035] transition-all duration-300 rounded-md"
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


              {/* Negócio */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Lead</p>
                <div className="border border-border rounded-md overflow-hidden">
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
                        <Button variant="ghost" size="sm" className="h-[30px] w-[30px] p-0 rounded-lg" onClick={handleValueSave}>
                          <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-[30px] w-[30px] p-0 rounded-lg" onClick={() => setIsEditingValue(false)}>
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
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[13px] text-muted-foreground/70">Status</span>
                    <span className={cn(
                      "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md border leading-none",
                      getStatusChip()
                    )}>
                      {getStatusLabel()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pipeline & Etapa */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Pipeline & Etapa</p>
                <div className="border border-border rounded-md overflow-hidden">
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

              {/* Datas */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Datas</p>
                <div className="border border-border rounded-md overflow-hidden">
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
