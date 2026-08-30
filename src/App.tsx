import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { PresentationModeProvider } from "@/contexts/PresentationModeContext";
import PageErrorBoundary from "@/components/error-boundaries/PageErrorBoundary";
import SectionErrorBoundary from "@/components/error-boundaries/SectionErrorBoundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ModuleProtectedRoute from "@/components/auth/ModuleProtectedRoute";
import GestorProtectedRoute from "@/components/auth/GestorProtectedRoute";
import RestrictedRoute from "@/components/auth/RestrictedRoute";
import DashLayout from "@/components/layout/DashLayout";
import LoginPage from "@/components/auth/LoginPage";
import ResetPasswordPage from "@/components/auth/ResetPasswordPage";
import FinalizarCadastro from "@/pages/FinalizarCadastro";
import MetaOAuthCallback from "@/pages/MetaOAuthCallback";
import GoogleOAuthCallback from "@/pages/GoogleOAuthCallback";
import MicrosoftOAuthCallback from "@/pages/MicrosoftOAuthCallback";
import CalcomOAuthCallback from "@/pages/CalcomOAuthCallback";
import TiktokCallback from "@/pages/TiktokCallback";
import Dashboard from "@/pages/Dashboard";
import Negocios from "@/pages/Negocios";
import Clientes from "@/pages/Clientes";
import Reunioes from "@/pages/Reunioes";
import ConfiguracoesShell from "@/components/settings/ConfiguracoesShell";
import { SETTINGS_SECTIONS } from "@/pages/settings/registry";
import Perfil from "@/pages/Perfil";
import NegocioSingle from "@/pages/NegocioSingle";
import Conversas from "@/pages/Conversas";
import ConversasDemo from "@/pages/ConversasDemo";
import OmniAutomacoes from "@/pages/OmniAutomacoes";
import OmniLogs from "@/pages/OmniLogs";
import Horarios from "@/pages/Horarios";
import Brandbook from "@/pages/Brandbook";
import DesignSystem from "@/pages/DesignSystem";
import AgenteSingle from "@/pages/AgenteSingle";
import ClienteSingle from "@/pages/ClienteSingle";
import EmpresaSingle from "@/pages/EmpresaSingle";
import Followups from "@/pages/Followups";
import Disparos from "@/pages/Disparos";
import DisparoDetalhes from "@/pages/DisparoDetalhes";
import CriarDisparo from "@/pages/CriarDisparo";
import TimeSingle from "@/pages/TimeSingle";
import Score from "@/pages/Score";
import LpPro from "@/pages/LpPro";
import ReuniaoSingle from "@/pages/ReuniaoSingle";
import ScheduleCalendarioConfig from "@/components/config/horarios/ScheduleCalendarioConfig";
import AgendamentoPublico from "@/pages/AgendamentoPublico";
import PublicFormPage from "@/pages/PublicFormPage";
import DataDeletionPage from "@/pages/DataDeletionPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import AdvancedErrorBoundary from "@/components/error-boundaries/AdvancedErrorBoundary";
import MfaSetup from "@/pages/MfaSetup";
import MfaRecoveryRegenerate from "@/pages/MfaRecoveryRegenerate";
import MfaVerify from "@/pages/MfaVerify";
import { useBrandColors } from "@/hooks/useBrandColors";
import React from "react";

import { isPublicRoute } from "@/utils/constants";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileShell from "@/components/mobile/MobileShell";
import MobileModuleGuard from "@/components/mobile/MobileModuleGuard";
import MobilePerfil from "@/pages/mobile/MobilePerfil";
import MobileOmniPro from "@/pages/mobile/MobileOmniPro";
import MobileConversaDetail from "@/pages/mobile/MobileConversaDetail";
import MobileCrmPro from "@/pages/mobile/MobileCrmPro";
import MobileNegocioDetail from "@/pages/mobile/MobileNegocioDetail";
import MobileBiPro from "@/pages/mobile/MobileBiPro";

// OTIMIZAÇÃO: QueryClient com cache agressivo e staleTime diferenciado
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      retryDelay: 500,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchInterval: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function AppContent() {
  const isMobile = useIsMobile();
  const location = useLocation();
  useBrandColors();

  const isPublic = isPublicRoute(location.pathname);

  // Redirect mobile users away from desktop routes → /m/*
  if (isMobile && !isPublic && !location.pathname.startsWith('/m/')) {
    return <Navigate to="/m/bi" replace />;
  }

  return (
    <Routes>
      {/* ── Mobile routes /m/* ── */}
      <Route path="/m" element={
        <ProtectedRoute>
          <MobileShell />
        </ProtectedRoute>
      }>
        <Route path="bi" element={
          <MobileModuleGuard moduleKey="dashboard">
            <MobileBiPro />
          </MobileModuleGuard>
        } />
        <Route path="crm" element={
          <MobileModuleGuard moduleKey="negocios">
            <MobileCrmPro />
          </MobileModuleGuard>
        } />
        <Route path="crm/:id" element={
          <MobileModuleGuard moduleKey="negocios">
            <MobileNegocioDetail />
          </MobileModuleGuard>
        } />
        <Route path="omni" element={
          <MobileModuleGuard moduleKey="conversas">
            <MobileOmniPro />
          </MobileModuleGuard>
        } />
        <Route path="omni/:id" element={
          <MobileModuleGuard moduleKey="conversas">
            <MobileConversaDetail />
          </MobileModuleGuard>
        } />
        <Route path="perfil" element={<MobilePerfil />} />
      </Route>

      {/* ── Desktop routes ── */}
      <Route path="/" element={<Navigate to="/bipro" replace />} />
      <Route path="/oauth/meta/callback" element={<MetaOAuthCallback />} />
      <Route path="/oauth/google/callback" element={<GoogleOAuthCallback />} />
      <Route path="/oauth/microsoft/callback" element={<MicrosoftOAuthCallback />} />
      <Route path="/oauth/calcom/callback" element={<CalcomOAuthCallback />} />
      <Route path="/tiktok/callback" element={<TiktokCallback />} />
      <Route path="/login" element={
        <SectionErrorBoundary section="Login">
          <LoginPage />
        </SectionErrorBoundary>
      } />
      <Route path="/reset-password" element={
        <SectionErrorBoundary section="Reset Password">
          <ResetPasswordPage />
        </SectionErrorBoundary>
      } />
      <Route path="/finalizar-cadastro" element={
        <SectionErrorBoundary section="Finalizar Cadastro">
          <FinalizarCadastro />
        </SectionErrorBoundary>
      } />

      {/* Public booking — no auth required */}
      <Route path="/agendar/:leadId" element={
        <SectionErrorBoundary section="Agendamento Público">
          <AgendamentoPublico />
        </SectionErrorBoundary>
      } />

      {/* Public form page — no auth required */}
      <Route path="/f/:formId" element={
        <SectionErrorBoundary section="Formulário Público">
          <PublicFormPage />
        </SectionErrorBoundary>
      } />

      {/* Data deletion request — public, LGPD/Meta compliance */}
      <Route path="/excluir-dados" element={
        <SectionErrorBoundary section="Exclusão de Dados">
          <DataDeletionPage />
        </SectionErrorBoundary>
      } />

      {/* Privacy policy — public */}
      <Route path="/politica-de-privacidade" element={
        <SectionErrorBoundary section="Política de Privacidade">
          <PrivacyPolicyPage />
        </SectionErrorBoundary>
      } />
      <Route path="/privacy-policy" element={
        <SectionErrorBoundary section="Privacy Policy">
          <PrivacyPolicyPage />
        </SectionErrorBoundary>
      } />

      {/* Terms of Service — public */}
      <Route path="/termos-de-servico" element={
        <SectionErrorBoundary section="Termos de Serviço">
          <TermsOfServicePage />
        </SectionErrorBoundary>
      } />
      <Route path="/terms-of-service" element={
        <SectionErrorBoundary section="Terms of Service">
          <TermsOfServicePage />
        </SectionErrorBoundary>
      } />

      {/* BI PRO™ */}
      <Route path="/bipro" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <ModuleProtectedRoute moduleKey="dashboard">
            <SectionErrorBoundary section="Dashboard">
              <Dashboard />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
      </Route>

      {/* DASHBOARD - Legacy compatibility routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/bipro" replace />} />
        <Route path="negocios" element={
          <ModuleProtectedRoute moduleKey="negocios">
            <SectionErrorBoundary section="Negócios">
              <Negocios />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="negocios/:id" element={
          <ModuleProtectedRoute moduleKey="negocios">
            <SectionErrorBoundary section="Negócio Single">
              <NegocioSingle />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="reunioes" element={
          <ModuleProtectedRoute moduleKey="agendamentos">
            <SectionErrorBoundary section="Reuniões">
              <Reunioes />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="reunioes/:id" element={
          <ModuleProtectedRoute moduleKey="agendamentos">
            <SectionErrorBoundary section="Reunião Single">
              <ReuniaoSingle />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
      </Route>

      {/* CRM PRO™ */}
      <Route path="/crm" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route path="kanban" element={
          <ModuleProtectedRoute moduleKey="negocios">
            <SectionErrorBoundary section="Negócios">
              <Negocios />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="kanban/:id" element={
          <ModuleProtectedRoute moduleKey="negocios">
            <SectionErrorBoundary section="Negócio Single">
              <NegocioSingle />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="list" element={
          <ModuleProtectedRoute moduleKey="negocios">
            <SectionErrorBoundary section="Negócios">
              <Negocios />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="list/:id" element={
          <ModuleProtectedRoute moduleKey="negocios">
            <SectionErrorBoundary section="Negócio Single">
              <NegocioSingle />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="clients" element={
          <ModuleProtectedRoute moduleKey="clientes">
            <SectionErrorBoundary section="Clientes">
              <Clientes />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="clients/:id" element={
          <ModuleProtectedRoute moduleKey="clientes">
            <SectionErrorBoundary section="Cliente Single">
              <ClienteSingle />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="empresas/:id" element={
          <ModuleProtectedRoute moduleKey="clientes">
            <SectionErrorBoundary section="Empresa Single">
              <EmpresaSingle />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
      </Route>

      {/* SENDS PRO™ */}
      <Route path="/send" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <ModuleProtectedRoute moduleKey="disparos">
            <SectionErrorBoundary section="Disparos">
              <Disparos />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path=":id" element={
          <ModuleProtectedRoute moduleKey="disparos">
            <SectionErrorBoundary section="Disparo Detalhes">
              <DisparoDetalhes />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="novo" element={
          <ModuleProtectedRoute moduleKey="disparos">
            <SectionErrorBoundary section="Criar Disparo">
              <CriarDisparo />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
      </Route>

      {/* SCHEDULE PRO™ */}
      <Route path="/schedule" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <ModuleProtectedRoute moduleKey="agendamentos">
            <SectionErrorBoundary section="Reuniões">
              <Reunioes />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="calendario" element={
          <ModuleProtectedRoute moduleKey="agendamentos">
            <SectionErrorBoundary section="Calendário">
              <ScheduleCalendarioConfig />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path=":id" element={
          <ModuleProtectedRoute moduleKey="agendamentos">
            <SectionErrorBoundary section="Reunião Single">
              <ReuniaoSingle />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
      </Route>

      {/* OMNI PRO™ */}
      <Route path="/omni" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <ModuleProtectedRoute moduleKey="conversas">
            <SectionErrorBoundary section="Conversas">
              <Conversas />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="demo" element={
          <RestrictedRoute requireGestor>
            <ModuleProtectedRoute moduleKey="conversas">
              <SectionErrorBoundary section="Conversas Demo">
                <ConversasDemo />
              </SectionErrorBoundary>
            </ModuleProtectedRoute>
          </RestrictedRoute>
        } />
        <Route path="automacoes" element={
          <ModuleProtectedRoute moduleKey="conversas">
            <SectionErrorBoundary section="OMNI Automações">
              <OmniAutomacoes />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
        <Route path="logs" element={
          <ModuleProtectedRoute moduleKey="conversas">
            <SectionErrorBoundary section="OMNI Logs">
              <OmniLogs />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
      </Route>

      {/* FORM PRO™ */}
      <Route path="/lp" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <ModuleProtectedRoute moduleKey="lp">
            <SectionErrorBoundary section="FORM PRO™">
              <LpPro />
            </SectionErrorBoundary>
          </ModuleProtectedRoute>
        } />
      </Route>

      {/* SETTINGS — Routes geradas do registry (fonte única de verdade) */}
      <Route path="/settings" element={
        <ProtectedRoute>
          <GestorProtectedRoute>
            <SectionErrorBoundary section="Layout">
              <DashLayout />
            </SectionErrorBoundary>
          </GestorProtectedRoute>
        </ProtectedRoute>
      }>
        {/* Index → seção geral */}
        <Route index element={
          <SectionErrorBoundary section="Configurações">
            <ConfiguracoesShell sectionId="geral" />
          </SectionErrorBoundary>
        } />

        {/* Routes dinâmicas geradas do SETTINGS_SECTIONS registry */}
        {SETTINGS_SECTIONS.flatMap((section) =>
          section.paths.map((fullPath) => {
            const relativePath = fullPath.replace('/settings/', '');
            return (
              <Route
                key={fullPath}
                path={relativePath}
                element={
                  <SectionErrorBoundary section="Configurações">
                    <ConfiguracoesShell sectionId={section.id} />
                  </SectionErrorBoundary>
                }
              />
            );
          })
        )}

        {/* Casos especiais — params dinâmicos, permanecem como Routes manuais */}
        <Route path="crm/aiagents/:id" element={
          <SectionErrorBoundary section="Agente IA">
            <AgenteSingle />
          </SectionErrorBoundary>
        } />
        <Route path="general/times/:teamId" element={
          <SectionErrorBoundary section="Time Single">
            <TimeSingle />
          </SectionErrorBoundary>
        } />
      </Route>

      {/* MFA SETUP — standalone page, no DashLayout */}
      <Route path="/settings/mfa-setup" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="MFA Setup">
            <MfaSetup />
          </SectionErrorBoundary>
        </ProtectedRoute>
      } />

      {/* MFA RECOVERY REGENERATE — standalone page, no DashLayout */}
      <Route path="/settings/mfa-recovery-regenerate" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="MFA Recovery">
            <MfaRecoveryRegenerate />
          </SectionErrorBoundary>
        </ProtectedRoute>
      } />

      {/* MFA VERIFY — AAL2 challenge after login, standalone */}
      <Route path="/settings/mfa-verify" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="MFA Verify">
            <MfaVerify />
          </SectionErrorBoundary>
        </ProtectedRoute>
      } />

      {/* PROFILE */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <SectionErrorBoundary section="Perfil">
            <Perfil />
          </SectionErrorBoundary>
        } />
      </Route>

      {/* BRANDBOOK — full screen, no DashLayout */}
      <Route path="/brandbook" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Brandbook">
            <Brandbook />
          </SectionErrorBoundary>
        </ProtectedRoute>
      } />

      {/* DESIGN SYSTEM — full screen, no DashLayout */}
      <Route path="/design-system" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Design System">
            <DesignSystem />
          </SectionErrorBoundary>
        </ProtectedRoute>
      } />

      {/* SCHEDULES */}
      <Route path="/schedules" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <ModuleProtectedRoute moduleKey="agendamentos">
            <RestrictedRoute requireGestor>
              <SectionErrorBoundary section="Horários">
                <Horarios />
              </SectionErrorBoundary>
            </RestrictedRoute>
          </ModuleProtectedRoute>
        } />
      </Route>

      {/* FOLLOW-UPS */}
      <Route path="/followups" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <SectionErrorBoundary section="Follow-ups">
            <Followups />
          </SectionErrorBoundary>
        } />
      </Route>

      {/* AI AGENTS - under SETTINGS */}

      {/* SCORE PRO™ */}
      <Route path="/score" element={
        <ProtectedRoute>
          <SectionErrorBoundary section="Layout">
            <DashLayout />
          </SectionErrorBoundary>
        </ProtectedRoute>
      }>
        <Route index element={
          <SectionErrorBoundary section="Score PRO™">
            <Score />
          </SectionErrorBoundary>
        } />
      </Route>

      {/* Catch-all 404 — handles old LP slug URLs and any unmatched paths */}
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-4xl font-bold text-foreground">404</h1>
            <p className="text-muted-foreground">Página não encontrada</p>
            <a href="/login" className="text-primary hover:underline text-sm">Ir para o login</a>
          </div>
        </div>
      } />

    </Routes>
  );
}

function App() {
  return (
    <PageErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <LoadingProvider>
            <PresentationModeProvider>
              <TooltipProvider>
                <Toaster />
                <BrowserRouter>
                  <AuthProvider>
                    <RealtimeProvider>
                      <NavigationProvider>
                        <AppContent />
                      </NavigationProvider>
                    </RealtimeProvider>
                  </AuthProvider>
                </BrowserRouter>
              </TooltipProvider>
            </PresentationModeProvider>
          </LoadingProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </PageErrorBoundary>
  );
}

export default App;
