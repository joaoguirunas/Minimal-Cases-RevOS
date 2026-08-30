import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-secret',
};

const CallbackSchema = z.object({
  send_id: z.string().uuid(),
  people_id: z.string().uuid(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  error_message: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========== AUTH: Shared Secret ==========
    const callbackSecret = Deno.env.get('SEND_CALLBACK_SECRET');
    if (!callbackSecret) {
      console.error('SEND_CALLBACK_SECRET not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providedSecret = req.headers.get('X-Callback-Secret');
    if (!providedSecret || providedSecret !== callbackSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ========== END AUTH ==========

    // ========== INPUT VALIDATION ==========
    let input: z.infer<typeof CallbackSchema>;
    try {
      const rawBody = await req.json();
      input = CallbackSchema.parse(rawBody);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errorMessages = validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return new Response(
          JSON.stringify({ success: false, error: `Validation failed: ${errorMessages}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw validationError;
    }
    // ========== END INPUT VALIDATION ==========

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { send_id, people_id, status, error_message } = input;

    console.log(`Callback: send=${send_id} people=${people_id} status=${status}`);

    // ========== IDEMPOTENCY CHECK ==========
    // Status precedence: higher rank = more advanced status
    const STATUS_RANK: Record<string, number> = {
      pending: 0,
      sent: 1,
      delivered: 2,
      read: 3,
      failed: 99,   // terminal
      invalid: 99,  // terminal
    };

    // Fetch current status to prevent double-counting on retried callbacks
    const { data: existingContact } = await supabase
      .from('sends_contacts')
      .select('status')
      .eq('send_id', send_id)
      .eq('people_id', people_id)
      .maybeSingle();

    const prevStatus = existingContact?.status ?? 'pending';
    const prevRank = STATUS_RANK[prevStatus] ?? 0;
    const newRank = STATUS_RANK[status] ?? 0;

    // Skip if same status (exact duplicate) or if incoming status is weaker/equal
    // Terminal states (failed/invalid) block any further updates
    if (prevStatus === status || prevRank >= newRank) {
      console.log(`Idempotent skip: send=${send_id} people=${people_id} current=${prevStatus} incoming=${status}`);
      return new Response(
        JSON.stringify({ success: true, idempotent: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Only increment counters on meaningful first-time transitions
    // pending → sent (increment sent_count) | pending → failed (increment failed_count)
    const isFirstSent   = status === 'sent'   && prevStatus === 'pending';
    const isFirstFailed = status === 'failed' && prevStatus === 'pending';
    const shouldUpdateCounter = isFirstSent || isFirstFailed;
    // ========== END IDEMPOTENCY CHECK ==========

    // Build update payload with appropriate timestamp
    const updatePayload: Record<string, unknown> = { status };
    if (status === 'sent') updatePayload.sent_at = new Date().toISOString();
    if (status === 'delivered') updatePayload.delivered_at = new Date().toISOString();
    if (status === 'read') updatePayload.read_at = new Date().toISOString();
    if (status === 'failed' && error_message) updatePayload.error_message = error_message;

    // Update sends_contacts row
    const { error: updateError } = await supabase
      .from('sends_contacts')
      .update(updatePayload)
      .eq('send_id', send_id)
      .eq('people_id', people_id);

    if (updateError) {
      console.error('Error updating sends_contacts:', updateError);
      throw updateError;
    }

    // ========== ATOMIC COUNTER UPDATES ==========
    if (shouldUpdateCounter) {
      const counterField = isFirstSent ? 'sent_count' : 'failed_count';
      const { error: rpcError } = await supabase.rpc('increment_field', {
        table_name: 'sends',
        field_name: counterField,
        row_id: send_id,
        increment_by: 1,
      });
      if (rpcError) {
        // Fallback: direct update (non-atomic, best-effort)
        console.log(`RPC not available for ${counterField}, using direct update`);
        const { data: sendData } = await supabase
          .from('sends')
          .select(counterField)
          .eq('id', send_id)
          .single();
        await supabase
          .from('sends')
          .update({ [counterField]: ((sendData?.[counterField as keyof typeof sendData] as number) || 0) + 1 })
          .eq('id', send_id);
      }
    }
    // ========== END ATOMIC COUNTER UPDATES ==========

    // Check if all contacts have been processed → auto-complete campaign
    const { count: pendingCount } = await supabase
      .from('sends_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('send_id', send_id)
      .eq('status', 'pending');

    if ((pendingCount || 0) === 0) {
      // Only update if not already completed (prevent redundant writes)
      await supabase
        .from('sends')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', send_id)
        .neq('status', 'completed');

      console.log(`Campaign ${send_id} auto-completed — all contacts processed`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
