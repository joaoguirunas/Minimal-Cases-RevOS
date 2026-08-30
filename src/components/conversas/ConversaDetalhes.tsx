
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, User, Bot, MessageCircle, MoreHorizontal, AlertCircle } from "lucide-react";
import { useMensagensPorPessoa } from "@/hooks/useMensagensPorPessoa";
import { useEnviarMensagem } from "@/hooks/useConversas";
import { useCanSendMessage } from "@/hooks/useCanSendMessage";
import { useSettings } from "@/hooks/useSettings";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageStatusTicks } from "./MessageStatusTicks";
import { WhatsappTemplateModal } from "./WhatsappTemplateModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { extractTemplateContent, extractTemplateVariableValues } from "@/utils/templateUtils";
import { useAuth } from "@/hooks/useAuth";

interface ConversaDetalhesProps {
  pessoaId: string;
  onVoltar: () => void;
}

const ConversaDetalhes = ({ pessoaId, onVoltar }: ConversaDetalhesProps) => {
  const { user } = useAuth();
  const [novaMensagem, setNovaMensagem] = useState("");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  
  const queryClient = useQueryClient();
  
  const { data: mensagens = [], isLoading, isError, error, refetch } = useMensagensPorPessoa(pessoaId, 'single-tenant');
  const { data: settings } = useSettings();
  const enviarMensagem = useEnviarMensagem();

  // Fetch pessoa data with all fields for template variable substitution
  const { data: pessoa } = useQuery({
    queryKey: ['pessoa-template', pessoaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients_people')
        .select('name, email, whatsapp, document, notes, score, status, type, income, moment, goal, conversation_summary')
        .eq('id', pessoaId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!pessoaId
  });

  // Get lead info from first message
  const leadId = (mensagens[0] as any)?.lead_id;
  const { data: canSendData } = useCanSendMessage(leadId);
  const pessoaNome = pessoa?.name || "Cliente";

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim() || !'single-tenant' || !leadId) return;

    // Check permissions
    if (!canSendData?.canSend) {
      toast.error(canSendData?.reason || "Não é possível enviar mensagem");
      return;
    }

    const messageToSend = novaMensagem.trim();
    setNovaMensagem("");

    try {
      await enviarMensagem.mutateAsync({
        from_message: 'humano',
        message: messageToSend,
        tipo_mensagem: 'texto',
        lead_id: leadId,
        tenant_id: 'single-tenant',
        pessoa_id: pessoaId,
        canal: 'whatsapp',
        phone_number: pessoa?.whatsapp ?? undefined,
      });

      toast.success("Mensagem enviada com sucesso!");
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setNovaMensagem(messageToSend);
      toast.error("Erro ao enviar mensagem");
    }
  };

  const handleSelectTemplate = async (template: any) => {
    if (!leadId || !'single-tenant') return;

    console.log('📨 CONVERSA DETALHES: Enviando template:', {
      template_id: template.id,
      id_template: template.id_template,
      nome: template.nome,
      leadId,
      pessoaId,
      pessoa: pessoa ? { name: pessoa.name } : null
    });

    // Conteúdo renderizado para exibição no chat
    const senderName = user?.profile?.nome?.split(' ')[0];
    const varRoles = (template.variables && typeof template.variables === 'object') ? template.variables : undefined;
    const templateMessage = extractTemplateContent(template.json_data, pessoa, varRoles, { senderName }) || `Template: ${template.nome}`;
    const variableValues = extractTemplateVariableValues(template.json_data, pessoa, varRoles, { senderName });
    const languageCode = template.json_data?.languageCode || 'pt_BR';

    try {
      // Meta API precisa do nome do template = campo name/nome do DB (igual ao N8N)
      const metaTemplateName = template.meta_template_name || template.json_data?.elementName || template.nome || template.id_template;

      await enviarMensagem.mutateAsync({
        from_message: 'humano',
        message: templateMessage,
        tipo_mensagem: 'texto',
        lead_id: leadId,
        tenant_id: 'single-tenant',
        pessoa_id: pessoaId,
        canal: 'whatsapp',
        whatsapp_template_id: metaTemplateName,
        template_language_code: languageCode,
        template_variable_values: variableValues,
        phone_number: pessoa?.whatsapp ?? undefined,
      });

      toast.success("Template enviado com sucesso!");
    } catch (error) {
      console.error('Erro ao enviar template:', error);
      toast.error("Erro ao enviar template");
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="h-screen flex">
      {/* Sidebar esquerda - lista de conversas (mantém a mesma estrutura da página principal) */}
      <div className="w-[220px] border-r bg-card">
        <div className="p-4 border-b">
          <Button variant="ghost" size="sm" onClick={onVoltar} className="mb-2 h-[30px] rounded-[4px] text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h2 className="text-lg font-semibold">Conversas</h2>
        </div>
        
        <div className="p-4">
          <div className="flex items-center gap-3 p-3 bg-primary/10 dark:bg-primary/20 rounded-[2px] border border-primary/20">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary/20 dark:bg-primary/30 text-primary text-sm font-medium">
                {getInitials(pessoaNome)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-sm">{pessoaNome}</h3>
              <p className="text-xs text-muted-foreground">Cliente</p>
            </div>
          </div>
        </div>
      </div>

      {/* Área principal do chat */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/20 dark:bg-primary/30 text-primary text-sm font-medium">
                  {getInitials(pessoaNome)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold">{pessoaNome}</h2>
                <p className="text-sm text-muted-foreground">Cliente</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-[30px] w-[30px] p-0 rounded-[4px]">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span>•</span>
            <span>há 1 dia</span>
            <span>•</span>
            <span>humano</span>
            <span>0</span>
          </div>
        </div>

        {/* Área de mensagens com ordenação melhorada */}
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          {isLoading && mensagens.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando mensagens...</p>
            </div>
          ) : isError && mensagens.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Erro ao carregar mensagens</h3>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : 'Falha de conexão ou permissão.'}
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm" className="h-[30px] rounded-[4px] text-xs">
                Tentar novamente
              </Button>
            </div>
          ) : mensagens.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma mensagem ainda</h3>
              <p className="text-muted-foreground">
                Inicie uma conversa enviando a primeira mensagem.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {mensagens.map((message: any) => {
                const isFromClient = message.from_message === 'cliente';
                const senderName = isFromClient 
                  ? pessoaNome.split(' ')[0] 
                  : message.from_message === 'agente_ia' 
                    ? 'IA' 
                    : message.from_message === 'humano'
                      ? 'Humano'
                      : 'Sistema';
                
                return (
                  <div key={message.id} className={`flex ${isFromClient ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-xs lg:max-md px-4 py-2 rounded ${
                      isFromClient 
                        ? 'bg-card text-foreground rounded-tl-none' 
                        : 'bg-[#B8924B] text-white rounded-tr-none'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                      
                      <div className="flex items-center gap-2 mt-2 text-xs opacity-75">
                        <span className="font-medium">{senderName}</span>
                        <span>•</span>
                        <span>
                          {format(new Date(message.created_at), "dd/MM/yyyy HH:mm")}
                        </span>
                        {!isFromClient && (
                          <>
                            <span>•</span>
                            <MessageStatusTicks status={message.status} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input de mensagem */}
        <div className="p-4 border-t bg-card space-y-2">
          {canSendData?.needsTemplate && settings?.whatsapp_provider === 'whatsapp-oficial' && (
            <Button
              onClick={() => setTemplateModalOpen(true)}
              variant="outline"
              className="w-full h-[30px] rounded-[4px] text-xs"
            >
              Enviar Template WhatsApp
            </Button>
          )}
          
          <div className="flex gap-2">
            <Input
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              placeholder={
                canSendData?.canSend 
                  ? "Digite sua mensagem..." 
                  : canSendData?.reason || "Não é possível enviar mensagens"
              }
              onKeyPress={(e) => e.key === 'Enter' && canSendData?.canSend && !enviarMensagem.isPending && handleEnviarMensagem()}
              disabled={!canSendData?.canSend || enviarMensagem.isPending}
              className="flex-1"
            />
            <Button
              onClick={handleEnviarMensagem}
              disabled={!novaMensagem.trim() || !canSendData?.canSend || enviarMensagem.isPending}
              className="h-[30px] w-[30px] p-0 rounded-[4px]"
            >
              {enviarMensagem.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {!canSendData?.canSend && canSendData?.reason && (
            <p className="text-sm text-destructive">
              {canSendData.reason}
            </p>
          )}
        </div>
      
        <WhatsappTemplateModal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>

      {/* Sidebar direita - informações do cliente */}
      <div className="w-[220px] border-l bg-card">
        <div className="p-4">
          <div className="text-center mb-6">
            <Avatar className="w-16 h-16 mx-auto mb-3">
              <AvatarFallback className="bg-primary/20 dark:bg-primary/30 text-primary text-lg font-medium">
                {getInitials(pessoaNome)}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-lg">{pessoaNome}</h3>
            <p className="text-sm text-muted-foreground">Cliente</p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Status e Responsável
              </h4>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <p className="text-sm font-medium text-primary">Em andamento</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Responsável</span>
                  <p className="text-sm">João Guirunas</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2 h-[30px] rounded-[4px] text-xs">
                <User className="w-4 h-4 mr-2" />
                Atribuir Vendedor
              </Button>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">Variáveis da Sessão</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome:</span>
                  <span>{pessoaNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone:</span>
                  <span>+5548991898486</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail:</span>
                  <span>joao@iatize.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pipeline:</span>
                  <span>Leads</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Etapa:</span>
                  <span>1.5 | Reunião Agendada</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendedor:</span>
                  <span>João Guirunas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origem:</span>
                  <span>sistema</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mídia:</span>
                  <span>-</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campanha:</span>
                  <span>-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversaDetalhes;
