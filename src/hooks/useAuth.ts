import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { useCallback, useEffect, useState, useRef, createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { logger } from "@/utils/logger";
import type { UserType } from "@/types/usuarios";

// Configurable timeouts so we can tune per environment without code changes.
// Values are in ms. Falsy/NaN values fall back to defaults preserved from prior behavior.
const PROFILE_FETCH_TIMEOUT_MS = (() => {
  const raw = import.meta.env.VITE_AUTH_PROFILE_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 2000;
})();
const AUTH_INIT_TIMEOUT_MS = (() => {
  const raw = import.meta.env.VITE_AUTH_INIT_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 3000;
})();

// ── Auth event logging (fire-and-forget) ────────────────────────────────────
async function hashString(s: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}

function logAuthEvent(
  eventType: string,
  userId?: string | null,
  metadata: Record<string, unknown> = {}
) {
  // Identificador da instalação para o log de auditoria — não é um segredo, só uma etiqueta.
  const tenantId = (import.meta.env.VITE_APP_TENANT_ID as string | undefined) ?? 'default';

  void (async () => {
    const uaHash = navigator.userAgent ? await hashString(navigator.userAgent) : null;
    void supabase.from("auth_events_log").insert({
      tenant_id: tenantId,
      user_id: userId ?? null,
      event_type: eventType,
      user_agent_hash: uaHash,
      metadata,
      occurred_at: new Date().toISOString(),
    });
  })();
}

interface AuthUser extends User {
  profile?: {
    id: string;
    auth_user_id: string;
    nome: string;
    email: string;
    whatsapp?: string | null;
    avatar_url?: string | null;
    gestor: boolean;
    consultor: boolean;
    ativo: boolean;
    super_adm: boolean;
    user_type: UserType;
    agente?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    deleted_by?: string | null;
    // true when loaded via fallbackProfile (timeout or fetch error) — mutations should be blocked
    isProvisional?: boolean;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  initError: string | null;
  isPasswordRecovery: boolean;
  profileRetryExhausted: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
  emergencyReset: () => void;
  currentTenantId?: string;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

const PROFILE_MAX_RETRIES = 3;
const PROFILE_RETRY_DELAY_MS = 2000;

export const useAuthLogic = (): AuthContextType => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [profileRetryExhausted, setProfileRetryExhausted] = useState(false);
  const isInitialized = useRef(false);
  const isExecuting = useRef(false);
  const isFetchingProfile = useRef(false);
  const profileRetryCount = useRef(0);

  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchUserProfile = useCallback(async (authUser: User, isRetry = false): Promise<void> => {
    if (isFetchingProfile.current && !isRetry) return;
    isFetchingProfile.current = true;
    setIsLoading(true);

    const makeFallbackProfile = (provisional: boolean) => ({
      id: authUser.id,
      auth_user_id: authUser.id,
      nome: authUser.email || 'Usuário',
      email: authUser.email || '',
      whatsapp: null,
      avatar_url: null,
      gestor: false,
      consultor: false,
      ativo: true,
      super_adm: false,
      user_type: 'user' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      deleted_by: null,
      isProvisional: provisional,
    });

    const scheduleRetry = (attempt: number) => {
      if (attempt >= PROFILE_MAX_RETRIES) {
        logger.warn('Profile fetch esgotou retries, marcando provisional');
        setProfileRetryExhausted(true);
        setUser({ ...authUser, profile: makeFallbackProfile(true) });
        setIsLoading(false);
        isFetchingProfile.current = false;
        return;
      }
      logger.warn(`Profile fetch falhou (tentativa ${attempt}/${PROFILE_MAX_RETRIES}), retry em ${PROFILE_RETRY_DELAY_MS}ms`);
      setUser({ ...authUser, profile: makeFallbackProfile(true) });
      setIsLoading(false);
      isFetchingProfile.current = false;
      setTimeout(() => {
        profileRetryCount.current = attempt;
        void fetchUserProfile(authUser, true);
      }, PROFILE_RETRY_DELAY_MS);
    };

    const timeoutId = setTimeout(() => {
      if (isFetchingProfile.current) {
        logAuthEvent("profile_fetch_timeout", authUser.id);
        scheduleRetry(profileRetryCount.current + 1);
      }
    }, PROFILE_FETCH_TIMEOUT_MS);

    try {
      logger.auth('Fetching profile for auth_user_id');

      const { data: profileData, error: profileError } = await supabase
        .from('settings_users')
        .select('id, name, email, phone, user_type, active, super_admin, avatar_url, agente, created_at, updated_at')
        .eq('auth_user_id', authUser.id)
        .eq('active', true)
        .maybeSingle();

      if (profileError) throw profileError;

      logger.auth('Profile data loaded');
      clearTimeout(timeoutId);

      profileRetryCount.current = 0;
      setProfileRetryExhausted(false);

      const profile = profileData ? {
        id: profileData.id,
        auth_user_id: authUser.id,
        nome: profileData.name,
        email: profileData.email,
        whatsapp: profileData.phone || null,
        avatar_url: profileData.avatar_url || null,
        gestor: profileData.user_type === 'manager' || profileData.user_type === 'admin',
        consultor: false,
        ativo: profileData.active,
        super_adm: profileData.super_admin === true || profileData.user_type === 'admin',
        user_type: profileData.user_type as UserType,
        agente: profileData.agente || null,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,
        deleted_at: null,
        deleted_by: null
      } : {
        id: authUser.id,
        auth_user_id: authUser.id,
        nome: authUser.user_metadata?.full_name || authUser.email || 'Usuário',
        email: authUser.email || '',
        whatsapp: null,
        avatar_url: null,
        gestor: false,
        consultor: false,
        ativo: true,
        super_adm: false,
        user_type: 'user' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null
      };

      setUser({ ...authUser, profile });

    } catch (error) {
      clearTimeout(timeoutId);
      logger.error('Erro ao buscar perfil', error);
      scheduleRetry(profileRetryCount.current + 1);
      return;
    } finally {
      if (isFetchingProfile.current) {
        isFetchingProfile.current = false;
        setIsLoading(false);
      }
    }
  }, []);

  const emergencyReset = useCallback(() => {
    isFetchingProfile.current = false;
    setIsLoading(false);
    setInitError(null);
  }, []);

  useEffect(() => {
    if (isInitialized.current || isExecuting.current) {
      logger.info('Auth já inicializado, pulando');
      return;
    }

    isExecuting.current = true;
    isInitialized.current = true;

    logger.auth('Inicializando auth single-tenant');

    let authListener: any;

    const initializeAuth = async () => {
      try {
        // Subscribe BEFORE getSession() so no SIGNED_IN/TOKEN_REFRESHED events are lost
        // while the async getSession() call is in flight on slow networks.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, newSession) => {
            logger.auth('Auth state changed:', event);

            if (event === 'PASSWORD_RECOVERY') {
              logger.auth('PASSWORD_RECOVERY recebido — ativando modo recovery');
              setIsPasswordRecovery(true);
              setSession(newSession);
              if (newSession?.user) {
                setUser(newSession.user as AuthUser);
              }
              setIsLoading(false);
              return;
            }

            if (event === 'TOKEN_REFRESHED') {
              logger.auth('Token refreshed - mantendo estado atual');
              logAuthEvent("session_refresh", newSession?.user?.id ?? null);
              if (newSession && session?.access_token !== newSession.access_token) {
                setSession(newSession);
              }
              return;
            }

            if (event === 'INITIAL_SESSION') {
              logger.auth('INITIAL_SESSION ignorado - já inicializado via getSession');
              return;
            }

            const currentUser = userRef.current;
            const currentUserId = currentUser?.id;
            const newUserId = newSession?.user?.id;

            if (currentUserId && newUserId && currentUserId === newUserId && currentUser?.profile) {
              logger.auth('Mesmo usuário detectado, mantendo estado atual');
              if (newSession) {
                setSession(newSession);
              }
              return;
            }

            setSession(newSession);

            if (newSession?.user) {
              if (event === 'SIGNED_IN' && isPasswordRecovery) {
                logger.auth('SIGNED_IN ignorado — modo recovery ativo');
                return;
              }

              if (event === 'SIGNED_IN' && !currentUser?.profile) {
                logger.auth('Novo login detectado, buscando perfil');
                fetchUserProfile(newSession.user);
              } else if (event === 'USER_UPDATED') {
                setUser(prev => prev ? { ...prev, ...newSession.user } : newSession.user as AuthUser);
              }
            } else if (!newSession) {
              setUser(null);
              setIsPasswordRecovery(false);
              setIsLoading(false);
            }
          }
        );

        authListener = subscription;

        const initTimeout = setTimeout(() => {
          if (isExecuting.current) {
            logger.warn('Auth init timeout, forçando conclusão');
            setIsLoading(false);
          }
        }, AUTH_INIT_TIMEOUT_MS);

        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession?.user) {
          logger.auth('Sessão existente encontrada');
          setSession(currentSession);
          fetchUserProfile(currentSession.user);
        } else {
          logger.auth('Nenhuma sessão encontrada');
          setIsLoading(false);
        }

        clearTimeout(initTimeout);

      } catch (error) {
        logger.error('Erro na inicialização do auth', error);
        setInitError('Erro na inicialização da autenticação');
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (authListener) {
        authListener.unsubscribe();
        logger.auth('Auth listener removido');
      }
      isExecuting.current = false;
    };
  }, []); // ⚠️ ARRAY VAZIO - sem dependências!

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);

      // Call rate-limited auth-login edge fn instead of signInWithPassword directly
      let res: Response;
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/auth-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        // Edge fn unreachable — fall back to direct auth
        logger.warn('auth-login edge fn unreachable, falling back to direct auth');
        const { error: fbErr, data: fbData } = await supabase.auth.signInWithPassword({ email, password });
        if (fbErr) {
          setIsLoading(false);
          logAuthEvent("login_failure", null, { email, reason: fbErr.message });
          return { error: fbErr.message };
        }
        if (fbData.user) {
          await fetchUserProfile(fbData.user);
          logAuthEvent("login_success", fbData.user.id, { email });
        }
        return {};
      }

      const body = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (res.status === 429) {
        setIsLoading(false);
        const retryAfter = body.retry_after_seconds as number | undefined;
        const minutes = retryAfter ? Math.ceil(retryAfter / 60) : 15;
        logAuthEvent("login_blocked", null, { email, retry_after_seconds: retryAfter });
        return { error: `Muitas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.` };
      }

      if (!res.ok || !body.ok) {
        setIsLoading(false);
        const reason = (body.error as string) || 'Credenciais inválidas';
        logAuthEvent("login_failure", null, { email, reason });
        return { error: reason };
      }

      // Success — establish session from returned tokens (AC3)
      const { error: sessionErr, data: sessionData } = await supabase.auth.setSession({
        access_token: body.access_token as string,
        refresh_token: body.refresh_token as string,
      });

      if (sessionErr || !sessionData?.user) {
        setIsLoading(false);
        logAuthEvent("login_failure", null, { email, reason: sessionErr?.message ?? 'session error' });
        return { error: sessionErr?.message ?? 'Erro ao estabelecer sessão' };
      }

      await fetchUserProfile(sessionData.user);
      logAuthEvent("login_success", sessionData.user.id, { email });
      return {};
    } catch (error: any) {
      setIsLoading(false);
      logAuthEvent("login_failure", null, { email, reason: error.message });
      return { error: error.message || 'Erro no login' };
    }
  }, [fetchUserProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    try {
      setIsLoading(true);
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName || email },
        },
      });

      if (error) return { error: error.message };
      return {};
    } catch (error: any) {
      return { error: error.message || 'Erro no cadastro' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl },
      });
      if (error) return { error: error.message };
      return {};
    } catch (error: any) {
      return { error: error.message || 'Erro no login com Google' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUserId = userRef.current?.id ?? null;
      logAuthEvent("logout", currentUserId);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setInitError(null);
      profileRetryCount.current = 0;
      setProfileRetryExhausted(false);
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
      if (error) return { error: error.message };
      return {};
    } catch (error: any) {
      return { error: error.message || 'Erro ao resetar senha' };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      setIsLoading(true);
      await fetchUserProfile(session.user);
    }
  }, [session?.user, fetchUserProfile]);

  const refreshSession = useCallback(async () => {
    try {
      setIsLoading(true);
      await supabase.auth.refreshSession();
    } catch (error) {
      console.error('Erro ao atualizar sessão:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    session,
    isLoading,
    initError,
    isPasswordRecovery,
    profileRetryExhausted,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshProfile,
    refreshSession,
    emergencyReset,
    currentTenantId: 'single-tenant'
  };
};
