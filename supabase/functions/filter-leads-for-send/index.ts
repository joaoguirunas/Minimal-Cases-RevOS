import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema with length limits and sanitization
const SendFiltersSchema = z.object({
  pipeline_id: z.string().uuid().optional(),
  stage_ids: z.array(z.string().uuid()).max(50).optional(),
  lead_status: z.array(z.enum(['in_progress', 'won', 'lost'])).optional(),
  user_id: z.array(z.string().uuid()).max(50).optional(),
  team_id: z.array(z.string().uuid()).max(50).optional(),
  created_from: z.string().datetime().optional(),
  created_to: z.string().datetime().optional(),
  value_min: z.number().min(0).max(999999999).optional(),
  value_max: z.number().min(0).max(999999999).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
  email: z.string().max(255).optional(),
  person_status: z.array(z.enum(['active', 'inactive', 'archived'])).optional(),
  service_status: z.array(z.enum(['open', 'closed', 'in_service'])).optional(),
  accepts_calls: z.boolean().nullable().optional(),
  ai_enabled: z.boolean().nullable().optional(),
  score_matrix_id: z.string().uuid().optional(),
  score_framing_id: z.string().uuid().optional(),
  score_investment_id: z.string().uuid().optional(),
  score_objective_id: z.string().uuid().optional(),
  // B2B Qualification Q-fields (match clients_people columns)
  q1_main_bottleneck: z.string().max(200).optional(),
  q2_lead_volume_month: z.string().max(100).optional(),
  q3_team_size: z.string().max(100).optional(),
  q4_crm_maturity: z.string().max(100).optional(),
  q5_crm_name: z.string().max(100).optional(),
  q6_trigger: z.string().max(200).optional(),
  q19_qualification_status: z.string().max(100).optional(),
  q21_interest_level: z.string().max(100).optional(),
  q22_close_probability: z.string().max(100).optional(),
}).strict();

const RequestSchema = z.object({
  filters: SendFiltersSchema,
  channel: z.enum(['whatsapp', 'email', 'sms', 'phone']).default('whatsapp'),
  limit: z.number().int().min(1).max(1000).optional().default(500),
  offset: z.number().int().min(0).optional().default(0),
});

type SendFilters = z.infer<typeof SendFiltersSchema>;

// Sanitize string for ilike queries - escape special characters
function sanitizeForIlike(value: string): string {
  // Escape special PostgreSQL LIKE pattern characters
  return value.replace(/[%_\\]/g, '\\$&');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ========== AUTH CHECK ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user has admin/gestor role
    const { data: userProfile } = await supabaseAuth
      .from('settings_users')
      .select('super_admin, user_type')
      .eq('auth_user_id', claimsData.user.id)
      .single();

    const isAdmin = userProfile?.super_admin === true || userProfile?.user_type === 'admin';
    const isManager = userProfile?.user_type === 'manager';
    if (!isAdmin && !isManager) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin or manager role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ========== END AUTH CHECK ==========

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== INPUT VALIDATION ==========
    let filters: SendFilters;
    let channel: 'whatsapp' | 'email' | 'sms' | 'phone' = 'whatsapp';
    let limit = 500;
    let offset = 0;
    try {
      const rawBody = await req.json();
      const validated = RequestSchema.parse(rawBody);
      filters = validated.filters;
      channel = validated.channel || 'whatsapp';
      limit = validated.limit ?? 500;
      offset = validated.offset ?? 0;
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errorMessages = validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error('Input validation failed:', errorMessages);
        return new Response(
          JSON.stringify({ error: `Validação falhou: ${errorMessages}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw validationError;
    }
    // ========== END INPUT VALIDATION ==========

    console.log('Filtering leads with validated filters:', filters);

    // Build dynamic query - usar left join para incluir pessoas sem leads
    let query = supabase
      .from('clients_people')
      .select(`
        id,
        name,
        whatsapp,
        email,
        telefone,
        status,
        leads(
          id,
          title,
          status,
          leads_pipelines_id,
          leads_stages_id,
          user_id,
          teams_id,
          value,
          created_at
        )
      `);

    // Apply channel-specific contact field filtering
    switch (channel) {
      case 'email':
        query = query
          .not('email', 'is', null)
          .neq('email', '');
        break;
      case 'sms':
      case 'phone':
        query = query
          .not('telefone', 'is', null)
          .neq('telefone', '');
        break;
      case 'whatsapp':
      default:
        query = query
          .not('whatsapp', 'is', null)
          .neq('whatsapp', '');
        break;
    }

    // Apply to all channels: only active people, paginated
    query = query
      .eq('status', 'active')
      .range(offset, offset + limit - 1);

    // Apply Lead filters - filtrar apenas se o filtro estiver presente
    let needsLeadFilter = false;
    
    if (filters.pipeline_id) {
      needsLeadFilter = true;
      query = query.eq('leads.leads_pipelines_id', filters.pipeline_id);
    }

    if (filters.stage_ids && filters.stage_ids.length > 0) {
      needsLeadFilter = true;
      query = query.in('leads.leads_stages_id', filters.stage_ids);
    }

    if (filters.lead_status && filters.lead_status.length > 0) {
      needsLeadFilter = true;
      query = query.in('leads.status', filters.lead_status);
    }

    if (filters.user_id && filters.user_id.length > 0) {
      needsLeadFilter = true;
      query = query.in('leads.user_id', filters.user_id);
    }

    if (filters.team_id && filters.team_id.length > 0) {
      needsLeadFilter = true;
      query = query.in('leads.teams_id', filters.team_id);
    }

    if (filters.created_from) {
      needsLeadFilter = true;
      query = query.gte('leads.created_at', filters.created_from);
    }

    if (filters.created_to) {
      needsLeadFilter = true;
      query = query.lte('leads.created_at', filters.created_to);
    }

    if (filters.value_min !== undefined) {
      needsLeadFilter = true;
      query = query.gte('leads.value', filters.value_min);
    }

    if (filters.value_max !== undefined) {
      needsLeadFilter = true;
      query = query.lte('leads.value', filters.value_max);
    }

    if (filters.utm_source) {
      needsLeadFilter = true;
      query = query.eq('leads.utm_source', filters.utm_source);
    }

    if (filters.utm_medium) {
      needsLeadFilter = true;
      query = query.eq('leads.utm_medium', filters.utm_medium);
    }

    if (filters.utm_campaign) {
      needsLeadFilter = true;
      query = query.eq('leads.utm_campaign', filters.utm_campaign);
    }

    // Apply Person filters with sanitized ilike queries
    if (filters.name) {
      const sanitizedName = sanitizeForIlike(filters.name);
      query = query.ilike('name', `%${sanitizedName}%`);
    }

    if (filters.email) {
      const sanitizedEmail = sanitizeForIlike(filters.email);
      query = query.ilike('email', `%${sanitizedEmail}%`);
    }

    if (filters.person_status && filters.person_status.length > 0) {
      query = query.in('status', filters.person_status);
    }

    if (filters.service_status && filters.service_status.length > 0) {
      query = query.in('service_status', filters.service_status);
    }

    if (filters.accepts_calls !== undefined && filters.accepts_calls !== null) {
      query = query.eq('accepts_calls', filters.accepts_calls);
    }

    if (filters.ai_enabled !== undefined && filters.ai_enabled !== null) {
      query = query.eq('ai_enabled', filters.ai_enabled);
    }

    if (filters.score_matrix_id) {
      query = query.eq('score_matrix_id', filters.score_matrix_id);
    }

    if (filters.score_framing_id) {
      query = query.eq('score_framing_id', filters.score_framing_id);
    }

    if (filters.score_investment_id) {
      query = query.eq('score_investment_id', filters.score_investment_id);
    }

    if (filters.score_objective_id) {
      query = query.eq('score_objective_id', filters.score_objective_id);
    }

    // Apply B2B Qualification filters (Q-fields on clients_people)
    if (filters.q1_main_bottleneck) {
      const sanitized = sanitizeForIlike(filters.q1_main_bottleneck);
      query = query.ilike('q1_main_bottleneck', `%${sanitized}%`);
    }

    if (filters.q2_lead_volume_month) {
      const sanitized = sanitizeForIlike(filters.q2_lead_volume_month);
      query = query.ilike('q2_lead_volume_month', `%${sanitized}%`);
    }

    if (filters.q3_team_size) {
      const sanitized = sanitizeForIlike(filters.q3_team_size);
      query = query.ilike('q3_team_size', `%${sanitized}%`);
    }

    if (filters.q4_crm_maturity) {
      const sanitized = sanitizeForIlike(filters.q4_crm_maturity);
      query = query.ilike('q4_crm_maturity', `%${sanitized}%`);
    }

    if (filters.q5_crm_name) {
      const sanitized = sanitizeForIlike(filters.q5_crm_name);
      query = query.ilike('q5_crm_name', `%${sanitized}%`);
    }

    if (filters.q6_trigger) {
      const sanitized = sanitizeForIlike(filters.q6_trigger);
      query = query.ilike('q6_trigger', `%${sanitized}%`);
    }

    if (filters.q19_qualification_status) {
      const sanitized = sanitizeForIlike(filters.q19_qualification_status);
      query = query.ilike('q19_qualification_status', `%${sanitized}%`);
    }

    if (filters.q21_interest_level) {
      const sanitized = sanitizeForIlike(filters.q21_interest_level);
      query = query.ilike('q21_interest_level', `%${sanitized}%`);
    }

    if (filters.q22_close_probability) {
      const sanitized = sanitizeForIlike(filters.q22_close_probability);
      query = query.ilike('q22_close_probability', `%${sanitized}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error filtering leads:', error);
      throw error;
    }

    const rawCount = data?.length || 0;
    console.log(`✅ Query executed successfully. Raw data count: ${rawCount}`);

    // Transform data to extract unique people and their leads
    const contactsMap = new Map();

    data?.forEach((person: any) => {
      // Se há filtros de lead, só incluir pessoas com leads válidos
      if (needsLeadFilter && (!person.leads || person.leads.length === 0)) {
        return;
      }

      if (!contactsMap.has(person.id)) {
        const firstLead = person.leads?.[0];
        contactsMap.set(person.id, {
          people_id: person.id,
          lead_id: firstLead?.id || null,
          name: person.name,
          whatsapp: person.whatsapp,
          email: person.email,
          telefone: person.telefone,
          lead: firstLead ? {
            id: firstLead.id,
            status: firstLead.status,
            title: firstLead.title,
            value: firstLead.value,
          } : null,
        });
      }
    });

    const contacts = Array.from(contactsMap.values());

    console.log(`✅ Found ${contacts.length} unique contacts (needsLeadFilter: ${needsLeadFilter})`);

    // has_more based on raw DB count (pre-dedup) — dedup can reduce contacts.length
    // below limit even when more rows exist in the DB
    return new Response(
      JSON.stringify({
        total: contacts.length,
        contacts: contacts,
        has_more: rawCount === limit,
        offset: offset,
        limit: limit,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in filter-leads-for-send:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
