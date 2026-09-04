// supabase/functions/_shared/click-classifier.test.ts
// Run: deno test --allow-env supabase/functions/_shared/click-classifier.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { classifyClick, deviceOf, extractClientIp, hashIp } from './click-classifier.ts';

const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
const get = (userAgent: string | null, extra: Partial<Parameters<typeof classifyClick>[0]> = {}) =>
  classifyClick({ method: 'GET', userAgent, accept: HTML, ...extra });

Deno.test('crawlers de preview são robôs (WhatsApp, Meta, Slack, Telegram, Twitter)', () => {
  for (const ua of [
    'WhatsApp/2.23.20.0 A',
    'WhatsApp/2.2338.12 W',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'TelegramBot (like TwitterBot)',
    'Twitterbot/1.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ]) assertEquals(get(ua), { isBot: true, reason: 'ua', device: deviceOf(ua) }, ua);
});

Deno.test('scanners de e-mail e HTTP libs são robôs', () => {
  for (const ua of ['curl/8.4.0', 'python-requests/2.31', 'Go-http-client/2.0', 'Mozilla/5.0 (Windows NT 10.0) HeadlessChrome/118.0', 'Microsoft Office Word 2014', 'Barracuda Sentinel (EE)'])
    assertEquals(get(ua).isBot, true, ua);
});

Deno.test('navegadores reais são humanos — inclusive o navegador embutido do WhatsApp', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.54 Mobile Safari/537.36';
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  assertEquals(get(android), { isBot: false, reason: null, device: 'mobile' });
  assertEquals(get(ios), { isBot: false, reason: null, device: 'mobile' });
  assertEquals(get(desktop), { isBot: false, reason: null, device: 'desktop' });
  // Sem header Accept (alguns webviews) continua humano.
  assertEquals(get(android, { accept: null }).isBot, false);
});

Deno.test('HEAD, UA vazio, prefetch e Accept sem text/html são robôs', () => {
  const ua = 'Mozilla/5.0 (Macintosh) Chrome/124 Safari/537.36';
  assertEquals(classifyClick({ method: 'HEAD', userAgent: ua, accept: HTML }).reason, 'method');
  assertEquals(get(null).reason, 'no_ua');
  assertEquals(get('   ').reason, 'no_ua');
  assertEquals(get(ua, { secPurpose: 'prefetch;prerender' }).reason, 'prefetch');
  assertEquals(get(ua, { xPurpose: 'preview' }).reason, 'prefetch');
  assertEquals(get(ua, { accept: '*/*' }).reason, 'accept');
});

Deno.test('extractClientIp prefere cf-connecting-ip > x-real-ip > primeiro x-forwarded-for', () => {
  assertEquals(extractClientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4');
  assertEquals(extractClientIp(new Headers({ 'x-real-ip': '5.6.7.8', 'x-forwarded-for': '1.2.3.4' })), '5.6.7.8');
  assertEquals(extractClientIp(new Headers()), null);
});

Deno.test('hashIp: 32 hex, determinístico no dia, muda com o dia, null sem IP', async () => {
  const a = await hashIp('1.2.3.4', 'salt', '2026-09-04');
  const b = await hashIp('1.2.3.4', 'salt', '2026-09-04');
  const c = await hashIp('1.2.3.4', 'salt', '2026-09-05');
  assertEquals(a, b);
  assertEquals(a === c, false);
  assertEquals(/^[0-9a-f]{32}$/.test(a!), true);
  assertEquals(await hashIp(null, 'salt'), null);
});
