// scripts/correio/klaviyo-import-suppressions.ts
/**
 * Importa do Klaviyo (somente leitura) quem não pode receber e-mail e grava em email_contacts
 * via public.email_import_suppression. Rodar antes do 1º envio pelo Resend e antes de cada subida.
 *   KLAVIYO_KEY=pk_... SUPABASE_URL=https://maigkwlgzinykfvemexf.supabase.co SERVICE_KEY=... \
 *     deno run -A scripts/correio/klaviyo-import-suppressions.ts [--dry]
 */
type Status = 'unsubscribed' | 'bounced' | 'complained';
const BY_REASON: Record<string, Status> = {
  HARD_BOUNCE: 'bounced', INVALID_EMAIL: 'bounced', SPAM_COMPLAINT: 'complained', USER_SUPPRESSED: 'unsubscribed', UNSUBSCRIBE: 'unsubscribed',
};

export function mapKlaviyoProfile(p: { attributes: { email?: string | null; subscriptions?: unknown } }): { email: string; status: Status; reason: string } | null {
  const email = (p.attributes.email ?? '').trim().toLowerCase();
  if (!email.includes('@')) return null;
  const mk = (p.attributes.subscriptions as { email?: { marketing?: { consent?: string; suppression?: { reason?: string }[] } } } | undefined)?.email?.marketing;
  if (!mk) return null;
  const reason = (mk.suppression ?? []).map((s) => s.reason ?? '').find((r) => r in BY_REASON);
  if (reason) return { email, status: BY_REASON[reason], reason: `klaviyo:${reason}` };
  if (mk.consent === 'UNSUBSCRIBED') return { email, status: 'unsubscribed', reason: 'klaviyo:UNSUBSCRIBED' };
  return null;
}

if (import.meta.main) {
  const dry = Deno.args.includes('--dry');
  const KEY = Deno.env.get('KLAVIYO_KEY')!, SB = Deno.env.get('SUPABASE_URL')!, SK = Deno.env.get('SERVICE_KEY')!;
  const H = { Authorization: `Klaviyo-API-Key ${KEY}`, revision: '2025-07-15', accept: 'application/vnd.api+json' };
  let url: string | null = 'https://a.klaviyo.com/api/profiles/?fields[profile]=email,subscriptions&additional-fields[profile]=subscriptions&page[size]=100';
  let scanned = 0; const rows: ReturnType<typeof mapKlaviyoProfile>[] = []; const count: Record<string, number> = {};
  while (url) {
    const res = await fetch(url, { headers: H });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, (Number(res.headers.get('retry-after')) || 2) * 1000)); continue; }
    if (!res.ok) throw new Error(`Klaviyo ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json() as { data: { attributes: { email?: string; subscriptions?: unknown } }[]; links?: { next?: string | null } };
    for (const p of j.data) { scanned++; const m = mapKlaviyoProfile(p); if (m) { rows.push(m); count[m.status] = (count[m.status] ?? 0) + 1; } }
    url = j.links?.next ?? null;
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`perfis lidos: ${scanned} · supressões: ${rows.length}`, count);
  if (dry) Deno.exit(0);
  let applied = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const res = await fetch(`${SB}/rest/v1/rpc/email_import_suppression`, {
      method: 'POST', headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_rows: rows.slice(i, i + 100) }),
    });
    if (!res.ok) throw new Error(`import ${res.status}: ${await res.text()}`);
    applied += Number(await res.json());
  }
  console.log(`aplicadas (novas): ${applied}`);
}
