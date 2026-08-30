import { useNavigate, useMatch } from "react-router-dom";
import { BarChart3, FolderKanban, Inbox } from "lucide-react";

const tabs = [
  { path: '/m/bi', icon: BarChart3, label: 'BI', moduleKey: 'dashboard' },
  { path: '/m/crm', icon: FolderKanban, label: 'CRM', moduleKey: 'negocios' },
  { path: '/m/omni', icon: Inbox, label: 'Omni', moduleKey: 'conversas' },
] as const;

const TabButton = ({ path, icon: Icon, label }: { path: string; icon: typeof BarChart3; label: string }) => {
  const navigate = useNavigate();
  const match = useMatch({ path, end: false });
  const isActive = !!match;

  return (
    <button
      onClick={() => { if (!isActive) navigate(path); }}
      className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] relative focus:outline-none"
      aria-label={label}
    >
      {isActive && (
        <span className="absolute top-0 left-[20%] right-[20%] h-0.5 bg-primary rounded-full" />
      )}
      <Icon
        className={isActive ? 'text-primary w-5 h-5' : 'text-muted-foreground w-5 h-5'}
        strokeWidth={isActive ? 2 : 1.5}
      />
      <span className={`text-[11px] font-medium leading-none ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </button>
  );
};

const MobileBottomTabs = () => {
  return (
    <nav
      className="h-16 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 saturate-[180%] border-t border-border flex items-stretch flex-shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map((tab) => (
        <TabButton key={tab.path} path={tab.path} icon={tab.icon} label={tab.label} />
      ))}
    </nav>
  );
};

export default MobileBottomTabs;
