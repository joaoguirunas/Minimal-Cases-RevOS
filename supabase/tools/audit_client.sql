-- =============================================================================
-- RevOS — Client Schema Audit
-- Run on each client's Supabase SQL Editor (not the main bank).
-- Returns one row per check: PASS or *** MISSING / OUTDATED ***.
-- Baseline ref: ohzwetkaazgxafubzvop | Generated: 2026-04-10
-- =============================================================================

SELECT category, check_name, status, detail
FROM (

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 1: Required tables
  -- ─────────────────────────────────────────────────────────────────
  SELECT '1.tables' AS category,
         t.tbl      AS check_name,
         CASE WHEN c.table_name IS NOT NULL THEN 'PASS' ELSE '*** MISSING ***' END AS status,
         NULL::text AS detail
  FROM (VALUES
    ('message_buffer'),
    ('settings_whatsapp_channels'),
    ('messages'),
    ('clients_people'),
    ('ai_agents'),
    ('ai_agents_execution_log'),
    ('_app_config'),
    ('omni_channel_configs')
  ) AS t(tbl)
  LEFT JOIN information_schema.tables c
    ON c.table_schema = 'public' AND c.table_name = t.tbl

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 2: messages — required columns
  -- ─────────────────────────────────────────────────────────────────
  SELECT '2.messages.columns',
         col.col,
         CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE '*** MISSING ***' END,
         NULL
  FROM (VALUES
    ('wa_message_id'),
    ('wa_phone_number_id'),
    ('source_type'),
    ('metadata'),
    ('module_ref_id'),
    ('execution_id'),
    ('ig_message_id')
  ) AS col(col)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'messages'
    AND c.column_name = col.col

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 3: message_buffer — required columns
  -- ─────────────────────────────────────────────────────────────────
  SELECT '3.message_buffer.columns',
         col.col,
         CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE '*** MISSING ***' END,
         NULL
  FROM (VALUES
    ('wa_phone_number_id'),
    ('channel_type')
  ) AS col(col)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'message_buffer'
    AND c.column_name = col.col

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 4: settings_whatsapp_channels — required columns
  -- ─────────────────────────────────────────────────────────────────
  SELECT '4.wa_channels.columns',
         col.col,
         CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE '*** MISSING ***' END,
         NULL
  FROM (VALUES
    ('app_secret'),
    ('waba_id')
  ) AS col(col)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'settings_whatsapp_channels'
    AND c.column_name = col.col

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 5: clients_people — AI fields
  -- ─────────────────────────────────────────────────────────────────
  SELECT '5.clients_people.columns',
         col.col,
         CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE '*** MISSING ***' END,
         NULL
  FROM (VALUES
    ('ai_last_message_at'),
    ('ai_processing_lock'),
    ('instagram_handle'),
    ('merged_into_id'),
    ('merge_history')
  ) AS col(col)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'clients_people'
    AND c.column_name = col.col

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 6: ai_agents — new columns
  -- ─────────────────────────────────────────────────────────────────
  SELECT '6.ai_agents.columns',
         col.col,
         CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE '*** MISSING ***' END,
         NULL
  FROM (VALUES
    ('wa_channel_id'),
    ('channel_types'),
    ('stage_ids')
  ) AS col(col)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'ai_agents'
    AND c.column_name = col.col

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 7: Required RPC functions
  -- ─────────────────────────────────────────────────────────────────
  SELECT '7.functions',
         fn.fn,
         CASE WHEN r.routine_name IS NOT NULL THEN 'PASS' ELSE '*** MISSING ***' END,
         NULL
  FROM (VALUES
    ('claim_pending_messages'),
    ('reset_stale_sending_messages'),
    ('trigger_omni_delivery_engine'),
    ('get_public_settings')
  ) AS fn(fn)
  LEFT JOIN information_schema.routines r
    ON r.routine_schema = 'public' AND r.routine_name = fn.fn

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 8: messages CHECK constraints — canonical values
  -- ─────────────────────────────────────────────────────────────────
  SELECT '8.messages.constraints',
         chk.constraint_name,
         CASE
           WHEN chk.constraint_name = 'messages_from_contact_check'
                AND cc.check_clause LIKE '%agente_ia%' AND cc.check_clause LIKE '%sistema%'
             THEN 'PASS'
           WHEN chk.constraint_name = 'messages_status_check'
                AND cc.check_clause LIKE '%sending%'
             THEN 'PASS'
           WHEN chk.constraint_name = 'messages_source_type_check'
                AND cc.check_clause LIKE '%ai_agent%'
             THEN 'PASS'
           WHEN chk.constraint_name = 'messages_channel_check'
                AND cc.check_clause LIKE '%instagram%'
             THEN 'PASS'
           WHEN chk.constraint_name = 'messages_message_type_check'
                AND cc.check_clause LIKE '%arquivo%'
             THEN 'PASS'
           WHEN cc.constraint_name IS NULL THEN '*** MISSING ***'
           ELSE '*** OUTDATED ***'
         END,
         LEFT(cc.check_clause, 100) AS detail
  FROM (VALUES
    ('messages_from_contact_check'),
    ('messages_status_check'),
    ('messages_source_type_check'),
    ('messages_channel_check'),
    ('messages_message_type_check')
  ) AS chk(constraint_name)
  LEFT JOIN information_schema.check_constraints cc
    ON cc.constraint_schema = 'public' AND cc.constraint_name = chk.constraint_name

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 9: pg_cron jobs (requires pg_cron extension)
  -- ─────────────────────────────────────────────────────────────────
  SELECT '9.cron_jobs',
         jn.job,
         CASE WHEN EXISTS (
           SELECT 1 FROM cron.job WHERE jobname = jn.job
         ) THEN 'PASS' ELSE '*** MISSING ***' END,
         NULL
  FROM (VALUES
    ('omni-delivery-engine'),
    ('reset-stale-sending')
  ) AS jn(job)

  UNION ALL

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 10: _app_config required keys
  -- ─────────────────────────────────────────────────────────────────
  SELECT '10._app_config',
         k.key,
         CASE
           WHEN ac.value IS NOT NULL AND ac.value != '' THEN 'PASS'
           WHEN ac.key IS NOT NULL THEN '*** EMPTY ***'
           ELSE '*** MISSING ***'
         END,
         NULL
  FROM (VALUES
    ('supabase_url'),
    ('service_role_key')
  ) AS k(key)
  LEFT JOIN _app_config ac ON ac.key = k.key

) AS audit
ORDER BY category, check_name;

-- =============================================================================
-- Summary: any row with status != 'PASS' requires sync_client_schema.sql
-- =============================================================================
