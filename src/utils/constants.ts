/**
 * Application-wide constants
 */

/** Token de verificação do webhook WhatsApp (Meta) */
export const WHATSAPP_VERIFY_TOKEN = 'growthsales-verify';

/**
 * Routes that do not require authentication.
 * Prefix-matched: /agendar/abc123, /f/xyz, /oauth/... all match.
 */
export const PUBLIC_ROUTES: string[] = [
  '/login',
  '/reset-password',
  '/finalizar-cadastro',
  '/oauth',
  '/tiktok',
  '/agendar',
  '/f',
  '/excluir-dados',
  '/politica-de-privacidade',
  '/termos-de-servico',
  '/terms-of-service',
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}
