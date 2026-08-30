-- Create AI Agents table
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  identity TEXT,
  general_rules TEXT,
  use_stages BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  current_version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create AI Agent Stages table (etapas)
CREATE TABLE IF NOT EXISTS public.ai_agents_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  name TEXT,
  prompt TEXT,
  control TEXT,
  order_index INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create AI Agent History table
CREATE TABLE IF NOT EXISTS public.ai_agents_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  changelog JSONB,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "ai_agents_access_policy" ON public.ai_agents FOR ALL USING (true);
CREATE POLICY "ai_agents_stages_access_policy" ON public.ai_agents_stages FOR ALL USING (true);
CREATE POLICY "ai_agents_history_access_policy" ON public.ai_agents_history FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON public.ai_agents(active);
CREATE INDEX IF NOT EXISTS idx_ai_agents_stages_agent_id ON public.ai_agents_stages(ai_agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_stages_stage_id ON public.ai_agents_stages(stage_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_history_agent_id ON public.ai_agents_history(ai_agent_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_agents_stages_updated_at BEFORE UPDATE ON public.ai_agents_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();