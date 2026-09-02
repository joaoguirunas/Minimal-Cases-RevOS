import React, { useState, useEffect, type ComponentType } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSystemModules } from "@/hooks/useSystemModules";
import { useTranslation } from "@/hooks/useTranslation";

import {
  BarChart3,
  Users,
  Building2,
  Settings,
  Megaphone,
  Sun,
  Moon,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  BookOpen,
  ArrowLeft,
  ClockIcon,
  RefreshCw,
  Briefcase,
  FolderKanban,
  Inbox,
  CalendarCheck,
  FormInput,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useNavigation } from "@/contexts/NavigationContext";
import { useUsuariosTimes } from "@/hooks/useTimes";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { OraLockup, OraWave } from '@/components/config/assets/OraLogo';
import { GSLockup, GSSymbol } from '@/components/ui/GrowthSalesLogo';

import { toast } from "sonner";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { MfaGraceBanner } from "@/components/layout/MfaGraceBanner";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { useMFA } from "@/hooks/useMFA";
import { useSettings } from "@/hooks/useSettings";

interface SidebarItem {
  name?: string;
  title?: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  path: string;
  module?: "disparos" | "reunioes" | "clientes" | "negocios" | "dashboard" | "conversas" | "lp" | "agendamentos" | "agentes-ia";
  requireGestor?: boolean;
  isComingSoon?: boolean;
  groupLabel?: string;
}

// Fixed menu items (BI PRO™, CRM PRO™, OMNI PRO™ always visible)
const fixedSidebarItems: SidebarItem[] = [
  {
    title: "BI PRO™",
    icon: BarChart3,
    path: "/bipro",
    module: "dashboard" as const,
    groupLabel: "CORE",
    requireGestor: true,
  },
  {
    title: "CRM PRO™",
    icon: FolderKanban,
    path: "/crm/kanban",
    module: "negocios" as const,
  },
  {
    title: "OMNI PRO™",
    icon: Inbox,
    path: "/omni",
    module: "conversas" as const,
  },
];

// Modular items (itens condicionais baseados em módulos ativos)
const getModularSidebarItems = (t: (key: string) => string): SidebarItem[] => [
  {
    title: 'SENDS PRO™',
    icon: Megaphone,
    path: "/send",
    module: "disparos" as const,
    groupLabel: "MODULES",
    requireGestor: true,
  },
  {
    title: "SCHEDULE PRO™",
    icon: CalendarCheck,
    path: "/schedule",
    module: "agendamentos" as const,
  },
  {
    title: "FORM PRO™",
    icon: FormInput,
    path: "/lp",
    module: "lp" as const,
    requireGestor: true,
  },
];

// Componente específico para o botão de refresh dos negócios
const RefreshNegociosButton = () => {
  const queryClient = useQueryClient();
  const selectedTenantId = 'single-tenant';
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    
    setIsRefreshing(true);
    try {
      console.log('🔄 Refreshing deals data...');
      
      // Invalidate all deals-related queries more comprehensively
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && (
            queryKey.includes('negocios') ||
            queryKey.includes('leads') ||
            queryKey.includes('pipelines') ||
            queryKey.includes('stages') ||
            queryKey[0] === 'negocios-definitive' ||
            queryKey[0] === 'negocios-por-etapa' ||
            queryKey[0] === 'negocios-por-etapa-definitive'
          );
        }
      });
      
      // Refetch das queries ativas para atualização imediata
      await queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (
            key[0] === 'negocios-definitive' ||
            key[0] === 'negocios-por-etapa-definitive'
          );
        },
        type: 'active'
      });
      
      console.log('✅ Deals data refreshed successfully');
      toast.success('Data updated!');
    } catch (error) {
      console.error('❌ Error refreshing deals data:', error);
      toast.error('Error updating data');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.location.reload()}
      className="h-[30px] px-3 text-xs border-border hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground rounded-lg transition-all duration-300"
      title="Refresh page"
    >
      <RefreshCw className="w-4 h-4 mr-1" />
      Refresh
    </Button>
  );
};

const DashLayout = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isTenantReady, setIsTenantReady] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { showBackButton, leadName, pipelineName, onBack, clearNavigationState } = useNavigation();
  
  const currentTenantId = 'single-tenant';
  const currentTenant = { id: 'single-tenant', name: 'Sistema', value: 'single-tenant' };
  const currentRole = 'user';
  const isTenantLoading = false;

  // Verificar quando o contexto do tenant está pronto
  useEffect(() => {
    setIsTenantReady(true);
    
    // Log de diagnóstico
    console.log('DashLayout - Status do tenant (single-tenant):', {
      currentTenantId,
      currentTenant: currentTenant?.name,
      isTenantReady: isTenantReady,
      isTenantLoading
    });
  }, [currentTenant, currentTenantId, isTenantLoading]);
  
  // Usar usuariosTimes apenas quando o tenant estiver pronto
  const { usuariosTimes } = useUsuariosTimes();
  

  // Check if user is gestor or super admin (NOT consultor)
  const isGestorOrAdmin = user?.profile?.gestor === true || user?.profile?.super_adm === true;
  const isConsultor = user?.profile?.consultor === true;
  const { isCliente, isProvisional } = useUserPermissions();
  const { data: settings } = useSettings();
  const { isActive: isMfaActive } = useMFA();
  const [mfaBannerDismissed, setMfaBannerDismissed] = useState(
    () => sessionStorage.getItem('mfa-banner-dismissed') === '1'
  );

  const requiresMfa =
    settings?.require_mfa_for_gestores === true &&
    (user?.profile?.gestor === true || user?.profile?.super_adm === true);
  const showMfaBanner = !mfaBannerDismissed && requiresMfa && !isMfaActive;

  const handleMfaBannerDismiss = () => {
    sessionStorage.setItem('mfa-banner-dismissed', '1');
    setMfaBannerDismissed(true);
  };

  // Show a non-blocking warning when operating on a provisional (fallback) profile
  useEffect(() => {
    if (!isProvisional) return;
    const id = toast.warning('Perfil carregando... algumas ações podem estar indisponíveis', {
      id: 'provisional-profile',
      duration: Infinity,
    });
    return () => { toast.dismiss(id); };
  }, [isProvisional]);

  // Check if user is in any team for this tenant
  const isUserInTeam = usuariosTimes?.some(ut => ut.user_id === user?.profile?.id) || false;


  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/bipro' || path.startsWith('/bipro/')) return 'BI PRO™';
    if (path === '/crm/kanban' || path.startsWith('/crm/kanban/')) return 'CRM PRO™ - Kanban';
    if (path === '/crm/list' || path.startsWith('/crm/list/')) return 'CRM PRO™ - Lista';
    if (path === '/crm/clients' || path.startsWith('/crm/clients/')) return 'CRM PRO™ - Clientes';
    if (path === '/send' || path.startsWith('/send/')) return 'SENDS PRO™';
    if (path === '/schedule' || path.startsWith('/schedule/')) return 'SCHEDULE PRO™';
    if (path === '/omni' || path.startsWith('/omni/')) return 'OMNI PRO™';
    if (path === '/lp' || path.startsWith('/lp/')) return 'FORM PRO™';
    if (path === '/score' || path.startsWith('/score/')) return 'SCORE PRO™';
    if (path === '/settings/crm/aiagents' || path.startsWith('/settings/crm/aiagents/')) return 'AI AGENTS PRO™';
    if (path === '/settings' || path.startsWith('/settings/')) return t('sidebar.settings');
    if (path === '/schedules' || path.startsWith('/schedules/')) return t('sidebar.mySchedule');
    if (path === '/followups' || path.startsWith('/followups/')) return 'Follow-ups';
    if (path === '/profile' || path.startsWith('/profile/')) return t('sidebar.profile');
    return '';
  };

  // Fetch active modules
  const { activeModules } = useSystemModules();

  // Generate dynamic sidebar items based on active modules and user permissions
  const getActiveSidebarItems = () => {
    const modularSidebarItems = getModularSidebarItems(t);
    const activeItems = [];

    // Always add fixed items (BI PRO™, CRM PRO™, OMNI PRO™) — except those
    // marked requireGestor (BI PRO™), which need the same gestor/admin check
    // as modular items below. Sem isso, BI aparecia na sidebar pra quem não
    // tem permissão nenhuma de acessar a rota.
    activeItems.push(...fixedSidebarItems.filter(item => !item.requireGestor || isGestorOrAdmin));

    // Process modular items with proper filtering
    modularSidebarItems.forEach(item => {
      // Check permissions: if requireGestor, user must be gestor/admin
      if (item.requireGestor && !isGestorOrAdmin) {
        return; // Skip this item
      }

      // Check module dependency: if item has a module, it must be active
      if (item.module) {
        const isModuleActive = activeModules.some(m =>
          m.module_key === item.module && m.is_active === true
        );

        if (isModuleActive) {
          activeItems.push(item);
        }
      } else {
        // Items without module requirement are always added (after permission checks)
        activeItems.push(item);
      }
    });

    console.log('Active sidebar items:', activeItems);
    return activeItems;
  };

  const sidebarItems = getActiveSidebarItems();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLogout = async () => {
    console.log('DashLayout - Logging out');
    try {
      await signOut();
      // O signOut já cuida do redirecionamento via onAuthStateChange
    } catch (error) {
      console.error('Erro no logout:', error);
      // Em caso de erro, navegar via React Router
      navigate('/login');
    }
  };

  // Single-tenant mode - no tenant switching
  const handleTenantSwitch = async (tenantId: string) => {
    console.log('DashLayout - Single-tenant mode, no tenant switching available');
  };

  const DashLogo = () => {
    const [logoLoaded, setLogoLoaded] = useState(false);
    const [logoError, setLogoError] = useState(false);
    const { data: config } = useConfiguracoesGerais();
    const tenantLogo = config?.logo_url;
    
    // Reset logo states when tenant changes
    useEffect(() => {
      if (tenantLogo) {
        console.log('🖼️ Logo URL configurado:', tenantLogo);
        setLogoLoaded(false);
        setLogoError(false);
      } else {
        console.log('⚠️ Sem logo_url na configuração');
      }
    }, [tenantLogo]);
    
    // Se há logo e não deu erro, mostrar logo
    if (tenantLogo && !logoError) {
      return (
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center w-[144px] h-[64px]">
            {!logoLoaded && (
              <div className="w-full h-full bg-muted animate-pulse rounded-md" />
            )}
            <img 
              src={tenantLogo}
              alt="Logo"
              crossOrigin="anonymous"
              className={`${logoLoaded ? 'block' : 'hidden'} max-w-[144px] max-h-[64px] object-contain`}
              onLoad={() => {
                console.log('✅ Logo carregado com sucesso');
                setLogoLoaded(true);
              }}
              onError={(e) => {
                console.error('❌ Erro ao carregar logo:', tenantLogo);
                setLogoError(true);
                setLogoLoaded(false);
              }}
            />
          </div>
        </div>
      );
    }
    
    return <GSLockup symbolSize={30} textSize={13} />;
  };

  // Create a function to render the Outlet with tenant context
  // IMPORTANTE: Usar key={location.pathname} para forçar re-render quando a rota muda
  // Isso resolve o problema do SectionErrorBoundary não resetar seu estado entre rotas
  const renderOutletWithContext = () => {
    const tenantContext = currentTenantId ? { 
      selectedTenantId: currentTenantId,
      selectedTenantValue: currentTenant?.value,
      currentRole
    } : {
      selectedTenantId: undefined,
      selectedTenantValue: undefined,
      currentRole: undefined
    };
    
    console.log('DashLayout - Passing tenant context to route:', location.pathname, tenantContext);
    
    // A key força o React a remontar o Outlet quando a rota muda
    return <Outlet key={location.pathname} context={tenantContext} />;
  };

  // Verificando se o usuário está autenticado
  if (!user) {
    console.log('DashLayout - No user found, should redirect to login');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Sempre mostrar layout quando há usuário autenticado
  // Removendo todas as verificações que impedem a renderização

  // Single-tenant mode - no tenant selector needed
  const shouldShowTenantSelector = false;

  return (
      <div className="h-screen overflow-hidden flex w-full bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "h-screen sticky top-0 bg-card dark:bg-[#0a0a0a] border-r border-border dark:border-white/[0.06] flex flex-col transition-[width] duration-300 ease-in-out",
        isSidebarCollapsed ? "w-[64px]" : "w-[240px]"
      )}>

        {/* Logo area */}
        <div className={cn(
          "flex items-center shrink-0 border-b border-border dark:border-white/[0.06]",
          isSidebarCollapsed ? "h-[64px] justify-center" : "h-[72px] px-4"
        )}>
            {isSidebarCollapsed ? (
            <GSSymbol size={26} />
          ) : (
            <DashLogo />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 min-h-0">
          {!isCliente && sidebarItems.map((item, index) => {
            const isActive = location.pathname.startsWith(item.path);
            const isComingSoon = item.isComingSoon || false;

            const groupHeader = item.groupLabel && !isSidebarCollapsed ? (
              <div key={`group-${item.groupLabel}`}>
                {index > 0 && <div className="border-t border-border/50 dark:border-white/[0.04] mx-3 my-1.5" />}
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40 dark:text-white/20 px-3 pt-3 pb-1">{item.groupLabel}</p>
              </div>
            ) : item.groupLabel && isSidebarCollapsed && index > 0 ? (
              <div key={`sep-${item.groupLabel}`} className="border-t border-border/50 dark:border-white/[0.04] mx-1 my-1.5" />
            ) : null;

            const btn = (
              <button
                onClick={() => { if (!isComingSoon) { clearNavigationState(); navigate(item.path); } }}
                disabled={isComingSoon}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md text-[13px] tracking-[0.01em] transition-all duration-300",
                  isSidebarCollapsed ? "h-9 w-9 justify-center p-0 mx-auto" : "h-9",
                  isComingSoon && "opacity-40 cursor-not-allowed",
                  !isComingSoon && isActive
                    ? "border-l-2 border-[#FF4400] bg-primary/10 dark:bg-white/[0.08] text-foreground dark:text-white font-medium pl-[10px] pr-3"
                    : "font-normal text-muted-foreground dark:text-white/50 hover:bg-muted dark:hover:bg-white/[0.06] hover:text-foreground dark:hover:text-white/90 px-3",
                )}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
                {!isSidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.title}</span>
                    {isComingSoon && (
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-[#F59E0B]/10 text-[#F59E0B] px-1.5 py-0.5 rounded-md leading-none">
                        SOON
                      </span>
                    )}
                  </>
                )}
              </button>
            );

            if (isSidebarCollapsed) {
              return (
                <React.Fragment key={item.path}>
                  {groupHeader}
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right" className="z-[9999] flex items-center gap-2">
                      {item.title}
                      {isComingSoon && (
                        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-[#F59E0B]/10 text-[#F59E0B] px-1.5 py-0.5 rounded-md leading-none">
                          SOON
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </React.Fragment>
              );
            }

            return <React.Fragment key={item.path}>{groupHeader}{btn}</React.Fragment>;
          })}
        </nav>

        {/* Footer — Settings row with inline collapse chevron */}
        <div className="shrink-0 border-t border-border dark:border-white/[0.06] py-2 px-2">
          {isSidebarCollapsed ? (
            /* Collapsed: stacked icons */
            <div className="space-y-0.5">
              {/* Expand chevron */}
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="h-9 w-9 mx-auto flex items-center justify-center rounded-md text-muted-foreground/70 dark:text-white/40 hover:text-foreground dark:hover:text-white/90 hover:bg-muted dark:hover:bg-white/[0.06] transition-all duration-300"
              >
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
              {/* Settings icon */}
              {isGestorOrAdmin && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { clearNavigationState(); navigate('/settings'); }}
                      className={cn(
                        "h-9 w-9 mx-auto flex items-center justify-center rounded-md transition-all duration-300",
                        location.pathname.startsWith('/settings')
                          ? "bg-muted dark:bg-white/[0.06] text-foreground dark:text-white/90"
                          : "text-muted-foreground/70 dark:text-white/40 hover:text-foreground dark:hover:text-white/90 hover:bg-muted dark:hover:bg-white/[0.06]"
                      )}
                    >
                      <Settings className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t('sidebar.settings')}</TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : (
            /* Expanded: settings + collapse chevron inline */
            <div className="flex items-center gap-1">
              {isGestorOrAdmin && (
                <button
                  onClick={() => { clearNavigationState(); navigate('/settings'); }}
                  className={cn(
                    "flex-1 flex items-center gap-3 rounded-md text-[13px] font-normal tracking-[0.01em] transition-all duration-300 h-9 px-3",
                    location.pathname.startsWith('/settings')
                      ? "bg-muted dark:bg-white/[0.06] text-foreground dark:text-white/90 font-medium"
                      : "text-muted-foreground/70 dark:text-white/40 hover:text-foreground dark:hover:text-white/90 hover:bg-muted dark:hover:bg-white/[0.06]"
                  )}
                >
                  <Settings className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 text-left">{t('sidebar.settings')}</span>
                </button>
              )}
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-md text-muted-foreground/70 dark:text-white/40 hover:text-foreground dark:hover:text-white/90 hover:bg-muted dark:hover:bg-white/[0.06] transition-all duration-300"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* MFA Grace Banner */}
        {showMfaBanner && (
          <MfaGraceBanner onDismiss={handleMfaBannerDismiss} />
        )}

        {/* Header */}
        <header className="h-[72px] bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4 min-w-0 overflow-hidden">
            {/* Back Button */}
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onBack ? onBack() : navigate(-1)}
                className="flex items-center gap-1.5 h-[30px] px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all duration-300"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="text-[13px] font-medium">Voltar</span>
              </Button>
            )}

            {/* Lead Info */}
            {showBackButton && leadName && (
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-border/60 select-none">/</span>
                <span className="font-medium text-foreground truncate max-w-[260px]">{leadName}</span>
                {pipelineName && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-muted-foreground">{pipelineName}</span>
                  </>
                )}
              </div>
            )}

            {/* Page Title with Refresh Button - only show when not showing back button */}
            {!showBackButton && getPageTitle() && (
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-['Outfit'] font-semibold text-foreground">
                  {getPageTitle()}
                </h1>
                {/* Refresh button specifically for Negócios page */}
                {location.pathname.startsWith('/crm/kanban/') && (
                  <RefreshNegociosButton />
                )}
              </div>
            )}

          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <NotificationsDropdown />

            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-[30px] w-[30px] rounded-lg transition-all duration-300">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-[30px] w-[30px] rounded-full transition-all duration-300">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={user.profile?.nome || user.email || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {(user.profile?.nome || user.email || '').split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="px-2 py-1">
                  <p className="text-sm font-medium">{user.profile?.nome || user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {renderOutletWithContext()}
        </main>

      </div>
    </div>
  );
};

export default DashLayout;
