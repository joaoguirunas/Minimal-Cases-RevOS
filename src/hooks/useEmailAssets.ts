/**
 * useEmailAssets — imagens do bucket público `email-assets` (EMAIL-3),
 * extraído do EmailAssetsManager (src/components/config/KlaviyoExtras.tsx)
 * para reuso no AssetPicker do editor de e-mail.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { EMAIL_ASSETS_PUBLIC_BASE } from '@/components/config/KlaviyoExtras';

export { EMAIL_ASSETS_PUBLIC_BASE };

export interface EmailAsset {
  name: string;
  path: string;
  url: string;
}

export function useEmailAssets(prefix = '') {
  return useQuery({
    queryKey: ['email-assets', prefix],
    staleTime: 30_000,
    queryFn: async (): Promise<EmailAsset[]> => {
      const { data, error } = await supabase.storage
        .from('email-assets')
        .list(prefix, { limit: 200, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      return (data ?? [])
        .filter((f) => f.name !== '.emptyFolderPlaceholder')
        .map((f) => {
          const path = `${prefix}${f.name}`;
          return { name: f.name, path, url: `${EMAIL_ASSETS_PUBLIC_BASE}/${path}` };
        });
    },
  });
}

interface UploadEmailAssetInput {
  file: File;
  prefix?: string;
}

export function useUploadEmailAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, prefix = '' }: UploadEmailAssetInput): Promise<{ url: string }> => {
      const name = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
      const path = `${prefix}${name}`;
      const { error } = await supabase.storage
        .from('email-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      return { url: `${EMAIL_ASSETS_PUBLIC_BASE}/${path}` };
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-assets'] }); },
  });
}
