import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * handle-twilio-status Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Webhook endpoint for Twilio Status Callbacks.
 *
 * Configure in Twilio Console (Messaging → Active Numbers → Status Callback URL):
 *   https://<project-ref>.supabase.co/functions/v1/handle-twilio-status
 *
 * Or pass it on the message create call:
 *   StatusCallback=https://...functions/v1/handle-twilio-status
 *
 * Twilio sends an application/x-www-form-urlencoded POST for each status change:
 *   MessageSid, MessageStatus, To, From, ErrorCode, ErrorMessage
 *
 * Handled statuses:
 *   queued       → update provider_status, last_status_at
 *   sent         → update provider_status, last_status_at
 *   delivered    → update provider_status, delivered_at, last_status_at
 *   failed       → update provider_status, failed_at, last_status_at, error_message
 *   undelivered  → update provider_status, failed_at, last_status_at, error_message
 *
 * Security:
 *   - Validates X-Twilio-Signature using TWILIO_AUTH_TOKEN (when configured)
 *   - Only accepts POST from Twilio's callback format
 *   - Never logs raw phone numbers
 *
 * Response: Always 200 OK (Twilio retries on non-2xx).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-twilio-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

/** Twilio statuses that represent a final non-delivered outcome */
const FAILED_STATUSES = new Set(["failed", "undelivered"]);
/** Twilio statuses that are terminal (no more callbacks expected) */
const TERMINAL_STATUSES = new Set(["delivered", "failed", "undelivered"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(message = "ok"): Response {
  return new Response(JSON.stringify({ success: true, message }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * Validate the X-Twilio-Signature header.
 * Returns true when validation passes or when TWILIO_AUTH_TOKEN is not configured
 * (allowing the function to be deployed without the secret while still functional).
 *
 * Twilio signature algorithm:
 *   1. Concatenate the full request URL + sorted POST params as key=value pairs
 *   2. Sign with HMAC-SHA1 using the auth token
 *   3. Base64-encode the result
 *   4. Compare with X-Twilio-Signature header
 */
async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  try {
    // Build the string to sign: URL + sorted key=value pairs concatenated
    const sortedKeys  = Object.keys(params).sort();
    const paramString = sortedKeys.map((k) => `${k}${params[k]}`).join("");
    const signingStr  = url + paramString;

    const enc     = new TextEncoder();
    const keyData = enc.encode(authToken);
    const msgData = enc.encode(signingStr);

    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const sigBuffer  = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computed   = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    return computed === signature;
  } catch (e) {
    console.warn("[twilio-status] ⚠️  Signature validation threw:", e instanceof Error ? e.message : String(e));
    return false;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  // Twilio always sends POST. Return 200 on GET/HEAD to let health checks pass.
  if (req.method !== "POST") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  console.log("[twilio-status] === INVOKED ===", new Date().toISOString());

  const TWILIO_AUTH_TOKEN    = Deno.env.get("TWILIO_AUTH_TOKEN");
  const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[twilio-status] ❌ Missing Supabase env vars");
    return ok("configuration error — logged"); // still 200 so Twilio won't retry
  }

  // ── Parse form body ──────────────────────────────────────────────────────────
  let params: Record<string, string> = {};
  try {
    const text       = await req.text();
    const urlParams  = new URLSearchParams(text);
    for (const [k, v] of urlParams.entries()) {
      params[k] = v;
    }
  } catch (parseErr) {
    console.error("[twilio-status] ❌ Failed to parse body:", parseErr);
    return ok("parse error — logged");
  }

  const messageSid    = params["MessageSid"]    ?? "";
  const messageStatus = params["MessageStatus"] ?? "";
  const errorCode     = params["ErrorCode"]     ?? null;
  const errorMessage  = params["ErrorMessage"]  ?? null;
  const toNumber      = params["To"]            ?? "";

  if (!messageSid || !messageStatus) {
    console.warn("[twilio-status] ⚠️  Missing MessageSid or MessageStatus — ignoring");
    return ok("missing required fields");
  }

  const phoneLast4 = toNumber.slice(-4);
  console.log(
    `[twilio-status] 📡 sid=${messageSid} | status=${messageStatus} | to=****${phoneLast4} | err=${errorCode ?? "-"}`
  );

  // ── Optional: validate Twilio signature ──────────────────────────────────────
  if (TWILIO_AUTH_TOKEN) {
    const signature = req.headers.get("X-Twilio-Signature") ?? "";
    const requestUrl = req.url;

    if (!signature) {
      console.warn("[twilio-status] ⚠️  Missing X-Twilio-Signature — rejecting");
      return err("Missing signature", 403);
    }

    const valid = await validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, requestUrl, params);
    if (!valid) {
      console.warn("[twilio-status] ⚠️  Invalid Twilio signature — rejecting");
      return err("Invalid signature", 403);
    }
  } else {
    console.warn("[twilio-status] ⚠️  TWILIO_AUTH_TOKEN not set — skipping signature validation");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Look up the log row by provider_message_sid ───────────────────────────────
  const { data: logRow, error: lookupErr } = await supabase
    .from("sms_notification_logs")
    .select("id, status, provider_status, queue_id")
    .eq("provider_message_sid", messageSid)
    .maybeSingle();

  if (lookupErr) {
    console.error("[twilio-status] ❌ Log lookup failed:", lookupErr.message);
    return ok("db lookup error — logged");
  }

  if (!logRow) {
    // Twilio may fire callbacks before our send-sms log write completes.
    // This is safe to ignore — the status will be reflected when the row
    // is eventually written (send-sms already reads Twilio's initial status).
    console.warn(`[twilio-status] ⚠️  No log row found for sid=${messageSid} — may arrive before initial write`);
    return ok("log row not found — may be in transit");
  }

  const now = new Date().toISOString();

  // ── Build the update payload ──────────────────────────────────────────────────
  const update: Record<string, unknown> = {
    provider_status: messageStatus,
    last_status_at:  now,
  };

  if (messageStatus === "delivered") {
    update.delivered_at = now;
    // Upgrade status from 'sent' to 'sent' (we don't add 'delivered' to the
    // status CHECK constraint — delivered_at column captures this cleanly).
    console.log(`[twilio-status] ✅ Delivered | sid=${messageSid} | log_id=${logRow.id}`);
  }

  if (FAILED_STATUSES.has(messageStatus)) {
    update.failed_at      = now;
    update.error_message  = errorMessage
      ? `Twilio ${messageStatus}: [${errorCode ?? "?"}] ${errorMessage}`.substring(0, 500)
      : `Twilio reported ${messageStatus}`;

    // Also update the queue row to failed if it's not already settled
    if (logRow.queue_id) {
      try {
        await supabase
          .from("sms_notification_queue")
          .update({
            status:        "failed",
            error_message: String(update.error_message).substring(0, 500),
          })
          .eq("id", logRow.queue_id)
          .neq("status", "failed"); // idempotent guard
      } catch (qErr) {
        console.warn("[twilio-status] ⚠️  Queue row update threw:", qErr instanceof Error ? qErr.message : String(qErr));
      }
    }

    console.error(
      `[twilio-status] ❌ ${messageStatus.toUpperCase()} | sid=${messageSid} | code=${errorCode ?? "-"} | log_id=${logRow.id}`
    );
  }

  // ── Apply update to sms_notification_logs ────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("sms_notification_logs")
    .update(update)
    .eq("id", logRow.id);

  if (updateErr) {
    console.error("[twilio-status] ❌ Log update failed:", updateErr.message);
    return ok("db update error — logged");
  }

  const isTerminal = TERMINAL_STATUSES.has(messageStatus);
  console.log(
    `[twilio-status] 📝 Updated log | id=${logRow.id} | status=${messageStatus} | terminal=${isTerminal}`
  );

  return ok(`status ${messageStatus} recorded`);
});
