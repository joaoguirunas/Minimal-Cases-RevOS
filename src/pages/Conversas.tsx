import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ContactAvatar } from "@/components/ui/contact-avatar";
import { Search, MessageCircle, Send, User, FileAudio, PhoneCall, Phone, Mail, MessageSquare, List, ChevronDown, Bot, UserCheck, Clock, RefreshCw, FileText, Paperclip, Image as ImageIcon, Mic, Square, X as XIcon, File as FileIcon, Video as VideoIcon, Instagram, SlidersHorizontal, Calendar, Zap, ExternalLink, Heart, CornerUpLeft as ReplyIcon } from "lucide-react";
import { useEnviarMensagem } from "@/hooks/useConversas";
import { useMensagensPorPessoa } from "@/hooks/useMensagensPorPessoa";
import { useConversasPaginadas } from "@/hooks/useConversasPaginadas";
import { useMarkConversationRead } from "@/hooks/useMarkConversationRead";
import UnreadBadge from "@/components/common/UnreadBadge";
import { useRealtimeManager } from "@/contexts/RealtimeContext";
import { usePipelines } from "@/hooks/usePipelines";
import { useLeadTags } from "@/hooks/useLeadTags";
import { useWhatsappChannels, useSetPersonActiveChannel } from "@/hooks/useWhatsappChannels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConversasSidebar from "@/components/conversas/ConversasSidebar";
import ConversasBadgeMidia from "@/components/conversas/ConversasBadgeMidia";
import ScoreBadge from "@/components/conversas/ScoreBadge";
import { MessageStatusTicks } from "@/components/conversas/MessageStatusTicks";
import { MessageContent } from "@/components/conversas/MessageContent";
import { WhatsappTemplateModal } from "@/components/conversas/WhatsappTemplateModal";
import { CannedResponsesModal } from "@/components/conversas/CannedResponsesModal";
import { useCannedResponses } from "@/hooks/useCannedResponses";
import { useCanSendMessage } from "@/hooks/useCanSendMessage";
import { useSettings } from "@/hooks/useSettings";
// PessoaListItem é definido no final deste arquivo
import { useEstatisticasMensagens } from "@/hooks/useEstatisticasMensagens";
import { format, subDays, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import React from "react";
// Hook otimizado removido - usando novo sistema
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useIncrementarContadorResumo } from "@/hooks/useIncrementarContadorResumo";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { DateRange } from "react-day-picker";
import StandardPageLoader from "@/components/loading/StandardPageLoader";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { OmniTabNav } from "@/components/conversas/OmniTabNav";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOmniMediaUpload, getMessageTypeFromFile } from "@/hooks/useOmniMediaUpload";
import { extractTemplateContent, buildMetaTemplateComponents } from "@/utils/templateUtils";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
interface PessoaListItemProps {
  pessoa: any;
  isSelected: boolean;
  onClick: () => void;
  tenantId: string;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}
const truncateMessage = (message: string, maxLength: number = 40) => {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
};
const formatTimeAgo = (dateString: string, t: (key: string, replacements?: Record<string, string | number>) => string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffInHours < 1) return t('conversationsPage.timeAgo.minutesAgo');
  if (diffInHours < 24) return t('conversationsPage.timeAgo.hoursAgo', { hours: diffInHours });
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return t('conversationsPage.timeAgo.yesterday');
  if (diffInDays < 7) return t('conversationsPage.timeAgo.daysAgo', { days: diffInDays });
  return format(date, 'dd/MM/yyyy');
};
const formatTempoAbandono = (tempoAbandono: {
  dias: number;
  horas: number;
  minutos: number;
} | string) => {
  if (typeof tempoAbandono === 'string') {
    return tempoAbandono;
  }
  const {
    dias,
    horas,
    minutos
  } = tempoAbandono;
  if (dias > 0) {
    return `${dias}d`;
  }
  if (horas > 0) {
    return `${horas}h`;
  }
  if (minutos > 0) {
    return `${minutos}m`;
  }
  return "now"; // This is used for abandonment time, keep simple format
};
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
const getLastSevenDays = () => {
  const today = toZonedTime(new Date(), BRAZIL_TIMEZONE);
  const sevenDaysAgo = subDays(today, 6); // Usar subDays ao invés de addDays
  return {
    from: sevenDaysAgo,
    to: today
  };
};
const WhatsAppSvg = () => (
  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.30z" />
  </svg>
);

const TikTokSvg = ({ className = 'w-2.5 h-2.5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} fill-current shrink-0`} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
  </svg>
);

const ChannelPill = ({ channel, isFromClient }: { channel?: string; isFromClient: boolean }) => {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    instagram: { label: 'IG',      cls: 'bg-pink-500/15 text-pink-600 border-pink-300/40',   icon: <Instagram className="w-2.5 h-2.5" /> },
    whatsapp:  { label: 'WA',      cls: 'bg-green-500/15 text-green-600 border-green-300/40', icon: <WhatsAppSvg /> },
    email:     { label: 'Email',   cls: 'bg-blue-500/15 text-blue-600 border-blue-300/40',   icon: <Mail className="w-2.5 h-2.5" /> },
    sms:       { label: 'SMS',     cls: 'bg-violet-500/15 text-violet-600 border-violet-300/40', icon: <MessageSquare className="w-2.5 h-2.5" /> },
    telefone:  { label: 'Chamada', cls: 'bg-orange-500/15 text-orange-600 border-orange-300/40', icon: <Phone className="w-2.5 h-2.5" /> },
    tiktok:    { label: 'TikTok',  cls: 'bg-slate-500/15 text-slate-600 border-slate-300/40',  icon: <TikTokSvg className="w-2.5 h-2.5" /> },
  };
  const c = cfg[channel || 'whatsapp'] || cfg.whatsapp;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[9px] font-semibold leading-none ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
};

const EmailRichEditor = ({
  bodyRef,
  onInput,
  disabled,
}: {
  bodyRef: React.RefObject<HTMLDivElement>;
  onInput: () => void;
  disabled?: boolean;
}) => {
  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val ?? undefined);
    bodyRef.current?.focus();
  };
  const btnCls = "h-6 min-w-[24px] px-1 rounded flex items-center justify-center hover:bg-muted transition-colors text-foreground/70 hover:text-foreground disabled:opacity-40";
  return (
    <div className={`rounded-md border border-border overflow-hidden bg-background transition-colors focus-within:border-[#B8924B]/50 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-card flex-wrap">
        <button type="button" onClick={() => exec('bold')}   title="Negrito (Ctrl+B)"  className={`${btnCls} text-[12px] font-bold`}>B</button>
        <button type="button" onClick={() => exec('italic')} title="Itálico (Ctrl+I)"  className={`${btnCls} text-[12px] italic`}>I</button>
        <button type="button" onClick={() => exec('underline')} title="Sublinhado"     className={`${btnCls} text-[12px] underline`}>U</button>
        <div className="w-px h-3.5 bg-border/60 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} title="Lista" className={btnCls}>
          <List className="w-3 h-3" />
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} title="Lista numerada" className={`${btnCls} text-[10px] font-mono`}>1.</button>
        <div className="w-px h-3.5 bg-border/60 mx-1" />
        <button type="button"
          onClick={() => {
            const url = window.prompt('URL do link:');
            if (url) exec('createLink', url);
          }}
          title="Inserir link"
          className={`${btnCls} text-[10px]`}
        >🔗</button>
        <button type="button" onClick={() => exec('removeFormat')} title="Limpar formatação"
          className={`${btnCls} text-[10px] text-muted-foreground`}>✕fmt</button>
      </div>
      {/* contenteditable body */}
      <div
        ref={bodyRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={onInput}
        data-placeholder="Corpo do e-mail…"
        className="min-h-[100px] max-h-[200px] overflow-y-auto px-3 py-2.5 text-[13px] leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none"
      />
    </div>
  );
};

const ChannelDot = ({ channel }: { channel?: string }) => {
  const map: Record<string, string> = {
    whatsapp:  'bg-green-400',
    instagram: 'bg-pink-400',
    email:     'bg-blue-400',
    sms:       'bg-violet-400',
    telefone:  'bg-orange-400',
  };
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${map[channel || 'whatsapp'] ?? 'bg-green-400'}`}
      title={channel ?? 'whatsapp'}
    />
  );
};

const formatPhoneDisplay = (phone?: string) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 11) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return phone;
};

const Conversas = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [pessoaSelecionada, setPessoaSelecionada] = useState<string | null>(
    () => searchParams.get('pessoaId'),
  );
  const [novaMensagem, setNovaMensagem] = useState("");
  const [filtroPipeline, setFiltroPipeline] = useState<string>("todos");
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todos");
  // Remover filtro de data padrão - mostrar todo histórico
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filtroStatusAtendimento, setFiltroStatusAtendimento] = useState("open");
  const [filtroAtendimentoIA, setFiltroAtendimentoIA] = useState("todos");
  const [filtroTimeVendas, setFiltroTimeVendas] = useState("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [filtroTag, setFiltroTag] = useState("todos");
  const [filtroWhatsappChannel, setFiltroWhatsappChannel] = useState("todos");
  const [datePreset, setDatePreset] = useState<string>('todos');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [filtroCanais, setFiltroCanais] = useState<Set<string>>(new Set(['whatsapp', 'instagram', 'email', 'sms', 'telefone', 'tiktok']));
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [canalAtivo, setCanalAtivo] = useState<'whatsapp' | 'instagram' | 'email' | 'sms' | 'telefone' | 'tiktok'>('whatsapp');
  const [replyingToComment, setReplyingToComment] = useState<{ igCommentId?: string; preview: string } | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<{ id: number; wa_message_id: string | null; preview: string; senderLabel: string } | null>(null);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [cannedQuery, setCannedQuery] = useState<string | null>(null); // null = picker fechado
  const { data: cannedResponses = [] } = useCannedResponses(canalAtivo === 'instagram' ? 'instagram' : 'whatsapp');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailHtml, setEmailHtml] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emailBodyRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const offsetLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.max(180, Math.min(480, ev.clientX - offsetLeft)));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  const selectedTenantId = 'single-tenant';
  const queryClient = useQueryClient();

  // ── AI toggle mutation ────────────────────────────────────────────────────
  const toggleAIMutation = useMutation({
    mutationFn: async ({ pessoaId, enabled }: { pessoaId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('clients_people')
        .update({ ai_enabled: enabled })
        .eq('id', pessoaId);
      if (error) throw error;
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['conversas-simples-v5'] });
      queryClient.invalidateQueries({ queryKey: ['can-send-message'] });
      toast({
        title: enabled ? 'IA ativada' : 'IA desativada',
        description: enabled ? 'A IA voltará a responder automaticamente.' : 'Atendimento humano assumido com sucesso.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message || 'Não foi possível alterar o controle de IA.', variant: 'destructive' });
    },
  });

  const handleDisableAI = () => {
    if (!pessoaSelecionada) return;
    toggleAIMutation.mutate({ pessoaId: pessoaSelecionada, enabled: false });
  };

  // State for optimistic UI
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastSentMessage, setLastSentMessage] = useState<string>('');
  const [lastSentTime, setLastSentTime] = useState<number>(0);
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);

  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'imagem' | 'audio' | 'arquivo' | 'video' | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickerType = useRef<'imagem' | 'arquivo' | 'video'>('arquivo');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Typing indicator (OMNI → client WhatsApp)
  const lastTypingSentRef = useRef<number>(0);
  const { upload: uploadMedia } = useOmniMediaUpload();

  // User permissions
  const {
    isManager,
    getTeamFilter,
    currentUserId
  } = useUserPermissions();

  // Realtime via Supabase WebSocket — invalida conversas-simples-v5 em tempo real
  const {
    isConnected,
    reconnect,
    enableConversasRealtime,
    disableConversasRealtime,
  } = useRealtimeManager();

  useEffect(() => {
    if (selectedTenantId) {
      enableConversasRealtime(selectedTenantId);
    }
    return () => disableConversasRealtime();
  }, [selectedTenantId, enableConversasRealtime, disableConversasRealtime]);
  const isReunioesModuleActive = false;
  const { data: settings } = useSettings();
  const {
    pipelines: allPipelines,
    stages
  } = usePipelines();
  
  // Filter only active pipelines for selection
  const pipelines = allPipelines.filter(p => p.active || p.ativo);
  const { tags: tagOptions = [] } = useLeadTags(true);
  const { data: whatsappChannelOptions = [] } = useWhatsappChannels();
  const setActiveChannel = useSetPersonActiveChannel();

  // Buscar times de vendas (apenas quando módulo reuniões está ativo)
  const {
    data: timesVendas = []
  } = useQuery({
    queryKey: ['times-vendas', selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId || !isReunioesModuleActive) return [];
      const {
        data,
        error
        // @ts-expect-error - TypeScript inference issue with Supabase complex queries
      } = await supabase.from('settings_teams').select('id, nome').eq('tenant_id', selectedTenantId).eq('tipo', 'vendas').eq('ativo', true).order('nome');
      if (error) {
        console.error('Erro ao buscar times de vendas:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!selectedTenantId && isReunioesModuleActive
  });

  // Get team members for the selected team
  const {
    data: teamMembers = []
  } = useTeamMembers(selectedTenantId, filtroTimeVendas !== 'todos' ? filtroTimeVendas : undefined);

  // Set initial filters for non-managers
  useEffect(() => {
    if (!isManager && selectedTenantId) {
      const userTeam = getTeamFilter();
      if (userTeam && filtroTimeVendas === "todos") {
        setFiltroTimeVendas(userTeam);
      }
      if (userTeam && currentUserId && filtroResponsavel === "todos") {
        setFiltroResponsavel(currentUserId);
      }
    }
  }, [isManager, selectedTenantId, getTeamFilter, currentUserId]);
  const {
    data: rawConversasSelecionada = []
  } = useMensagensPorPessoa(pessoaSelecionada?.toString(), selectedTenantId);

  // Merge optimistic messages with real data
  const conversasSelecionada = useMemo(() => {
    if (optimisticMessages.length === 0) {
      return rawConversasSelecionada;
    }
    const allMessages = [...rawConversasSelecionada, ...optimisticMessages];

    // Sort by timestamp to maintain chronological order
    return allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [rawConversasSelecionada, optimisticMessages]);

  const enviarMensagem = useEnviarMensagem();
  const incrementarContador = useIncrementarContadorResumo();

  // Memoizar filtros para evitar re-renderizações
  // Para user type: aguardar currentUserId antes de disparar a query.
  // Enquanto nulo, tenantId='' desabilita useConversasSimples (enabled: !!tenantId).
  const filtrosConversas = useMemo(() => ({
    tenantId: (!isManager && !currentUserId) ? '' : (selectedTenantId || ''),
    searchTerm,
    statusAtendimento: filtroStatusAtendimento,
    atendimentoIA: filtroAtendimentoIA,
    dateRange,
    filtroPipeline,
    filtroEtapa,
    filtroResponsavel: isManager ? filtroResponsavel : currentUserId,
    filtroTime: isManager ? filtroTimeVendas : undefined,
    filtroTag,
    filtroChannel: filtroWhatsappChannel
  }), [selectedTenantId, searchTerm, filtroStatusAtendimento, filtroAtendimentoIA, dateRange, filtroPipeline, filtroEtapa, filtroResponsavel, filtroTimeVendas, filtroTag, filtroWhatsappChannel, isManager, currentUserId]);
  const {
    data: filteredConversas,
    isLoading,
    hasMore,
    loadMore,
    resetPagination,
    totalCount,
    refetch
  } = useConversasPaginadas(filtrosConversas);

  // AGORA definir pessoaAtual APÓS filteredConversas estar disponível
  const pessoaAtual = pessoaSelecionada ? filteredConversas.find(p => p.id === pessoaSelecionada) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tiktokOpenId = (pessoaAtual as any)?.tiktok_open_id as string | undefined;

  // Lookup pra renderizar o trecho citado quando uma mensagem tem parent_message_id (quote reply)
  const mensagensPorId = useMemo(() => {
    const map = new Map<number, { message: string; senderLabel: string }>();
    for (const c of conversasSelecionada as any[]) {
      if (c.id == null) continue;
      const senderLabel = c.from_message === 'agente_ia' ? 'IA' : c.from_message === 'humano' ? (c.user_name || 'Você') : (pessoaAtual?.nome?.split(' ')[0] || 'Cliente');
      map.set(c.id, { message: c.message || '', senderLabel });
    }
    return map;
  }, [conversasSelecionada, pessoaAtual?.nome]);

  // Marca como lida ao abrir a conversa e sempre que chegar inbound com ela aberta.
  // A RPC é idempotente; o refetch zera unread_count e o efeito para de disparar.
  const { mutate: markConversationRead } = useMarkConversationRead();
  const markReadFailedRef = useRef<Set<string>>(new Set());
  const unreadDaPessoaAtual = pessoaAtual?.unread_count ?? 0;
  useEffect(() => {
    if (!pessoaSelecionada || unreadDaPessoaAtual <= 0) return;
    // Sem acesso à conversa a RPC lança — sem esse guard o refetch traria
    // unread_count > 0 de novo e o efeito entraria em loop de chamadas falhas.
    if (markReadFailedRef.current.has(pessoaSelecionada)) return;

    const pessoaId = pessoaSelecionada;
    markConversationRead(pessoaId, {
      onError: () => { markReadFailedRef.current.add(pessoaId); },
    });
  }, [pessoaSelecionada, unreadDaPessoaAtual, markConversationRead]);

  // Filtro client-side por canal (aplicado após a query server-side)
  const conversasFiltradas = useMemo(() => {
    if (filtroCanais.size >= 6) return filteredConversas;
    return filteredConversas.filter(pessoa => {
      const hasWa     = !!pessoa.whatsapp;
      const hasIg     = !!pessoa.instagram_id || !!pessoa.instagram_user_id;
      const hasEmail  = !!pessoa.email;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasTiktok = !!(pessoa as any).tiktok_open_id;
      if (!hasWa && !hasIg && !hasEmail && !hasTiktok) return true;
      return (
        (filtroCanais.has('whatsapp')  && hasWa)     ||
        (filtroCanais.has('instagram') && hasIg)     ||
        (filtroCanais.has('email')     && hasEmail)  ||
        (filtroCanais.has('tiktok')    && hasTiktok) ||
        (filtroCanais.has('sms')       && hasWa)     ||
        (filtroCanais.has('telefone')  && hasWa)
      );
    });
  }, [filteredConversas, filtroCanais]);

  // Get lead ID for permission checking - usar múltiplas fontes
  // 1. Mensagens existentes
  // 2. Fallback: negócios da pessoa
  const leadIdFromMessages = rawConversasSelecionada[0]?.lead_id;
  const leadIdFromNegocios = pessoaAtual?.negocios?.[0]?.id;
  const leadId = leadIdFromMessages || leadIdFromNegocios;
  
  // Check if user can send message
  const { data: canSendData, isLoading: isLoadingCanSend } = useCanSendMessage(leadId, canalAtivo, pessoaSelecionada?.toString());
  

  // Refresh silencioso — sem limpar accumulatedData, sem flash
  const handleRefreshSilent = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ['conversas-simples-v5'], exact: false });
      if (pessoaSelecionada) {
        await queryClient.refetchQueries({ queryKey: ['mensagens-por-pessoa-v2', pessoaSelecionada], exact: false });
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [pessoaSelecionada, queryClient, isRefreshing]);

  // Função de atualização manual otimizada
  const handleAtualizarManual = useCallback(async () => {
    try {
      // Invalidar queries específicas de forma mais eficiente
      await queryClient.invalidateQueries({
        queryKey: ['conversas-simples-v5'],
        refetchType: 'active'
      });

      // Se há pessoa selecionada, invalidar mensagens também
      if (pessoaSelecionada) {
        await queryClient.invalidateQueries({
          queryKey: ['mensagens-por-pessoa-v2', pessoaSelecionada],
          refetchType: 'active'
        });
      }

      // Reset da paginação após invalidação
      resetPagination();
    } catch {
      // silent
    }
  }, [pessoaSelecionada, queryClient, resetPagination]);

  // Atualização silenciosa a cada 30s
  const atualizarListagemCompleta = useCallback(async () => {
    // Invalidar queries com refetchType: 'none' para evitar loading states
    queryClient.invalidateQueries({
      queryKey: ['conversas-simples-v5'],
      exact: false,
      refetchType: 'none'
    });

    // Refetch silencioso das queries específicas sem mostrar loading
    queryClient.refetchQueries({
      queryKey: ['conversas-simples-v5'],
      exact: false
    });

    // Invalidar queries de mensagens se pessoa selecionada
    if (pessoaSelecionada) {
      queryClient.refetchQueries({
        queryKey: ['mensagens-por-pessoa-v2', pessoaSelecionada],
        exact: false
      });
    }

    // Não fazer refetch() que causa reset da paginação durante auto-update
  }, [pessoaSelecionada, queryClient]);

  // Atualização automática a cada 30 segundos para reduzir carga
  useEffect(() => {
    const interval = setInterval(() => {
      atualizarListagemCompleta();
    }, 30000); // 30 segundos - menos agressivo

    return () => clearInterval(interval);
  }, [atualizarListagemCompleta]);

  // REMOVIDO: Reset automático de paginação (causava corrida com o hook)
  // Agora o reset é feito internamente pelo useConversasPaginadas quando filtros mudam

  // Reset filtro responsável quando filtro time muda
  useEffect(() => {
    if (filtroTimeVendas === 'todos') {
      setFiltroResponsavel('todos');
    } else if (!isManager && currentUserId) {
      // Para não gestores, manter o próprio ID
      setFiltroResponsavel(currentUserId);
    }
  }, [filtroTimeVendas, isManager, currentUserId]);

  // Reset filtro etapa quando pipeline muda para "todos"
  useEffect(() => {
    if (filtroPipeline === 'todos') {
      setFiltroEtapa('todos');
    }
  }, [filtroPipeline]);
  useEffect(() => {
    // Scroll apenas dentro do container de mensagens, não da página inteira
    if (conversasSelecionada.length > 0 && messagesEndRef.current) {
      // Aguardar um frame para garantir que o DOM foi atualizado
      requestAnimationFrame(() => {
        const messagesContainer = messagesEndRef.current?.closest('.overflow-y-auto');
        if (messagesContainer) {
          messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
  }, [conversasSelecionada]);
  // Clear send error when person or channel changes
  useEffect(() => { setSendError(null); }, [pessoaSelecionada, canalAtivo]);

  // Derivar canal ativo a partir da última mensagem quando pessoa muda
  useEffect(() => {
    if (!pessoaSelecionada) {
      setCanalAtivo('whatsapp');
      return;
    }
    // Auto-detect: se a pessoa só tem instagram (sem WhatsApp), ativar canal instagram
    if (pessoaAtual?.instagram_id && !pessoaAtual?.whatsapp) {
      setCanalAtivo('instagram');
      return;
    }
    if (tiktokOpenId && !pessoaAtual?.whatsapp && !pessoaAtual?.instagram_id) {
      setCanalAtivo('tiktok');
      return;
    }
    if (!rawConversasSelecionada || rawConversasSelecionada.length === 0) {
      setCanalAtivo('whatsapp');
      return;
    }
    const ultima = [...rawConversasSelecionada].reverse().find((m: any) => m.channel);
    setCanalAtivo((ultima?.channel as any) || 'whatsapp');
  }, [pessoaSelecionada, pessoaAtual?.instagram_id, pessoaAtual?.whatsapp, tiktokOpenId]);

  // Preencher emailTo quando pessoa muda
  useEffect(() => {
    setEmailTo(pessoaAtual?.email || '');
    setEmailSubject('');
    setEmailHtml('');
    if (emailBodyRef.current) emailBodyRef.current.innerHTML = '';
  }, [pessoaAtual?.id]);

  // ── AI processing lock — realtime indicator ───────────────────────────────
  // Tracks whether the AI agent is currently processing for the selected person.
  // Used to show typing bubble in chat and pulse in header.
  const [aiIsProcessing, setAiIsProcessing] = useState(false);
  // Phase: 'pensando' (first ~2.5s) → 'digitando' (after)
  const [aiPhase, setAiPhase] = useState<'pensando' | 'digitando'>('pensando');

  useEffect(() => {
    if (!aiIsProcessing) { setAiPhase('pensando'); return; }
    setAiPhase('pensando');
    const tPhase = setTimeout(() => setAiPhase('digitando'), 2500);
    // Safety: if lock stays true > 3 min (agent crashed without releasing), clear locally
    const tSafety = setTimeout(() => setAiIsProcessing(false), 3 * 60_000);
    return () => { clearTimeout(tPhase); clearTimeout(tSafety); };
  }, [aiIsProcessing]);

  useEffect(() => {
    if (!pessoaSelecionada) {
      setAiIsProcessing(false);
      return;
    }
    // Fetch initial state
    supabase
      .from('clients_people')
      .select('ai_processing_lock')
      .eq('id', pessoaSelecionada)
      .single()
      .then(({ data }) => setAiIsProcessing(data?.ai_processing_lock ?? false));

    // Subscribe to changes
    const channel = supabase
      .channel(`ai-lock-${pessoaSelecionada}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clients_people', filter: `id=eq.${pessoaSelecionada}` },
        (payload: any) => setAiIsProcessing(payload.new?.ai_processing_lock ?? false),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pessoaSelecionada]);

  // Typing indicator — fires when OMNI user types in WhatsApp channel
  // WhatsApp typing indicator lasts ~25 s; resend every 20 s while still typing
  useEffect(() => {
    if (canalAtivo !== 'whatsapp' || !pessoaSelecionada || !novaMensagem.trim()) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 20_000) return;
    lastTypingSentRef.current = now;
    supabase.functions.invoke('whatsapp-outbound', {
      body: { action: 'typing', people_id: pessoaSelecionada },
    }).catch(() => {});
  }, [novaMensagem, canalAtivo, pessoaSelecionada]);

  // Typing indicator — fires when OMNI user starts recording audio (WhatsApp only)
  useEffect(() => {
    if (!isRecording || canalAtivo !== 'whatsapp' || !pessoaSelecionada) return;
    lastTypingSentRef.current = Date.now();
    supabase.functions.invoke('whatsapp-outbound', {
      body: { action: 'typing', people_id: pessoaSelecionada },
    }).catch(() => {});
  }, [isRecording, canalAtivo, pessoaSelecionada]);

  // Refresh typing indicator every 20s during recording — WA indicator expires after ~25s
  useEffect(() => {
    if (!isRecording || canalAtivo !== 'whatsapp' || !pessoaSelecionada) return;
    const interval = setInterval(() => {
      supabase.functions.invoke('whatsapp-outbound', {
        body: { action: 'typing', people_id: pessoaSelecionada },
      }).catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [isRecording, canalAtivo, pessoaSelecionada]);

  const stagesFiltradas = filtroPipeline !== "todos" ? stages.filter(stage => stage.pipeline_id === filtroPipeline) : stages;

  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    switch (preset) {
      case 'hoje':      setDateRange({ from: subDays(today, 0), to: today }); break;
      case 'semana':    setDateRange({ from: subDays(today, 7),  to: today }); break;
      case 'mes':       setDateRange({ from: subDays(today, 30), to: today }); break;
      case '3meses':    setDateRange({ from: subDays(today, 90), to: today }); break;
      default:          setDateRange(undefined);
    }
  };

  const filtroSecundarioCount = [
    filtroStatusAtendimento !== 'open',   // 'open' é o default
    datePreset !== 'todos',                 // período ativo
    filtroPipeline !== 'todos',
    filtroEtapa !== 'todos',
    filtroAtendimentoIA !== 'todos',
    isReunioesModuleActive && filtroTimeVendas !== 'todos',
    isReunioesModuleActive && filtroResponsavel !== 'todos',
    filtroCanais.size < 5,                  // algum canal desmarcado
    filtroTag !== 'todos',
    filtroWhatsappChannel !== 'todos',
  ].filter(Boolean).length;

  const clearFiltrosSecundarios = () => {
    setFiltroStatusAtendimento('open');
    setDatePreset('todos');
    setDateRange(undefined);
    setFiltroPipeline('todos');
    setFiltroEtapa('todos');
    setFiltroAtendimentoIA('todos');
    setFiltroCanais(new Set(['whatsapp', 'instagram', 'email', 'sms', 'telefone', 'tiktok']));
    if (isManager) { setFiltroTimeVendas('todos'); setFiltroResponsavel('todos'); }
    setFiltroTag('todos');
    setFiltroWhatsappChannel('todos');
  };

  const toggleCanalFiltro = (canal: string) => {
    setFiltroCanais(prev => {
      const next = new Set(prev);
      if (next.has(canal)) {
        if (next.size === 1) return prev; // manter pelo menos 1 canal
        next.delete(canal);
      } else {
        next.add(canal);
      }
      return next;
    });
  };
  const formatDuracao = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Media helpers ────────────────────────────────────────────────────────────
  const clearMedia = (revokeUrl = true) => {
    if (revokeUrl && mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null);
    setMediaType(null);
    setMediaPreviewUrl(null);
  };

  const openFilePicker = (type: 'imagem' | 'arquivo' | 'video') => {
    filePickerType.current = type;
    if (fileInputRef.current) {
      if (type === 'imagem') fileInputRef.current.accept = 'image/*';
      else if (type === 'video') fileInputRef.current.accept = 'video/*';
      else fileInputRef.current.accept = '*/*';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const detectedType = filePickerType.current === 'imagem'
      ? 'imagem'
      : filePickerType.current === 'video'
        ? 'video'
        : getMessageTypeFromFile(file);
    const preview = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaType(detectedType);
    setMediaPreviewUrl(preview);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Priority: ogg (Firefox, native) → webm (Chrome, native — edge converts to ogg) → mp4 (Safari)
      // Do NOT prefer mp4 on Chrome: Chrome's audio/mp4 MediaRecorder can produce invalid files.
      // WebM Opus is Chrome's native format and is reliably converted server-side.
      const mimeType =
        MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
        MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' :
        'audio/webm';
      console.log(`🎙️ Audio recording: mimeType=${mimeType}`);
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext =
          mimeType.includes('mp4') ? 'm4a' :
          mimeType.includes('ogg') ? 'oga' :
          'webm';
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType });
        const preview = URL.createObjectURL(blob);
        setMediaFile(file);
        setMediaType('audio');
        setMediaPreviewUrl(preview);
        setIsRecording(false);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        setRecordingSeconds(0);
      };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar o microfone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };
  // ────────────────────────────────────────────────────────────────────────────

  const handleEnviarMensagem = async (templateId?: string, templateNome?: string, templateMessage?: string, messageOverride?: string, templateLanguageCode?: string, templateVariableValues?: string[], templateVariableNames?: string[], templateParameterFormat?: string, templateComponents?: Array<Record<string, unknown>>) => {
    const messageContent = messageOverride || (templateId ? (templateMessage || `Template: ${templateNome}`) : novaMensagem.trim());

    if ((!messageContent && !mediaFile) || !selectedTenantId || !pessoaSelecionada) {
      console.log('❌ CONVERSA: Envio bloqueado - dados faltando', {
        messageContent,
        hasMedia: !!mediaFile,
        selectedTenantId,
        pessoaSelecionada
      });
      toast({
        title: "Erro ao enviar",
        description: "Dados incompletos para enviar a mensagem.",
        variant: "destructive",
      });
      return;
    }

    // Check permissions before sending (apenas se não for template e se não estiver carregando)
    // Se canSendData ainda estiver carregando ou undefined, permitir envio para não bloquear silenciosamente
    if (canSendData?.canSend === false && !templateId) {
      toast({
        title: t('conversationsPage.chat.sendingBlocked'),
        description: canSendData?.reason || t('conversationsPage.chat.startConversation'),
        variant: "destructive",
      });
      return;
    }

    // Proteção contra envios duplos
    if (enviarMensagem.isPending || isSending) {
      console.log('⏳ CONVERSA: Envio já em andamento, ignorando...');
      return;
    }

    // Prevenir mensagens duplicadas com proteção mais rigorosa
    const now = Date.now();
    if (messageContent === lastSentMessage && now - lastSentTime < 5000) {
      toast({
        title: t('common.warning'),
        description: t('conversationsPage.chat.duplicateWarning'),
        variant: "destructive"
      });
      return;
    }
    
    // Obter lead_id das conversas existentes OU da pessoaAtual.negocios (nunca criar automaticamente)
    const leadIdFromConversas = conversasSelecionada[0]?.lead_id;
    const leadIdFromNegocios = pessoaAtual?.negocios?.[0]?.id;
    const leadIdToUse = leadIdFromConversas || leadIdFromNegocios || null;
    setIsSending(true);
    setLastSentMessage(messageContent);
    setLastSentTime(now);

    // Capture media state before clearing UI
    const capturedMedia = mediaFile;
    const capturedMediaType = mediaType;
    const capturedPreviewUrl = mediaPreviewUrl; // keep blob URL alive for optimistic display

    // Optimistic UI - mostrar mensagem imediatamente
    const optimisticMessage = {
      id: `temp-${now}`,
      message: messageContent,
      from_message: 'humano',
      created_at: new Date().toISOString(),
      tipo_mensagem: capturedMediaType || 'texto',
      media_url: capturedPreviewUrl, // blob URL — valid until we manually revoke below
      media_metadata: capturedMedia ? { file_name: capturedMedia.name, mime_type: capturedMedia.type, file_size: capturedMedia.size } : null,
      status: 'pending',
      isOptimistic: true
    };
    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    setNovaMensagem(''); // Limpar input imediatamente
    setCannedQuery(null); // Fechar picker se aberto
    clearMedia(false); // Limpar preview UI sem revogar blob URL (ainda usada no otimista)

    console.log('📤 CONVERSA: Enviando mensagem:', {
      messageContent,
      mediaType: capturedMediaType,
      leadId: leadIdToUse,
      pessoaId: pessoaSelecionada,
      templateId,
      templateNome
    });

    setSendError(null);
    try {
      // Upload de mídia (se houver) antes de salvar a mensagem
      let uploadedUrl: string | null = null;
      let uploadedMetadata: { file_name: string; mime_type: string; file_size: number } | null = null;
      if (capturedMedia && selectedTenantId) {
        setIsUploading(true);
        try {
          console.log('📎 CONVERSA: Fazendo upload de mídia...');
          const result = await uploadMedia(capturedMedia, selectedTenantId);
          uploadedUrl = result.url;
          uploadedMetadata = result.metadata;
          console.log('✅ CONVERSA: Upload concluído:', uploadedUrl);
        } catch (uploadError: any) {
          console.error('❌ CONVERSA: Erro no upload:', uploadError);
          setOptimisticMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
          if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
          setIsUploading(false);
          setIsSending(false);
          toast({ title: "Erro no upload", description: uploadError.message || "Falha ao enviar o arquivo.", variant: "destructive" });
          return;
        } finally {
          setIsUploading(false);
        }
      }

      const isCommentReply = !!replyingToComment && canalAtivo === 'instagram';
      // Private reply: person only has comment history (no DM window) — route via /{comment_id}/private_replies
      const isPrivateReply = !isCommentReply && canalAtivo === 'instagram' && !!canSendData?.commentId;

      await enviarMensagem.mutateAsync({
        from_message: 'humano',
        message: messageContent,
        tipo_mensagem: isCommentReply
          ? 'reply_comentario'
          : isPrivateReply
          ? 'private_reply'
          : (capturedMediaType || 'texto'),
        lead_id: leadIdToUse,
        tenant_id: selectedTenantId,
        pessoa_id: pessoaSelecionada,
        canal: canalAtivo,
        whatsapp_template_id: templateId,
        template_language_code: templateLanguageCode,
        template_variable_values: templateVariableValues,
        template_variable_names: templateVariableNames,
        template_parameter_format: templateParameterFormat,
        template_components: templateComponents,
        media_url: uploadedUrl,
        media_metadata: isCommentReply
          ? { reply_to_comment_id: replyingToComment.igCommentId || '' }
          : isPrivateReply
          ? { reply_to_comment_id: canSendData.commentId! }
          : uploadedMetadata,
        phone_number: canalAtivo === 'whatsapp' ? (pessoaAtual?.whatsapp ?? undefined) : undefined,
        reply_to_message_id: canalAtivo === 'whatsapp' ? replyingToMessage?.id ?? null : null,
        reply_to_wa_message_id: canalAtivo === 'whatsapp' ? replyingToMessage?.wa_message_id ?? null : null,
        onIgDeliveryError: canalAtivo === 'instagram' ? setSendError : undefined,
        onWaDeliveryError: canalAtivo === 'whatsapp' ? setSendError : undefined,
      });
      if (isCommentReply) setReplyingToComment(null);
      if (canalAtivo === 'whatsapp') setReplyingToMessage(null);

      console.log('✅ CONVERSA: Mensagem enviada com sucesso');

      // Incrementar contador de mensagens para resumo após enviar mensagem
      incrementarContador.mutate({
        pessoaId: pessoaSelecionada,
        tenantId: selectedTenantId
      });

      // Remover mensagem otimista e aguardar dados reais
      setTimeout(() => {
        setOptimisticMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        // Revogar blob URL só agora — depois que o DB message real já chegou
        if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
      }, 2000);
    } catch (error: any) {
      console.error('❌ CONVERSA: Erro ao enviar mensagem:', error);

      // Remover mensagem otimista em caso de erro
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));

      // Restaurar mensagem no input se houver erro (apenas se não for template)
      if (!templateId) {
        setNovaMensagem(messageContent);
      }

      const errMsg = error.message || t('conversationsPage.chat.errorSending');
      // Show inline persistent error for WA and IG so user can see the real reason
      if (canalAtivo === 'whatsapp' || canalAtivo === 'instagram') {
        setSendError(errMsg);
      }
      toast({
        title: t('conversationsMessages.error'),
        description: errMsg,
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };
  
  const handleSelectTemplate = async (template: any) => {
    // Defensive fallback: pessoaAtual comes from paginated list (20/page).
    // If person not in current page, fetch directly from DB to ensure template
    // variables ({{1}}, {{nome}}, etc.) are resolved to real values.
    // Without this, resolveVarToValue returns '' → Meta 400 "missing text value".
    let pessoa = pessoaAtual;
    // Fetch from DB whenever name is missing — covers: person off current page,
    // or list item has name=null (DB column was never set / merged contact).
    const pessoaName = (pessoa as any)?.name || (pessoa as any)?.nome || '';
    if ((!pessoa || !pessoaName) && pessoaSelecionada) {
      const { data: p } = await supabase
        .from('clients_people')
        .select('id, name, whatsapp, email, document, notes, score, status, type, income, moment, goal, conversation_summary')
        .eq('id', pessoaSelecionada)
        .single();
      if (p) pessoa = p;
    }

    // Normalizar: garantir que pessoa.name está sempre preenchido para {{1}} e afins
    // uses .name (real DB column) with fallback to .nome (display alias added by useConversasSimples)
    if (pessoa) {
      const resolvedName = (pessoa as any).name || (pessoa as any).nome || '';
      pessoa = { ...(pessoa as any), name: resolvedName } as typeof pessoa;
    }

    console.log('📨 CONVERSAS: Template selecionado:', {
      template_db_id: template.id,
      id_template: template.id_template,
      nome: template.nome,
      language_code: template.json_data?.languageCode,
      pessoa: pessoa ? { name: pessoa.name, whatsapp: pessoa.whatsapp } : null
    });

    // Conteúdo renderizado para exibição otimista no chat
    const senderName = user?.profile?.nome?.split(' ')[0];
    const varRoles = (template.variables && typeof template.variables === 'object') ? template.variables as Record<string, string> : undefined;
    const templateMessage = extractTemplateContent(template.json_data, pessoa, varRoles, { senderName }) || `Template: ${template.nome}`;
    // Full Meta API components array (header + body + buttons), mirrors N8N logic
    const metaComponents = buildMetaTemplateComponents(template.json_data, pessoa, varRoles, { senderName });
    const languageCode = template.json_data?.languageCode || template.json_data?.language?.code || 'pt_BR';
    // Meta API precisa do nome do template = campo name/nome do DB (igual ao N8N)
    const metaTemplateName = template.meta_template_name || template.json_data?.elementName || template.nome || template.id_template;

    handleEnviarMensagem(metaTemplateName, template.nome, templateMessage, undefined, languageCode, undefined, undefined, undefined, metaComponents);
  };
  
  const handleEnviarEmail = async () => {
    const to = emailTo.trim();
    const subject = emailSubject.trim();
    const html = emailBodyRef.current?.innerHTML || '';
    const text = emailBodyRef.current?.innerText?.trim() || '';
    if (!text || !to || !selectedTenantId || !pessoaSelecionada) return;

    const leadIdFromConversas = conversasSelecionada[0]?.lead_id;
    const leadIdFromNegocios = pessoaAtual?.negocios?.[0]?.id;
    const leadIdToUse = leadIdFromConversas || leadIdFromNegocios;
    if (!leadIdToUse) {
      toast({ title: 'Erro', description: 'Nenhum lead encontrado para enviar o e-mail.', variant: 'destructive' });
      return;
    }

    try {
      await enviarMensagem.mutateAsync({
        from_message: 'humano',
        message: html,
        tipo_mensagem: 'email',
        lead_id: leadIdToUse,
        tenant_id: selectedTenantId,
        pessoa_id: pessoaSelecionada,
        canal: 'email',
        media_metadata: { email_to: to, email_subject: subject, file_name: '', mime_type: 'text/html', file_size: html.length },
      });
      setEmailSubject('');
      setEmailHtml('');
      if (emailBodyRef.current) emailBodyRef.current.innerHTML = '';
      toast({ title: 'E-mail enviado', description: 'O N8N vai entregar o e-mail.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao enviar e-mail.', variant: 'destructive' });
    }
  };

  const handleIniciarChamada = async () => {
    if (!selectedTenantId || !pessoaSelecionada) return;
    const leadIdFromConversas = conversasSelecionada[0]?.lead_id;
    const leadIdFromNegocios = pessoaAtual?.negocios?.[0]?.id;
    const leadIdToUse = leadIdFromConversas || leadIdFromNegocios;
    if (!leadIdToUse) {
      toast({ title: "Erro", description: "Nenhum lead encontrado para iniciar a chamada.", variant: "destructive" });
      return;
    }
    try {
      await enviarMensagem.mutateAsync({
        from_message: 'humano',
        message: 'Chamada iniciada',
        tipo_mensagem: 'chamada',
        lead_id: leadIdToUse,
        tenant_id: selectedTenantId,
        pessoa_id: pessoaSelecionada,
        canal: 'telefone',
      });
      toast({ title: 'Chamada solicitada', description: 'O N8N vai iniciar a ligação.' });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao iniciar chamada.", variant: "destructive" });
    }
  };

  const getChannelBadgeForMessage = (tipoMensagem?: string, pessoa?: any) => {
    if (tipoMensagem === 'chamada') {
      return <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 rounded-md border border-orange-100">
          <Phone className="w-3 h-3 text-orange-600" />
          <span className="text-xs font-medium text-orange-700">Chamada</span>
        </div>;
    }
    if (pessoa?.whatsapp) {
      return <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-md border border-green-100">
          <svg className="w-3 h-3 text-green-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.30z" />
          </svg>
        </div>;
    }
    if (pessoa?.email) {
      return <div className="flex items-center gap-1 px-2 py-1 bg-[#B8924B]/8 rounded-md border border-[#B8924B]/20">
          <Mail className="w-3 h-3 text-[#B8924B]" />
        </div>;
    }
    return <div className="flex items-center gap-1 px-2 py-1 bg-card rounded-md border border-border">
        <MessageCircle className="w-3 h-3 text-muted-foreground" />
      </div>;
  };
  return <div className="flex flex-col h-screen bg-background">
      <OmniTabNav />
      <div className="flex flex-1 overflow-hidden">
      <div ref={sidebarRef} style={{ width: sidebarWidth }} className="shrink-0 border-r bg-card flex flex-col">
        <div className="px-2 pt-2 pb-1.5 border-b space-y-1.5">
          {/* Search + Refresh */}
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" strokeWidth={1.5} />
              <Input
                placeholder="Buscar contato..."
                className="pl-8 h-[30px] text-[13px] border-border"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-[30px] w-[30px] p-0 shrink-0"
              onClick={handleRefreshSilent}
              disabled={isRefreshing}
              title="Atualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </Button>
          </div>

          {/* Date preset + Filtros popover */}
          <div className="flex gap-1.5">
            <Select value={datePreset} onValueChange={handleDatePreset}>
              <SelectTrigger className="flex-1 h-[30px] text-[12px] border-border gap-1 pl-2 min-w-0">
                <Calendar className="w-3 h-3 text-muted-foreground/40 shrink-0" strokeWidth={1.5} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo período</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="3meses">Últ. 3 meses</SelectItem>
              </SelectContent>
            </Select>

            <Popover open={filtrosOpen} onOpenChange={setFiltrosOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-[30px] px-2.5 gap-1.5 border-border shrink-0 text-[12px] ${
                    filtroSecundarioCount > 0
                      ? 'bg-foreground text-background border-foreground hover:bg-foreground/90 hover:text-background'
                      : ''
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {filtroSecundarioCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-muted-foreground text-background leading-none">
                      {filtroSecundarioCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={4} className="w-64 p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted">
                  <span className="text-[12px] font-semibold">Filtros</span>
                  {filtroSecundarioCount > 0 && (
                    <button
                      onClick={clearFiltrosSecundarios}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <XIcon className="w-3 h-3" strokeWidth={1.5} />
                      Limpar tudo
                    </button>
                  )}
                </div>

                <div className="p-3 space-y-3">
                  {/* Status de conversa */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { value: 'todos',          label: 'Todos' },
                        { value: 'open',         label: 'Aberto' },
                        { value: 'nao_respondida', label: 'Pendente' },
                        { value: 'closed',      label: 'Fechado' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setFiltroStatusAtendimento(value)}
                          className={`text-[10px] py-1 rounded font-semibold transition-colors leading-none ${
                            filtroStatusAtendimento === value
                              ? 'bg-foreground text-background'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pipeline */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pipeline</Label>
                    <Select
                      value={filtroPipeline}
                      onValueChange={(v) => { setFiltroPipeline(v); setFiltroEtapa('todos'); }}
                    >
                      <SelectTrigger className="h-[30px] text-[12px]">
                        <SelectValue placeholder="Todos os pipelines" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os pipelines</SelectItem>
                        {pipelines.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Etapa */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Etapa</Label>
                    <Select value={filtroEtapa} onValueChange={setFiltroEtapa} disabled={filtroPipeline === 'todos'}>
                      <SelectTrigger className="h-[30px] text-[12px]">
                        <SelectValue placeholder="Todas as etapas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as etapas</SelectItem>
                        {stagesFiltradas.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tag */}
                  {tagOptions.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tag</Label>
                      <Select value={filtroTag} onValueChange={setFiltroTag}>
                        <SelectTrigger className="h-[30px] text-[12px]">
                          <SelectValue placeholder="Todas as tags" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todas as tags</SelectItem>
                          {tagOptions.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                {t.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Canal WhatsApp (Meta/Evolution) */}
                  {whatsappChannelOptions.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Canal WhatsApp</Label>
                      <Select value={filtroWhatsappChannel} onValueChange={setFiltroWhatsappChannel}>
                        <SelectTrigger className="h-[30px] text-[12px]">
                          <SelectValue placeholder="Todos os canais" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os canais</SelectItem>
                          {whatsappChannelOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="inline-flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${c.provider === 'evolution' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                {c.label} {c.provider === 'evolution' ? '(não-oficial)' : ''}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Atendimento IA */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atendimento</Label>
                    <Select value={filtroAtendimentoIA} onValueChange={setFiltroAtendimentoIA}>
                      <SelectTrigger className="h-[30px] text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ia_ativa">IA ativa</SelectItem>
                        <SelectItem value="humano">Humano</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Equipe + Responsável (módulo reuniões) */}
                  {isReunioesModuleActive && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Equipe</Label>
                        <Select value={filtroTimeVendas} onValueChange={setFiltroTimeVendas} disabled={!isManager}>
                          <SelectTrigger className="h-[30px] text-[12px]">
                            <SelectValue placeholder="Todas as equipes" />
                          </SelectTrigger>
                          <SelectContent>
                            {isManager && <SelectItem value="todos">Todas as equipes</SelectItem>}
                            {timesVendas.map(time => (
                              <SelectItem key={time.id} value={time.id}>{time.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Responsável</Label>
                        <Select
                          value={filtroResponsavel}
                          onValueChange={setFiltroResponsavel}
                          disabled={!isManager || filtroTimeVendas === 'todos'}
                        >
                          <SelectTrigger className="h-[30px] text-[12px]">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            {isManager && <SelectItem value="todos">Todos</SelectItem>}
                            {teamMembers.map(m => (
                              <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Channel filter pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {([
              { canal: 'whatsapp',  label: 'WA',    activeCls: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-300/40',
                icon: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> },
              { canal: 'instagram', label: 'IG',    activeCls: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-300/40',   icon: <Instagram className="w-2.5 h-2.5 shrink-0" /> },
              { canal: 'email',     label: 'Email', activeCls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300/40',    icon: <Mail className="w-2.5 h-2.5 shrink-0" /> },
              { canal: 'sms',       label: 'SMS',   activeCls: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-300/40', icon: <MessageSquare className="w-2.5 h-2.5 shrink-0" /> },
              { canal: 'telefone',  label: 'Tel',     activeCls: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-300/40', icon: <Phone className="w-2.5 h-2.5 shrink-0" /> },
              { canal: 'tiktok',    label: 'TikTok',  activeCls: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300/40',   icon: <TikTokSvg /> },
            ] as const).map(({ canal, label, icon, activeCls }) => {
              const active = filtroCanais.has(canal);
              return (
                <button
                  key={canal}
                  onClick={() => toggleCanalFiltro(canal)}
                  title={active ? `Ocultar ${label}` : `Mostrar ${label}`}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold transition-all ${
                    active
                      ? activeCls
                      : 'bg-transparent text-muted-foreground/25 border-border opacity-40 line-through'
                  }`}
                >
                  {icon}{label}
                </button>
              );
            })}
          </div>

          {/* Contagem */}
          <div className="text-[11px] text-muted-foreground/60 px-0.5 tabular-nums">
            {conversasFiltradas.length} {conversasFiltradas.length === 1 ? 'contato' : 'contatos'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? <div className="flex items-center justify-center py-10">
              <StandardPageLoader size="small" message="" />
            </div> : conversasFiltradas.length === 0 ? <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <MessageCircle className="w-8 h-8 text-muted-foreground/20 mb-2" strokeWidth={1} />
              <p className="text-[13px] text-muted-foreground/50">Nenhum contato encontrado</p>
            </div> : <>
              {conversasFiltradas.map(pessoa => {
            return <PessoaListItem key={pessoa.id} pessoa={pessoa} isSelected={pessoaSelecionada === pessoa.id} onClick={() => setPessoaSelecionada(pessoa.id)} tenantId={selectedTenantId || ''} t={t} />;
          })}
              
              {hasMore && <div className="p-3 border-t">
                    <Button variant="outline" className="w-full h-[30px] text-[12px] gap-1.5" onClick={loadMore} disabled={isLoading}>
                    {isLoading ? <>
                        <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Carregando...
                      </> : <>
                        <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Carregar mais
                      </>}
                  </Button>
                </div>}
            </>}
        </div>
      </div>

      <div
        onMouseDown={handleSidebarMouseDown}
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {pessoaSelecionada && pessoaAtual ? <>
            <div className="px-5 py-3 border-b bg-card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold truncate">{pessoaAtual.nome}</span>
                  <ScoreBadge score={pessoaAtual.score} />
                  {pessoaAtual.ai_enabled && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 transition-colors ${
                      aiIsProcessing
                        ? 'text-violet-700 bg-violet-200 dark:bg-violet-900/60 dark:text-violet-300'
                        : 'text-violet-600 bg-violet-100 dark:bg-violet-950/50 dark:text-violet-400'
                    }`}>
                      <Bot className={`w-2.5 h-2.5 ${aiIsProcessing ? 'animate-pulse' : ''}`} />
                      {aiIsProcessing ? (aiPhase === 'pensando' ? 'pensando...' : 'digitando...') : 'IA ativa'}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                  {pessoaAtual.whatsapp || (pessoaAtual.instagram_user_id ? `@${pessoaAtual.instagram_user_id}` : pessoaAtual.instagram_id ? `Instagram: ${pessoaAtual.instagram_id}` : t('conversationsPage.noWhatsapp'))}
                </p>
              </div>
              {/* Canal WhatsApp (Meta/Evolution) — canal atual do contato, trocável na hora */}
              {pessoaAtual.whatsapp && whatsappChannelOptions.length > 0 && (
                <Select
                  value={(pessoaAtual as any).active_channel_id ?? "__none__"}
                  onValueChange={(value) =>
                    setActiveChannel.mutate({
                      peopleId: pessoaSelecionada!,
                      channelId: value === "__none__" ? null : value,
                    })
                  }
                  disabled={setActiveChannel.isPending}
                >
                  <SelectTrigger className="h-[30px] text-[12px] w-auto gap-1.5" title="Canal WhatsApp deste contato">
                    <SelectValue placeholder="Canal padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Canal padrão</SelectItem>
                    {whatsappChannelOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${c.provider === 'evolution' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          {c.label} {c.provider === 'evolution' ? '(não-oficial)' : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* AI toggle button — quick control without leaving the conversation */}
              {pessoaAtual.ai_enabled !== undefined && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAIMutation.mutate({ pessoaId: pessoaSelecionada!, enabled: !pessoaAtual.ai_enabled })}
                  disabled={toggleAIMutation.isPending}
                  className={`gap-1.5 text-xs h-[30px] px-2.5 ${pessoaAtual.ai_enabled ? 'text-violet-600 hover:text-violet-700' : 'text-muted-foreground hover:text-foreground'}`}
                  title={pessoaAtual.ai_enabled ? 'Desativar IA para este contato' : 'Ativar IA para este contato'}
                >
                  <Bot className="w-3.5 h-3.5" />
                  {pessoaAtual.ai_enabled ? 'IA on' : 'IA off'}
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-background">
              {conversasSelecionada.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/20 mb-3" strokeWidth={1} />
                  <p className="text-[13px] font-medium text-foreground/40">{t('conversationsPage.chat.noMessages')}</p>
                  <p className="text-[12px] text-muted-foreground/35 mt-0.5">{t('conversationsPage.chat.startConversation')}</p>
                </div> : <div className="space-y-4 max-w-3xl mx-auto px-5 py-6">
                  {conversasSelecionada.map((conversa, idx) => {
              const isFromClient = conversa.from_message === 'cliente';
              const isIA        = conversa.from_message === 'agente_ia';
              const isCall      = conversa.tipo_mensagem === 'chamada';
              const isEmail     = conversa.tipo_mensagem === 'email';
              const isComment   = conversa.tipo_mensagem === 'comentario';
              const isStoryReply = conversa.tipo_mensagem === 'story_reply';
              const isStoryMention = conversa.tipo_mensagem === 'story_mention';
              const isOptimistic = !!conversa.isOptimistic;
              const timeStr     = format(new Date(conversa.created_at), 'HH:mm');

              const senderName = isIA
                ? 'IA'
                : conversa.from_message === 'humano'
                  ? (conversa.user_name || 'Você')
                  : pessoaAtual?.nome?.split(' ')[0] || 'Cliente';

              /* ── Evento de sistema (chamada / email no meio do feed) ── */
              if (isCall || (isEmail && isFromClient)) {
                const icon = isCall
                  ? <Phone className="w-3 h-3" />
                  : <Mail className="w-3 h-3" />;
                const label = isCall ? 'Chamada iniciada' : 'E-mail recebido';
                return (
                  <div key={conversa.id} className="flex items-center gap-3 py-1.5 select-none">
                    <div className="flex-1 h-px bg-border/30" />
                    <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/45 text-[11px]">
                      {icon}
                      <span className="font-medium">{label}</span>
                      <span className="opacity-60 tabular-nums">· {timeStr}</span>
                    </div>
                    <div className="flex-1 h-px bg-border/30" />
                  </div>
                );
              }

              /* ── Interações Instagram (comentário / story reply / story mention) ── */
              if (isComment || isStoryReply || isStoryMention) {
                const isStoryVariant = isStoryMention || isStoryReply;
                const typeLabel = isComment ? 'Comentou no post' : isStoryReply ? 'Respondeu ao Story' : 'Mencionou em Story';

                const meta = conversa.media_metadata as Record<string, string | boolean | undefined> | null;
                const postImageUrl = meta?.post_image_url as string | undefined;
                const postThumbnailUrl = meta?.post_thumbnail_url as string | undefined;
                const postPermalink = meta?.post_permalink as string | undefined;
                const postCaption = meta?.post_caption as string | undefined;
                const commentId = meta?.comment_id as string | undefined;
                const previewImg = postImageUrl || postThumbnailUrl;

                // ── Story variant: simple compact bubble ─────────────────
                if (isStoryVariant) {
                  const accentCls = isStoryMention
                    ? 'border-violet-300/30 bg-violet-500/8 text-violet-700 dark:text-violet-300'
                    : 'border-pink-300/30 bg-pink-500/8 text-pink-700 dark:text-pink-300';
                  const accentHeaderCls = isStoryMention ? 'text-violet-500' : 'text-pink-500';
                  const typeIcon = isStoryReply ? '📖' : '📢';
                  return (
                    <div key={conversa.id} className="flex flex-col items-start gap-0.5 max-w-[300px] lg:max-w-[360px]">
                      <div className={`w-full rounded-md rounded-bl-[4px] border px-3.5 py-2.5 ${accentCls}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Instagram className={`w-3 h-3 ${accentHeaderCls}`} />
                          <span className={`text-[10px] font-semibold ${accentHeaderCls}`}>{typeIcon} {typeLabel}</span>
                          <span className="text-[10px] text-muted-foreground/40 tabular-nums ml-auto">{timeStr}</span>
                        </div>
                        <p className="text-[13px] leading-relaxed">{conversa.message}</p>
                      </div>
                    </div>
                  );
                }

                // ── Comment: full Instagram-style post card ───────────────
                return (
                  <div key={conversa.id} className="flex flex-col items-start gap-1.5 max-w-[300px] lg:max-w-[340px] mt-3">

                    {/* ── Instagram post card ── */}
                    <div className="w-full rounded-md border border-border bg-card overflow-hidden">

                      {/* Card header — IG branding */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 via-red-400 to-yellow-400 flex items-center justify-center">
                            <Instagram className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-[11px] font-semibold text-foreground/80">instagram</span>
                        </div>
                        {postPermalink && (
                          <a
                            href={postPermalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-0.5 text-[10px] text-pink-500 hover:text-pink-600 font-medium"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Ver post
                          </a>
                        )}
                      </div>

                      {/* Post image */}
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt="Post"
                          className="w-full object-cover"
                          style={{ maxHeight: 240, minHeight: 120 }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-24 bg-gradient-to-br from-pink-500/10 via-violet-500/5 to-orange-500/10 flex items-center justify-center">
                          <Instagram className="w-8 h-8 text-pink-400/30" />
                        </div>
                      )}

                      {/* IG action bar */}
                      <div className="flex items-center px-3 pt-2 pb-1 gap-3">
                        <Heart className="w-[18px] h-[18px] text-foreground/70" />
                        <MessageCircle className="w-[18px] h-[18px] text-foreground/70" />
                        <Send className="w-[17px] h-[17px] text-foreground/70 -rotate-12" />
                      </div>

                      {/* Caption */}
                      {postCaption && (
                        <div className="px-3 pb-2">
                          <p className="text-[11.5px] text-foreground/80 leading-relaxed">
                            <span className="font-semibold text-foreground/90">instagram </span>
                            {postCaption}
                          </p>
                        </div>
                      )}

                      {/* Separator + comment */}
                      <div className="border-t border-border px-3 py-2">
                        <div className="flex items-start gap-1.5">
                          {/* Avatar — real photo or initial */}
                          <ContactAvatar
                            src={pessoaAtual?.profile_picture}
                            name={pessoaAtual?.nome || pessoaAtual?.instagram_user_id}
                            size="xs"
                            className="mt-0.5"
                            fallbackClassName="bg-gradient-to-br from-pink-400 to-violet-500 text-white"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11.5px] text-foreground/80 leading-snug">
                              <span className="font-semibold text-foreground/90">
                                {pessoaAtual?.instagram_user_id || pessoaAtual?.nome?.split(' ')[0] || 'usuário'}{' '}
                              </span>
                              {conversa.message}
                            </p>
                            <span className="text-[9.5px] text-muted-foreground/50 tabular-nums">{timeStr}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Quick actions ── */}
                    <div className="flex items-center gap-1 ml-0.5">
                      <button
                        onClick={() => {
                          setReplyingToComment({ igCommentId: commentId, preview: (conversa.message || '').slice(0, 60) });
                          setCanalAtivo('instagram');
                          textareaRef.current?.focus();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 border border-pink-300/25 transition-colors"
                      >
                        ↩ Responder
                      </button>
                      <button
                        onClick={() => { setReplyingToComment(null); setCanalAtivo('instagram'); textareaRef.current?.focus(); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-muted text-muted-foreground hover:bg-muted/50 border border-border transition-colors"
                      >
                        💬 DM
                      </button>
                    </div>
                  </div>
                );
              }

              /* ── Resposta pública a comentário ── */
              if (conversa.tipo_mensagem === 'reply_comentario') {
                return (
                  <div key={conversa.id} className="flex justify-end">
                    <div className="max-w-[340px] lg:max-w-[420px] rounded-md rounded-br-[3px] border bg-pink-600/90 border-pink-500/40 px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Instagram className="w-3 h-3 text-pink-200" />
                        <span className="text-[10px] font-semibold text-pink-200">↩ Respondeu no post</span>
                        <span className="text-[10px] text-pink-300/60 tabular-nums ml-auto">{timeStr}</span>
                      </div>
                      <p className="text-[13px] text-white leading-relaxed">{conversa.message}</p>
                    </div>
                  </div>
                );
              }

              /* ── Bolha de mensagem ──────────────────────────────────── */
              const isOutgoing = !isFromClient;

              // Forma: canto plano no lado do remetente (speech bubble sutil)
              const shapeOut = 'rounded-md rounded-br-[3px]';
              const shapeIn  = 'rounded-md rounded-bl-[3px]';

              let bubbleCls = '';
              if (isFromClient) {
                bubbleCls = `bg-card text-foreground ${shapeIn}`;
              } else if (isOptimistic) {
                bubbleCls = `bg-muted text-foreground ${shapeOut} opacity-55`;
              } else if (isIA) {
                bubbleCls = `bg-card text-foreground border-l-2 border-l-violet-400/50 ${shapeOut}`;
              } else {
                bubbleCls = `bg-background text-foreground ${shapeOut}`;
              }

              /* Footer text color */
              const footerCls = isIA
                ? 'text-violet-300/70'
                : isOptimistic
                  ? 'text-muted-foreground/70'
                  : 'text-muted-foreground';

              const parentPreview = (conversa as any).parent_message_id != null
                ? mensagensPorId.get((conversa as any).parent_message_id)
                : null;

              const canReply = canalAtivo === 'whatsapp' && !isOptimistic && !!conversa.id;
              const replyButton = canReply && (
                <button
                  onClick={() => setReplyingToMessage({
                    id: conversa.id as number,
                    wa_message_id: (conversa as any).wa_message_id ?? null,
                    preview: (conversa.message || '').slice(0, 60),
                    senderLabel: senderName,
                  })}
                  title="Responder"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-primary shrink-0"
                >
                  <ReplyIcon className="w-3.5 h-3.5" />
                </button>
              );

              return (
                <div key={conversa.id} className={`group flex items-center gap-1.5 ${isFromClient ? 'justify-start' : 'justify-end'}`}>
                  {isOutgoing && replyButton}
                  <div className={`max-w-[340px] lg:max-w-[420px] px-3.5 py-2.5 ${bubbleCls}`}>

                    {/* Rótulo — IA */}
                    {isIA && (
                      <div className="flex items-center gap-1 mb-1.5">
                        <Bot className="w-2.5 h-2.5 text-violet-500" />
                        <span className="text-[9px] font-semibold tracking-widest uppercase text-violet-500">IA</span>
                      </div>
                    )}
                    {/* Rótulo — cliente */}
                    {isFromClient && (
                      <p className="text-[10px] font-medium text-muted-foreground/45 mb-1 leading-none">
                        {senderName}
                      </p>
                    )}

                    {/* Trecho citado (quote reply) */}
                    {parentPreview && (
                      <div className="mb-1.5 pl-2 border-l-2 border-current/25 opacity-60">
                        <p className="text-[10px] font-medium leading-none mb-0.5">{parentPreview.senderLabel}</p>
                        <p className="text-[11px] leading-snug truncate">{parentPreview.message.slice(0, 80) || '📎 mídia'}</p>
                      </div>
                    )}

                    {/* Conteúdo */}
                    <MessageContent
                      message={conversa.message}
                      tipo_mensagem={conversa.tipo_mensagem}
                      media_url={conversa.media_url}
                      media_metadata={conversa.media_metadata}
                      isFromClient={isFromClient}
                      source_type={(conversa as any).source_type}
                      metadata={(conversa as any).metadata}
                    />

                    {/* Erro de entrega — visível direto no chat */}
                    {isOutgoing && conversa.status === 'error' && (() => {
                      const _de = (conversa as any).metadata?.delivery_error;
                      const errMsg = (conversa as any).metadata?.error_reason
                        || (typeof _de === 'string' ? _de : _de ? ([_de.title, _de.code != null ? `(${_de.code})` : null].filter(Boolean).join(' ') || 'Falha na entrega') : null);
                      return errMsg ? (
                        <p className="text-[10px] text-destructive mt-1 leading-snug max-w-[260px]">
                          ⚠ {errMsg}
                        </p>
                      ) : null;
                    })()}

                    {/* Rodapé: canal · hora · ticks */}
                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                      {isOutgoing && !isIA && (
                        <span className={`text-[10px] font-medium ${footerCls} mr-0.5`}>{senderName}</span>
                      )}
                      <ChannelDot channel={conversa.channel} />
                      <span className={`text-[10px] tabular-nums ${footerCls}`}>{timeStr}</span>
                      {isOutgoing && conversa.status && !isOptimistic && (
                        <MessageStatusTicks status={conversa.status} />
                      )}
                    </div>
                  </div>
                  {isFromClient && replyButton}
                </div>
              );
            })}
                  {/* AI typing bubble */}
                  {pessoaAtual?.ai_enabled && aiIsProcessing && (
                    <div className="flex justify-end">
                      <div className="bg-card border-l-2 border-l-violet-400/50 rounded-md rounded-br-[3px] px-3.5 py-2.5 flex items-center gap-2">
                        <Bot className="w-2.5 h-2.5 text-violet-400 animate-pulse" />
                        <span className="text-[9px] font-semibold tracking-widest uppercase text-violet-400 mr-0.5">IA</span>
                        {aiPhase === 'pensando' ? (
                          <span className="text-[10px] text-violet-300 italic">pensando...</span>
                        ) : (
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>}
            </div>

            <div className="p-4 border-t bg-card space-y-2.5">

                  {/* ── Canal pills — sempre visíveis acima do compositor ── */}
                  <div className="flex items-center gap-1 flex-wrap rounded-md bg-card px-2 py-1.5">
                    {pessoaAtual?.whatsapp && (
                      <button onClick={() => setCanalAtivo('whatsapp')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${canalAtivo === 'whatsapp' ? 'bg-green-500/15 border-green-400/40 text-green-700 dark:text-green-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
                        <WhatsAppSvg />WhatsApp
                      </button>
                    )}
                    <button onClick={() => setCanalAtivo('instagram')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${canalAtivo === 'instagram' ? 'bg-pink-500/15 border-pink-400/40 text-pink-700 dark:text-pink-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
                      <Instagram className="w-3 h-3" />{canalAtivo === 'instagram' && replyingToComment ? '↩ Post' : 'Instagram DM'}
                    </button>
                    <button onClick={() => setCanalAtivo('email')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${canalAtivo === 'email' ? 'bg-blue-500/15 border-blue-400/40 text-blue-700 dark:text-blue-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
                      <Mail className="w-3 h-3" />E-mail
                    </button>
                    {pessoaAtual?.whatsapp && (
                      <button onClick={() => setCanalAtivo('sms')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${canalAtivo === 'sms' ? 'bg-violet-500/15 border-violet-400/40 text-violet-700 dark:text-violet-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
                        <MessageSquare className="w-3 h-3" />SMS
                      </button>
                    )}
                    {pessoaAtual?.whatsapp && (
                      <button onClick={() => setCanalAtivo('telefone')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${canalAtivo === 'telefone' ? 'bg-orange-500/15 border-orange-400/40 text-orange-700 dark:text-orange-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
                        <Phone className="w-3 h-3" />Ligar
                      </button>
                    )}
                    <button
                      onClick={() => tiktokOpenId && setCanalAtivo('tiktok')}
                      disabled={!tiktokOpenId}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${canalAtivo === 'tiktok' ? 'bg-slate-500/15 border-slate-400/40 text-slate-700 dark:text-slate-300' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'} disabled:opacity-30 disabled:cursor-not-allowed`}>
                      <TikTokSvg className="w-3 h-3" />TikTok DM
                    </button>
                  </div>

              {/* ── Conteúdo condicional por estado + canal ── */}
              {canSendData?.needsTemplate ? (
                // Fora da janela de 24h — único modo possível é via template
                <div className="flex items-center gap-2 px-1">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-muted-foreground leading-tight truncate">
                      {canSendData.reason ?? 'Janela 24h expirada — use um template para retomar'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowTemplateModal(true)}
                    className="h-[30px] px-3 text-[11px] gap-1.5 shrink-0"
                  >
                    <FileText className="w-3 h-3" />
                    Enviar Template
                  </Button>
                </div>
              ) : !canSendData?.canSend && canSendData?.reason && (canalAtivo === 'whatsapp' || canalAtivo === 'instagram') ? (
                // Bloqueado por IA ou janela expirada (WhatsApp e Instagram)
                <div className="space-y-3">
                  <div className="flex gap-2 opacity-50">
                    <Input
                      value=""
                      disabled
                      placeholder={t('conversationsPage.chat.sendingBlocked')}
                      className="flex-1"
                    />
                    <Button disabled className="px-3">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {canSendData.isAIActive && pessoaSelecionada && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisableAI}
                        disabled={toggleAIMutation.isPending}
                        className="gap-1.5 text-xs h-[30px] px-3"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {toggleAIMutation.isPending ? 'Assumindo...' : 'Assumir controle (desativar IA)'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                // Envio livre: todos os canais quando não bloqueados
                <>

                  {/* ── Aviso de identificador ausente ────────────────── */}
                  {(() => {
                    const missingId =
                      (canalAtivo === 'instagram' && !pessoaAtual?.instagram_id && !pessoaAtual?.instagram_user_id) ||
                      (canalAtivo === 'email'     && !pessoaAtual?.email) ||
                      (canalAtivo === 'whatsapp'  && !pessoaAtual?.whatsapp) ||
                      (canalAtivo === 'sms'       && !pessoaAtual?.whatsapp) ||
                      (canalAtivo === 'telefone'  && !pessoaAtual?.whatsapp) ||
                      (canalAtivo === 'tiktok'    && !tiktokOpenId);
                    const label: Record<string, string> = {
                      instagram: 'Instagram IGSID ou @username',
                      email:     'e-mail',
                      whatsapp:  'número de WhatsApp',
                      sms:       'número de telefone',
                      telefone:  'número de telefone',
                      tiktok:    'TikTok Open ID',
                    };
                    if (!missingId) return null;
                    return (
                      <div className="flex items-center gap-2.5 rounded-md border border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/30 px-3 py-2.5">
                        <span className="text-amber-500 shrink-0">⚠</span>
                        <p className="text-[12px] text-amber-700 dark:text-amber-400 leading-snug">
                          Este contato não tem <strong>{label[canalAtivo]}</strong> cadastrado. Adicione nas informações do contato para habilitar o envio.
                        </p>
                      </div>
                    );
                  })()}

                  {canalAtivo === 'telefone' ? (
                    /* Ligação */
                    <div className="space-y-1.5">
                      <Button
                        onClick={handleIniciarChamada}
                        disabled={enviarMensagem.isPending || isSending || !pessoaAtual?.whatsapp}
                        className="w-full gap-2 h-[30px] bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-xs"
                      >
                        {enviarMensagem.isPending || isSending
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <PhoneCall className="w-4 h-4" />}
                        Ligar para {pessoaAtual?.nome?.split(' ')[0]} · {formatPhoneDisplay(pessoaAtual?.whatsapp)}
                      </Button>
                      <p className="text-[11px] text-center text-muted-foreground/40">
                        O N8N inicia a chamada via Call Pro
                      </p>
                    </div>

                  ) : canalAtivo === 'email' ? (
                    /* ── Editor de e-mail rico ─────────────────────────── */
                    <div className="space-y-2">
                      {/* Para */}
                      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 focus-within:border-[#B8924B]/50 transition-colors">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                        <span className="text-[11px] text-muted-foreground/60 shrink-0">Para:</span>
                        <input
                          value={emailTo}
                          onChange={e => setEmailTo(e.target.value)}
                          placeholder="destinatario@email.com"
                          className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground/40 focus:outline-none"
                        />
                      </div>
                      {/* Assunto */}
                      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 focus-within:border-[#B8924B]/50 transition-colors">
                        <span className="text-[11px] text-muted-foreground/60 shrink-0">Assunto:</span>
                        <input
                          value={emailSubject}
                          onChange={e => setEmailSubject(e.target.value)}
                          placeholder="Assunto do e-mail"
                          className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground/40 focus:outline-none"
                        />
                      </div>
                      {/* Corpo rich text */}
                      <EmailRichEditor
                        bodyRef={emailBodyRef}
                        onInput={() => setEmailHtml(emailBodyRef.current?.innerHTML || '')}
                        disabled={enviarMensagem.isPending || isSending}
                      />
                      {/* Rodapé */}
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[10px] text-muted-foreground/40">Ctrl+B · I · U para formatar</span>
                        <Button
                          onClick={handleEnviarEmail}
                          disabled={!emailHtml || !emailTo.trim() || enviarMensagem.isPending || isSending}
                          className="gap-1.5 h-[30px] px-4 text-[12px] bg-primary hover:bg-primary-hover text-primary-foreground"
                        >
                          {enviarMensagem.isPending || isSending
                            ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <Send className="w-3.5 h-3.5" />}
                          Enviar e-mail
                        </Button>
                      </div>
                    </div>

                  ) : (
                    /* WhatsApp / Instagram / SMS — input unificado */
                    <>
                      {/* Hidden file input */}
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

                      {/* Banner de resposta (quote) a mensagem do WhatsApp */}
                      {replyingToMessage && canalAtivo === 'whatsapp' && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/8 border border-primary/25">
                          <ReplyIcon className="w-3 h-3 text-primary shrink-0" />
                          <span className="text-[11px] flex-1 truncate">
                            ↩ Respondendo <span className="font-medium">{replyingToMessage.senderLabel}</span>: <em className="text-muted-foreground">"{replyingToMessage.preview}{replyingToMessage.preview.length >= 60 ? '…' : ''}"</em>
                          </span>
                          <button onClick={() => setReplyingToMessage(null)} className="text-muted-foreground/50 hover:text-muted-foreground shrink-0">
                            <XIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Banner de resposta a comentário */}
                      {replyingToComment && canalAtivo === 'instagram' && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-pink-500/8 border border-pink-300/30">
                          <Instagram className="w-3 h-3 text-pink-500 shrink-0" />
                          <span className="text-[11px] text-pink-600 dark:text-pink-400 flex-1 truncate">
                            ↩ Respondendo no post: <em>"{replyingToComment.preview}{replyingToComment.preview.length >= 60 ? '…' : ''}"</em>
                          </span>
                          <button onClick={() => setReplyingToComment(null)} className="text-muted-foreground/50 hover:text-muted-foreground shrink-0">
                            <XIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* ── Picker de respostas padrão (/trigger) ────────── */}
                      {cannedQuery !== null && (canalAtivo === 'whatsapp' || canalAtivo === 'instagram') && (() => {
                        const filtered = cannedResponses.filter(r =>
                          !cannedQuery ||
                          r.title.toLowerCase().includes(cannedQuery.toLowerCase()) ||
                          (r.shortcut && r.shortcut.toLowerCase().startsWith(cannedQuery.toLowerCase()))
                        );
                        if (filtered.length === 0) return null;
                        return (
                          <div className="rounded-md border border-border bg-card overflow-hidden">
                            <div className="px-3 py-1.5 border-b bg-card flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1">
                                <Zap className="w-3 h-3 text-yellow-500" />Respostas padrão
                              </span>
                              <span className="text-[10px] text-muted-foreground/40">↑↓ navegar · Enter selecionar · Esc fechar</span>
                            </div>
                            {filtered.slice(0, 6).map(r => (
                              <button
                                key={r.id}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  setNovaMensagem(r.content);
                                  setCannedQuery(null);
                                  setTimeout(() => textareaRef.current?.focus(), 0);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-medium truncate">{r.title}</span>
                                  {r.shortcut && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-card text-muted-foreground border border-border shrink-0">
                                      /{r.shortcut}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[12px] text-muted-foreground/60 truncate mt-0.5">{r.content}</p>
                              </button>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Preview de mídia */}
                      {mediaFile && !isRecording && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-md border border-border">
                          {mediaType === 'imagem' && mediaPreviewUrl && (
                            <img src={mediaPreviewUrl} alt="preview" className="w-10 h-10 rounded object-cover shrink-0" />
                          )}
                          {mediaType === 'audio' && mediaPreviewUrl && (
                            <audio src={mediaPreviewUrl} controls className="h-7 flex-1 min-w-0" />
                          )}
                          {mediaType === 'video' && mediaPreviewUrl && (
                            <video src={mediaPreviewUrl} className="w-16 h-10 rounded object-cover shrink-0" muted />
                          )}
                          {mediaType === 'arquivo' && (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <FileIcon className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[12px] text-muted-foreground truncate block max-w-[180px]">{mediaFile.name}</span>
                                <span className="text-[10px] text-muted-foreground/50">{mediaFile.size < 1024*1024 ? `${(mediaFile.size/1024).toFixed(0)} KB` : `${(mediaFile.size/(1024*1024)).toFixed(1)} MB`}</span>
                              </div>
                            </div>
                          )}
                          {isUploading ? (
                            <div className="flex items-center gap-1.5 ml-auto shrink-0 text-muted-foreground/60">
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              <span className="text-[11px]">Enviando...</span>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => clearMedia(true)}
                              className="h-6 w-6 p-0 ml-auto shrink-0 text-muted-foreground/60 hover:text-destructive">
                              <XIcon className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      )}

                      {/* UI de gravação */}
                      {isRecording && (
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-red-500/8 border border-red-500/20">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                          <span className="text-[12px] font-mono text-red-500 tabular-nums">{formatDuracao(recordingSeconds)}</span>
                          <span className="text-[12px] text-muted-foreground flex-1">Gravando áudio...</span>
                          <Button variant="ghost" size="sm" onClick={stopRecording}
                            className="h-6 w-6 p-0 shrink-0 text-red-500 hover:text-red-600">
                            <Square className="w-3 h-3 fill-current" />
                          </Button>
                        </div>
                      )}

                      {/* Campo de texto unificado */}
                      <div className={`flex items-end gap-1.5 rounded-md border bg-card px-2 py-1.5 transition-colors focus-within:border-ring/50 ${isRecording ? 'border-red-300/40' : 'border-border'}`}>
                        {/* Anexo */}
                        {!isRecording && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"
                                className="h-[30px] w-[30px] shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
                                disabled={enviarMensagem.isPending || isSending}>
                                <Paperclip className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40">
                              <DropdownMenuItem onClick={() => openFilePicker('imagem')}>
                                <ImageIcon className="w-4 h-4 mr-2 text-[#B8924B]" />Imagem
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openFilePicker('video')}>
                                <VideoIcon className="w-4 h-4 mr-2 text-purple-500" />Vídeo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={startRecording} disabled={canalAtivo === 'instagram'}>
                                <Mic className="w-4 h-4 mr-2 text-red-500" />Gravar Áudio
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openFilePicker('arquivo')}>
                                <FileIcon className="w-4 h-4 mr-2 text-muted-foreground" />Arquivo
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {/* Textarea auto-grow — hidden when audio is attached (no caption allowed) */}
                        {mediaType === 'audio' ? (
                          <span className="flex-1 text-[13px] text-muted-foreground/50 py-0.5 select-none pointer-events-none">
                            Áudio pronto — clique enviar
                          </span>
                        ) : (
                          <textarea
                            ref={textareaRef}
                            value={novaMensagem}
                            onChange={e => {
                              const val = e.target.value;
                              setNovaMensagem(val);
                              // Trigger canned responses picker on /
                              if (val === '/') {
                                setCannedQuery('');
                              } else if (val.startsWith('/') && !val.includes(' ')) {
                                setCannedQuery(val.slice(1));
                              } else {
                                setCannedQuery(null);
                              }
                              if (textareaRef.current) {
                                textareaRef.current.style.height = 'auto';
                                textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
                              }
                            }}
                            placeholder={
                              mediaFile
                                ? 'Legenda (opcional)'
                                : t('conversationsPage.chat.typeMessage')
                            }
                            rows={1}
                            disabled={isRecording || enviarMensagem.isPending || isSending}
                            onKeyDown={e => {
                              if (e.key === 'Escape' && cannedQuery !== null) {
                                e.preventDefault();
                                setCannedQuery(null);
                                return;
                              }
                              if (e.key === 'Enter' && !e.shiftKey && canSendData?.canSend && !enviarMensagem.isPending && !isSending && !isRecording && !(canalAtivo === 'instagram' && !pessoaAtual?.instagram_id && !pessoaAtual?.instagram_user_id)) {
                                if (cannedQuery !== null) { setCannedQuery(null); return; }
                                e.preventDefault();
                                handleEnviarMensagem();
                                if (textareaRef.current) textareaRef.current.style.height = 'auto';
                              }
                            }}
                            className="flex-1 bg-transparent text-[13px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none resize-none min-h-[28px] max-h-[120px] overflow-y-auto py-0.5 disabled:opacity-50"
                            style={{ height: '28px' }}
                          />
                        )}

                        {/* ⚡ Respostas padrão */}
                        <Button variant="ghost" size="icon"
                          onClick={() => setShowCannedModal(true)}
                          className="h-[30px] w-[30px] shrink-0 text-yellow-500/70 hover:text-yellow-500"
                          title="Respostas padrão">
                          <Zap className="w-4 h-4" />
                        </Button>

                        {/* Mic / Stop */}
                        {!mediaFile && (
                          isRecording ? (
                            <Button variant="ghost" size="icon" onClick={stopRecording}
                              className="h-[30px] w-[30px] shrink-0 text-red-500 hover:text-red-600">
                              <Square className="w-4 h-4 fill-current" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={startRecording}
                              disabled={enviarMensagem.isPending || isSending || canalAtivo === 'instagram'}
                              title={canalAtivo === 'instagram' ? 'Áudio não suportado pelo Instagram' : undefined}
                              className="h-[30px] w-[30px] shrink-0 text-muted-foreground/50 hover:text-muted-foreground">
                              <Mic className="w-4 h-4" />
                            </Button>
                          )
                        )}

                        {/* Enviar */}
                        <Button
                          onClick={() => {
                            handleEnviarMensagem();
                            if (textareaRef.current) textareaRef.current.style.height = 'auto';
                          }}
                          disabled={(!novaMensagem.trim() && !mediaFile) || isRecording || isUploading || enviarMensagem.isPending || isSending || (canalAtivo === 'instagram' && !pessoaAtual?.instagram_id && !pessoaAtual?.instagram_user_id)}
                          size="icon"
                          className="h-[30px] w-[30px] shrink-0 rounded-lg"
                        >
                          {isUploading || enviarMensagem.isPending || isSending
                            ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <Send className="w-3.5 h-3.5" />}
                        </Button>
                      </div>

                      {/* Inline persistent send error — especially useful for IG */}
                      {sendError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2">
                          <span className="text-destructive/70 shrink-0 text-[12px] leading-none mt-px">!</span>
                          <p className="text-[11px] text-destructive/80 leading-snug flex-1">{sendError}</p>
                          <button
                            onClick={() => setSendError(null)}
                            className="text-destructive/40 hover:text-destructive/70 shrink-0"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </> : <div className="flex-1 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center text-center px-4">
              <MessageCircle className="w-10 h-10 text-muted-foreground/20 mb-3" strokeWidth={1} />
              <p className="text-[13px] font-medium text-foreground/40">{t('conversationsPage.selectConversation')}</p>
              <p className="text-[12px] text-muted-foreground/35 mt-0.5">{t('conversationsPage.selectToStart')}</p>
            </div>
          </div>}
      </div>

      {pessoaSelecionada && pessoaAtual && <ConversasSidebar key={pessoaSelecionada} pessoa={pessoaAtual} tenantId={selectedTenantId || ''} onMerged={(canonicalId) => setPessoaSelecionada(canonicalId)} onSendLink={(url) => handleEnviarMensagem(undefined, undefined, undefined, `Olá! Agende sua reunião pelo link: ${url}`)} />}
      
      <CannedResponsesModal open={showCannedModal} onClose={() => setShowCannedModal(false)} />

      <WhatsappTemplateModal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleSelectTemplate}
      />
      </div>
    </div>;
};
const PessoaListItem = ({
  pessoa,
  isSelected,
  onClick,
  tenantId,
  t
}: PessoaListItemProps) => {
  const {
    data: estatisticas
  } = useEstatisticasMensagens(pessoa.id, tenantId);
  const getChannelBadge = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const personTiktokId = (pessoa as any).tiktok_open_id as string | undefined;
    return <ConversasBadgeMidia whatsapp={pessoa.whatsapp} instagram={pessoa.instagram_user_id || (pessoa.instagram_id ? pessoa.instagram_id : undefined)} tiktok={personTiktokId} />;
  };

  // Badge de status removido para simplificar layout

  const unreadCount = pessoa.unread_count ?? 0;
  const hasUnread = unreadCount > 0;
  const timeLabel = pessoa.data_ultima_mensagem
    ? formatTimeAgo(pessoa.data_ultima_mensagem, t)
        .replace(/há\s*/, '').replace(/atrás/, '').replace(/cerca de/, '')
        .replace(/poucos\s+minutos/, '5m').replace(/um minuto/, '1m')
        .replace(/(\d+)\s*minutos?/, '$1m').replace(/uma hora/, '1h')
        .replace(/(\d+)\s*horas?/, '$1h').replace(/um dia/, '1d')
        .replace(/(\d+)\s*dias?/, '$1d')
    : null;

  return (
    <div
      className={`relative px-3 py-2.5 cursor-pointer transition-all duration-150 ${
        isSelected ? 'bg-muted' : 'hover:bg-muted/70'
      }`}
      onClick={onClick}
    >
      {/* Indicador de seleção */}
      {isSelected && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-muted-foreground rounded-full" />
      )}

      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <ContactAvatar
          src={pessoa.profile_picture}
          name={pessoa.nome}
          size="md"
          fallbackClassName={isSelected
            ? 'bg-muted text-foreground'
            : 'bg-muted text-muted-foreground'
          }
        />

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 pt-0.5">
          {/* Linha 1: nome + badges + contador de não lidas + tempo */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[13px] leading-tight truncate ${hasUnread ? 'font-semibold text-foreground' : 'font-medium'}`}>{pessoa.nome}</span>
              <div className="shrink-0">{getChannelBadge()}</div>
              {pessoa.ai_enabled && (
                <span className="shrink-0 inline-flex" title="IA ativa">
                  <Bot className="w-3 h-3 text-violet-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <UnreadBadge variant="pill" count={unreadCount} since={pessoa.first_unread_at} />
              {timeLabel && (
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">{timeLabel}</span>
              )}
            </div>
          </div>

          {/* Linha 2: preview última mensagem */}
          {pessoa.ultima_mensagem && (
            <p className="text-[11.5px] text-muted-foreground/50 truncate leading-snug mt-0.5">
              {pessoa.ultima_mensagem.from_message === 'humano' && (
                <span className="text-muted-foreground/35">Você: </span>
              )}
              {pessoa.ultima_mensagem.from_message === 'agente_ia' && (
                <span className="text-violet-400/70">IA: </span>
              )}
              {truncateMessage(pessoa.ultima_mensagem.message, 42)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
export default Conversas;