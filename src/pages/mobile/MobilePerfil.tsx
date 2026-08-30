import { LogOut, Monitor, Shield } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const MobilePerfil = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDesktopHint, setShowDesktopHint] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="sticky top-0 z-10 bg-card border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Perfil</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* User card */}
        <div className="bg-card border border-border rounded-[2px] p-6 flex flex-col items-center gap-3">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
              {(user?.profile?.nome || user?.email || 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="font-semibold text-base">{user?.profile?.nome || 'Usuário'}</p>
            <p className="text-sm text-muted-foreground">{user?.email || ''}</p>
          </div>
        </div>

        {/* Menu items */}
        <div className="bg-card border border-border rounded-[2px] overflow-hidden divide-y divide-border">
          <button
            onClick={() => setShowDesktopHint(h => !h)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted transition-colors min-h-[44px]"
          >
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Configurações</span>
          </button>
          {showDesktopHint && (
            <div className="px-4 py-3 bg-muted/50 text-xs text-muted-foreground">
              Configurações completas disponíveis na versão desktop. Acesse pelo computador para personalizar seu ambiente.
            </div>
          )}
          <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted transition-colors min-h-[44px]">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Segurança</span>
          </button>
        </div>

        <Button
          variant="outline"
          className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 min-h-[44px]"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
        </Button>
      </div>
    </div>
  );
};

export default MobilePerfil;
