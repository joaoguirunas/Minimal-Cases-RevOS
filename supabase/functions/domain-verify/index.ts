import { corsHeaders } from "../_shared/response.ts";

const EXPECTED_CNAME = "app.growthsales.ai";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let domain: string;
  try {
    const body = await req.json();
    domain = (body.domain ?? "").trim().toLowerCase();
  } catch {
    return json({ ok: false, error: "Invalid body" }, 400);
  }

  if (!domain) return json({ ok: false, error: "domain required" }, 400);

  // Strip protocol if accidentally included
  domain = domain.replace(/^https?:\/\//, "").split("/")[0];

  try {
    // Use DNS-over-HTTPS (Cloudflare) since Deno.resolveDns may not be available
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=CNAME`;
    const res = await fetch(dohUrl, {
      headers: { Accept: "application/dns-json" },
    });

    const data = await res.json();
    const answers: Array<{ type: number; data: string }> = data.Answer ?? [];

    // CNAME type = 5
    const cnameRecords = answers
      .filter((a) => a.type === 5)
      .map((a) => a.data.replace(/\.$/, "").toLowerCase());

    const verified = cnameRecords.some((cname) => cname === EXPECTED_CNAME);

    return json({
      ok: true,
      verified,
      expected_cname: EXPECTED_CNAME,
      found_cnames: cnameRecords,
    });
  } catch (err) {
    return json({
      ok: true,
      verified: false,
      expected_cname: EXPECTED_CNAME,
      error: String(err),
    });
  }
});
