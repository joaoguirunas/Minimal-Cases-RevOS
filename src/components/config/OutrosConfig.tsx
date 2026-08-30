import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Link2, Copy, Check, ExternalLink, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const LogsViewer           = lazy(() => import("@/components/config/LogsViewer"));
const SystemDocConfig      = lazy(() => import("@/components/config/SystemDocConfig"));
const SettingsAuditLog     = lazy(() => import("@/components/config/SettingsAuditLog"));
const LGPDConfig           = lazy(() => import("@/components/config/LGPDConfig"));
const AuthEventsLogViewer  = lazy(() => import("@/components/config/AuthEventsLogViewer"));

// ── FieldRow ─────────────────────────────────────────────────────────────────
const FieldRow = ({
  label,
  hint,
  last = false,
  children,
}: {
  label: string;
  hint?: string;
  last?: boolean;
  children: React.ReactNode;
}) => (
  <div className={cn("flex items-center justify-between gap-6 px-5 py-3.5", !last && "border-b border-border")}>
    <div className="min-w-0 flex-shrink-0 w-44">
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">{hint}</p>}
    </div>
    <div className="flex-1 flex justify-end">{children}</div>
  </div>
);

// ── Tab loader ────────────────────────────────────────────────────────────────
const TabLoader = () => (
  <div className="min-h-[400px] flex items-center justify-center">
    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
  </div>
);

// ── Links Úteis tab ───────────────────────────────────────────────────────────
function LinksUteisTab() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const origin = window.location.origin;
  const publicLinks = [
    {
      key: "privacy",
      label: "Política de Privacidade",
      hint: "Cole no Meta → App → Política de privacidade",
      url: `${origin}/politica-de-privacidade`,
    },
    {
      key: "delete",
      label: "Exclusão de Dados",
      hint: "Cole no Meta → App → URL de exclusão de dados",
      url: `${origin}/excluir-dados`,
    },
    {
      key: "domain",
      label: "Domínio do aplicativo",
      hint: "Use para configurar domínios no painel Meta",
      url: "crm.joaoguirunas.com",
    },
  ];

  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      <div className="px-5 py-2.5 bg-muted border-b border-border flex items-center gap-2">
        <Link2 className="w-3 h-3 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Links Úteis
        </p>
      </div>
      {publicLinks.map(({ key, label, hint, url }, i) => (
        <FieldRow key={key} label={label} hint={hint} last={i === publicLinks.length - 1}>
          <div className="flex items-center gap-2">
            <code className="text-[11px] text-muted-foreground font-mono truncate max-w-[240px] block">
              {url}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy(key, url)}
              className="h-[30px] text-[12px] gap-1.5 rounded-[4px] shrink-0"
            >
              {copiedKey === key
                ? <><Check className="w-3 h-3" />Copiado</>
                : <><Copy className="w-3 h-3" />Copiar</>}
            </Button>
          </div>
        </FieldRow>
      ))}
    </div>
  );
}

// ── Design System tab ─────────────────────────────────────────────────────────
function DesignSystemTab() {
  const navigate = useNavigate();
  return (
    <div className="border border-border rounded-[2px] bg-card p-6 space-y-3">
      <p className="text-[13px] font-medium text-foreground">Design System</p>
      <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
        Visualize tokens de cor, tipografia, ícones e componentes do sistema.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="h-[30px] text-[12px] gap-1.5 rounded-[4px]"
        onClick={() => navigate("/brandbook")}
      >
        <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
        Abrir Design System
      </Button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OutrosConfig() {
  const { user } = useAuth();
  const isSuperAdmin = user?.profile?.super_adm === true;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground">Outros</h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">
          Logs, documentação, links úteis e design system
        </p>
      </div>

      <Tabs defaultValue="links">
        <TabsList className="h-8 bg-muted/50 rounded-[4px] p-0.5 gap-0.5">
          <TabsTrigger value="links" className="h-7 text-[12px] rounded-[3px] px-3">
            Links Úteis
          </TabsTrigger>
          <TabsTrigger value="logs" className="h-7 text-[12px] rounded-[3px] px-3">
            Logs
          </TabsTrigger>
          <TabsTrigger value="audit" className="h-7 text-[12px] rounded-[3px] px-3">
            Configurações
          </TabsTrigger>
          <TabsTrigger value="lgpd" className="h-7 text-[12px] rounded-[3px] px-3">
            LGPD
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="h-7 text-[12px] rounded-[3px] px-3">
            Segurança
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="documentacao" className="h-7 text-[12px] rounded-[3px] px-3">
              Documentação
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="design-system" className="h-7 text-[12px] rounded-[3px] px-3">
              Design System
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="links" className="mt-4">
          <LinksUteisTab />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <LogsViewer />
          </Suspense>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <SettingsAuditLog />
          </Suspense>
        </TabsContent>

        <TabsContent value="lgpd" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <LGPDConfig />
          </Suspense>
        </TabsContent>

        <TabsContent value="seguranca" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <AuthEventsLogViewer />
          </Suspense>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="documentacao" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <SystemDocConfig />
            </Suspense>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="design-system" className="mt-4">
            <DesignSystemTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
