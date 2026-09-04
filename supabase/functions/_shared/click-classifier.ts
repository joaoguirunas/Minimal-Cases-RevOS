/**
 * click-classifier — decide se um GET no link rastreado foi um humano ou um robô
 * (crawler de preview do WhatsApp/Meta/Slack, scanner de e-mail corporativo,
 * prefetch de navegador, HTTP lib). Função pura: recebe só método + headers.
 *
 * Importante: o navegador embutido do WhatsApp (Android/iOS) NÃO manda "WhatsApp"
 * no User-Agent — só o crawler de preview manda ("WhatsApp/2.23…"). Por isso a
 * palavra na regex é segura.
 */

export interface ClickRequestInfo {
  method: string;
  userAgent: string | null;
  accept?: string | null;
  secPurpose?: string | null;
  purpose?: string | null;
  xPurpose?: string | null;
  xMoz?: string | null;
}
export type ClickDevice = 'mobile' | 'desktop' | 'unknown';
export type BotReason = 'method' | 'no_ua' | 'ua' | 'prefetch' | 'accept';
export interface ClickClass { isBot: boolean; reason: BotReason | null; device: ClickDevice }

/** Lista explícita (sem `bot\b` genérico — "Cubot" é marca de celular). */
export const BOT_UA_RE = new RegExp(
  [
    // previews / redes sociais / mensageiros
    'whatsapp', 'facebookexternalhit', 'facebot', 'meta-external', 'twitterbot', 'slackbot', 'slack-imgproxy',
    'telegrambot', 'discordbot', 'linkedinbot', 'pinterestbot', 'skypeuripreview', 'iframely', 'embedly', 'linkpreview',
    // buscadores / crawlers
    'googlebot', 'google-inspectiontool', 'adsbot-google', 'bingbot', 'yandexbot', 'yandeximages', 'duckduckbot',
    'applebot', 'baiduspider', 'petalbot', 'bytespider', 'gptbot', 'claudebot', 'ccbot', 'amazonbot',
    'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'ia_archiver',
    // http libs / headless
    'python-requests', 'python-urllib', 'aiohttp', 'go-http-client', 'okhttp', 'curl/', 'wget/', 'libwww-perl',
    'java/', 'apache-httpclient', 'node-fetch', 'undici', 'axios/', 'headlesschrome', 'phantomjs', 'puppeteer',
    'playwright', 'selenium', 'lighthouse',
    // monitoramento / segurança de e-mail
    'pingdom', 'uptimerobot', 'statuscake', 'site24x7', 'newrelicpinger', 'datadog',
    'barracuda', 'proofpoint', 'mimecast', 'forcepoint', 'safelinks', 'urldefense', 'trendmicro', 'symantec',
    'sophos', 'zscaler', 'microsoft office', 'ms-office', 'outlook-',
    // provedores de e-mail/marketing
    'klaviyo', 'sendgrid', 'mailgun', 'postmark', 'mailchimp', 'hubspot',
    // genéricos seguros
    'crawler', 'spider', 'scraper', 'scanner', 'validator',
  ].map((s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|'),
  'i',
);

export function deviceOf(ua: string | null): ClickDevice {
  if (!ua) return 'unknown';
  if (/mobile|android|iphone|ipad|ipod|windows phone/i.test(ua)) return 'mobile';
  if (/mozilla|windows nt|macintosh|x11|linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

export function classifyClick(req: ClickRequestInfo): ClickClass {
  const ua = (req.userAgent ?? '').trim();
  const device = deviceOf(ua || null);
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') return { isBot: true, reason: 'method', device };
  if (!ua) return { isBot: true, reason: 'no_ua', device };
  if (BOT_UA_RE.test(ua)) return { isBot: true, reason: 'ua', device };
  const purpose = [req.secPurpose, req.purpose, req.xPurpose, req.xMoz].filter(Boolean).join(' ').toLowerCase();
  if (/prefetch|preview|prerender/.test(purpose)) return { isBot: true, reason: 'prefetch', device };
  // Navegador em navegação de topo sempre manda text/html; scanner manda "*/*" ou nada.
  const accept = (req.accept ?? '').toLowerCase();
  if (accept && !accept.includes('text/html')) return { isBot: true, reason: 'accept', device };
  return { isBot: false, reason: null, device };
}

export function clickInfoFromRequest(req: Request): ClickRequestInfo {
  const h = req.headers;
  return {
    method: req.method,
    userAgent: h.get('user-agent'),
    accept: h.get('accept'),
    secPurpose: h.get('sec-purpose'),
    purpose: h.get('purpose'),
    xPurpose: h.get('x-purpose'),
    xMoz: h.get('x-moz'),
  };
}

export function extractClientIp(headers: Headers): string | null {
  const cf = headers.get('cf-connecting-ip');
  if (cf?.trim()) return cf.trim();
  const real = headers.get('x-real-ip');
  if (real?.trim()) return real.trim();
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || null;
  return null;
}

/** sha256(salt|dia|ip) truncado em 32 hex. Salt diário: não dá pra correlacionar entre dias. */
export async function hashIp(ip: string | null, salt: string, day = new Date().toISOString().slice(0, 10)): Promise<string | null> {
  if (!ip) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${day}|${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
