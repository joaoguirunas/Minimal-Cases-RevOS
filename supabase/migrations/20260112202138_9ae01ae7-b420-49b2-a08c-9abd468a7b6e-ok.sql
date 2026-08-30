-- ============================================
-- TASK ATTACHMENTS: Storage bucket + table for URLs
-- Images are stored in Supabase Storage, only URLs saved in DB
-- ============================================

-- 1. Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments', 
  'task-attachments', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create table to store attachment references (URLs only, not files!)
CREATE TABLE IF NOT EXISTS public.project_task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.settings_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.project_task_attachments(task_id);

-- 4. Enable RLS
ALTER TABLE public.project_task_attachments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - authenticated users can manage attachments
CREATE POLICY "Authenticated users can view task attachments"
ON public.project_task_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can upload task attachments"
ON public.project_task_attachments FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can delete their own attachments"
ON public.project_task_attachments FOR DELETE TO authenticated
USING (uploaded_by IN (SELECT id FROM public.settings_users WHERE auth_user_id = auth.uid()));

-- 6. Storage policies for task-attachments bucket
CREATE POLICY "Public can view task attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their own task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);