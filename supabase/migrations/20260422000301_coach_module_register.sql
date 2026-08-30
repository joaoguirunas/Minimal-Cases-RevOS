-- CoachPRO™ — Registo do módulo em settings_system_modules
-- Migration: 20260422000301
-- Garante que o módulo 'coach' aparece na sidebar e pode ser activado/desactivado

INSERT INTO public.settings_system_modules (module_key, module_name, is_active, order_index)
VALUES ('coach', 'CoachPRO™', true, 95)
ON CONFLICT (module_key) DO UPDATE
  SET module_name = EXCLUDED.module_name,
      is_active   = EXCLUDED.is_active;
