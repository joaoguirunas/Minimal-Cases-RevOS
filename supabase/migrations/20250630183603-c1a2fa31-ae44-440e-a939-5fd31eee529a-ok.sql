
-- Verificar se existem tenants no sistema
-- Se não existir, vamos criar um tenant padrão
INSERT INTO public.crm_tenants (name, value, modulos_ativos)
SELECT 'Tenant Principal', 'tenant-principal', '{"visitas": true, "reservas": true, "reunioes": true, "campanhas": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.crm_tenants LIMIT 1);

-- Atualizar usuários que não têm tenant_id para usar o primeiro tenant disponível
UPDATE public.crm_usuarios 
SET tenant_id = (SELECT id FROM public.crm_tenants ORDER BY created_at LIMIT 1)
WHERE tenant_id IS NULL 
AND auth_user_id IS NOT NULL;

-- Se o usuário atual (joao@iatize.com) não for super admin, vamos torná-lo super admin para resolver o problema
UPDATE public.crm_usuarios 
SET super_adm = true 
WHERE email = 'joao@iatize.com' 
AND NOT super_adm;

-- Garantir que o usuário está ativo
UPDATE public.crm_usuarios 
SET ativo = true 
WHERE email = 'joao@iatize.com';
