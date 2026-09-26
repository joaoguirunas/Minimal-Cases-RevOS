// supabase/functions/resend-webhook/index.ts
/** Eventos do Resend (entregue, aberto, bounce, spam…) → email_events/email_messages/email_contacts. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleResendWebhook } from './handler.ts';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve((req) => handleResendWebhook(req, {
  secret: Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '',
  apply: async (id, type, msgId, payload, at) => {
    const { data, error } = await sb.rpc('email_apply_event', { p_id: id, p_type: type, p_msg_id: msgId, p_payload: payload, p_at: at });
    if (error) throw new Error(error.message);
    return { duplicate: (data as { duplicate?: boolean } | null)?.duplicate === true };
  },
}));
