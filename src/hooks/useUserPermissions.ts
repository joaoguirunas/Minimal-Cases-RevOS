
import { useAuth } from '@/hooks/useAuth';
import { useUsuariosTimes } from "./useTimes";
import { useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FeatureKey } from '@/hooks/usePermissions';

// Loads the feature permissions for the current user's role_id.
// Returns null when: user has no role_id, tenant has no permissions configured,
// or the role is admin/manager (all features enabled unconditionally).
// In all these cases callers fall back to the hardcoded behavior (backward compat).
const useCurrentUserFeaturePermissions = (roleId: string | null | undefined, skipFetch: boolean) => {
  return useQuery<Record<FeatureKey, boolean> | null>({
    queryKey: ['user-permissions', roleId],
    queryFn: async () => {
      if (!roleId) return null;
      const { data, error } = await supabase
        .from('tenant_role_permissions')
        .select('feature_key, enabled')
        .eq('role_id', roleId);
      if (error || !data || data.length === 0) return null;
      return Object.fromEntries(data.map(r => [r.feature_key, r.enabled])) as Record<FeatureKey, boolean>;
    },
    enabled: !!roleId && !skipFetch,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUserPermissions = () => {
  const { user } = useAuth();
  const { usuariosTimes } = useUsuariosTimes();

  const basePermissions = useMemo(() => {
    if (!user?.profile) {
      return {
        isAdmin: false,
        isManager: false,
        isManagerStrict: false,
        isUser: false,
        isComercial: false,
        isGestor: false,
        isConsultor: false,
        isSuperAdmin: false,
        isCliente: false,
        currentUserId: null,
        currentUserName: "",
        isValid: false,
        roleId: null,
        isProvisional: false,
      };
    }

    const isAdmin = user.profile.user_type === 'admin';
    const isManagerStrict = user.profile.user_type === 'manager';
    const isUser = user.profile.user_type === 'user';
    const isComercial = user.profile.user_type === 'comercial';
    // isManager preserves legacy capability semantics ("can manage") — admin OR manager.
    // For the strict role check use isManagerStrict, isAdmin, isUser, or isComercial.
    const isManager = isAdmin || isManagerStrict;
    const isGestor = isManager;
    const isSuperAdmin = isAdmin;
    const isConsultor = false;
    const isCliente = false;
    const currentUserId = user.profile.id;
    const currentUserName = user.profile.nome || "";
    const roleId: string | null = (user.profile as any).role_id ?? null;
    const isProvisional = user.profile.isProvisional === true;

    if (!currentUserId) {
      return {
        isAdmin: false,
        isManager: false,
        isManagerStrict: false,
        isUser: false,
        isComercial: false,
        isGestor: false,
        isConsultor: false,
        isSuperAdmin: false,
        isCliente: false,
        currentUserId: null,
        currentUserName: "",
        isValid: false,
        roleId: null,
        isProvisional: false,
      };
    }

    return {
      isAdmin,
      isManager,
      isManagerStrict,
      isUser,
      isComercial,
      isGestor,
      isConsultor,
      isSuperAdmin,
      isCliente,
      currentUserId,
      currentUserName,
      isValid: true,
      roleId,
      isProvisional,
    };
  }, [user?.profile]);

  const canManage = basePermissions.isManager;

  const { data: featurePerms } = useCurrentUserFeaturePermissions(
    basePermissions.roleId,
    canManage
  );

  const userTimes = useMemo(() => {
    if (!usuariosTimes || !basePermissions.currentUserId) return [];
    return usuariosTimes
      .filter(ut => ut.usuario_id === basePermissions.currentUserId)
      .map(ut => ut.time_id);
  }, [usuariosTimes, basePermissions.currentUserId]);

  const filterFunctions = useMemo(() => {
    const getResponsavelFilter = () => {
      if (!basePermissions.isValid || basePermissions.isProvisional) return "__INVALID_USER__";
      if (canManage) return "";
      // 'comercial' é restrito por PIPELINE (via equipe → settings_teams_pipelines,
      // ver usePipelines/useMyAllowedPipelineIds), não por atribuição individual do
      // lead — a maioria dos leads não tem user_id setado, então filtrar por
      // "responsável = eu" deixaria tudo invisível pra esse perfil.
      if (basePermissions.isComercial) return "";
      return basePermissions.currentUserId;
    };

    const getTeamFilter = () => {
      if (!basePermissions.isValid || basePermissions.isProvisional) return "__INVALID_USER__";
      if (canManage) return "";
      // Mesmo motivo do getResponsavelFilter acima — leads também raramente têm
      // teams_id setado; a restrição de 'comercial' já vem do filtro de pipeline.
      if (basePermissions.isComercial) return "";
      if (basePermissions.isUser && userTimes.length > 0) return userTimes;
      return "";
    };

    return { getResponsavelFilter, getTeamFilter };
  }, [canManage, basePermissions.currentUserId, basePermissions.isValid, basePermissions.isProvisional, basePermissions.isComercial, basePermissions.isUser, userTimes]);

  // Feature-level gates: admin/manager always true; otherwise check featurePerms,
  // fallback to hardcoded defaults when no permissions configured for the tenant.
  const canFeature = (key: FeatureKey, defaultValue: boolean): boolean => {
    if (basePermissions.isProvisional) return false;
    if (canManage) return true;
    if (featurePerms) return featurePerms[key] ?? defaultValue;
    return defaultValue;
  };

  const isProvisional = basePermissions.isProvisional;

  return {
    ...basePermissions,
    userTimes,
    isProvisional,
    canChangeFilters: !isProvisional && canManage,
    canBlockSchedule: !isProvisional && canManage,
    canBlockOwnSchedule: !isProvisional,
    canCreateUser: !isProvisional && canManage,
    canEditUser: !isProvisional && canManage,
    canDeleteUser: !isProvisional && canManage,
    canCreateClient: !isProvisional && canManage,
    canEditClient: !isProvisional && canManage,
    canDeleteClient: !isProvisional && canManage,
    canAccessCRM: true,
    canAccessFullProjects: true,
    canAccessSettings: !isProvisional && canManage,
    // Granular feature gates (US-CFG-06)
    canExportCRM:   canFeature('crm_export', canManage),
    canDeleteCRM:   canFeature('crm_delete', canManage),
    canViewScore:   canFeature('score_view', true),
    canCreateSends: canFeature('sends_create', canManage),
    canViewBI:      canFeature('bi_view', false),
    canViewSettings: canFeature('settings_view', canManage),
    ...filterFunctions,
  };
};
