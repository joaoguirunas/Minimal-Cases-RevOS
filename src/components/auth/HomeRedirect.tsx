import { Navigate } from 'react-router-dom';
import { useUserPermissions } from '@/hooks/useUserPermissions';

/** Comercial entra no kanban (o trabalho dele); todo mundo mais no BI, como hoje. */
export default function HomeRedirect() {
  const { isComercial, isValid } = useUserPermissions();
  if (!isValid) return null;
  return <Navigate to={isComercial ? '/crm/kanban' : '/bipro'} replace />;
}
