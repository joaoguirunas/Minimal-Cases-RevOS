
-- Enable RLS on crm_pipelines table if not already enabled
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for crm_pipelines table
-- Policy for SELECT operations
CREATE POLICY "Users can view pipelines for their tenant" 
  ON public.crm_pipelines 
  FOR SELECT 
  USING (true); -- Allow all for now, can be refined later

-- Policy for INSERT operations
CREATE POLICY "Users can create pipelines for their tenant" 
  ON public.crm_pipelines 
  FOR INSERT 
  WITH CHECK (true); -- Allow all for now, can be refined later

-- Policy for UPDATE operations
CREATE POLICY "Users can update pipelines for their tenant" 
  ON public.crm_pipelines 
  FOR UPDATE 
  USING (true); -- Allow all for now, can be refined later

-- Policy for DELETE operations
CREATE POLICY "Users can delete pipelines for their tenant" 
  ON public.crm_pipelines 
  FOR DELETE 
  USING (true); -- Allow all for now, can be refined later

-- Also create similar policies for crm_stages table
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stages for their tenant" 
  ON public.crm_stages 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create stages for their tenant" 
  ON public.crm_stages 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update stages for their tenant" 
  ON public.crm_stages 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete stages for their tenant" 
  ON public.crm_stages 
  FOR DELETE 
  USING (true);
