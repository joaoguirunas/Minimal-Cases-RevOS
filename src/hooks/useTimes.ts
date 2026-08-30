// Re-export from useTeamsNew and provide compatibility layer
export * from './useTeamsNew';
export { useTeams as useTimes, type Team as Time } from './useTeamsNew';
export { useTimesWithMethods } from './useTimesCompat';

export type { UsuarioBasico as Usuario } from '@/types/usuarios';

// Legacy hooks that map to new structure
import { useUsers } from './useUsersNew';
import { useUsersTeams } from './useUsersTeams';

export const useUsuariosDoTenant = (tenantId?: string) => {
  const usersQuery = useUsers();
  // Ensure backward-compat property `nome` exists while preserving full user object
  const usuariosMapped = (usersQuery.data || []).map((u) => ({
    ...u,
    nome: u.nome || u.name,
  }));
  return {
    ...usersQuery,
    usuarios: usuariosMapped as any[],
  } as const;
};

export const useUsuariosTimes = (tenantIdOrTeamId?: string) => {
  const { data = [], isLoading, error, refetch } = useUsersTeams();
  
  // Map new column names to legacy names for backward compatibility
  const mappedData = data.map(ut => ({
    ...ut,
    usuario_id: ut.user_id,
    time_id: ut.team_id,
    usuario: ut.usuario ? {
      ...ut.usuario,
      nome: ut.usuario.name,
      super_adm: ut.usuario.super_admin,
      gestor: ut.usuario.user_type === 'manager' || ut.usuario.user_type === 'admin',
      ativo: ut.usuario.active
    } : null
  }));
  
  return {
    data: mappedData,
    usuariosTimes: mappedData, // mantém compatibilidade com V3
    isLoading,
    error,
    refetch,
    fetchUsuariosTimes: async () => {
      await refetch();
    },
    map: (fn: any) => (mappedData as any[]).map(fn),
  } as const;
};

export const useUsuariosPorTime = useUsuariosTimes;


