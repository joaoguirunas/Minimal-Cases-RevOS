import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  auth_user_id: string | null;
}

export function useCurrentUser() {
  const { data: currentUser, isLoading, error } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const { data, error } = await supabase
        .from('settings_users')
        .select('id, name, email, avatar_url, auth_user_id')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching current user:', error);
        return null;
      }
      
      return data as CurrentUser;
    },
  });

  return {
    currentUser,
    isLoading,
    error,
  };
}
