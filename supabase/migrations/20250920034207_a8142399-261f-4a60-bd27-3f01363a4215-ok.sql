-- Corrigir associação do usuário com o tenant "Receita Previsível"

-- Atualizar o usuário João Ramos para ter o tenant_id correto
UPDATE crm_usuarios 
SET tenant_id = (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel')
WHERE email = 'joao@receitaprevisivel.ai' AND auth_user_id = '0e19572f-aa33-4132-b898-db638a675467';

-- Verificar se a atualização foi feita
SELECT 
    u.nome,
    u.email, 
    u.tenant_id,
    t.name as tenant_name,
    u.super_adm,
    u.gestor
FROM crm_usuarios u
LEFT JOIN crm_tenants t ON u.tenant_id = t.id
WHERE u.email = 'joao@receitaprevisivel.ai';