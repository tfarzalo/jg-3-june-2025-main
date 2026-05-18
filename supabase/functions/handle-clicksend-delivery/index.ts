import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * handle-clicksend-delivery Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Webhook endpoint for ClickSend Delivery Receipts.
 *
 * Configure in ClickSend Dashboard (Developers → Webhooks → SMS Delivery Receipts):
 *   https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/handle-clicksend-delivery
 *
 * ClickSend sends an application/x-www-form-urlencoded POST for each status change:
 *   message_id, status, to, from, custom_string, timestamp, etc.
 *
 * Handled statuses:
 *   Sent         → update provider_status, last_status_at
 *   Delivered    → update provider_status, delivered_at, last_status_at
 *   Failed       → update provider_status, failed_at, last_status_at, error_message
 *   Undelivered  → update provider_status, failed_at, last_status_at, error_message
 *
 * Security:
 *   - Only accepts POST from ClickSend's callback format
 *   - Never logs raw phone numbers
 *
 * Response: Always 200 OK (ClickSend retries on non-2xx).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

/** ClickSend statuses that represent a final non-delivered outcome */
const FAILED_STATUSES = new Set(["Failed", "Undelivered"]);
/** ClickSend statuses that are terminal (no more callbacks expected) */
const TERMINAL_STATUSES = new Set(["Delivered", "Failed", "Undelivered"]);

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

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    console.warn("[clicksend-delivery] ⚠️  Non-POST request received");
    return err("Method not allowed", 405);
  }

  console.log("[clicksend-delivery] === WEBHOOK RECEIVED ===", new Date().toISOString());

  // ── Parse form-encoded body ──────────────────────────────────────────────────
  let formData: URLSearchParams;
  try {
    const body = await req.text();
    formData = new URLSearchParams(body);
  } catch (parseErr) {
    console.error("[clicksend-delivery] ❌ Failed to parse form body:", parseErr);
    return ok("body parse failed (non-fatal)");
  }

  // ── Extract ClickSend callback fields ────────────────────────────────────────
  const messageId     = formData.get("message_id");
  const status        = formData.get("status");
  const customString  = formData.get("custom_string"); // Contains log_id or event_type
  const errorCode     = formData.get("error_code");
  const errorMessage  = formData.get("error_text");
  const timestamp     = formData.get("timestamp");

  if (!messageId || !status) {
    console.warn("[clicksend-delivery] ⚠️  Missing message_id or status in callback");
    return ok("missing required fields (non-fatal)");
  }

  console.log(
    `[clicksend-delivery] 📬 message_id=${messageId} | status=${status} | custom=${customString ?? "-"}`
  );

  // ── Supabase client ──────────────────────────────────────────────────────────
  const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Find the log row(s) matching this message_id ─────────────────────────────
  const { data: logs, error: fetchErr } = await supabase
    .from("sms_notification_logs")
    .select("id, status, phone_last4, event_type")
    .eq("provider_message_sid", messageId);

  if (fetchErr) {
    console.error("[clicksend-delivery] ❌ DB query failed:", fetchErr.message);
    return ok("db error (non-fatal)");
  }

  if (!logs || logs.length === 0) {
    // ClickSend may fire callbacks before our send-sms log write completes.
    // That's okay — the initial status from send-sms response is already correct;
    // is eventually written (send-sms already reads ClickSend's initial status).
    console.warn(`[clicksend-delivery] ⚠️  No log found for message_id=${messageId}`);
    return ok("no matching log (non-fatal)");
  }

  const logRow = logs[0];
  console.log(
    `[clicksend-delivery] 📝 Found log | id=${logRow.id} | event=${logRow.event_type} | phone=****${logRow.phone_last4}`
  );

  // ── Skip if already terminal ─────────────────────────────────────────────────
  if (TERMINAL_STATUSES.has(logRow.status)) {
    console.log(`[clicksend-delivery] ⏭️  Already terminal (${logRow.status}), skipping update`);
    return ok("already terminal");
  }

  // ── Build update payload ─────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const isFailed = FAILED_STATUSES.has(status);

  // Build metadata updates
  const existingMetadata = (logRow as any).metadata || {};
  const newMetadata = {
    ...existingMetadata,
    clicksend_status: status,
    last_status_at: now,
  };

  if (timestamp) {
    newMetadata.clicksend_timestamp = timestamp;
  }
  if (errorCode) {
    newMetadata.clicksend_error_code = errorCode;
  }

  const updates: Record<string, any> = {
    provider_status: status,
    last_status_at: now,
    metadata: newMetadata,
  };

  // Set delivered_at or failed_at based on status
  if (status === "Delivered") {
    updates.delivered_at = now;
  } else if (isFailed) {
    updates.failed_at = now;
    if (errorMessage) {
      updates.error_message = `ClickSend: ${errorMessage}`;
    }
  }

  // ── Update the log row ───────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("sms_notification_logs")
    .update(updates)
    .eq("id", logRow.id);

  if (updateErr) {
    console.error("[clicksend-delivery] ❌ Update failed:", updateErr.message);
    return ok("update failed (non-fatal)");
  }

  console.log(
    `[clicksend-delivery] ✅ Updated | log_id=${logRow.id} | status=${status} | terminal=${TERMINAL_STATUSES.has(status)}`
  );

  return ok("processed");
});
