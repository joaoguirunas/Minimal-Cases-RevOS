/**
 * EVOLUTION SESSION MANAGE — pure logic
 *
 * Geração de token de webhook + checagem de admin/gestor, decoupled do
 * Deno.serve handler pra poder ser testado direto (evolution-session-manage/
 * index.ts importa daqui). Espelha o padrão de evolution-inbound-lib.ts.
 */

/**
 * Token de webhook (`settings_whatsapp_channels.evolution_webhook_token`) —
 * usado tanto no header `authorization: Bearer <token>` quanto, reusado,
 * como path-secret (`/evolution-webhook/{secret}`). 64 chars hex (2 UUIDs
 * v4 sem hífen), sem dependência de `crypto.randomUUID` pra ser testável
 * com uma fonte de aleatoriedade injetada.
 */
export function generateToken(randomUUID: () => string = () => crypto.randomUUID()): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

export interface SessionManageCaller {
  super_admin?: boolean | null;
  user_type?: string | null;
}

/**
 * Só admin/gestor pode gerenciar o canal WhatsApp da empresa inteira —
 * conectar/desconectar afeta o CRM todo, não um usuário isolado.
 */
export function isAdminCaller(caller: SessionManageCaller | null | undefined): boolean {
  if (!caller) return false;
  return caller.super_admin === true || caller.user_type === 'gestor';
}
