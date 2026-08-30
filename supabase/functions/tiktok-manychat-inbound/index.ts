/**
 * TIKTOK MANYCHAT INBOUND — receives TikTok DMs forwarded via ManyChat Flow Builder.
 *
 * ⚠️  DEPLOY: supabase functions deploy tiktok-manychat-inbound --no-verify-jwt
 *
 * Configure in ManyChat Flow Builder (TikTok trigger):
 *   Action → External Request → POST → this URL
 *   Header: X-Webhook-Secret: <value from config panel>
 */

import { handleManyChatInbound, corsHeaders } from '../_shared/manychat-inbound.ts';

Deno.serve((req: Request) => handleManyChatInbound(req, 'tiktok-manychat'));
