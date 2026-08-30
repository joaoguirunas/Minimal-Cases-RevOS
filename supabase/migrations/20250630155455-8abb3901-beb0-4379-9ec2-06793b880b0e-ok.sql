
-- Adicionar colunas gestor e super_adm na tabela crm_usuarios
ALTER TABLE crm_usuarios 
ADD COLUMN gestor boolean NOT NULL DEFAULT false,
ADD COLUMN super_adm_tenant boolean NOT NULL DEFAULT false;

-- Migrar dados existentes baseados no tipo_usuario
UPDATE crm_usuarios 
SET gestor = CASE 
    WHEN tipo_usuario = 'gestor' THEN true 
    ELSE false 
END;

UPDATE crm_usuarios 
SET super_adm_tenant = CASE 
    WHEN super_adm = true AND admin_global = false THEN true 
    ELSE false 
END;
