import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RecipientType = "profile" | "property_contact" | "property_system_contact";
type RequestBody = { recipientType?: RecipientType; recipientId?: string; recipientKey?: string };

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
};

const generateToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function resolveRecipient(admin: ReturnType<typeof createClient>, body: RequestBody) {
  const id = body.recipientId || "";
  if (!id) throw new Error("Recipient is required.");

  if (body.recipientType === "profile") {
    const { data, error } = await admin.from("profiles")
      .select("id,email,full_name,archived_at").eq("id", id).single();
    if (error || !data) throw new Error("Recipient was not found.");
    if (data.archived_at) throw new Error("Archived users cannot receive an initial email.");
    return { name: data.full_name || data.email, email: data.email, key: null };
  }

  if (body.recipientType === "property_contact") {
    const { data, error } = await admin.from("property_contacts")
      .select("id,name,email,secondary_email").eq("id", id).single();
    if (error || !data) throw new Error("Recipient was not found.");
    const key = body.recipientKey === "secondary" ? "secondary" : "primary";
    const email = key === "secondary" ? data.secondary_email : data.email;
    return { name: data.name || email, email, key };
  }

  if (body.recipientType === "property_system_contact") {
    const fields: Record<string, { name: string; primary: string; secondary: string }> = {
      community_manager: { name: "community_manager_name", primary: "community_manager_email", secondary: "community_manager_secondary_email" },
      maintenance_supervisor: { name: "maintenance_supervisor_name", primary: "maintenance_supervisor_email", secondary: "maintenance_supervisor_secondary_email" },
      primary_contact: { name: "primary_contact_name", primary: "primary_contact_email", secondary: "primary_contact_secondary_email" },
      ap: { name: "ap_name", primary: "ap_email", secondary: "ap_secondary_email" },
    };
    const [slot, addressKind = "primary"] = (body.recipientKey || "").split(":");
    const field = fields[slot];
    if (!field) throw new Error("Recipient source is invalid.");
    if (addressKind !== "primary" && addressKind !== "secondary") throw new Error("Recipient source is invalid.");
    const { data, error } = await admin.from("properties").select(
      "id,community_manager_name,community_manager_email,community_manager_secondary_email,maintenance_supervisor_name,maintenance_supervisor_email,maintenance_supervisor_secondary_email,primary_contact_name,primary_contact_email,primary_contact_secondary_email,ap_name,ap_email,ap_secondary_email",
    ).eq("id", id).single();
    if (error || !data) throw new Error("Recipient was not found.");
    const emailField = addressKind === "secondary" ? field.secondary : field.primary;
    return {
      name: String((data as Record<string, unknown>)[field.name] || (data as Record<string, unknown>)[emailField] || "Recipient"),
      email: String((data as Record<string, unknown>)[emailField] || ""),
      key: `${slot}:${addressKind}`,
    };
  }

  throw new Error("Recipient type is invalid.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const portalBaseUrl = (Deno.env.get("PORTAL_BASE_URL") || "").replace(/\/$/, "");
  if (!supabaseUrl || !anonKey || !serviceKey || !portalBaseUrl) {
    return json({ error: "Email verification is not configured." }, 503);
  }

  try {
    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Authentication required." }, 401);

    const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
    if (!profile?.role || profile.role === "subcontractor") return json({ error: "You are not authorized to send this email." }, 403);

    const body = await req.json() as RequestBody;
    const recipient = await resolveRecipient(admin, body);
    const email = String(recipient.email || "").trim();
    if (!validEmail(email)) return json({ error: "This recipient does not have a valid email address." }, 400);

    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: prepared, error: prepareError } = await admin.rpc("prepare_recipient_email_verification", {
      p_email: email,
      p_recipient_type: body.recipientType,
      p_recipient_id: body.recipientId,
      p_recipient_key: recipient.key,
      p_recipient_name: recipient.name,
      p_token_hash: tokenHash,
      p_token_expires_at: expiresAt,
      p_initiated_by: authData.user.id,
      p_cooldown_seconds: 600,
    });
    if (prepareError) {
      if (prepareError.message.includes("sent recently")) return json({ error: prepareError.message }, 429);
      throw prepareError;
    }

    const attempt = prepared?.[0];
    if (!attempt?.attempt_id || !attempt?.verification_id) throw new Error("Unable to prepare verification email.");
    const verificationUrl = `${portalBaseUrl}/email-verification/${encodeURIComponent(token)}`;
    const firstName = (String(recipient.name || "there").replace(/[\r\n]/g, " ").trim().split(/\s+/)[0] || "there");
    const text = [
      `Hello ${firstName},`,
      "Please verify your email address by clicking the link below:",
      verificationUrl,
      "JG Painting Pros Inc. may send important notifications and updates to this email address.",
      "Please mark this message as Not Spam if it was filtered incorrectly. Where possible, add the sender to your Safe Senders list or email allowlist to help ensure inbox deliverability.",
      "JG Painting Pros Inc.",
    ].join("\n\n");

    const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject: "Verify your email address for JG Painting Pros",
        text,
        emailType: "recipient_email_verification",
        metadata: { verification_id: attempt.verification_id, verification_attempt_id: attempt.attempt_id },
      }),
    });
    const sendResult = await sendResponse.json().catch(() => ({}));
    if (!sendResponse.ok || !sendResult.success) {
      const failedAt = new Date().toISOString();
      await admin.from("recipient_email_verification_attempts").update({ status: "send_failed", delivery_error: "Email submission failed", updated_at: failedAt }).eq("id", attempt.attempt_id);
      await admin.from("recipient_email_verifications").update({ status: "delivery_problem", last_delivery_error: "Email submission failed", updated_at: failedAt }).eq("id", attempt.verification_id);
      return json({ error: "The initial email could not be sent. Please try again later." }, 502);
    }

    const sentAt = new Date().toISOString();
    await admin.from("recipient_email_verification_attempts").update({
      status: "sent", sent_at: sentAt, outbound_email_send_id: sendResult.auditId || null,
      provider_message_id: sendResult.messageId || null, updated_at: sentAt,
    }).eq("id", attempt.attempt_id);
    await admin.from("recipient_email_verifications").update({
      status: "verification_sent", verification_sent_at: sentAt,
      last_outbound_email_send_id: sendResult.auditId || null,
      last_provider_message_id: sendResult.messageId || null,
      last_delivery_error: null, updated_at: sentAt,
    }).eq("id", attempt.verification_id);

    return json({ success: true, email, status: "verification_sent" });
  } catch (error) {
    console.error("Initial email send failed", error);
    return json({ error: "The initial email could not be sent. Please try again later." }, 500);
  }
});
