import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ state: "invalid" }, 405);
  try {
    const { token } = await req.json() as { token?: string };
    if (!token || token.length < 32 || token.length > 200) return json({ state: "invalid" }, 400);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !key) throw new Error("Missing server configuration");
    const admin = createClient(url, key);
    const tokenHash = await hashToken(token);
    const { data: attempt } = await admin.from("recipient_email_verification_attempts")
      .select("id,verification_id,status,token_expires_at,verified_at")
      .eq("token_hash", tokenHash).maybeSingle();
    if (!attempt) return json({ state: "invalid" }, 404);
    if (attempt.status === "verified" || attempt.verified_at) return json({ state: "already_verified" });
    if (new Date(attempt.token_expires_at).getTime() <= Date.now()) {
      await admin.from("recipient_email_verification_attempts").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", attempt.id).in("status", ["prepared", "sent"]);
      return json({ state: "expired" }, 410);
    }
    if (attempt.status !== "sent") return json({ state: "invalid" }, 400);

    const now = new Date().toISOString();
    const { data: claimed } = await admin.from("recipient_email_verification_attempts")
      .update({ status: "verified", verified_at: now, updated_at: now })
      .eq("id", attempt.id).eq("status", "sent").select("id").maybeSingle();
    if (!claimed) {
      const { data: current } = await admin.from("recipient_email_verification_attempts").select("status").eq("id", attempt.id).single();
      return json({ state: current?.status === "verified" ? "already_verified" : "invalid" });
    }
    await admin.from("recipient_email_verifications").update({
      status: "verified", verified_at: now, last_delivery_error: null, updated_at: now,
    }).eq("id", attempt.verification_id);
    return json({ state: "verified" });
  } catch (error) {
    console.error("Recipient verification failed", error);
    return json({ state: "invalid" }, 500);
  }
});
