import { ReactNode } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useSystemModules } from '@/hooks/useSystemModules';

interface MobileModuleGuardProps {
  moduleKey: string;
  children: ReactNode;
}

const MobileModuleGuard = ({ moduleKey, children }: MobileModuleGuardProps) => {
  const { activeModules, isLoading } = useSystemModules();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isActive = activeModules.some(m => m.module_key === moduleKey);

  if (!isActive) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-card border border-border rounded-[2px] p-8 flex flex-col items-center gap-4 text-center max-w-xs w-full">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold text-base">Módulo não disponível</h2>
            <p className="text-sm text-muted-foreground">
              Este módulo não está disponível neste plano.
            </p>
          </div>
          <button className="text-sm text-primary underline-offset-4 hover:underline">
            Falar com suporte
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MobileModuleGuard;
