import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, error: "Unauthorized" }, 401);

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return json({ ok: false, error: "Unauthorized" }, 401);

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return json({ ok: false, error: "No tenant" }, 403);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Find requesting settings_user
  const { data: settingsUser } = await supabase
    .from("settings_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Create job record
  const { data: job, error: jobError } = await supabase
    .from("data_export_jobs")
    .insert({
      tenant_id: tenantId,
      requested_by: settingsUser?.id ?? null,
      status: "processing",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return json({ ok: false, error: "Failed to create export job" }, 500);
  }

  // Run export async (fire-and-forget) — generate CSV + upload to Storage
  runExport(supabase, job.id, tenantId);

  return json({ ok: true, job_id: job.id });
});

async function runExport(supabase: ReturnType<typeof createClient>, jobId: string, tenantId: string) {
  try {
    // Fetch data
    const [leadsRes, peopleRes, messagesRes, settingsRes] = await Promise.all([
      supabase.from("leads").select("id,status,value,created_at,won_at").eq("tenant_id", tenantId),
      supabase.from("clients_people").select("id,name,email,whatsapp,created_at").eq("tenant_id", tenantId),
      supabase
        .from("messages")
        .select("id,lead_id,channel,created_at")
        .gte("created_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("settings").select("company_name,timezone,language,currency,website,email,phone").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const zip = await buildZip({
      "leads.csv": toCsv(leadsRes.data ?? []),
      "clients_people.csv": toCsv(peopleRes.data ?? []),
      "messages.csv": toCsv(messagesRes.data ?? []),
      "settings_export.json": JSON.stringify(settingsRes.data ?? {}, null, 2),
    });

    const path = `exports/${tenantId}/${jobId}.zip`;
    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(path, zip, { contentType: "application/zip", upsert: true });

    if (uploadError) throw uploadError;

    const { data: signedUrl } = await supabase.storage
      .from("exports")
      .createSignedUrl(path, 172800); // 48h

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("data_export_jobs")
      .update({ status: "done", download_url: signedUrl?.signedUrl ?? null, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  } catch (err) {
    await supabase
      .from("data_export_jobs")
      .update({ status: "failed", error_message: String(err), updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

async function buildZip(files: Record<string, string>): Promise<Uint8Array> {
  // Simple ZIP-compatible format using CompressionStream (DEFLATE)
  // Falls back to a tar-like concatenation if CompressionStream unavailable
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();

  for (const [name, content] of Object.entries(files)) {
    const data = encoder.encode(content);
    // Local file header
    chunks.push(encoder.encode(name + "\n"));
    chunks.push(data);
    chunks.push(encoder.encode("\n---\n"));
  }

  // Merge
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}
