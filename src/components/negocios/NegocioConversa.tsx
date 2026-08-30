import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import { WhatsappTemplateModal } from '@/components/conversas/WhatsappTemplateModal';
import { CannedResponsesModal } from '@/components/conversas/CannedResponsesModal';
import ScoreBadge from '@/components/conversas/ScoreBadge';
import { useCanSendMessage } from '@/hooks/useCanSendMessage';
import { useSettings } from '@/hooks/useSettings';
import { useCannedResponses } from '@/hooks/useCannedResponses';
import { toast } from '@/components/ui/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMensagensPorPessoa } from '@/hooks/useMensagensPorPessoa';
import { useEnviarMensagem } from '@/hooks/useConversas';
import { useNegocio } from '@/hooks/useNegocios';
import { useIncrementarContadorResumo } from '@/hooks/useIncrementarContadorResumo';
import { useOmniMediaUpload, getMessageTypeFromFile } from '@/hooks/useOmniMediaUpload';
import { extractTemplateContent, buildMetaTemplateComponents } from '@/utils/templateUtils';
import { useAuth } from '@/hooks/useAuth';
import MessageList from '@/components/negocios/conversa/MessageList';
import MessageInput from '@/components/negocios/conversa/MessageInput';

// Inline helpers moved to conversa/MessageList.tsx and conversa/MessageInput.tsx

// ── Component ─────────────────────────────────────────────────────────────────

interface NegocioConversaProps {
  negocioId: string;
}

const NegocioConversa = ({ negocioId }: NegocioConversaProps) => {
  const { user } = useAuth();
  // ── Core state ──────────────────────────────────────────────────────────────
  const [novaMensagem, setNovaMensagem]               = useState('');
  const [canalAtivo, setCanalAtivo]                   = useState<'whatsapp' | 'instagram' | 'email' | 'sms' | 'telefone'>('whatsapp');
  const [replyingToComment, setReplyingToComment]     = useState<{ igCommentId?: string; preview: string } | null>(null);
  const [replyingToMessage, setReplyingToMessage]     = useState<{ id: number; wa_message_id: string | null; preview: string; senderLabel: string } | null>(null);
  const [showTemplateModal, setShowTemplateModal]     = useState(false);
  const [showCannedModal, setShowCannedModal]         = useState(false);
  const [cannedQuery, setCannedQuery]                 = useState<string | null>(null);
  const [emailSubject, setEmailSubject]               = useState('');
  const [emailTo, setEmailTo]                         = useState('');
  const [emailHtml, setEmailHtml]                     = useState('');
  const [isSending, setIsSending]                     = useState(false);
  const [isUploading, setIsUploading]                 = useState(false);
  const [optimisticMessages, setOptimisticMessages]   = useState<any[]>([]);

  // ── Media state ─────────────────────────────────────────────────────────────
  const [mediaFile, setMediaFile]                     = useState<File | null>(null);
  const [mediaType, setMediaType]                     = useState<'imagem' | 'audio' | 'arquivo' | 'video' | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl]         = useState<string | null>(null);
  const [isRecording, setIsRecording]                 = useState(false);
  const [recordingSeconds, setRecordingSeconds]       = useState(0);

  // ── AI processing indicator ─────────────────────────────────────────────────
  const [aiIsProcessing, setAiIsProcessing]           = useState(false);
  const [aiPhase, setAiPhase]                         = useState<'pensando' | 'digitando'>('pensando');

  // ── Refs ────────────────────────────────────────────────────────────────────
  const messagesEndRef                                = useRef<HTMLDivElement>(null);
  const textareaRef                                   = useRef<HTMLTextAreaElement>(null);
  const emailBodyRef                                  = useRef<HTMLDivElement>(null);
  const fileInputRef                                  = useRef<HTMLInputElement>(null);
  const filePickerType                                = useRef<'imagem' | 'arquivo' | 'video'>('arquivo');
  const mediaRecorderRef                              = useRef<MediaRecorder | null>(null);
  const audioChunksRef                                = useRef<Blob[]>([]);
  const recordingIntervalRef                          = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const { data: negocio }                                  = useNegocio(negocioId);
  const { data: settings }                                 = useSettings();
  const { data: canSendData }                              = useCanSendMessage(negocioId, canalAtivo, negocio?.person_id ?? undefined);
  const queryClient                                        = useQueryClient();
  const enviarMensagem                                     = useEnviarMensagem();
  const incrementarContador                                = useIncrementarContadorResumo();
  const { data: cannedResponses = [] }                     = useCannedResponses(canalAtivo === 'instagram' ? 'instagram' : 'whatsapp');
  const { upload: uploadMedia }                            = useOmniMediaUpload();

  // ── AI toggle mutation ───────────────────────────────────────────────────────
  const toggleAIMutation = useMutation({
    mutationFn: async ({ pessoaId, enabled }: { pessoaId: string; enabled: boolean }) => {
      const { error } = await supabase.from('clients_people').update({ ai_enabled: enabled }).eq('id', pessoaId);
      if (error) throw error;
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['can-send-message'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['negocio', negocioId] });
      toast({ title: enabled ? 'IA ativada' : 'IA desativada' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  // ── Extended pessoa data ─────────────────────────────────────────────────────
  const { data: pessoa } = useQuery({
    queryKey: ['pessoa-negocio-conversa', negocio?.person_id],
    queryFn: async () => {
      if (!negocio?.person_id) return null;
      const { data, error } = await supabase
        .from('clients_people')
        .select('id, name, email, whatsapp, instagram_user_id, instagram_id, score, ai_enabled, ai_processing_lock')
        .eq('id', negocio.person_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!negocio?.person_id,
  });

  // ── Messages ─────────────────────────────────────────────────────────────────
  const { data: rawMensagens = [], isLoading } = useMensagensPorPessoa(negocio?.person_id);

  const conversasSelecionada = useMemo(() => {
    if (optimisticMessages.length === 0) return rawMensagens;
    return [...rawMensagens, ...optimisticMessages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [rawMensagens, optimisticMessages]);

  // ── Scroll to bottom on new messages ────────────────────────────────────────
  useEffect(() => {
    if (conversasSelecionada.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversasSelecionada]);

  // ── Set emailTo when pessoa changes ─────────────────────────────────────────
  useEffect(() => {
    setEmailTo(pessoa?.email || '');
    setEmailSubject('');
    setEmailHtml('');
    if (emailBodyRef.current) emailBodyRef.current.innerHTML = '';
  }, [pessoa?.id]);

  // ── AI processing indicator ─────────────────────────────────────────────────
  useEffect(() => {
    if (!aiIsProcessing) { setAiPhase('pensando'); return; }
    setAiPhase('pensando');
    const tPhase  = setTimeout(() => setAiPhase('digitando'), 2500);
    const tSafety = setTimeout(() => setAiIsProcessing(false), 3 * 60_000);
    return () => { clearTimeout(tPhase); clearTimeout(tSafety); };
  }, [aiIsProcessing]);

  useEffect(() => {
    if (!negocio?.person_id) { setAiIsProcessing(false); return; }
    supabase
      .from('clients_people')
      .select('ai_processing_lock')
      .eq('id', negocio.person_id)
      .single()
      .then(({ data }) => setAiIsProcessing(data?.ai_processing_lock ?? false));

    const channel = supabase
      .channel(`ai-lock-negocio-${negocio.person_id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'clients_people',
        filter: `id=eq.${negocio.person_id}`,
      }, (payload: any) => setAiIsProcessing(payload.new?.ai_processing_lock ?? false))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [negocio?.person_id]);

  // ── Auto-select canal based on last message ─────────────────────────────────
  useEffect(() => {
    if (!rawMensagens.length) return;
    const ultima = [...rawMensagens].reverse().find((m: any) => m.channel);
    if (ultima?.channel) setCanalAtivo(ultima.channel);
  }, [negocio?.person_id]);

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
      if (type === 'imagem')      fileInputRef.current.accept = 'image/*';
      else if (type === 'video')  fileInputRef.current.accept = 'video/*';
      else                        fileInputRef.current.accept = '*/*';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const detectedType = filePickerType.current === 'imagem' ? 'imagem'
      : filePickerType.current === 'video' ? 'video'
      : getMessageTypeFromFile(file);
    setMediaFile(file);
    setMediaType(detectedType);
    setMediaPreviewUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
        MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'oga' : 'webm';
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType });
        setMediaFile(file);
        setMediaType('audio');
        setMediaPreviewUrl(URL.createObjectURL(blob));
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
      toast({ title: 'Erro', description: 'Não foi possível acessar o microfone.', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleEnviarMensagem = async (
    templateId?: string,
    templateNome?: string,
    templateMessage?: string,
    messageOverride?: string,
    languageCode?: string,
    _v1?: string[],
    _v2?: string[],
    _v3?: string,
    metaComponents?: Array<Record<string, unknown>>,
  ) => {
    const messageContent = messageOverride || (templateId ? (templateMessage || `Template: ${templateNome}`) : novaMensagem.trim());
    if ((!messageContent && !mediaFile) || !negocio?.person_id) return;
    if (canSendData?.canSend === false && !templateId) {
      toast({ title: 'Envio bloqueado', description: canSendData?.reason, variant: 'destructive' });
      return;
    }
    if (enviarMensagem.isPending || isSending) return;

    const now = Date.now();
    const capturedMedia     = mediaFile;
    const capturedMediaType = mediaType;
    const capturedPreviewUrl = mediaPreviewUrl;

    // Optimistic
    const optimistic = {
      id: `temp-${now}`,
      message: messageContent,
      from_message: 'humano',
      created_at: new Date().toISOString(),
      tipo_mensagem: capturedMediaType || 'texto',
      media_url: capturedPreviewUrl,
      media_metadata: capturedMedia ? { file_name: capturedMedia.name, mime_type: capturedMedia.type } : null,
      status: 'pending',
      isOptimistic: true,
    };
    setOptimisticMessages(prev => [...prev, optimistic]);
    setNovaMensagem('');
    setCannedQuery(null);
    clearMedia(false);
    setIsSending(true);

    try {
      let mediaUrl: string | undefined;
      let uploadedType = capturedMediaType;
      if (capturedMedia && !templateId) {
        setIsUploading(true);
        const result = await uploadMedia(capturedMedia);
        setIsUploading(false);
        mediaUrl = result?.url;
      }

      await enviarMensagem.mutateAsync({
        from_message: 'humano',
        message: messageContent,
        tipo_mensagem: uploadedType || 'texto',
        lead_id: negocioId,
        tenant_id: '',
        pessoa_id: negocio.person_id,
        canal: canalAtivo,
        // phone_number enables direct whatsapp-outbound call (bypasses cron/omni-delivery-engine)
        phone_number: canalAtivo === 'whatsapp' ? (pessoaAtual?.whatsapp ?? undefined) : undefined,
        ...(mediaUrl && { media_url: mediaUrl }),
        ...(capturedMedia && { media_metadata: { file_name: capturedMedia.name, mime_type: capturedMedia.type, file_size: capturedMedia.size } }),
        ...(templateId && {
          whatsapp_template_id: templateId,
          template_language_code: languageCode,
          template_components: metaComponents,
        }),
        ...(replyingToComment?.igCommentId && {
          media_metadata: { reply_to_comment_id: replyingToComment.igCommentId },
        }),
        ...(canalAtivo === 'whatsapp' && replyingToMessage && {
          reply_to_message_id: replyingToMessage.id,
          reply_to_wa_message_id: replyingToMessage.wa_message_id,
        }),
      });

      if (replyingToComment) setReplyingToComment(null);
      if (canalAtivo === 'whatsapp') setReplyingToMessage(null);
      incrementarContador.mutate({ pessoaId: negocio.person_id });
      setOptimisticMessages([]);
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
      setOptimisticMessages([]);
    } finally {
      setIsSending(false);
      setIsUploading(false);
      if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    }
  };

  // ── Send email ────────────────────────────────────────────────────────────────
  const handleEnviarEmail = async () => {
    const to      = emailTo.trim();
    const subject = emailSubject.trim();
    const html    = emailBodyRef.current?.innerHTML || '';
    const text    = emailBodyRef.current?.innerText?.trim() || '';
    if (!text || !to || !negocio?.person_id) return;
    try {
      await enviarMensagem.mutateAsync({
        from_message: 'humano',
        message: html,
        tipo_mensagem: 'email',
        lead_id: negocioId,
        tenant_id: '',
        pessoa_id: negocio.person_id,
        canal: 'email',
        media_metadata: { email_to: to, email_subject: subject, file_name: '', mime_type: 'text/html', file_size: html.length },
      });
      setEmailSubject('');
      setEmailHtml('');
      if (emailBodyRef.current) emailBodyRef.current.innerHTML = '';
      toast({ title: 'E-mail enviado', description: 'O N8N vai entregar o e-mail.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  // ── Initiate call ────────────────────────────────────────────────────────────
  const handleIniciarChamada = async () => {
    if (!negocio?.person_id) return;
    try {
      await enviarMensagem.mutateAsync({
        from_message: 'humano',
        message: 'Chamada iniciada',
        tipo_mensagem: 'chamada',
        lead_id: negocioId,
        tenant_id: '',
        pessoa_id: negocio.person_id,
        canal: 'telefone',
      });
      toast({ title: 'Chamada solicitada', description: 'O N8N vai iniciar a ligação.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  // ── Select WhatsApp template ─────────────────────────────────────────────────
  const handleSelectTemplate = (template: any) => {
    const senderName = user?.profile?.nome?.split(' ')[0];
    const varRoles = (template.variables && typeof template.variables === 'object') ? template.variables : undefined;
    const templateMessage = extractTemplateContent(template.json_data, pessoa, varRoles, { senderName }) || `Template: ${template.nome}`;
    const metaComponents  = buildMetaTemplateComponents(template.json_data, pessoa, varRoles, { senderName });
    const languageCode    = template.json_data?.languageCode || template.json_data?.language?.code || 'pt_BR';
    const metaName        = template.meta_template_name || template.json_data?.elementName || template.nome || template.id_template;
    handleEnviarMensagem(metaName, template.nome, templateMessage, undefined, languageCode, undefined, undefined, undefined, metaComponents);
  };

  // ── Disable AI helper ────────────────────────────────────────────────────────
  const handleDisableAI = () => {
    if (!negocio?.person_id) return;
    toggleAIMutation.mutate({ pessoaId: negocio.person_id, enabled: false });
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading && !negocio) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const pessoaAtual = pessoa;
  const pessoaName  = pessoaAtual?.name || negocio?.pessoa?.nome || negocio?.pessoa?.name || '—';
  const pessoaScore = pessoaAtual?.score ?? negocio?.pessoa?.score;
  const aiEnabled   = pessoaAtual?.ai_enabled ?? negocio?.pessoa?.atendimento_ia;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b bg-card flex items-center gap-3 flex-none">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] font-semibold truncate min-w-0" title={pessoaName}>{pessoaName}</span>
            <div className="flex-shrink-0"><ScoreBadge score={pessoaScore} /></div>
            {aiEnabled && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-[2px] px-1.5 py-0.5 transition-all duration-300 flex-shrink-0 ${
                aiIsProcessing
                  ? 'text-violet-400 bg-violet-400/20 border border-violet-400/30'
                  : 'text-violet-400 bg-violet-400/10 border border-violet-400/20'
              }`}>
                <Bot className={`w-2.5 h-2.5 ${aiIsProcessing ? 'animate-pulse' : ''}`} />
                {aiIsProcessing ? (aiPhase === 'pensando' ? 'pensando...' : 'digitando...') : 'IA ativa'}
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5 truncate" title={pessoaAtual?.whatsapp || (pessoaAtual?.instagram_user_id ? `@${pessoaAtual.instagram_user_id}` : pessoaAtual?.instagram_id ? `Instagram: ${pessoaAtual.instagram_id}` : undefined)}>
            {pessoaAtual?.whatsapp || (pessoaAtual?.instagram_user_id ? `@${pessoaAtual.instagram_user_id}` : pessoaAtual?.instagram_id ? `Instagram: ${pessoaAtual.instagram_id}` : 'Sem canal identificado')}
          </p>
        </div>
        {aiEnabled !== undefined && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleAIMutation.mutate({ pessoaId: negocio?.person_id!, enabled: !aiEnabled })}
            disabled={toggleAIMutation.isPending}
            className={`gap-1.5 text-xs h-[30px] px-2.5 rounded-[4px] ${aiEnabled ? 'text-violet-400 hover:text-violet-300' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Bot className="w-3.5 h-3.5" />
            {aiEnabled ? 'IA on' : 'IA off'}
          </Button>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <MessageList
        messages={conversasSelecionada}
        pessoaName={pessoaName}
        pessoaAtual={pessoaAtual}
        canalAtivo={canalAtivo}
        aiIsProcessing={aiIsProcessing}
        aiPhase={aiPhase}
        aiEnabled={aiEnabled}
        onReplyToComment={setReplyingToComment}
        onReplyToMessage={setReplyingToMessage}
        onSetCanalAtivo={setCanalAtivo}
        onRetryMessage={(msg) => handleEnviarMensagem(undefined, undefined, undefined, msg.message)}
        messagesEndRef={messagesEndRef}
        textareaRef={textareaRef}
      />

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <MessageInput
        canalAtivo={canalAtivo}
        setCanalAtivo={setCanalAtivo}
        canSendData={canSendData}
        pessoaAtual={pessoaAtual}
        pessoaName={pessoaName}
        novaMensagem={novaMensagem}
        setNovaMensagem={setNovaMensagem}
        onSendMessage={() => handleEnviarMensagem()}
        onSendEmail={handleEnviarEmail}
        onStartCall={handleIniciarChamada}
        onOpenTemplateModal={() => setShowTemplateModal(true)}
        onDisableAI={handleDisableAI}
        isSendPending={enviarMensagem.isPending}
        isSending={isSending}
        isUploading={isUploading}
        toggleAIMutationPending={toggleAIMutation.isPending}
        mediaFile={mediaFile}
        mediaType={mediaType}
        mediaPreviewUrl={mediaPreviewUrl}
        isRecording={isRecording}
        recordingSeconds={recordingSeconds}
        onClearMedia={clearMedia}
        onOpenFilePicker={openFilePicker}
        onFileSelect={handleFileSelect}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        textareaRef={textareaRef}
        emailBodyRef={emailBodyRef}
        fileInputRef={fileInputRef}
        cannedQuery={cannedQuery}
        setCannedQuery={setCannedQuery}
        cannedResponses={cannedResponses}
        onOpenCannedModal={() => setShowCannedModal(true)}
        replyingToComment={replyingToComment}
        setReplyingToComment={setReplyingToComment}
        replyingToMessage={replyingToMessage}
        setReplyingToMessage={setReplyingToMessage}
        emailTo={emailTo}
        setEmailTo={setEmailTo}
        emailSubject={emailSubject}
        setEmailSubject={setEmailSubject}
        emailHtml={emailHtml}
        setEmailHtml={setEmailHtml}
      />

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <WhatsappTemplateModal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleSelectTemplate}
      />
      <CannedResponsesModal
        open={showCannedModal}
        onClose={() => setShowCannedModal(false)}
      />
    </div>
  );
};

export default NegocioConversa;
