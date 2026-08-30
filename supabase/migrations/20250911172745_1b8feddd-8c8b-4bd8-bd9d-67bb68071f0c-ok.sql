-- Fix RLS for INSERT on crm_agendamentos to allow super admins to insert across tenants
-- Drop the existing policy and recreate it with a relaxed tenant constraint for super admins

DROP POLICY IF EXISTS "Users can insert agendamentos with proper permissions" ON public.crm_agendamentos;

CREATE POLICY "Users can insert agendamentos with proper permissions"
ON public.crm_agendamentos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.crm_usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND (
        -- Super admins can insert regardless of tenant
        u.super_adm = true
        OR (
          -- Otherwise must match tenant and have proper role
          u.tenant_id = public.crm_agendamentos.tenant_id
          AND (
            u.gestor = true
            OR (
              u.gestor = false
              AND u.super_adm = false
              AND u.id = public.crm_agendamentos.usuario_id
            )
          )
        )
      )
  )
);
