// Compatibility layer for Users hooks with methods
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from './useUsersNew';

export const useUsuariosWithMethods = () => {
  const usersQuery = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  
  return {
    ...usersQuery,
    usuarios: usersQuery.data || [],
    criarUsuario: createUser,
    atualizarUsuario: updateUser,
    deletarUsuario: deleteUser,
    fetchUsuarios: usersQuery.refetch,
  };
};
