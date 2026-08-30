import React, { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import {
  Send, Bot, MessageCircle, Instagram, Mail, Phone, PhoneCall,
  Paperclip, Mic, Square, X as XIcon, File as FileIcon,
  Image as ImageIcon, Video as VideoIcon, Zap, FileText, Clock,
  UserCheck, List, CornerUpLeft as ReplyIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Inline helpers ───────────────────────────────────────────────────────────

const WhatsAppSvg = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.48z" />
  </svg>
);

const EmailRichEditor = ({
  bodyRef,
  onInput,
  disabled,
}: {
  bodyRef: RefObject<HTMLDivElement>;
  onInput: () => void;
  disabled?: boolean;
}) => {
  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val ?? undefined);
    bodyRef.current?.focus();
  };
  const btnCls = 'h-6 min-w-[24px] px-1 rounded flex items-center justify-center hover:bg-muted transition-colors text-foreground/70 hover:text-foreground disabled:opacity-40';
  return (
    <div className={`rounded-[4px] border border-border overflow-hidden bg-background transition-colors focus-within:border-[#3B82F6]/60 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted flex-wrap">
        <button type="button" onClick={() => exec('bold')}      className={`${btnCls} text-[12px] font-bold`}>B</button>
        <button type="button" onClick={() => exec('italic')}    className={`${btnCls} text-[12px] italic`}>I</button>
        <button type="button" onClick={() => exec('underline')} className={`${btnCls} text-[12px] underline`}>U</button>
        <div className="w-px h-3.5 bg-border/60 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className={btnCls}><List className="w-3 h-3" /></button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={`${btnCls} text-[10px] font-mono`}>1.</button>
        <div className="w-px h-3.5 bg-border/60 mx-1" />
        <button type="button"
          onClick={() => { const url = window.prompt('URL do link:'); if (url) exec('createLink', url); }}
          className={`${btnCls} text-[10px]`}>🔗</button>
        <button type="button" onClick={() => exec('removeFormat')} className={`${btnCls} text-[10px] text-muted-foreground`}>✕fmt</button>
      </div>
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

const formatPhoneDisplay = (phone?: string) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 11) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  return phone;
};

const formatDuracao = (segundos: number) => {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ── Types ────────────────────────────────────────────────────────────────────

interface MessageInputProps {
  canalAtivo: 'whatsapp' | 'instagram' | 'email' | 'sms' | 'telefone';
  setCanalAtivo: (canal: any) => void;
  canSendData: any;
  pessoaAtual: any;
  pessoaName: string;
  novaMensagem: string;
  setNovaMensagem: (val: string) => void;
  onSendMessage: () => void;
  onSendEmail: () => void;
  onStartCall: () => void;
  onOpenTemplateModal: () => void;
  onDisableAI: () => void;
  isSendPending: boolean;
  isSending: boolean;
  isUploading: boolean;
  toggleAIMutationPending: boolean;
  mediaFile: File | null;
  mediaType: 'imagem' | 'audio' | 'arquivo' | 'video' | null;
  mediaPreviewUrl: string | null;
  isRecording: boolean;
  recordingSeconds: number;
  onClearMedia: (revokeUrl?: boolean) => void;
  onOpenFilePicker: (type: 'imagem' | 'arquivo' | 'video') => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  emailBodyRef: RefObject<HTMLDivElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  cannedQuery: string | null;
  setCannedQuery: (val: string | null) => void;
  cannedResponses: any[];
  onOpenCannedModal: () => void;
  replyingToComment: { igCommentId?: string; preview: string } | null;
  setReplyingToComment: (val: any) => void;
  replyingToMessage?: { id: number; wa_message_id: string | null; preview: string; senderLabel: string } | null;
  setReplyingToMessage?: (val: any) => void;
  emailTo: string;
  setEmailTo: (val: string) => void;
  emailSubject: string;
  setEmailSubject: (val: string) => void;
  emailHtml: string;
  setEmailHtml: (val: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

const MessageInput: React.FC<MessageInputProps> = ({
  canalAtivo, setCanalAtivo,
  canSendData, pessoaAtual, pessoaName,
  novaMensagem, setNovaMensagem,
  onSendMessage, onSendEmail, onStartCall, onOpenTemplateModal, onDisableAI,
  isSendPending, isSending, isUploading, toggleAIMutationPending,
  mediaFile, mediaType, mediaPreviewUrl, isRecording, recordingSeconds,
  onClearMedia, onOpenFilePicker, onFileSelect, onStartRecording, onStopRecording,
  textareaRef, emailBodyRef, fileInputRef,
  cannedQuery, setCannedQuery, cannedResponses, onOpenCannedModal,
  replyingToComment, setReplyingToComment,
  replyingToMessage, setReplyingToMessage,
  emailTo, setEmailTo, emailSubject, setEmailSubject, emailHtml, setEmailHtml,
}) => {
  return (
    <div className="p-4 border-t bg-card space-y-2.5 flex-none" role="region" aria-label="Área de envio de mensagem">

      {/* Channel pills */}
      <div className="flex items-center gap-1 flex-wrap rounded-[2px] bg-muted px-2 py-1.5">
        {pessoaAtual?.whatsapp && (
          <button onClick={() => setCanalAtivo('whatsapp')} aria-label="Canal WhatsApp" aria-pressed={canalAtivo === 'whatsapp'}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium border transition-all ${canalAtivo === 'whatsapp' ? 'bg-[#00D26A]/10 border-[#00D26A]/30 text-[#00D26A]' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
            <WhatsAppSvg />WhatsApp
          </button>
        )}
        <button onClick={() => setCanalAtivo('instagram')} aria-label="Canal Instagram" aria-pressed={canalAtivo === 'instagram'}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium border transition-all ${canalAtivo === 'instagram' ? 'bg-violet-400/10 border-violet-400/30 text-violet-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
          <Instagram className="w-3 h-3" />{canalAtivo === 'instagram' && replyingToComment ? '↩ Post' : 'Instagram DM'}
        </button>
        <button onClick={() => setCanalAtivo('email')} aria-label="Canal E-mail" aria-pressed={canalAtivo === 'email'}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium border transition-all ${canalAtivo === 'email' ? 'bg-[#3B82F6]/10 border-[#3B82F6]/30 text-[#3B82F6]' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
          <Mail className="w-3 h-3" />E-mail
        </button>
        {pessoaAtual?.whatsapp && (
          <button onClick={() => setCanalAtivo('sms')} aria-label="Canal SMS" aria-pressed={canalAtivo === 'sms'}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium border transition-all ${canalAtivo === 'sms' ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#8B5CF6]' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
            <MessageCircle className="w-3 h-3" />SMS
          </button>
        )}
        {pessoaAtual?.whatsapp && (
          <button onClick={() => setCanalAtivo('telefone')} aria-label="Canal Telefone" aria-pressed={canalAtivo === 'telefone'}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium border transition-all ${canalAtivo === 'telefone' ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'}`}>
            <Phone className="w-3 h-3" />Ligar
          </button>
        )}
      </div>

      {/* Conditional content */}
      {canSendData?.needsTemplate && canalAtivo === 'whatsapp' ? (
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              Janela 24h expirada — use um template para retomar
            </p>
          </div>
          <Button size="sm" onClick={onOpenTemplateModal} className="h-7 px-3 text-[11px] gap-1.5 shrink-0">
            <FileText className="w-3 h-3" />Enviar Template
          </Button>
        </div>
      ) : !canSendData?.canSend && canSendData?.reason && (canalAtivo === 'whatsapp' || canalAtivo === 'instagram') ? (
        <div className="space-y-3">
          <div className="flex gap-2 opacity-50">
            <input value="" disabled placeholder="Envio bloqueado" className="flex-1 h-9 text-[13px] rounded-[4px] border border-input bg-background px-3 cursor-not-allowed" aria-label="Envio bloqueado" />
            <Button disabled aria-label="Enviar"><Send className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-2 text-sm text-destructive">
              {canSendData.isAIActive && <Bot className="w-4 h-4" />}
              <span>{canSendData.reason}</span>
            </div>
            {canSendData.isAIActive && (
              <Button variant="outline" size="sm" onClick={onDisableAI} disabled={toggleAIMutationPending} className="gap-1.5 text-xs h-7 px-3">
                <UserCheck className="w-3.5 h-3.5" />
                {toggleAIMutationPending ? 'Assumindo...' : 'Assumir controle (desativar IA)'}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Missing identifier warning */}
          {(() => {
            const missingId =
              (canalAtivo === 'instagram' && !pessoaAtual?.instagram_id && !pessoaAtual?.instagram_user_id) ||
              (canalAtivo === 'email'     && !pessoaAtual?.email) ||
              (canalAtivo === 'whatsapp'  && !pessoaAtual?.whatsapp) ||
              (canalAtivo === 'sms'       && !pessoaAtual?.whatsapp) ||
              (canalAtivo === 'telefone'  && !pessoaAtual?.whatsapp);
            const label: Record<string, string> = {
              instagram: 'Instagram IGSID ou @username',
              email: 'e-mail', whatsapp: 'número de WhatsApp', sms: 'número de telefone', telefone: 'número de telefone',
            };
            if (!missingId) return null;
            return (
              <div className="flex items-center gap-2.5 rounded-[2px] border border-[#F59E0B]/20 bg-[#F59E0B]/10 px-3 py-2.5">
                <span className="text-amber-500 shrink-0">⚠</span>
                <p className="text-[12px] text-[#F59E0B] leading-snug">
                  Este contato não tem <strong>{label[canalAtivo]}</strong> cadastrado.
                </p>
              </div>
            );
          })()}

          {/* Phone call */}
          {canalAtivo === 'telefone' ? (
            <div className="space-y-1.5">
              <Button onClick={onStartCall} disabled={isSendPending || isSending || !pessoaAtual?.whatsapp} className="w-full gap-2 h-[30px] bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white rounded-[4px] font-medium text-xs">
                {isSendPending || isSending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <PhoneCall className="w-4 h-4" />}
                Ligar para {pessoaName.split(' ')[0]} · {formatPhoneDisplay(pessoaAtual?.whatsapp)}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground/40">O N8N inicia a chamada via Call Pro</p>
            </div>

          ) : canalAtivo === 'email' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-[4px] border border-border bg-muted px-2.5 py-1.5 focus-within:border-[#3B82F6]/60 transition-all duration-300">
                <Mail className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                <span className="text-[11px] text-muted-foreground/60 shrink-0">Para:</span>
                <input value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="destinatario@email.com" className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground/40 focus:outline-none" aria-label="Destinatário do e-mail" />
              </div>
              <div className="flex items-center gap-2 rounded-[4px] border border-border bg-muted px-2.5 py-1.5 focus-within:border-[#3B82F6]/60 transition-all duration-300">
                <span className="text-[11px] text-muted-foreground/60 shrink-0">Assunto:</span>
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Assunto do e-mail" className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground/40 focus:outline-none" aria-label="Assunto do e-mail" />
              </div>
              <EmailRichEditor bodyRef={emailBodyRef} onInput={() => setEmailHtml(emailBodyRef.current?.innerHTML || '')} disabled={isSendPending || isSending} />
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-muted-foreground/40">Ctrl+B · I · U para formatar</span>
                <Button onClick={onSendEmail} disabled={!emailHtml || !emailTo.trim() || isSendPending || isSending} className="gap-1.5 h-[30px] px-4 text-[12px] rounded-[4px] bg-primary hover:bg-primary-hover text-primary-foreground">
                  {isSendPending || isSending
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5" />}
                  Enviar e-mail
                </Button>
              </div>
            </div>

          ) : (
            /* WhatsApp / Instagram / SMS */
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelect} aria-hidden="true" />

              {/* Reply-to-message banner (quote reply, WhatsApp) */}
              {replyingToMessage && canalAtivo === 'whatsapp' && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] bg-primary/8 border border-primary/25">
                  <ReplyIcon className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[11px] flex-1 truncate">
                    ↩ Respondendo <span className="font-medium">{replyingToMessage.senderLabel}</span>: <em className="text-muted-foreground">"{replyingToMessage.preview}{replyingToMessage.preview.length >= 60 ? '…' : ''}"</em>
                  </span>
                  <button onClick={() => setReplyingToMessage?.(null)} className="text-muted-foreground/50 hover:text-muted-foreground shrink-0" aria-label="Cancelar resposta">
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Reply-to-comment banner */}
              {replyingToComment && canalAtivo === 'instagram' && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] bg-violet-400/8 border border-violet-400/30">
                  <Instagram className="w-3 h-3 text-pink-500 shrink-0" />
                  <span className="text-[11px] text-violet-400 flex-1 truncate">
                    ↩ Respondendo no post: <em>"{replyingToComment.preview}{replyingToComment.preview.length >= 60 ? '…' : ''}"</em>
                  </span>
                  <button onClick={() => setReplyingToComment(null)} className="text-muted-foreground/50 hover:text-muted-foreground shrink-0" aria-label="Cancelar resposta">
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Canned responses picker */}
              {cannedQuery !== null && (canalAtivo === 'whatsapp' || canalAtivo === 'instagram') && (() => {
                const filtered = cannedResponses.filter((r: any) =>
                  !cannedQuery ||
                  r.title.toLowerCase().includes(cannedQuery.toLowerCase()) ||
                  (r.shortcut && r.shortcut.toLowerCase().startsWith(cannedQuery.toLowerCase()))
                );
                if (!filtered.length) return null;
                return (
                  <div className="rounded-[2px] border border-border bg-card overflow-hidden" role="listbox" aria-label="Respostas padrão">
                    <div className="px-3 py-1.5 border-b border-border bg-muted flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-500" />Respostas padrão
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">Enter selecionar · Esc fechar</span>
                    </div>
                    {filtered.slice(0, 6).map((r: any) => (
                      <button key={r.id} role="option"
                        onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); setNovaMensagem(r.content); setCannedQuery(null); setTimeout(() => textareaRef.current?.focus(), 0); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/[0.035] transition-colors border-b border-white/[0.04] last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium truncate">{r.title}</span>
                          {r.shortcut && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-card text-muted-foreground border border-border shrink-0">/{r.shortcut}</span>}
                        </div>
                        <p className="text-[12px] text-muted-foreground/60 truncate mt-0.5">{r.content}</p>
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Media preview */}
              {mediaFile && !isRecording && (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-[2px] border border-border">
                  {mediaType === 'imagem' && mediaPreviewUrl && <img src={mediaPreviewUrl} alt="preview" className="w-10 h-10 rounded object-cover shrink-0" />}
                  {mediaType === 'audio' && mediaPreviewUrl && <audio src={mediaPreviewUrl} controls className="h-7 flex-1 min-w-0" />}
                  {mediaType === 'video' && mediaPreviewUrl && <video src={mediaPreviewUrl} className="w-16 h-10 rounded object-cover shrink-0" muted />}
                  {mediaType === 'arquivo' && (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <FileIcon className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[12px] text-muted-foreground truncate block max-w-[180px]">{mediaFile.name}</span>
                        <span className="text-[10px] text-muted-foreground/50">{mediaFile.size < 1024 * 1024 ? `${(mediaFile.size / 1024).toFixed(0)} KB` : `${(mediaFile.size / (1024 * 1024)).toFixed(1)} MB`}</span>
                      </div>
                    </div>
                  )}
                  {isUploading ? (
                    <div className="flex items-center gap-1.5 ml-auto shrink-0 text-muted-foreground/60">
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span className="text-[11px]">Enviando...</span>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => onClearMedia(true)} className="h-6 w-6 p-0 ml-auto shrink-0 text-muted-foreground/60 hover:text-destructive" aria-label="Remover anexo">
                      <XIcon className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}

              {/* Recording UI */}
              {isRecording && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-[2px] bg-[#EF4444]/10 border border-[#EF4444]/20">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
                  <span className="text-[12px] font-mono text-red-500 tabular-nums">{formatDuracao(recordingSeconds)}</span>
                  <span className="text-[12px] text-muted-foreground flex-1">Gravando áudio...</span>
                  <Button variant="ghost" size="sm" onClick={onStopRecording} className="h-6 w-6 p-0 shrink-0 text-red-500 hover:text-red-600" aria-label="Parar gravação">
                    <Square className="w-3 h-3 fill-current" />
                  </Button>
                </div>
              )}

              {/* Unified text input */}
              <div className={`flex items-end gap-1.5 rounded-[2px] border bg-muted px-2 py-1.5 transition-all duration-300 focus-within:border-ring/50 ${isRecording ? 'border-[#EF4444]/40' : 'border-border'}`}>
                {/* Attachment */}
                {!isRecording && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-muted-foreground" disabled={isSendPending || isSending} aria-label="Anexar arquivo">
                        <Paperclip className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem onClick={() => onOpenFilePicker('imagem')}>
                        <ImageIcon className="w-4 h-4 mr-2 text-[#B8924B]" />Imagem
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenFilePicker('video')}>
                        <VideoIcon className="w-4 h-4 mr-2 text-purple-500" />Vídeo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onStartRecording} disabled={canalAtivo === 'instagram'}>
                        <Mic className="w-4 h-4 mr-2 text-red-500" />Gravar Áudio
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenFilePicker('arquivo')}>
                        <FileIcon className="w-4 h-4 mr-2 text-muted-foreground" />Arquivo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Textarea */}
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
                      if (val === '/') setCannedQuery('');
                      else if (val.startsWith('/') && !val.includes(' ')) setCannedQuery(val.slice(1));
                      else setCannedQuery(null);
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
                      }
                    }}
                    placeholder={mediaFile ? 'Legenda (opcional)' : 'Digite sua mensagem... (/ para respostas padrão)'}
                    rows={1}
                    disabled={isRecording || isSendPending || isSending}
                    onKeyDown={e => {
                      if (e.key === 'Escape' && cannedQuery !== null) { e.preventDefault(); setCannedQuery(null); return; }
                      if (e.key === 'Enter' && !e.shiftKey && canSendData?.canSend && !isSendPending && !isSending && !isRecording) {
                        if (cannedQuery !== null) { setCannedQuery(null); return; }
                        e.preventDefault();
                        onSendMessage();
                        if (textareaRef.current) textareaRef.current.style.height = 'auto';
                      }
                    }}
                    aria-label="Mensagem"
                    className="flex-1 bg-transparent text-[13px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none resize-none min-h-[28px] max-h-[120px] overflow-y-auto py-0.5 disabled:opacity-50"
                    style={{ height: '28px' }}
                  />
                )}

                {/* Canned responses button */}
                <Button variant="ghost" size="icon" onClick={onOpenCannedModal} className="h-7 w-7 shrink-0 text-yellow-500/70 hover:text-yellow-500" title="Respostas padrão" aria-label="Respostas padrão">
                  <Zap className="w-4 h-4" />
                </Button>

                {/* Mic / Stop */}
                {!mediaFile && (
                  isRecording ? (
                    <Button variant="ghost" size="icon" onClick={onStopRecording} className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600" aria-label="Parar gravação">
                      <Square className="w-4 h-4 fill-current" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" onClick={onStartRecording} disabled={isSendPending || isSending || canalAtivo === 'instagram'} title={canalAtivo === 'instagram' ? 'Áudio não suportado pelo Instagram' : undefined} className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-muted-foreground" aria-label="Gravar áudio">
                      <Mic className="w-4 h-4" />
                    </Button>
                  )
                )}

                {/* Send */}
                <Button
                  onClick={() => { onSendMessage(); if (textareaRef.current) textareaRef.current.style.height = 'auto'; }}
                  disabled={(!novaMensagem.trim() && !mediaFile) || isRecording || isUploading || isSendPending || isSending}
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-[4px]"
                  aria-label="Enviar mensagem"
                >
                  {isUploading || isSendPending || isSending
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MessageInput;
