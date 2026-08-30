-- 091: Seed PROSPECT PRO module in settings_system_modules
-- The original seed (007) did not include the prospect module.
-- This migration adds it for existing tenants; new tenants will get it
-- from the updated seed (007) which now includes prospect.
--
-- Idempotent: ON CONFLICT DO NOTHING ensures safe re-runs.

INSERT INTO settings_system_modules (module_key, module_name, is_active, order_index, icon)
VALUES ('prospect', 'PROSPECT PRO™', true, 13, 'Search')
ON CONFLICT (module_key) DO NOTHING;
