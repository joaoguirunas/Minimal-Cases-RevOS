import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSystemModules } from "@/hooks/useSystemModules";
import { useTranslation } from "@/hooks/useTranslation";
import Loader from "@/components/loading/Loader";
import {
  BarChart3,
  PieChart,
  MessageCircle,
  Users,
  Calendar,
  Megaphone,
  Send,
  Bot,
  Clock,
  Settings,
  LayoutDashboard,
  MessageSquare,
  Target,
  TrendingUp,
  Phone,
  Globe
} from "lucide-react";

const iconMap: Record<string, any> = {
  'BarChart3': BarChart3,
  'PieChart': PieChart,
  'MessageCircle': MessageCircle,
  'MessageSquare': MessageSquare,
  'Users': Users,
  'Calendar': Calendar,
  'Megaphone': Megaphone,
  'Send': Send,
  'Bot': Bot,
  'Clock': Clock,
  'Settings': Settings,
  'LayoutDashboard': LayoutDashboard,
  'Target': Target,
  'TrendingUp': TrendingUp,
  'Phone': Phone,
  'Globe': Globe,
};

const ModulosConfig = () => {
  const { t } = useTranslation();
  const { modules, isLoading, toggleModule, isToggling } = useSystemModules();

  if (isLoading) {
    return <Loader />;
  }

  // Include configurable modules only.
  // score e agentes-ia agora fazem parte do CRM — não são módulos opcionais.
  const configurableModules = modules.filter(
    m => !['configuracoes', 'clientes', 'followups', 'score', 'agentes-ia'].includes(m.module_key)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground">{t('settings.sections.modules.title')}</h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">
          {t('modulesConfig.description')}
        </p>
      </div>

      {/* Module list */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        {configurableModules.map((module, index) => {
          const Icon = module.icon ? iconMap[module.icon] : null;
          const isLast = index === configurableModules.length - 1;

          return (
            <div
              key={module.id}
              className={`flex items-center justify-between px-5 py-3.5 ${!isLast ? 'border-b border-border' : ''}`}
            >
              <div className="flex items-center gap-3">
                {Icon && <Icon className="w-4 h-4 text-muted-foreground/60" strokeWidth={1.5} />}
                <Label
                  htmlFor={module.module_key}
                  className="text-[13px] font-normal tracking-[0.01em] cursor-pointer text-foreground"
                >
                  {module.module_name}
                </Label>
              </div>
              <Switch
                id={module.module_key}
                checked={module.is_active}
                onCheckedChange={(checked) => toggleModule({ id: module.id, is_active: checked })}
                disabled={isToggling}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModulosConfig;
