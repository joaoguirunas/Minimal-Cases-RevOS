import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FeatureKey =
  | 'crm_export'
  | 'crm_delete'
  | 'score_view'
  | 'sends_create'
  | 'bi_view'
  | 'settings_view';

export const ALL_FEATURE_KEYS: FeatureKey[] = [
  'crm_export',
  'crm_delete',
  'score_view',
  'sends_create',
  'bi_view',
  'settings_view',
];

export const FEATURE_LABELS: Record<FeatureKey, { label: string; description: string }> = {
  crm_export:    { label: 'Exportar leads',        description: 'Exportar dados do CRM para CSV/Excel' },
  crm_delete:    { label: 'Deletar leads',          description: 'Remover registros do CRM permanentemente' },
  score_view:    { label: 'Ver Score',              description: 'Acessar o Score de qualificação de leads' },
  sends_create:  { label: 'Criar Campanhas',        description: 'Criar e disparar campanhas de envio' },
  bi_view:       { label: 'Ver BI',                 description: 'Acessar dashboards e relatórios de BI' },
  settings_view: { label: 'Ver Configurações',      description: 'Acessar o painel de configurações' },
};

export interface TenantRole {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface TenantRolePermission {
  id: string;
  role_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const useTenantRoles = () => {
  return useQuery<TenantRole[]>({
    queryKey: ['tenant-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as TenantRole[];
    },
  });
};

export const useTenantRolePermissions = (roleId?: string) => {
  return useQuery<TenantRolePermission[]>({
    queryKey: ['tenant-role-permissions', roleId],
    queryFn: async () => {
      const query = supabase
        .from('tenant_role_permissions')
        .select('*');
      if (roleId) query.eq('role_id', roleId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TenantRolePermission[];
    },
    enabled: !!roleId,
  });
};

export const useAllRolePermissions = () => {
  return useQuery<TenantRolePermission[]>({
    queryKey: ['tenant-role-permissions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_role_permissions')
        .select('*');
      if (error) throw error;
      return data as TenantRolePermission[];
    },
  });
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateTenantRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('tenant_roles')
        .insert({ name, description: description ?? null })
        .select()
        .single();
      if (error) throw error;
      // Seed all features as disabled by default for new custom roles
      const perms = ALL_FEATURE_KEYS.map(fk => ({
        role_id: (data as TenantRole).id,
        feature_key: fk,
        enabled: false,
      }));
      await supabase.from('tenant_role_permissions').insert(perms);
      return data as TenantRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-roles'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-role-permissions-all'] });
      toast.success('Role criada com sucesso');
    },
    onError: (err: any) => toast.error('Erro ao criar role: ' + err.message),
  });
};

export const useDeleteTenantRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('tenant_roles').delete().eq('id', roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-roles'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-role-permissions-all'] });
      toast.success('Role removida');
    },
    onError: (err: any) => toast.error('Erro ao remover role: ' + err.message),
  });
};

export const useUpdateRolePermission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, featureKey, enabled }: { roleId: string; featureKey: FeatureKey; enabled: boolean }) => {
      const { error } = await supabase
        .from('tenant_role_permissions')
        .update({ enabled })
        .eq('role_id', roleId)
        .eq('feature_key', featureKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-role-permissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    },
    onError: (err: any) => toast.error('Erro ao salvar permissão: ' + err.message),
  });
};
