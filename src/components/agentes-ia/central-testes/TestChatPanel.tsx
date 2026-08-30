import { useState, useEffect, useRef } from 'react';
import {
  Send, Loader2, MessageCircle, Mail, Bot, ArrowRight,
  Paperclip, Mic, Square, X, FileText, Film, Phone, Instagram, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePersonMessages, type TestPerson, type TestMessage } from '@/hooks/useTestSession';
import { useOmniMediaUpload, getMessageTypeFromFile } from '@/hooks/useOmniMediaUpload';
import { useToast } from '@/hooks/use-toast';

// ── All possible channels ──────────────────────────────────────────────────────

const ALL_CHANNELS = [
  { value: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle },
  { value: 'email',     label: 'Email',     icon: Mail },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'sms',       label: 'SMS',       icon: MessageCircle },
  { value: 'telefone',  label: 'Telefone',  icon: Phone },
];

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: TestMessage }) {
  const isFromPerson = msg.from_contact === 'cliente';
  const isFromAgent = msg.from_contact === 'agente_ia';

  return (
    <div className={cn('flex', isFromPerson ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[72%] rounded-[12px] px-3 py-2 text-[13px] leading-relaxed',
        isFromPerson
          ? 'bg-primary text-primary-foreground rounded-br-[4px]'
          : isFromAgent
          ? 'bg-muted text-foreground rounded-bl-[4px] border border-border'
          : 'bg-muted text-muted-foreground rounded-bl-[4px] italic text-[11px]',
      )}>
        {!isFromPerson && !isFromAgent && (
          <span className="text-[10px] font-medium text-muted-foreground/60 block mb-0.5">
            {msg.from_contact}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <span className={cn(
          'text-[9px] mt-1 block',
          isFromPerson ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground/50',
        )}>
          {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-12 h-12 bg-muted rounded-[2px] flex items-center justify-center mb-3">
        <Bot className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="text-[13px] font-medium text-foreground mb-1">Selecione uma pessoa</p>
      <p className="text-[12px] text-muted-foreground/60">
        Escolha um lead no painel esquerdo para iniciar a simulação
      </p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSeconds(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface TestChatPanelProps {
  person: TestPerson | null;
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
  isProcessing: boolean;
  onSend: (content: string, media?: { message_type: string; media_url: string; media_metadata?: object }) => void;
  onClearHistory: () => void;
}

export function TestChatPanel({
  person,
  selectedChannel,
  onChannelChange,
  isProcessing,
  onSend,
  onClearHistory,
}: TestChatPanelProps) {
  const [input, setInput] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string>('texto');
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messages = usePersonMessages(person?.id ?? null);
  const { upload } = useOmniMediaUpload();
  const { toast } = useToast();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // ── File attachment ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = getMessageTypeFromFile(file);
    setMediaFile(file);
    setMediaType(type);
    setMediaPreviewUrl(URL.createObjectURL(file));
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaType('texto');
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
      setMediaPreviewUrl(null);
    }
  };

  // ── Audio recording ──────────────────────────────────────────────────────────

  const startRecording = async () => {
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
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // ── Send ─────────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if ((!input.trim() && !mediaFile) || isProcessing || !person) return;

    if (mediaFile) {
      setIsUploading(true);
      try {
        const result = await upload(mediaFile, 'test');
        onSend(input.trim(), {
          message_type: mediaType,
          media_url: result.url,
          media_metadata: result.metadata,
        });
        clearMedia();
        setInput('');
      } catch (err) {
        console.error('[TestChatPanel] upload error:', err);
        toast({ title: 'Erro no upload', description: String(err), variant: 'destructive' });
      } finally {
        setIsUploading(false);
      }
    } else {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!person) return <EmptyState />;

  const isBusy = isProcessing || isUploading;

  const currentChannel = ALL_CHANNELS.find(c => c.value === selectedChannel) ?? ALL_CHANNELS[0];

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground truncate">
                {person.name}
              </span>
              {isBusy && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  {isUploading ? 'Enviando arquivo...' : 'Agente processando...'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-muted-foreground/60">{person.lead.pipeline_name}</span>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30" />
              <span
                className="text-[10px] font-medium"
                style={{ color: person.lead.stage_color ?? undefined }}
              >
                {person.lead.stage_name}
              </span>
              {person.lead.control && (
                <Badge variant="outline" className="text-[9px] h-3.5 px-1 ml-1 font-mono">
                  ctrl:{person.lead.control}
                </Badge>
              )}
            </div>
          </div>

          {/* Limpar histórico */}
          <div className="shrink-0">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-[30px] px-2 text-muted-foreground hover:text-destructive gap-1.5"
                  title="Limpar histórico"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Limpar</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar mensagens desta sessão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove apenas as mensagens enviadas nesta sessão de teste. O histórico anterior de {person.name} não será afetado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearHistory}>Limpar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Canal — sempre visível */}
          <div className="shrink-0">
            <Select value={selectedChannel} onValueChange={onChannelChange}>
              <SelectTrigger className="h-[30px] w-[130px] text-xs border-border">
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    <currentChannel.icon className="h-3 w-3" />
                    {currentChannel.label}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ALL_CHANNELS.map(ch => (
                  <SelectItem key={ch.value} value={ch.value} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <ch.icon className="h-3 w-3" />
                      {ch.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[12px] text-muted-foreground/40 italic">
              Nenhuma mensagem. Envie a primeira mensagem abaixo.
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}

        {/* Typing indicator */}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-[12px] rounded-bl-[4px] px-3 py-2 border border-border">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border bg-card shrink-0">

        {/* Media preview */}
        {mediaFile && !isRecording && (
          <div className="mb-2 flex items-center gap-2 bg-muted rounded-[4px] px-3 py-2 border border-border">
            {mediaType === 'imagem' && mediaPreviewUrl && (
              <img
                src={mediaPreviewUrl}
                alt="preview"
                className="h-10 w-10 object-cover rounded-[4px] shrink-0"
              />
            )}
            {mediaType === 'video' && (
              <Film className="h-5 w-5 text-muted-foreground/60 shrink-0" />
            )}
            {mediaType === 'audio' && mediaPreviewUrl && (
              <audio controls src={mediaPreviewUrl} className="h-8 max-w-[180px]" />
            )}
            {mediaType === 'arquivo' && (
              <FileText className="h-5 w-5 text-muted-foreground/60 shrink-0" />
            )}
            <span className="text-[11px] text-muted-foreground truncate flex-1">
              {mediaFile.name}
            </span>
            <button
              onClick={clearMedia}
              className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 items-end">
          {/* Attachment button */}
          {!isRecording && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              title="Anexar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          )}

          {/* Text area or recording indicator */}
          {isRecording ? (
            <div className="flex items-center gap-3 flex-1 bg-muted rounded-[4px] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-[12px] font-mono text-red-500">{formatSeconds(recordingSeconds)}</span>
              <span className="text-[12px] text-muted-foreground">Gravando áudio...</span>
            </div>
          ) : (
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Enviar como ${person.name}... (Enter para enviar)`}
              className="min-h-[40px] max-h-[120px] text-[13px] resize-none bg-muted border-border"
              disabled={isBusy}
              rows={1}
            />
          )}

          {/* Mic / Stop recording button */}
          {isRecording ? (
            <Button
              onClick={stopRecording}
              variant="destructive"
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              title="Parar gravação"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              disabled={isBusy}
              onClick={startRecording}
              title="Gravar áudio"
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}

          {/* Send button */}
          {!isRecording && (
            <Button
              onClick={() => void handleSend()}
              disabled={(!input.trim() && !mediaFile) || isBusy}
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              title="Enviar"
            >
              {isBusy
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/40 mt-1.5">
          Simulação real — o agente irá processar e responder normalmente, incluindo envio de mensagens e execução de ferramentas.
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,*/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
