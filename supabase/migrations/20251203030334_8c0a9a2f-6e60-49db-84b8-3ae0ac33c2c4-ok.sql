-- Create storage bucket for team images
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-images', 'team-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for team images bucket
CREATE POLICY "Team images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-images');

CREATE POLICY "Authenticated users can upload team images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'team-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update team images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'team-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete team images"
ON storage.objects FOR DELETE
USING (bucket_id = 'team-images' AND auth.role() = 'authenticated');