import { useMemo, useState } from 'react';
import { FileDown, FileText, Volume2, CornerDownLeft, ExternalLink, ChevronDown, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
}

interface TemplateJsonData {
  components?: TemplateComponent[];
}

interface TemplateData {
  id: string;
  id_template: string;
  nome: string;
  json_data: TemplateJsonData | string;
}

interface TemplateButton {
  text: string;
  type: string; // 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
}

interface MessageContentProps {
  message: string;
  whatsapp_template_id?: string;
  template?: TemplateData;
  tipo_mensagem?: string;
  media_url?: string | null;
  media_metadata?: { file_name?: string; mime_type?: string; file_size?: number } | null;
  isFromClient?: boolean;
  followup_id?: string | null;
  source_type?: string | null;
  metadata?: {
    header_text?: string;
    buttons?: TemplateButton[];
    error_reason?: string;
    template_name?: string;
    form_name?: string;
    form_fields?: { label: string; value: string }[];
    [key: string]: unknown;
  } | null;
}

function fmtSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders the message content based on its type:
 * texto / imagem / audio / arquivo (or template).
 */
export const MessageContent = ({
  message,
  whatsapp_template_id,
  template,
  tipo_mensagem,
  media_url,
  media_metadata,
  isFromClient,
  followup_id,
  source_type,
  metadata,
}: MessageContentProps) => {
  const fupBadge = followup_id ? (
    <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border leading-none text-[#B8924B] border-[#B8924B]/30 bg-[#B8924B]/8 ml-1">
      FUP
    </span>
  ) : null;
  const [imgError, setImgError] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);

  // ── WhatsApp template preview ──────────────────────────────────────────────
  const templateMessage = useMemo(() => {
    if (!whatsapp_template_id || !template?.json_data) return null;
    try {
      const jsonData = typeof template.json_data === 'string'
        ? JSON.parse(template.json_data)
        : template.json_data;
      const body = jsonData.components?.find((c: TemplateComponent) => c.type === 'BODY');
      if (body?.text) return body.text;
      const header = jsonData.components?.find((c: TemplateComponent) => c.type === 'HEADER' && c.format === 'TEXT');
      return header?.text ?? null;
    } catch {
      return null;
    }
  }, [whatsapp_template_id, template]);

  // ── Template card from metadata (rich: header + body + buttons) ───────────
  // Used when metadata carries pre-resolved header_text and/or buttons (lp-submit, campaign, followup)
  const metaButtons = metadata?.buttons;
  const metaHeaderText = metadata?.header_text;

  if (metaHeaderText || (metaButtons && metaButtons.length > 0)) {
    return (
      <div className="space-y-0 min-w-[200px]">
        {metaHeaderText && (
          <p className="text-[13px] font-semibold leading-snug whitespace-pre-wrap mb-1">
            {metaHeaderText}
          </p>
        )}
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message}{fupBadge}</p>
        {metaButtons && metaButtons.length > 0 && (
          <div className="mt-2 border-t border-current/10 pt-1.5 space-y-1">
            {metaButtons.map((btn, i) => (
              <div
                key={i}
                className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-center opacity-75 py-0.5"
              >
                {btn.type === 'URL' ? (
                  <ExternalLink size={11} className="shrink-0" />
                ) : (
                  <CornerDownLeft size={11} className="shrink-0" />
                )}
                {btn.text}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (templateMessage) {
    return (
      <div className="space-y-1">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{templateMessage}</p>
        <span className="text-xs opacity-60 italic">📋 {template?.nome}{fupBadge}</span>
      </div>
    );
  }

  // ── Image ──────────────────────────────────────────────────────────────────
  if (tipo_mensagem === 'imagem' && media_url && !imgError) {
    return (
      <div className="space-y-1.5">
        <img
          src={media_url}
          alt={media_metadata?.file_name || 'imagem'}
          onError={() => setImgError(true)}
          className="rounded-[2px] max-w-[220px] max-h-[220px] object-cover cursor-pointer"
          onClick={() => window.open(media_url, '_blank')}
        />
        {message && (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message}</p>
        )}
      </div>
    );
  }

  // ── Audio ──────────────────────────────────────────────────────────────────
  if (tipo_mensagem === 'audio' && media_url) {
    const isPlaceholder = !message || /^\[.*\]$/.test(message.trim());
    return (
      <div className="space-y-1.5">
        <div className={cn(
          'flex items-center gap-2 rounded-[2px] px-3 py-2',
          isFromClient ? 'bg-card' : 'bg-primary-foreground/10'
        )}>
          <Volume2 className="w-4 h-4 shrink-0 opacity-60" />
          <audio
            src={media_url}
            controls
            className="h-7 flex-1 min-w-[160px] max-w-[240px]"
            style={{ colorScheme: 'normal' }}
          />
        </div>
        {!isPlaceholder && (
          <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground italic">
            {message}
          </p>
        )}
      </div>
    );
  }

  // ── Video ──────────────────────────────────────────────────────────────────
  if (tipo_mensagem === 'video' && media_url) {
    return (
      <div className="space-y-1.5">
        <video
          src={media_url}
          controls
          className="rounded-[2px] max-w-[280px] max-h-[220px] object-cover"
        />
        {message && (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message}</p>
        )}
      </div>
    );
  }

  // ── File / Document ────────────────────────────────────────────────────────
  if (tipo_mensagem === 'arquivo' && media_url) {
    const fileName = media_metadata?.file_name || 'arquivo';
    const fileSize = fmtSize(media_metadata?.file_size);
    return (
      <div className="space-y-1.5">
        <a
          href={media_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2.5 rounded-[2px] border transition-colors',
            isFromClient
              ? 'bg-card border-border hover:bg-accent/50'
              : 'bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20'
          )}
        >
          <div className="w-8 h-8 rounded-[2px] bg-card flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 opacity-60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium truncate">{fileName}</p>
            {fileSize && <p className="text-[10px] opacity-50">{fileSize}</p>}
          </div>
          <FileDown className="w-3.5 h-3.5 opacity-40 shrink-0" />
        </a>
        {message && (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message}</p>
        )}
      </div>
    );
  }

  // ── Form submission ────────────────────────────────────────────────────────
  // Detect by source_type OR by message content pattern (fallback for older messages)
  const isFormMessage = source_type === 'form' || message?.startsWith('📋 Cadastro via formulário');
  if (isFormMessage) {
    const formFields = metadata?.form_fields;
    const hasFields = formFields && formFields.length > 0;
    return (
      <div className="space-y-1.5 min-w-[200px]">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5 opacity-60 shrink-0" />
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap flex-1">{message}</p>
        </div>
        <button
          onClick={() => setFormExpanded(v => !v)}
          className="flex items-center gap-1 text-[10px] font-medium opacity-55 hover:opacity-90 transition-opacity"
        >
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', formExpanded && 'rotate-180')} />
          {formExpanded
            ? 'Ocultar campos'
            : hasFields
              ? `Ver ${formFields.length} campo${formFields.length !== 1 ? 's' : ''} preenchido${formFields.length !== 1 ? 's' : ''}`
              : 'Ver campos preenchidos'}
        </button>
        {formExpanded && (
          <div className="border-t border-current/10 pt-1.5 mt-0.5">
            {hasFields ? (
              <div className="space-y-1">
                {formFields.map((f, i) => (
                  <div key={i} className="flex gap-1.5 text-[11px] leading-snug">
                    <span className="opacity-50 shrink-0 min-w-[80px] max-w-[110px] truncate">{f.label}:</span>
                    <span className="opacity-85 break-words">{f.value || '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] opacity-45 italic">
                Dados do formulário não armazenados — disponível em novos envios.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Plain text (default) ───────────────────────────────────────────────────
  return (
    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
      {message}{fupBadge}
    </p>
  );
};
