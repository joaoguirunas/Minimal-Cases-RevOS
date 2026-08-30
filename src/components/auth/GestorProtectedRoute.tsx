import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

/** Bloqueia a rota inteira pra quem não é gestor/admin (user_type='user' ou
 * 'comercial') — mesmo critério do ModuleProtectedRoute e da sidebar
 * (DashLayout.isGestorOrAdmin), só que aqui pra rotas que não têm module_key
 * no registry de módulos (ex: /settings). */
const GestorProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isGestorOrAdmin = user?.profile?.gestor === true || user?.profile?.super_adm === true;
  if (!isGestorOrAdmin) {
    return <Navigate to="/crm/kanban" replace />;
  }

  return <>{children}</>;
};

export default GestorProtectedRoute;
