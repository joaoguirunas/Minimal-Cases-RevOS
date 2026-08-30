import { supabase } from '@/integrations/supabase/client';

export interface OmniMediaMetadata {
  file_name: string;
  mime_type: string;
  file_size: number;
}

export interface OmniMediaUploadResult {
  url: string;
  metadata: OmniMediaMetadata;
}

export type OmniMessageType = 'texto' | 'imagem' | 'audio' | 'arquivo' | 'video';

/**
 * Returns the message_type based on the file's MIME type.
 */
export function getMessageTypeFromFile(file: File): OmniMessageType {
  if (file.type.startsWith('image/')) return 'imagem';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'arquivo';
}

/**
 * Uploads a file to the omni-media Supabase storage bucket.
 * Returns the public URL and metadata for storage in the messages table.
 */
export const useOmniMediaUpload = () => {
  const upload = async (
    file: File,
    tenantId?: string,
  ): Promise<OmniMediaUploadResult> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const prefix = tenantId || 'shared';
    const path = `${prefix}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from('omni-media')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error(`Upload falhou: ${error.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('omni-media')
      .getPublicUrl(path);

    return {
      url: publicUrl,
      metadata: {
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      },
    };
  };

  return { upload };
};
