-- Add video and missing audio MIME types to omni-media bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  -- Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif',
  -- Audio (WhatsApp sends ogg/opus, aac, mp4 audio)
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav',
  'audio/aac', 'audio/amr', 'audio/3gpp', 'audio/opus',
  -- Video (WhatsApp sends mp4, 3gpp)
  'video/mp4', 'video/3gpp', 'video/3gp2', 'video/quicktime',
  'video/webm', 'video/avi', 'video/mpeg', 'video/x-msvideo',
  -- Documents
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'application/zip', 'application/x-zip-compressed',
  'application/octet-stream'
]
WHERE id = 'omni-media';
