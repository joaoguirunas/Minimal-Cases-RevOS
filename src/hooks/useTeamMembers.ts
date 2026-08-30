import { useUsersTeams } from './useUsersTeams';
import { logger } from '@/utils/logger';

export const useTeamMembers = (tenantId?: string, teamId?: string) => {
  const { data: usersTeams = [], isLoading, error, refetch } = useUsersTeams(teamId);
  
  // Mapear dados para formato esperado
  const teamMembers = usersTeams
    .filter(ut => {
      // Filter by teamId when provided
      if (teamId && ut.team_id !== teamId) return false;
      // Verificar se o usuário existe e está ativo
      const usuario = ut.usuario || (ut as { usuario?: typeof ut.usuario; settings_users?: typeof ut.usuario }).settings_users;
      return usuario && usuario.active !== false;
    })
    .map(ut => {
      // Suportar ambos os formatos de response
      const usuario = ut.usuario || (ut as { usuario?: typeof ut.usuario; settings_users?: typeof ut.usuario }).settings_users;
      
      return {
        id: usuario?.id || '',
        nome: usuario?.name || '',
        name: usuario?.name || '',
        email: usuario?.email || '',
        gestor: usuario?.user_type === 'manager' || usuario?.user_type === 'admin',
        is_manager: usuario?.user_type === 'manager' || usuario?.user_type === 'admin',
        super_adm: usuario?.super_admin || false,
        ativo: usuario?.active !== false,
        user_type: usuario?.user_type
      };
    });
  
  logger.info('🔍 useTeamMembers - Data:', {
    teamId,
    membersCount: teamMembers.length,
    rawDataCount: usersTeams.length
  });
  
  return {
    data: teamMembers,
    isLoading,
    error,
    refetch
  };
};