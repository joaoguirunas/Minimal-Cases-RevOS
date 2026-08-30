import { ArrowLeft, Info, Paperclip, Send, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useMensagensPorPessoa } from '@/hooks/useMensagensPorPessoa';
import { useEnviarMensagem } from '@/hooks/useConversas';
import { usePessoas } from '@/hooks/usePessoas';
import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { MessageStatusTicks } from '@/components/conversas/MessageStatusTicks';
import { useCanSendMessage } from '@/hooks/useCanSendMessage';
import { WhatsappTemplateModal } from '@/components/conversas/WhatsappTemplateModal';
import { extractTemplateContent, buildMetaTemplateComponents } from '@/utils/templateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface MobileConversaSingleProps {
  pessoaId: string;
}

export const MobileConversaSingle = ({ pessoaId }: MobileConversaSingleProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messageText, setMessageText] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: pessoas } = usePessoas();
  const pessoa = pessoas?.find((p: { id: string }) => p.id === pessoaId);

  const { data: mensagens, isLoading } = useMensagensPorPessoa(pessoaId);
  const enviarMensagem = useEnviarMensagem();
  const { data: canSendData } = useCanSendMessage(undefined, 'whatsapp', pessoaId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const handleSend = () => {
    if (!messageText.trim() || !pessoa) return;
    if (canSendData?.canSend === false) return;

    enviarMensagem.mutate({
      lead_id: '',
      tenant_id: '',
      pessoa_id: pessoaId,
      message: messageText,
      from_message: 'humano',
      tipo_mensagem: 'texto',
      canal: 'whatsapp',
      phone_number: pessoa.whatsapp,
    });

    setMessageText('');
  };

  const handleSelectTemplate = async (template: Record<string, unknown>) => {
    // Defensive fallback: usePessoas may not have loaded yet; fetch directly if needed
    let pessoaData = pessoa;
    if ((!pessoaData || !(pessoaData.name || (pessoaData as any).nome)) && pessoaId) {
      const { data: p } = await supabase
        .from('clients_people')
        .select('id, name, whatsapp, email, document, notes, score, status, type, income, moment, goal, conversation_summary')
        .eq('id', pessoaId)
        .single();
      pessoaData = p;
    }
    const senderName = user?.profile?.nome?.split(' ')[0];
    const varRoles = (template.variables && typeof template.variables === 'object') ? template.variables as Record<string, string> : undefined;
    const templateMessage = extractTemplateContent(template.json_data, pessoaData, varRoles, { senderName }) || `Template: ${template.nome}`;
    const metaComponents = buildMetaTemplateComponents(template.json_data, pessoaData, varRoles, { senderName });
    const languageCode = template.json_data?.languageCode || template.json_data?.language?.code || 'pt_BR';
    const metaTemplateName = template.meta_template_name || template.json_data?.elementName || template.nome || template.id_template;

    enviarMensagem.mutate({
      lead_id: '',
      tenant_id: '',
      pessoa_id: pessoaId,
      message: templateMessage,
      from_message: 'humano',
      tipo_mensagem: 'texto',
      canal: 'whatsapp',
      phone_number: pessoa?.whatsapp,
      whatsapp_template_id: metaTemplateName,
      template_language_code: languageCode,
      template_variable_values: metaComponents,
    });
    setShowTemplateModal(false);
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {pessoa && getInitials(pessoa.nome || pessoa.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">{pessoa?.nome || pessoa?.name}</h2>
            {pessoa?.whatsapp && (
              <p className="text-sm text-muted-foreground truncate">{pessoa.whatsapp}</p>
            )}
          </div>
          
          <Button variant="ghost" size="icon" className="shrink-0">
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {mensagens?.map((msg: Record<string, unknown>) => {
              const isReceived = msg.tipo_mensagem === 'received' || !msg.tipo_mensagem;
              
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    isReceived ? "justify-start" : "justify-end"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-[2px] px-4 py-2",
                      isReceived 
                        ? "bg-muted text-foreground rounded-tl-none" 
                        : "bg-primary text-primary-foreground rounded-tr-none"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.texto || msg.content || msg.message}
                    </p>
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      isReceived ? "justify-start" : "justify-end"
                    )}>
                      <span className={cn(
                        "text-micro",
                        isReceived ? "text-muted-foreground" : "text-primary-foreground/70"
                      )}>
                        {format(new Date(msg.created_at || msg.data_criacao), 'HH:mm')}
                      </span>
                      {!isReceived && msg.status && (
                        <MessageStatusTicks status={msg.status} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input fixo */}
      <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        {canSendData?.needsTemplate ? (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground flex-1 truncate">
              {canSendData.reason ?? 'Janela 24h expirada'}
            </p>
            <Button size="sm" onClick={() => setShowTemplateModal(true)}>
              Enviar Template
            </Button>
          </div>
        ) : !canSendData?.canSend && canSendData?.reason ? (
          <p className="text-xs text-muted-foreground text-center py-1">{canSendData.reason}</p>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0">
              <Paperclip className="h-5 w-5" />
            </Button>

            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Digite uma mensagem..."
              className="flex-1 bg-muted border-0"
            />

            <Button
              size="icon"
              onClick={handleSend}
              disabled={!messageText.trim() || enviarMensagem.isPending}
              className="shrink-0"
            >
              {enviarMensagem.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}
      </div>

      <WhatsappTemplateModal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
};
