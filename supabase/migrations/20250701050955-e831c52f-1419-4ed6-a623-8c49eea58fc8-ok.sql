
-- Primeiro, vamos identificar e remover os agendamentos duplicados
-- Mantemos apenas o mais recente de cada duplicata
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY usuario_id, data, hora_inicio 
      ORDER BY criado_em DESC
    ) as rn
  FROM public.crm_agendamentos
  WHERE usuario_id IS NOT NULL
)
DELETE FROM public.crm_agendamentos
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Agora podemos adicionar a constraint única
ALTER TABLE public.crm_agendamentos 
ADD CONSTRAINT unique_usuario_data_hora 
UNIQUE (usuario_id, data, hora_inicio);

-- Criar índice para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_data_hora 
ON public.crm_agendamentos(usuario_id, data, hora_inicio);
