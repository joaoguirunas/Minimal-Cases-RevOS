// supabase/functions/email-unsubscribe/index.ts
/** Descadastro de e-mail (público). One-click RFC 8058 + API da página /sair/:token. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleUnsubscribe } from './handler.ts';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve((req) => handleUnsubscribe(req, {
  secret: Deno.env.get('EMAIL_UNSUBSCRIBE_SECRET') ?? '',
  unsubscribe: async (email, reason) => String((await sb.rpc('email_unsubscribe', { p_email: email, p_reason: reason })).data ?? 'unsubscribed'),
  status: async (email) => String((await sb.rpc('email_contact_status', { p_email: email })).data ?? 'subscribed'),
}));
