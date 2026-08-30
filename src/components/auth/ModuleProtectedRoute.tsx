import { Navigate } from "react-router-dom";
import { useSystemModules } from "@/hooks/useSystemModules";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Módulos restritos a gestor/admin — user_type='user'/'comercial' não tem acesso
const GESTOR_ONLY_MODULES = new Set(['dashboard', 'lp', 'disparos']);

// Módulos acessíveis para user_type='user'/'comercial', em ordem de prioridade
// para redirect — NUNCA inclua aqui uma chave que também esteja em
// GESTOR_ONLY_MODULES: se o módulo bloqueado for o primeiro ativo encontrado,
// o redirect aponta pra ele mesmo e gera loop infinito (tela fica "piscando").
const USER_ACCESSIBLE_MODULE_REDIRECT: Record<string, string> = {
  'negocios': '/crm/kanban',
  'conversas': '/omni',
};

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  moduleKey: string;
}

const ModuleProtectedRoute = ({ children, moduleKey }: ModuleProtectedRouteProps) => {
  const { activeModules, isLoading } = useSystemModules();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Bloqueia módulos gestor-only para user_type='user'
  if (GESTOR_ONLY_MODULES.has(moduleKey)) {
    const isGestorOrAdmin = user?.profile?.gestor === true || user?.profile?.super_adm === true;
    if (!isGestorOrAdmin) {
      const firstAccessible = activeModules.find(m => USER_ACCESSIBLE_MODULE_REDIRECT[m.module_key]);
      const redirectPath = firstAccessible
        ? USER_ACCESSIBLE_MODULE_REDIRECT[firstAccessible.module_key]
        : '/crm/kanban';
      return <Navigate to={redirectPath} replace />;
    }
  }

  const isModuleActive = activeModules.some(m => m.module_key === moduleKey);

  if (!isModuleActive) {
    if (activeModules.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-[24px] font-semibold">Nenhum módulo ativo</h2>
            <p className="text-muted-foreground">
              Entre em contato com o administrador para ativar os módulos necessários.
            </p>
          </div>
        </div>
      );
    }

    const firstActiveModule = activeModules[0];
    const redirectMap: Record<string, string> = {
      'dashboard': '/bipro',
      'conversas': '/omni',
      'negocios': '/crm/kanban',
      'clientes': '/crm/clients',
      'agendamentos': '/schedule',
      'agentes-ia': '/settings/crm/aiagents',
      'disparos': '/send',
      'lp': '/lp',
    };

    const redirectPath = redirectMap[firstActiveModule.module_key] || '/bipro';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ModuleProtectedRoute;
