import React, { RefObject, useMemo } from 'react';
import {
  Bot, MessageCircle, Instagram, Mail, Phone, CornerUpLeft as ReplyIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { MessageStatusTicks } from '@/components/conversas/MessageStatusTicks';
import { MessageContent } from '@/components/conversas/MessageContent';

// ── Inline helpers ───────────────────────────────────────────────────────────

const WhatsAppSvg = () => (
  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.48z" />
  </svg>
);

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

// ── Delivery-error formatter ────────────────────────────────────────────────
// metadata.delivery_error pode ser objeto {at, code, title, error_data} (gravado
// pelo whatsapp-inbound status webhook) — NUNCA renderizar o objeto direto no JSX.
function formatDeliveryError(metadata: any): string | null {
  if (!metadata) return null;
  if (metadata.error_reason) return String(metadata.error_reason);
  const de = metadata.delivery_error;
  if (!de) return null;
  if (typeof de === 'string') return de;
  const parts = [de.title, de.code != null ? `(${de.code})` : null].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Falha na entrega';
}

// ── Types ────────────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: any[];
  pessoaName: string;
  pessoaAtual: any;
  canalAtivo: string;
  aiIsProcessing: boolean;
  aiPhase: 'pensando' | 'digitando';
  aiEnabled: boolean | undefined;
  onReplyToComment: (data: { igCommentId?: string; preview: string }) => void;
  onReplyToMessage?: (data: { id: number; wa_message_id: string | null; preview: string; senderLabel: string }) => void;
  onSetCanalAtivo: (canal: any) => void;
  onRetryMessage?: (message: any) => void;
  messagesEndRef: RefObject<HTMLDivElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
}

// ── Component ────────────────────────────────────────────────────────────────

const MessageList: React.FC<MessageListProps> = ({
  messages,
  pessoaName,
  pessoaAtual,
  aiIsProcessing,
  aiPhase,
  aiEnabled,
  onReplyToComment,
  onReplyToMessage,
  onSetCanalAtivo,
  onRetryMessage,
  messagesEndRef,
  textareaRef,
}) => {
  // Lookup pra renderizar o trecho citado quando uma mensagem tem parent_message_id (quote reply)
  const mensagensPorId = useMemo(() => {
    const map = new Map<number, { message: string; senderLabel: string }>();
    for (const c of messages) {
      if (c.id == null) continue;
      const senderLabel = c.from_message === 'agente_ia' ? 'IA' : c.from_message === 'humano' ? (c.user_name || 'Você') : pessoaName.split(' ')[0];
      map.set(c.id, { message: c.message || '', senderLabel });
    }
    return map;
  }, [messages, pessoaName]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-background">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <MessageCircle className="w-10 h-10 text-muted-foreground/20 mb-3" strokeWidth={1} />
          <p className="text-[13px] font-medium text-foreground/40">Nenhuma mensagem</p>
          <p className="text-[12px] text-muted-foreground/35 mt-0.5">Envie uma mensagem para iniciar a conversa.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-w-3xl mx-auto px-5 py-6">
          {messages.map((conversa: any) => {
            const isFromClient = conversa.from_message === 'cliente';
            const isIA         = conversa.from_message === 'agente_ia';
            const isCall       = conversa.tipo_mensagem === 'chamada';
            const isEmail      = conversa.tipo_mensagem === 'email';
            const isComment    = conversa.tipo_mensagem === 'comentario';
            const isStoryReply = conversa.tipo_mensagem === 'story_reply';
            const isStoryMention = conversa.tipo_mensagem === 'story_mention';
            const isOptimistic = !!conversa.isOptimistic;
            const isFailed     = conversa.status === 'failed' || conversa.status === 'error';
            const timeStr      = format(new Date(conversa.created_at), 'HH:mm');
            const senderName   = isIA ? 'IA' : conversa.from_message === 'humano' ? (conversa.user_name || 'Você') : pessoaName.split(' ')[0];

            /* System event (call / email from client) */
            if (isCall || (isEmail && isFromClient)) {
              return (
                <div key={conversa.id} className="flex items-center gap-3 py-1.5 select-none">
                  <div className="flex-1 h-px bg-border" />
                  <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/45 text-[11px]">
                    {isCall ? <Phone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    <span className="font-medium">{isCall ? 'Chamada iniciada' : 'E-mail recebido'}</span>
                    <span className="opacity-60 tabular-nums">· {timeStr}</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                </div>
              );
            }

            /* Instagram story / mention */
            if (isStoryReply || isStoryMention) {
              const accentCls = isStoryMention
                ? 'border-violet-400/20 bg-violet-400/10 text-violet-400'
                : 'border-pink-400/20 bg-pink-400/10 text-pink-400';
              const accentHeaderCls = isStoryMention ? 'text-violet-400' : 'text-pink-400';
              const typeLabel = isStoryReply ? 'Respondeu ao Story' : 'Mencionou em Story';
              const typeIcon  = isStoryReply ? '📖' : '📢';
              return (
                <div key={conversa.id} className="flex flex-col items-start gap-0.5 max-w-[300px] lg:max-w-[360px]">
                  <div className={`w-full rounded-[2px] border px-3.5 py-2.5 ${accentCls}`}>
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

            /* Instagram comment */
            if (isComment) {
              const meta           = conversa.media_metadata as Record<string, any> | null;
              const postImageUrl   = meta?.post_image_url as string | undefined;
              const postThumbnail  = meta?.post_thumbnail_url as string | undefined;
              const postPermalink  = meta?.post_permalink as string | undefined;
              const postCaption    = meta?.post_caption as string | undefined;
              const commentId      = meta?.comment_id as string | undefined;
              const previewImg     = postImageUrl || postThumbnail;
              return (
                <div key={conversa.id} className="flex flex-col items-start gap-1.5 max-w-[300px] lg:max-w-[340px] mt-3">
                  <div className="w-full rounded-[2px] border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-[4px] bg-gradient-to-br from-pink-500 via-red-400 to-yellow-400 flex items-center justify-center">
                          <Instagram className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-[11px] font-semibold text-foreground/80">instagram</span>
                      </div>
                      {postPermalink && (
                        <a href={postPermalink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-0.5 text-[10px] text-pink-500 hover:text-pink-600 font-medium">
                          Ver post
                        </a>
                      )}
                    </div>
                    {previewImg ? (
                      <img src={previewImg} alt="Post" className="w-full object-cover" style={{ maxHeight: 240, minHeight: 120 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-24 bg-gradient-to-br from-pink-500/10 via-violet-500/5 to-orange-500/10 flex items-center justify-center">
                        <Instagram className="w-8 h-8 text-pink-400/30" />
                      </div>
                    )}
                    {postCaption && (
                      <div className="px-3 pb-2">
                        <p className="text-[11.5px] text-foreground/80 leading-relaxed">
                          <span className="font-semibold text-foreground/90">instagram </span>{postCaption}
                        </p>
                      </div>
                    )}
                    <div className="border-t border-border px-3 py-2">
                      <div className="flex items-start gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 shrink-0 flex items-center justify-center mt-0.5 text-white text-[9px] font-bold">
                          {(pessoaAtual?.instagram_user_id || pessoaName || 'U')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11.5px] text-foreground/80 leading-snug">
                            <span className="font-semibold text-foreground/90">{pessoaAtual?.instagram_user_id || pessoaName.split(' ')[0] || 'usuário'} </span>
                            {conversa.message}
                          </p>
                          <span className="text-[9.5px] text-muted-foreground/50 tabular-nums">{timeStr}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-0.5">
                    <button
                      onClick={() => { onReplyToComment({ igCommentId: commentId, preview: (conversa.message || '').slice(0, 60) }); onSetCanalAtivo('instagram'); textareaRef.current?.focus(); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] text-[10px] font-medium bg-violet-400/10 text-violet-400 hover:bg-violet-400/20 border border-violet-400/25 transition-all duration-300"
                    >↩ Responder</button>
                    <button
                      onClick={() => { onReplyToComment(null as any); onSetCanalAtivo('instagram'); textareaRef.current?.focus(); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] text-[10px] font-medium bg-muted text-muted-foreground hover:bg-white/[0.035] border border-border transition-all duration-300"
                    >💬 DM</button>
                  </div>
                </div>
              );
            }

            /* Reply to comment (outgoing) */
            if (conversa.tipo_mensagem === 'reply_comentario') {
              return (
                <div key={conversa.id} className="flex justify-end">
                  <div className="max-w-[340px] lg:max-w-[420px] rounded-[2px] border bg-violet-500/80 border-violet-400/40 px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Instagram className="w-3 h-3 text-violet-200" />
                      <span className="text-[10px] font-semibold text-violet-200">↩ Respondeu no post</span>
                      <span className="text-[10px] text-pink-300/60 tabular-nums ml-auto">{timeStr}</span>
                    </div>
                    <p className="text-[13px] text-white leading-relaxed">{conversa.message}</p>
                  </div>
                </div>
              );
            }

            /* Standard message bubble */
            const isOutgoing = !isFromClient;
            const shapeOut   = 'rounded-[2px] rounded-br-[5px]';
            const shapeIn    = 'rounded-[2px] rounded-bl-[5px]';
            let bubbleCls = '';
            if (isFromClient)   bubbleCls = `bg-card text-foreground ${shapeIn}`;
            else if (isOptimistic) bubbleCls = `bg-muted text-foreground ${shapeOut} opacity-55`;
            else if (isIA)      bubbleCls = `bg-card text-foreground border-l-[3px] border-l-violet-400 ${shapeOut}`;
            else                bubbleCls = `bg-background text-foreground ${shapeOut}`;

            const footerCls = isIA ? 'text-violet-300/70' : isOptimistic ? 'text-muted-foreground/70' : 'text-muted-foreground';

            const parentPreview = conversa.parent_message_id != null
              ? mensagensPorId.get(conversa.parent_message_id)
              : null;
            const canReply = !!onReplyToMessage && conversa.channel === 'whatsapp' && !isOptimistic && !!conversa.id;
            const replyButton = canReply && (
              <button
                onClick={() => onReplyToMessage!({
                  id: conversa.id,
                  wa_message_id: conversa.wa_message_id ?? null,
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
                  {isIA && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <Bot className="w-2.5 h-2.5 text-violet-500" />
                      <span className="text-[9px] font-semibold tracking-widest uppercase text-violet-500">IA</span>
                    </div>
                  )}
                  {isFromClient && (
                    <p className="text-[10px] font-medium text-muted-foreground/45 mb-1 leading-none">{senderName}</p>
                  )}
                  {parentPreview && (
                    <div className="mb-1.5 pl-2 border-l-2 border-current/25 opacity-60">
                      <p className="text-[10px] font-medium leading-none mb-0.5">{parentPreview.senderLabel}</p>
                      <p className="text-[11px] leading-snug truncate">{parentPreview.message.slice(0, 80) || '📎 mídia'}</p>
                    </div>
                  )}
                  <MessageContent
                    message={conversa.message}
                    tipo_mensagem={conversa.tipo_mensagem}
                    media_url={conversa.media_url}
                    media_metadata={conversa.media_metadata}
                    isFromClient={isFromClient}
                    metadata={(conversa as any).metadata}
                  />
                  {isOutgoing && (conversa.status === 'error' || conversa.status === 'failed') && (() => {
                    const errMsg = formatDeliveryError((conversa as any).metadata);
                    return errMsg ? (
                      <p className="text-[10px] text-destructive mt-1 leading-snug max-w-[260px]">
                        ⚠ {errMsg}
                      </p>
                    ) : null;
                  })()}
                  {/* WhatsApp delivery log — shows attempt history when available (set by whatsapp-outbound) */}
                  {isOutgoing && Array.isArray((conversa as any).metadata?.delivery_log) && (conversa as any).metadata.delivery_log.length > 0 && (
                    <details className="mt-1 group">
                      <summary className={`text-[10px] cursor-pointer select-none ${conversa.status === 'error' || conversa.status === 'failed' ? 'text-destructive/80 hover:text-destructive' : 'text-muted-foreground/70 hover:text-muted-foreground'}`}>
                        Log de envio ({(conversa as any).metadata.delivery_log.length})
                      </summary>
                      <div className="mt-1 space-y-1">
                        {((conversa as any).metadata.delivery_log as Array<Record<string, any>>).map((entry, idx) => (
                          <div key={idx} className="text-[10px] leading-snug px-2 py-1 rounded bg-muted/50 border border-border/40">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={entry.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                                {entry.success ? '✓' : '✗'} #{entry.attempt}
                              </span>
                              {entry.http_status != null && (
                                <span className="text-muted-foreground">HTTP {entry.http_status}</span>
                              )}
                              {entry.timestamp && (
                                <span className="text-muted-foreground/70 tabular-nums ml-auto">
                                  {format(new Date(entry.timestamp), 'HH:mm:ss')}
                                </span>
                              )}
                            </div>
                            {entry.wamid && (
                              <div className="text-muted-foreground/80 break-all"><span className="text-muted-foreground/60">wamid:</span> {entry.wamid}</div>
                            )}
                            {entry.meta_payload_type && (
                              <div className="text-muted-foreground/80"><span className="text-muted-foreground/60">tipo:</span> {entry.meta_payload_type}</div>
                            )}
                            {entry.error && (
                              <div className="text-destructive/90 break-words mt-0.5">{entry.error}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Footer: time + status */}
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

                  {/* Failed message retry */}
                  {isFailed && isOutgoing && onRetryMessage && (
                    <div className="mt-1.5 pt-1.5 border-t border-[#EF4444]/30 flex items-center gap-2">
                      <span className="text-[10px] text-red-400 flex-1">
                        {formatDeliveryError((conversa as any).metadata) || 'Falha ao enviar'}
                      </span>
                      <button
                        onClick={() => onRetryMessage(conversa)}
                        className="text-[10px] font-medium text-red-400 hover:text-red-300 underline"
                      >
                        Reenviar
                      </button>
                    </div>
                  )}
                </div>
                {isFromClient && replyButton}
              </div>
            );
          })}

          {/* AI typing bubble */}
          {aiEnabled && aiIsProcessing && (
            <div className="flex justify-end">
              <div className="bg-card border-l-[3px] border-l-violet-400 rounded-[2px] rounded-br-[5px] px-3.5 py-2.5 flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
};

export default MessageList;
