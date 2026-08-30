-- Renomear coluna "campanhas" para "disparos" no campo JSON modulos_ativos da tabela crm_tenants
-- Não podemos alterar diretamente o campo JSON, então vamos fazer via UPDATE

-- Primeiro, atualizar os registros existentes que têm o campo "campanhas" no JSON
UPDATE crm_tenants 
SET modulos_ativos = jsonb_set(
    COALESCE(modulos_ativos, '{}'::jsonb) - 'campanhas',
    '{disparos}',
    COALESCE(modulos_ativos->'campanhas', 'false'::jsonb)
)
WHERE modulos_ativos ? 'campanhas';

-- Criar função para migrar automaticamente novos dados se necessário
CREATE OR REPLACE FUNCTION migrate_campanhas_to_disparos()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o JSON contém 'campanhas' mas não 'disparos', migrar
  IF NEW.modulos_ativos ? 'campanhas' AND NOT NEW.modulos_ativos ? 'disparos' THEN
    NEW.modulos_ativos = jsonb_set(
      NEW.modulos_ativos - 'campanhas',
      '{disparos}',
      NEW.modulos_ativos->'campanhas'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para migração automática em INSERTs e UPDATEs
DROP TRIGGER IF EXISTS trigger_migrate_campanhas_to_disparos ON crm_tenants;
CREATE TRIGGER trigger_migrate_campanhas_to_disparos
  BEFORE INSERT OR UPDATE ON crm_tenants
  FOR EACH ROW
  EXECUTE FUNCTION migrate_campanhas_to_disparos();