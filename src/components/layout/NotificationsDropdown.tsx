import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

const relativeTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

export const NotificationsDropdown = () => {
  const navigate = useNavigate();
  const {
    notifications,
    isLoading,
    hasMore,
    isLoadingMore,
    loadMore,
    unreadCount,
    markAsRead,
    markNotificationRead,
    markAllAsRead,
    isMarkingAll,
  } = useNotifications();

  const handleSelect = (notification: AppNotification) => {
    // meeting_scheduled é um alerta pessoal pro closer, não sobre "abrir a
    // conversa" — fecha só essa notificação (sem mexer em messages.seen_at)
    // e leva pro lead, não pro Omni.
    if (notification.event_type === 'meeting_scheduled') {
      if (!notification.read_at) markNotificationRead(notification.id);
      if (notification.lead_id) navigate(`/crm/kanban/${notification.lead_id}`);
      return;
    }

    if (notification.people_id) {
      // Marca a conversa inteira como lida: limpa o sino e o contador do Omni/Kanban
      // na mesma transação. Um UPDATE só em notifications deixaria os dois divergentes.
      if (!notification.read_at) markAsRead(notification.people_id);
      navigate(`/omni?pessoaId=${notification.people_id}`);
      return;
    }

    if (notification.lead_id) navigate(`/crm/kanban/${notification.lead_id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
          className="relative h-[30px] w-[30px] rounded-lg transition-all duration-300"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#00D26A] px-1 text-[10px] font-semibold leading-none text-black">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isMarkingAll}
              onClick={(e) => {
                e.preventDefault();
                markAllAsRead();
              }}
              className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[380px] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {!isLoading && notifications.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma notificação por aqui.
            </p>
          )}

          {notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onSelect={() => handleSelect(notification)}
              className="flex cursor-pointer flex-col items-start gap-0.5 rounded-none px-3 py-2"
            >
              <div className="flex w-full items-center gap-2">
                {!notification.read_at && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D26A]" />
                )}
                <span
                  className={`truncate text-[13px] ${notification.read_at ? 'text-muted-foreground' : 'font-medium text-foreground'}`}
                >
                  {notification.title}
                </span>
                {notification.unread_messages > 1 && (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                    {notification.unread_messages}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {relativeTime(notification.created_at)}
                </span>
              </div>
              {notification.body && (
                <p className="line-clamp-2 w-full pl-0 text-xs text-muted-foreground">
                  {notification.body}
                </p>
              )}
            </DropdownMenuItem>
          ))}

          {hasMore && (
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoadingMore}
                onClick={(e) => {
                  e.preventDefault();
                  loadMore();
                }}
                className="h-7 w-full text-xs text-muted-foreground"
              >
                {isLoadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Carregar mais'}
              </Button>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;
