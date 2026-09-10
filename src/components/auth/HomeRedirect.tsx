import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';

/**
 * Destino da raiz "/": comercial entra no kanban (o trabalho dele), todo mundo
 * mais no BI. Visitante sem sessão vai pro login — antes daqui a rota era um
 * <Navigate to="/bipro">, que caía no ProtectedRoute e de lá no /login; sem esse
 * caso explícito a raiz renderizava nada (tela preta) para quem não está logado.
 */
export default function HomeRedirect() {
  const { user, isLoading } = useAuth();
  const { isComercial, isValid } = useUserPermissions();

  if (isLoading) return null;                       // sessão ainda sendo resolvida
  if (!user) return <Navigate to="/login" replace />;
  if (!isValid) return null;                        // perfil do usuário ainda carregando
  return <Navigate to={isComercial ? '/crm/kanban' : '/bipro'} replace />;
}
