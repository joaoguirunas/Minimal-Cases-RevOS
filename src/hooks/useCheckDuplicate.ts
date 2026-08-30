import { supabase } from '@/integrations/supabase/client';

export interface DuplicatePerson {
  id: string;
  name: string;
  whatsapp?: string | null;
  email?: string | null;
  instagram_handle?: string | null;
  instagram_user_id?: string | null;
  profile_picture?: string | null;
}

interface CheckDuplicateParams {
  excludeId?: string;  // current person's ID (omit or use dummy when creating new)
  whatsapp?: string | null;
  email?: string | null;
  instagramHandle?: string | null;
  instagramUserId?: string | null;
}

const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';

export const useCheckDuplicate = () => {
  const check = async (params: CheckDuplicateParams): Promise<DuplicatePerson | null> => {
    const { excludeId, whatsapp, email, instagramHandle, instagramUserId } = params;

    // Skip check if no identity fields provided
    if (!whatsapp && !email && !instagramHandle && !instagramUserId) return null;

    const { data: duplicateId, error } = await supabase.rpc('find_duplicate_person', {
      p_exclude_id: excludeId || DUMMY_UUID,
      p_whatsapp: whatsapp || null,
      p_email: email || null,
      p_document: null,
      p_instagram_user_id: instagramUserId || null,
      p_instagram_handle: instagramHandle || null,
    });

    if (error || !duplicateId) return null;

    const { data: person } = await supabase
      .from('clients_people')
      .select('id, name, whatsapp, email, instagram_handle, instagram_user_id, profile_picture')
      .eq('id', duplicateId as string)
      .single();

    return person as DuplicatePerson | null;
  };

  return { check };
};
