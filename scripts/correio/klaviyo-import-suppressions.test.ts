// scripts/correio/klaviyo-import-suppressions.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mapKlaviyoProfile } from './klaviyo-import-suppressions.ts';

const p = (email: string | null, marketing: unknown) => ({ attributes: { email, subscriptions: { email: { marketing } } } });
Deno.test('mapeia supressões e descadastros do Klaviyo', () => {
  assertEquals(mapKlaviyoProfile(p('A@B.com', { consent: 'SUBSCRIBED', suppression: [{ reason: 'HARD_BOUNCE' }] })), { email: 'a@b.com', status: 'bounced', reason: 'klaviyo:HARD_BOUNCE' });
  assertEquals(mapKlaviyoProfile(p('a@b.com', { suppression: [{ reason: 'INVALID_EMAIL' }] }))?.status, 'bounced');
  assertEquals(mapKlaviyoProfile(p('a@b.com', { suppression: [{ reason: 'SPAM_COMPLAINT' }] }))?.status, 'complained');
  assertEquals(mapKlaviyoProfile(p('a@b.com', { suppression: [{ reason: 'USER_SUPPRESSED' }] }))?.status, 'unsubscribed');
  assertEquals(mapKlaviyoProfile(p('a@b.com', { consent: 'UNSUBSCRIBED', suppression: [] }))?.status, 'unsubscribed');
});
Deno.test('assinante, nunca-inscrito (checkout) e sem e-mail não viram supressão', () => {
  assertEquals(mapKlaviyoProfile(p('a@b.com', { consent: 'SUBSCRIBED', suppression: [] })), null);
  assertEquals(mapKlaviyoProfile(p('a@b.com', { consent: 'NEVER_SUBSCRIBED', suppression: [] })), null);
  assertEquals(mapKlaviyoProfile(p(null, { consent: 'UNSUBSCRIBED' })), null);
  assertEquals(mapKlaviyoProfile({ attributes: { email: 'a@b.com' } }), null);
});
