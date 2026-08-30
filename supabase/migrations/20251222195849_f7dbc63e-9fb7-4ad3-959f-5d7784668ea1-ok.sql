-- Tabela para nodes do processo (start, end, decision, task_set, sprint_lane)
CREATE TABLE public.process_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL DEFAULT 'task_set', -- 'start', 'end', 'decision', 'task_set', 'sprint_lane'
  task_set_id UUID REFERENCES process_task_sets(id) ON DELETE SET NULL,
  label TEXT,
  condition_expression TEXT, -- Para decision gateways (ex: "Aprovado?")
  sprint_number INTEGER DEFAULT 1,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  width FLOAT DEFAULT NULL,
  height FLOAT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para conexões entre nodes
CREATE TABLE public.process_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  label TEXT, -- "Sim", "Não" para decisões
  condition_value TEXT, -- valor da condição (true/false, etc)
  edge_type TEXT DEFAULT 'default', -- 'default', 'success', 'failure'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.process_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_edges ENABLE ROW LEVEL SECURITY;

-- Policies para process_nodes
CREATE POLICY "Allow all access to process_nodes" ON public.process_nodes
  FOR ALL USING (true) WITH CHECK (true);

-- Policies para process_edges
CREATE POLICY "Allow all access to process_edges" ON public.process_edges
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_process_nodes_process_id ON public.process_nodes(process_id);
CREATE INDEX idx_process_edges_process_id ON public.process_edges(process_id);
CREATE INDEX idx_process_edges_source ON public.process_edges(source_node_id);
CREATE INDEX idx_process_edges_target ON public.process_edges(target_node_id);