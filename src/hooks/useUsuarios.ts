// Re-export users hook
export * from './useUsersNew';

// Backward compatibility wrapper
export const useUsuarios = () => {
  const usersQuery = useUsers();
  return {
    ...usersQuery,
    usuarios: usersQuery.data || [],
  };
};

import { useUsers } from './useUsersNew';