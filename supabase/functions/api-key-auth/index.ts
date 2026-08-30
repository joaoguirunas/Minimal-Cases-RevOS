import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/response.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, valid: false, error: "Missing X-API-Key header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // SHA-256 the incoming key, compare against stored hash
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: row, error } = await supabase
    .from("tenant_api_keys")
    .select("id, tenant_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !row) {
    return new Response(
      JSON.stringify({ ok: true, valid: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (row.revoked_at !== null) {
    return new Response(
      JSON.stringify({ ok: true, valid: false, error: "Key revoked" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from("tenant_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => {});

  return new Response(
    JSON.stringify({ ok: true, valid: true, tenant_id: row.tenant_id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
