import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useEstatisticasMensagens = (pessoaId?: string, tenantId?: string) => {
  return useQuery({
    queryKey: ['estatisticas-mensagens', pessoaId],
    queryFn: async () => {
      if (!pessoaId) return null;
      
      const { data, error } = await supabase
        .from('messages')
        .select('id, from_contact, message_type, channel, created_at')
        .eq('people_id', pessoaId);
      
      if (error) throw error;
      
      const msgs = data || [];
      const total = msgs.length;
      const ia = msgs.filter(m => m.from_contact === 'agente_ia').length;
      const humano = msgs.filter(m => m.from_contact === 'humano').length;
      const cliente = msgs.filter(m => m.from_contact === 'cliente').length;
      const enviadas = ia + humano;
      const recebidas = cliente;
      const whatsapp = msgs.filter(m => m.channel === 'whatsapp' || !m.channel).length;
      const email = msgs.filter(m => m.channel === 'email').length;
      const ligacoes = msgs.filter(m => m.channel === 'phone' || m.channel === 'call').length;
      
      // Check last client message for abandonment
      const clientMsgs = msgs.filter(m => m.from_contact === 'cliente').sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const ultimaMsgCliente = clientMsgs[0]?.created_at || null;
      const tempoAbandono = ultimaMsgCliente 
        ? Math.floor((Date.now() - new Date(ultimaMsgCliente).getTime()) / 60000)
        : undefined;
      
      return {
        total,
        enviadas,
        recebidas,
        ia,
        tempoAbandono,
        // Legacy property names used by ConversasSidebar
        total_mensagens: total,
        mensagens_agente_ia: ia,
        mensagens_humano: humano,
        mensagens_cliente: cliente,
        total_whatsapp: whatsapp,
        total_email: email,
        total_ligacoes: ligacoes,
        ultima_mensagem_cliente: ultimaMsgCliente,
        tempo_abandono: tempoAbandono,
      };
    },
    enabled: !!pessoaId,
    staleTime: 30000,
  });
};
