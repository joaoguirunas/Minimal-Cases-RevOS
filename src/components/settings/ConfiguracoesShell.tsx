import { Suspense, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import RestrictedRoute from '@/components/auth/RestrictedRoute';
import { cn } from '@/lib/utils';
import {
  SETTINGS_SECTIONS,
  SECTION_BY_ID,
  SECTION_BY_PATH,
  NAV_GROUPS,
  SIDEBAR_SECTIONS,
} from '@/pages/settings/registry';

interface ConfiguracoesShellProps {
  sectionId?: string;
}

const WIDE_SECTIONS = new Set(
  SETTINGS_SECTIONS.filter((s) => s.wide).map((s) => s.id)
);
// agentes-ia gets special zero-padding treatment
const FULLBLEED_SECTIONS = new Set(['agentes-ia']);

function ConfiguracoesShellContent({ sectionId }: { sectionId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = user?.profile?.super_adm === true;

  // Resolve active section: prop → path lookup → fallback
  const activeSection = useMemo(() => {
    if (sectionId) return sectionId;
    const fromPath = SECTION_BY_PATH.get(location.pathname);
    return fromPath?.id ?? 'geral';
  }, [sectionId, location.pathname]);

  const section = SECTION_BY_ID.get(activeSection);
  const Component = section?.Component ?? SECTION_BY_ID.get('geral')!.Component;

  const translatedSections = useMemo(
    () =>
      SIDEBAR_SECTIONS.map((s) => ({
        ...s,
        title: t(s.titleKey),
        badge: s.badgeKey ? t(s.badgeKey) : undefined,
      })),
    [t]
  );

  const mainClass = useMemo(() => {
    if (FULLBLEED_SECTIONS.has(activeSection)) return 'flex-1 overflow-auto p-0 max-w-none';
    if (WIDE_SECTIONS.has(activeSection)) return 'flex-1 overflow-auto p-8 max-w-5xl';
    return 'flex-1 overflow-auto p-8 max-w-3xl';
  }, [activeSection]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left nav ──────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 border-r border-border pt-6 pb-6 px-3 space-y-5 h-full overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = translatedSections.filter(
            (s) => s.group === group.key && (!isSuperAdmin ? true : true)
          );
          if (!items.length) return null;
          return (
            <div key={group.key}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 px-3 mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map((s) => {
                  const isActive = activeSection === s.id;
                  const canonicalPath = s.paths[0];
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(canonicalPath, { replace: true })}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-[2px] text-[12px] tracking-[0.01em] transition-all duration-150 h-8 px-3',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'font-normal text-muted-foreground/70 hover:text-foreground hover:bg-primary/[0.06]'
                      )}
                    >
                      <s.icon className="w-[15px] h-[15px] flex-shrink-0" strokeWidth={1.5} />
                      <span className="flex-1 text-left truncate">{s.title}</span>
                      {s.badge && (
                        <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-[2px] leading-none">
                          {s.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </aside>

      {/* ── Content panel ─────────────────────────────────────────── */}
      <main className={mainClass}>
        <Suspense
          fallback={
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          }
        >
          <Component />
        </Suspense>
        {!FULLBLEED_SECTIONS.has(activeSection) && (
          <p className="text-[11px] text-muted-foreground/30 text-center pt-6 pb-2 font-mono">
            v{__APP_VERSION__}
          </p>
        )}
      </main>
    </div>
  );
}

export default function ConfiguracoesShell({ sectionId = 'geral' }: ConfiguracoesShellProps) {
  return (
    <RestrictedRoute requireGestor>
      <ConfiguracoesShellContent sectionId={sectionId} />
    </RestrictedRoute>
  );
}
