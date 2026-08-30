-- FWUP-17: RLS policies baseline repair
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA:
--   009_ensure_full_tenant_baseline cria 33 tabelas com ENABLE ROW LEVEL SECURITY
--   mas ZERO CREATE POLICY. As policies foram criadas em migrations com nomes UUID
--   que nunca entraram no client-migrations.json e portanto nunca chegaram em
--   tenants como ORA. Com RLS ativo e sem policies, todos os reads/writes de
--   usuários autenticados retornam vazio ou negam acesso.
--
-- SOLUÇÃO:
--   DROP POLICY IF EXISTS + CREATE POLICY para cada tabela com RLS.
--   settings_users usa USING (true) simples (evita dependência em has_role()).
--
-- IDEMPOTENTE: DROP IF EXISTS antes de cada CREATE.
-- SEM BEGIN/COMMIT: auto-commit por statement.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── settings ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.settings;
DROP POLICY IF EXISTS "authenticated_write" ON public.settings;
CREATE POLICY "authenticated_read"  ON public.settings FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings FOR ALL    USING (true) WITH CHECK (true);

-- ── settings_users ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_policy" ON public.settings_users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.settings_users;
DROP POLICY IF EXISTS "users_update_policy" ON public.settings_users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.settings_users;
DROP POLICY IF EXISTS "authenticated_read"  ON public.settings_users;
DROP POLICY IF EXISTS "authenticated_write" ON public.settings_users;
CREATE POLICY "authenticated_read"  ON public.settings_users FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_users FOR ALL    USING (true) WITH CHECK (true);

-- ── settings_teams ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.settings_teams;
DROP POLICY IF EXISTS "authenticated_write" ON public.settings_teams;
CREATE POLICY "authenticated_read"  ON public.settings_teams FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_teams FOR ALL    USING (true) WITH CHECK (true);

-- ── settings_users_teams ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.settings_users_teams;
DROP POLICY IF EXISTS "authenticated_write" ON public.settings_users_teams;
CREATE POLICY "authenticated_read"  ON public.settings_users_teams FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_users_teams FOR ALL    USING (true) WITH CHECK (true);

-- ── settings_schedules ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.settings_schedules;
DROP POLICY IF EXISTS "authenticated_write" ON public.settings_schedules;
CREATE POLICY "authenticated_read"  ON public.settings_schedules FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_schedules FOR ALL    USING (true) WITH CHECK (true);

-- ── settings_system_modules ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.settings_system_modules;
DROP POLICY IF EXISTS "authenticated_write" ON public.settings_system_modules;
DROP POLICY IF EXISTS "super_admin_manage_modules" ON public.settings_system_modules;
CREATE POLICY "authenticated_read"  ON public.settings_system_modules FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_system_modules FOR ALL    USING (true) WITH CHECK (true);

-- ── clients_people ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.clients_people;
DROP POLICY IF EXISTS "authenticated_write" ON public.clients_people;
CREATE POLICY "authenticated_read"  ON public.clients_people FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.clients_people FOR ALL    USING (true) WITH CHECK (true);

-- ── clients_people_updates ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.clients_people_updates;
DROP POLICY IF EXISTS "authenticated_write" ON public.clients_people_updates;
CREATE POLICY "authenticated_read"  ON public.clients_people_updates FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.clients_people_updates FOR ALL    USING (true) WITH CHECK (true);

-- ── clients_companies ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.clients_companies;
DROP POLICY IF EXISTS "authenticated_write" ON public.clients_companies;
CREATE POLICY "authenticated_read"  ON public.clients_companies FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.clients_companies FOR ALL    USING (true) WITH CHECK (true);

-- ── leads_pipelines ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.leads_pipelines;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_pipelines;
CREATE POLICY "authenticated_read"  ON public.leads_pipelines FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_pipelines FOR ALL    USING (true) WITH CHECK (true);

-- ── leads_stages ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.leads_stages;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_stages;
CREATE POLICY "authenticated_read"  ON public.leads_stages FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_stages FOR ALL    USING (true) WITH CHECK (true);

-- ── leads_stages_followups ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.leads_stages_followups;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_stages_followups;
CREATE POLICY "authenticated_read"  ON public.leads_stages_followups FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_stages_followups FOR ALL    USING (true) WITH CHECK (true);

-- ── leads_loss_reasons ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.leads_loss_reasons;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_loss_reasons;
CREATE POLICY "authenticated_read"  ON public.leads_loss_reasons FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_loss_reasons FOR ALL    USING (true) WITH CHECK (true);

-- ── leads ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.leads;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads;
CREATE POLICY "authenticated_read"  ON public.leads FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads FOR ALL    USING (true) WITH CHECK (true);

-- ── leads_notes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.leads_notes;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_notes;
CREATE POLICY "authenticated_read"  ON public.leads_notes FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_notes FOR ALL    USING (true) WITH CHECK (true);

-- ── leads_files ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.leads_files;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_files;
CREATE POLICY "authenticated_read"  ON public.leads_files FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_files FOR ALL    USING (true) WITH CHECK (true);

-- ── leads_updates ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.leads_updates;
DROP POLICY IF EXISTS "authenticated_write" ON public.leads_updates;
CREATE POLICY "authenticated_read"  ON public.leads_updates FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.leads_updates FOR ALL    USING (true) WITH CHECK (true);

-- ── meetings ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.meetings;
DROP POLICY IF EXISTS "authenticated_write" ON public.meetings;
CREATE POLICY "authenticated_read"  ON public.meetings FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.meetings FOR ALL    USING (true) WITH CHECK (true);

-- ── messages ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.messages;
DROP POLICY IF EXISTS "authenticated_write" ON public.messages;
CREATE POLICY "authenticated_read"  ON public.messages FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.messages FOR ALL    USING (true) WITH CHECK (true);

-- ── score_objectives (guard: tabela pode não existir em tenants antigos) ─────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'score_objectives') THEN
    DROP POLICY IF EXISTS "authenticated_read"  ON public.score_objectives;
    DROP POLICY IF EXISTS "authenticated_write" ON public.score_objectives;
    CREATE POLICY "authenticated_read"  ON public.score_objectives FOR SELECT USING (true);
    CREATE POLICY "authenticated_write" ON public.score_objectives FOR ALL    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── score_investments (guard: tabela pode não existir em tenants antigos) ────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'score_investments') THEN
    DROP POLICY IF EXISTS "authenticated_read"  ON public.score_investments;
    DROP POLICY IF EXISTS "authenticated_write" ON public.score_investments;
    CREATE POLICY "authenticated_read"  ON public.score_investments FOR SELECT USING (true);
    CREATE POLICY "authenticated_write" ON public.score_investments FOR ALL    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── score_framings (guard: tabela pode não existir em tenants antigos) ───────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'score_framings') THEN
    DROP POLICY IF EXISTS "authenticated_read"  ON public.score_framings;
    DROP POLICY IF EXISTS "authenticated_write" ON public.score_framings;
    CREATE POLICY "authenticated_read"  ON public.score_framings FOR SELECT USING (true);
    CREATE POLICY "authenticated_write" ON public.score_framings FOR ALL    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── score_matrix ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'score_matrix') THEN
    DROP POLICY IF EXISTS "authenticated_read"  ON public.score_matrix;
    DROP POLICY IF EXISTS "authenticated_write" ON public.score_matrix;
    CREATE POLICY "authenticated_read"  ON public.score_matrix FOR SELECT USING (true);
    CREATE POLICY "authenticated_write" ON public.score_matrix FOR ALL    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── sends ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.sends;
DROP POLICY IF EXISTS "authenticated_write" ON public.sends;
CREATE POLICY "authenticated_read"  ON public.sends FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.sends FOR ALL    USING (true) WITH CHECK (true);

-- ── sends_contacts ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.sends_contacts;
DROP POLICY IF EXISTS "authenticated_write" ON public.sends_contacts;
CREATE POLICY "authenticated_read"  ON public.sends_contacts FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.sends_contacts FOR ALL    USING (true) WITH CHECK (true);

-- ── webhooks ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.webhooks;
DROP POLICY IF EXISTS "authenticated_write" ON public.webhooks;
CREATE POLICY "authenticated_read"  ON public.webhooks FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.webhooks FOR ALL    USING (true) WITH CHECK (true);

-- ── webhook_logs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.webhook_logs;
DROP POLICY IF EXISTS "authenticated_write" ON public.webhook_logs;
CREATE POLICY "authenticated_read"  ON public.webhook_logs FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.webhook_logs FOR ALL    USING (true) WITH CHECK (true);

-- ── whatsapp_templates ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.whatsapp_templates;
DROP POLICY IF EXISTS "authenticated_write" ON public.whatsapp_templates;
CREATE POLICY "authenticated_read"  ON public.whatsapp_templates FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.whatsapp_templates FOR ALL    USING (true) WITH CHECK (true);

-- ── ai_agents ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.ai_agents;
DROP POLICY IF EXISTS "authenticated_write" ON public.ai_agents;
CREATE POLICY "authenticated_read"  ON public.ai_agents FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents FOR ALL    USING (true) WITH CHECK (true);

-- ── ai_agents_history ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.ai_agents_history;
DROP POLICY IF EXISTS "authenticated_write" ON public.ai_agents_history;
CREATE POLICY "authenticated_read"  ON public.ai_agents_history FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_history FOR ALL    USING (true) WITH CHECK (true);

-- ── ai_agents_steps ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.ai_agents_steps;
DROP POLICY IF EXISTS "authenticated_write" ON public.ai_agents_steps;
CREATE POLICY "authenticated_read"  ON public.ai_agents_steps FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_steps FOR ALL    USING (true) WITH CHECK (true);

-- ── ai_agents_steps_history ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.ai_agents_steps_history;
DROP POLICY IF EXISTS "authenticated_write" ON public.ai_agents_steps_history;
CREATE POLICY "authenticated_read"  ON public.ai_agents_steps_history FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.ai_agents_steps_history FOR ALL    USING (true) WITH CHECK (true);

-- ── ai_agents_score_matrix (guard: tabela pode não existir em tenants antigos)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_agents_score_matrix') THEN
    DROP POLICY IF EXISTS "authenticated_read"  ON public.ai_agents_score_matrix;
    DROP POLICY IF EXISTS "authenticated_write" ON public.ai_agents_score_matrix;
    CREATE POLICY "authenticated_read"  ON public.ai_agents_score_matrix FOR SELECT USING (true);
    CREATE POLICY "authenticated_write" ON public.ai_agents_score_matrix FOR ALL    USING (true) WITH CHECK (true);
  END IF;
END $$;
