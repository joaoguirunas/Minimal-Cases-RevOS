import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Phone, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ConversaItemProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversa: Record<string, any>;
}

export const MobileConversaItem = ({ conversa }: ConversaItemProps) => {
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'atendendo': return 'bg-success';
      case 'aguardando': return 'bg-warning';
      case 'finalizado': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  const hasUnread = conversa.unread_count > 0;

  return (
    <button
      onClick={() => navigate(`/m/omni/${conversa.id}`)}
      className={cn(
        "w-full px-4 py-3 flex items-start gap-3 active:bg-muted transition-colors text-left rounded-2xl",
        hasUnread && "bg-accent/5"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-12 w-12 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(conversa.nome)}
        </AvatarFallback>
      </Avatar>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className={cn(
              "text-base truncate",
              hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
            )}>
              {conversa.nome}
            </h3>
            {conversa.ai_enabled && (
              <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </div>
          <span className="text-micro text-muted-foreground shrink-0">
            {conversa.data_ultima_mensagem && formatTime(conversa.data_ultima_mensagem)}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-1">
          {conversa.whatsapp && (
            <div className="flex items-center gap-1 text-micro text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="truncate">{conversa.whatsapp}</span>
            </div>
          )}
        </div>

        {conversa.ultima_mensagem_conteudo && (
          <p className={cn(
            "text-sm truncate mb-1",
            hasUnread ? "font-medium text-foreground" : "text-muted-foreground"
          )}>
            {conversa.ultima_mensagem_conteudo}
          </p>
        )}

        <div className="flex items-center gap-2">
          {conversa.statusAtendimento && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-micro px-2 py-0 h-5",
                getStatusColor(conversa.statusAtendimento)
              )}
            >
              {conversa.statusAtendimento}
            </Badge>
          )}
          {hasUnread && (
            <Badge className="bg-primary text-primary-foreground text-micro px-2 py-0 h-5">
              {conversa.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
};
