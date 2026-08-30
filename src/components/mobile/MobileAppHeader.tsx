import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GSLockup } from "@/components/ui/GrowthSalesLogo";

const MobileAppHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: config } = useConfiguracoesGerais();
  const tenantLogo = config?.logo_url;

  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (tenantLogo) {
      setLogoLoaded(false);
      setLogoError(false);
    }
  }, [tenantLogo]);

  const userInitials = (user?.profile?.nome || user?.email || '')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header
      className="bg-card border-b border-border flex-shrink-0"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="h-14 flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center">
          {tenantLogo && !logoError ? (
            <div className="flex items-center justify-center h-8">
              {!logoLoaded && (
                <div className="w-24 h-8 bg-muted animate-pulse rounded-[2px]" />
              )}
              <img
                src={tenantLogo}
                alt="Logo"
                crossOrigin="anonymous"
                className={`${logoLoaded ? 'block' : 'hidden'} max-w-[120px] max-h-8 object-contain`}
                onLoad={() => setLogoLoaded(true)}
                onError={() => { setLogoError(true); setLogoLoaded(false); }}
              />
            </div>
          ) : (
            <GSLockup symbolSize={24} textSize={12} />
          )}
        </div>

        {/* Avatar */}
        <button
          onClick={() => navigate('/m/perfil')}
          className="flex items-center justify-center rounded-full focus:outline-none"
          aria-label="Perfil"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profile?.avatar_url || ''} alt={user?.profile?.nome || user?.email || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
};

export default MobileAppHeader;
