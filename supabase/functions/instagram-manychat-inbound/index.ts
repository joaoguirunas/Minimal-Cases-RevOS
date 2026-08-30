/**
 * INSTAGRAM MANYCHAT INBOUND — receives Instagram DMs forwarded via ManyChat Flow Builder.
 *
 * ⚠️  DEPLOY: supabase functions deploy instagram-manychat-inbound --no-verify-jwt
 *
 * Configure in ManyChat Flow Builder (Instagram trigger):
 *   Action → External Request → POST → this URL
 *   Header: X-Webhook-Secret: <value from config panel>
 */

import { handleManyChatInbound } from '../_shared/manychat-inbound.ts';

Deno.serve((req: Request) => handleManyChatInbound(req, 'instagram-manychat'));
