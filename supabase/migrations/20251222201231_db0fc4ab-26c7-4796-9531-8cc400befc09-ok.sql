-- Adicionar sort_order para ordenar task sets dentro de cada sprint
ALTER TABLE process_nodes 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Criar índice para ordenação eficiente
CREATE INDEX IF NOT EXISTS idx_process_nodes_sprint_sort 
ON process_nodes(process_id, sprint_number, sort_order);