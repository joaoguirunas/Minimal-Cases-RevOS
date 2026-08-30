import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl, CONTROL_PLANE_URL, CONTROL_PLANE_ANON_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UserType } from '@/types/usuarios';

export interface User {
  id: string;
  auth_user_id?: string;
  name: string;
  email: string;
  phone?: string; // Database column name
  is_manager: boolean;
  is_super_admin: boolean;
  user_type?: UserType;
  active: boolean;
  deleted_by?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  // Backward compatibility
  nome?: string;
  gestor?: boolean;
  super_adm?: boolean;
  ativo?: boolean;
  whatsapp?: string; // Alias for phone
  agente?: string | null;
}

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error} = await supabase
        .from('settings_users')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      
      // Add Portuguese compatibility aliases
      const mappedData = (data || []).map(item => ({
        ...item,
        nome: item.name,
        gestor: item.user_type === 'manager' || item.user_type === 'admin',
        super_adm: item.user_type === 'admin' || item.super_admin,
        ativo: item.active,
        whatsapp: item.phone // Map phone to whatsapp for compatibility
      }));
      
      return mappedData as User[];
    },
  });
};

export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Map database fields to User type with Portuguese compatibility
      return {
        ...data,
        nome: data.name,
        gestor: data.user_type === 'manager' || data.user_type === 'admin',
        super_adm: data.user_type === 'admin' || data.super_admin,
        ativo: data.active,
        whatsapp: data.phone // Map phone to whatsapp for compatibility
      } as User;
    },
    enabled: !!id,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData: {
      nome: string;
      email: string;
      senha?: string;
      whatsapp?: string;
      gestor: boolean;
      timesSelecionados: string[];
      superAdmin?: boolean;
      userType?: UserType;
      projectIds?: string[];
    }) => {
      const userType = userData.userType || (userData.superAdmin ? 'admin' : (userData.gestor ? 'manager' : 'user'));

      // 1. Get caller's tenant JWT (passed in body, NOT in Authorization header,
      //    because the control plane gateway validates Authorization against its own
      //    project — a tenant JWT would be rejected as "Invalid JWT")
      const { data: { session } } = await supabase.auth.getSession();
      const callerToken = session?.access_token ?? '';

      // 2. Create user via control plane edge function (avoids pg_net statement timeout)
      const res = await fetch(`${CONTROL_PLANE_URL}/functions/v1/create-tenant-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONTROL_PLANE_ANON_KEY,
          'Authorization': `Bearer ${CONTROL_PLANE_ANON_KEY}`,
        },
        body: JSON.stringify({
          supabase_url: supabaseUrl,
          caller_token: callerToken,
          email: userData.email,
          password: userData.senha || 'senha123',
          name: userData.nome,
          phone: userData.whatsapp || null,
          user_type: userType,
          super_admin: userData.superAdmin || false,
        }),
      });

      let result: { user_id?: string; error?: string; message?: string; code?: string } = {};
      try {
        result = await res.json();
      } catch (_) {
        throw new Error(`HTTP ${res.status}: resposta inválida da função create-tenant-user`);
      }
      console.error('[useCreateUser] create-tenant-user:', res.status, result);
      if (!res.ok || result?.error) throw new Error(result?.error || result?.message || result?.code || `HTTP ${res.status}`);

      // 3. Fetch the created profile
      const { data: userRecord, error: fetchErr } = await supabase
        .from('settings_users')
        .select('*')
        .eq('id', result.user_id)
        .single();

      if (fetchErr || !userRecord) throw new Error('Usuário criado mas perfil não encontrado');

      // 3. Criar relações com times se houver
      if (userData.timesSelecionados && userData.timesSelecionados.length > 0) {
        const timesData = userData.timesSelecionados.map(timeId => ({
          user_id: userRecord.id,
          team_id: timeId
        }));

        const { error: timesError } = await supabase
          .from('settings_users_teams')
          .insert(timesData);

        if (timesError) throw timesError;
      }

      return userRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar usuário:', error);
      toast.error('Erro ao criar usuário: ' + error.message);
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<User> & { id: string }) => {
      // Map Portuguese field names to English database columns
      const mappedUpdates: Record<string, unknown> = { ...updates };
      
      if ('nome' in mappedUpdates) {
        mappedUpdates.name = mappedUpdates.nome;
        delete mappedUpdates.nome;
      }
      if ('ativo' in mappedUpdates) {
        mappedUpdates.active = mappedUpdates.ativo;
        delete mappedUpdates.ativo;
      }
      // user_type explícito sempre vence — o boolean gestor não distingue
      // 'user' de 'comercial' (ambos gestor=false), então reconstruir a
      // partir dele sozinho perderia essa role. Só usa o fallback por
      // boolean quando o caller não manda user_type diretamente.
      const hasExplicitUserType = 'user_type' in mappedUpdates;
      if ('gestor' in mappedUpdates) {
        if (!hasExplicitUserType) {
          // Promote to manager (admin must be set explicitly via super_adm/userType).
          mappedUpdates.user_type = mappedUpdates.gestor ? 'manager' : 'user';
        }
        delete mappedUpdates.gestor;
      }
      if ('super_adm' in mappedUpdates) {
        // super_adm now derives from user_type === 'admin'. Setting super_adm=true upgrades to admin.
        if (mappedUpdates.super_adm && !hasExplicitUserType) {
          mappedUpdates.user_type = 'admin';
        }
        mappedUpdates.super_admin = mappedUpdates.super_adm;
        delete mappedUpdates.super_adm;
      }
      if ('whatsapp' in mappedUpdates) {
        mappedUpdates.phone = mappedUpdates.whatsapp; // Map whatsapp to phone
        delete mappedUpdates.whatsapp;
      }
      
      console.log('🔄 Updating user:', id, 'with data:', mappedUpdates);
      
      const { error } = await supabase
        .from('settings_users')
        .update(mappedUpdates)
        .eq('id', id);
      
      if (error) {
        console.error('❌ Update error:', error);
        throw error;
      }
      
      console.log('✅ User updated successfully');
      return { id, ...mappedUpdates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Call edge function to delete user from auth and settings_users
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: id }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to delete user');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário: ' + error.message);
    },
  });
};