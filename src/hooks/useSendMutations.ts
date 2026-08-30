import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Send, SendChannel } from '@/types/sends';
import { toast } from 'sonner';

interface CreateSendInput {
  name: string;
  type: 'imported' | 'filtered';
  channel: SendChannel;
  template_id?: string | null;       // UUID of whatsapp_templates (stored as text)
  message_content?: string | null;   // Non-WhatsApp channels (Email/SMS/Phone)
  webhook_id?: string | null;
  wa_channel_id?: string | null;
  pipeline_id?: string | null;
  stage_ids?: string[] | null;       // Array of stage UUIDs
  send_interval_seconds?: number;
  status?: 'draft' | 'scheduled';
  scheduled_at?: string | null;
  filter_config?: Record<string, unknown> | null;
  total_contacts?: number;
  contacts?: Array<{ people_id: string; whatsapp?: string }>;
}

interface UpdateSendInput {
  id: string;
  data: Record<string, unknown>;
}

// Helper to insert contacts in batch into sends_contacts
async function insertSendContacts(
  sendId: string,
  contacts: Array<{ people_id: string; whatsapp?: string }>
): Promise<void> {
  const contactsToInsert = contacts.map((contact) => ({
    send_id: sendId,
    people_id: contact.people_id,
    whatsapp: contact.whatsapp ?? '',
    status: 'pending' as const,
  }));

  // sends_contacts not in auto-generated Supabase types — cast required
  const { error } = await (supabase as any)
    .from('sends_contacts')
    .insert(contactsToInsert);

  if (error) throw error;
}

export const useCriarSend = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (send: CreateSendInput): Promise<Send> => {
      console.log('🔥 Creating campaign:', { name: send.name, channel: send.channel });

      // Separate contacts (goes to sends_contacts) from send columns
      const { contacts, ...sendColumns } = send;

      // Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      let userId: string | null = null;
      if (user) {
        const { data: settingsUser } = await supabase
          .from('settings_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        userId = settingsUser?.id || null;
      }

      const { data, error } = await supabase
        .from('sends')
        .insert([{
          ...sendColumns,
          created_by: userId,
        }])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Campaign created:', { id: data.id, channel: data.channel });

      // Insert contacts if provided
      if (contacts && contacts.length > 0) {
        console.log('📝 Inserting contacts:', contacts.length);
        try {
          await insertSendContacts(data.id, contacts);
          console.log('✅ Contacts inserted');
        } catch (contactError) {
          // Rollback: delete the send so we don't leave an orphan with no contacts
          console.error('❌ Contact insertion failed, rolling back send creation');
          await supabase.from('sends').delete().eq('id', data.id);
          throw new Error(`Erro ao inserir contatos: ${(contactError as Error).message}`);
        }
      }

      return data as Send;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sends'] });
      toast.success('Campaign created successfully!');
    },
    onError: (error: Error) => {
      console.error('❌ Error creating campaign:', error);
      toast.error(`Error: ${error.message}`);
    },
  });
};

export const useAtualizarSend = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data: updateData }: UpdateSendInput): Promise<Send> => {
      const { data, error } = await supabase
        .from('sends')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Send;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sends'] });
      queryClient.invalidateQueries({ queryKey: ['send', variables.id] });
    },
    onError: (error: Error) => {
      console.error('❌ Error updating campaign:', error);
      toast.error(`Erro ao atualizar disparo: ${error.message}`);
    },
  });
};

export const useDuplicarSend = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sendId: string): Promise<Send> => {
      // Fetch original campaign
      const { data: original, error: fetchError } = await supabase
        .from('sends')
        .select('*')
        .eq('id', sendId)
        .single();

      if (fetchError || !original) throw new Error('Campanha original não encontrada');

      // Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      let userId: string | null = null;
      if (user) {
        const { data: settingsUser } = await supabase
          .from('settings_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        userId = settingsUser?.id || null;
      }

      // Insert duplicate with draft status
      const { data: copy, error: insertError } = await supabase
        .from('sends')
        .insert({
          name: `${original.name} (cópia)`,
          channel: original.channel,
          type: original.type,
          status: 'draft' as const,
          template_id: original.template_id,
          wa_channel_id: original.wa_channel_id,
          webhook_id: original.webhook_id,
          message_content: original.message_content,
          send_interval_seconds: original.send_interval_seconds,
          filter_config: original.filter_config,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return copy as Send;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sends'] });
    },
    onError: (error: Error) => {
      console.error('Error duplicating campaign:', error);
      toast.error(`Erro ao duplicar: ${error.message}`);
    },
  });
};

export const useDeletarSend = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('sends')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sends'] });
      toast.success('Campaign deleted!');
    },
    onError: (error: Error) => {
      console.error('❌ Error deleting campaign:', error);
      toast.error(`Error: ${error.message}`);
    },
  });
};
