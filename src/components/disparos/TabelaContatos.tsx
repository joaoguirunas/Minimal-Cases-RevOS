import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Edit2, Check, X, Clock } from 'lucide-react';
import { useSendContacts } from '@/hooks/useSendContacts';
import { useUpdateContactStatus } from '@/hooks/useSendContactMutations';
import { ContactStatus } from '@/types/sends';
import StatusBadge from './StatusBadge';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CHANNEL_CONTACT_FIELD: Record<string, { field: string; label: string }> = {
  whatsapp: { field: 'whatsapp', label: 'WhatsApp' },
  email:    { field: 'email',    label: 'Email' },
  sms:      { field: 'telefone', label: 'Telefone' },
  phone:    { field: 'telefone', label: 'Telefone' },
};

interface TabelaContatosProps {
  sendId: string;
  sendStatus?: string;
  channel?: string;
}

export default function TabelaContatos({ sendId, sendStatus = 'draft', channel = 'whatsapp' }: TabelaContatosProps) {
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<ContactStatus | null>(null);
  const queryClient = useQueryClient();

  // Pass search to hook only for channel_value filtering (whatsapp/telefone column).
  // Name filtering is done client-side below because it's a JOIN column not filterable server-side.
  const { data: rawContacts, isLoading } = useSendContacts(sendId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    search,
  });

  const contacts = search
    ? rawContacts?.filter((c: Record<string, any>) => {
        const name = (c.person?.name as string ?? '').toLowerCase();
        const term = search.toLowerCase();
        const channelValue = (c.whatsapp as string ?? '').toLowerCase();
        return name.includes(term) || channelValue.includes(term);
      })
    : rawContacts;

  // Encontrar o próximo contato pendente (primeiro da lista)
  const nextPendingContact = contacts?.find((c: Record<string, unknown>) => c.status === 'pending');

  // Setup realtime para atualizar automaticamente
  useEffect(() => {
    const channel = supabase
      .channel('sends_contacts_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sends_contacts',
          filter: `send_id=eq.${sendId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['send-contacts', sendId] });
          queryClient.invalidateQueries({ queryKey: ['send', sendId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sendId, queryClient]);

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateContactStatus();

  const handleStartEdit = (contactId: string, currentStatus: ContactStatus) => {
    setEditingId(contactId);
    setEditingStatus(currentStatus);
  };

  const handleSaveEdit = (contactId: string) => {
    if (editingStatus) {
      updateStatus({
        id: contactId,
        status: editingStatus,
        sendId,
      });
    }
    setEditingId(null);
    setEditingStatus(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingStatus(null);
  };

  if (isLoading) {
    return (
      <Card className="rounded-[4px]">
        <CardContent className="p-12">
          <LoadingSpinner size="large" message="Carregando contatos..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4 border border-border bg-card rounded-[2px]">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Buscar por nome ou ${CHANNEL_CONTACT_FIELD[channel]?.label ?? 'contato'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContactStatus | 'all')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="read">Lido</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="invalid">Inválido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="border border-border bg-card rounded-[2px] overflow-hidden">
        {!contacts || contacts.length === 0 ? (
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              {search || statusFilter !== 'all' 
                ? 'Nenhum contato encontrado com os filtros aplicados'
                : 'Nenhum contato encontrado'
              }
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-[50px]">#</TableHead>
                <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Contato</TableHead>
                <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{CHANNEL_CONTACT_FIELD[channel]?.label ?? 'Contato'}</TableHead>
                <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Enviado em</TableHead>
                <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Erro</TableHead>
                <TableHead className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact: Record<string, any>, index: number) => {
                const isNextPending = contact.id === nextPendingContact?.id;
                const isRunning = sendStatus === 'running';

                return (
                  <TableRow
                    key={contact.id}
                    className={`hover:bg-white/[0.035] transition-colors ${isNextPending && isRunning ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {isNextPending && isRunning ? (
                          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                            <Clock className="w-4 h-4 animate-pulse" />
                            <span className="text-xs font-medium">Próximo</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground font-medium">
                            {index + 1}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="font-medium">{contact.person?.name || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">{contact.person?.email || '-'}</div>
                    </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      {(() => {
                        const fieldKey = CHANNEL_CONTACT_FIELD[channel]?.field ?? 'whatsapp';
                        const value = fieldKey === 'whatsapp' ? contact.whatsapp
                          : contact.person?.[fieldKey];
                        return value || '\u2014';
                      })()}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {editingId === contact.id ? (
                      <Select 
                        value={editingStatus || contact.status} 
                        onValueChange={(v) => setEditingStatus(v as ContactStatus)}
                      >
                        <SelectTrigger className="w-[140px] h-[30px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="sent">Enviado</SelectItem>
                          <SelectItem value="delivered">Entregue</SelectItem>
                          <SelectItem value="read">Lido</SelectItem>
                          <SelectItem value="failed">Falhou</SelectItem>
                          <SelectItem value="invalid">Inválido</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge status={contact.status} size="sm" />
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {contact.sent_at ? format(new Date(contact.sent_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {contact.error_message ? (
                      <div className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate" title={contact.error_message}>
                        {contact.error_message}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">-</div>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {editingId === contact.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-[30px] w-[30px] p-0"
                          onClick={() => handleSaveEdit(contact.id)}
                          disabled={isUpdating}
                        >
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-[30px] w-[30px] p-0"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          <X className="w-3.5 h-3.5 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-[30px] w-[30px] p-0"
                        onClick={() => handleStartEdit(contact.id, contact.status)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
