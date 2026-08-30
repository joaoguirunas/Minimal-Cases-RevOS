
-- Limpar registros orfãos da tabela crm_usuario_times
DELETE FROM crm_usuario_times 
WHERE usuario_id NOT IN (SELECT id FROM crm_usuarios WHERE ativo = true);

-- Verificar se há registros com tenant_id inconsistente
DELETE FROM crm_usuario_times ut
WHERE NOT EXISTS (
  SELECT 1 FROM crm_usuarios u 
  WHERE u.id = ut.usuario_id 
  AND (u.tenant_id = ut.tenant_id OR u.super_adm = true)
);
