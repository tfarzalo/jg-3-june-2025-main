import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * send-sms Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends a single outbound SMS via Twilio.
 *
 * LOW-LEVEL primitive — called by dispatch-sms-notification (and future tools).
 * Never reads phone numbers from untrusted client input.
 *
 * Secrets (Supabase Edge Function secrets — NEVER logged):
 *   TWILIO_ACCOUNT_SID   — Twilio Account SID
 *   TWILIO_AUTH_TOKEN    — Twilio Auth Token
 *   TWILIO_PHONE_NUMBER  — Twilio sender number (E.164 format)
 *
 * Request body:
 * {
 *   to:                   string   — E.164 destination (+1XXXXXXXXXX)
 *   body:                 string   — message text
 *   recipient_user_id?:   string   — profiles.id for audit log
 *   event_type?:          string   — event key (defaults "direct")
 *   metadata?:            object   — safe context for log row
 *   dry_run?:             boolean  — if true, skip Twilio, log as "simulated"
 * }
 *
 * Response body:
 * {
 *   success:                boolean
 *   provider_message_sid?:  string
 *   provider_status?:       string
 *   error?:                 string
 *   log_id?:                string
 *   simulated?:             boolean  — present and true when dry_run=true
 * }
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

/** E.164 U.S. phone — matches profiles.sms_phone CHECK constraint exactly */
const E164_US_REGEX = /^\+1[0-9]{10}$/;

/** Twilio hard limit is 1600 chars */
const MAX_BODY_LENGTH = 1600;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendSmsRequest {
  to: string;
  body: string;
  recipient_user_id?: string;
  event_type?: string;
  metadata?: Record<string, unknown>;
  dry_run?: boolean;
  /** Optional: back-reference to sms_notification_queue.id when called from queue processor */
  queue_id?: string;
}

interface SendSmsResponse {
  success: boolean;
  provider_message_sid?: string;
  provider_status?: string;
  error?: string;
  log_id?: string;
  simulated?: boolean;
}

/** Partial Twilio REST API response */
interface TwilioMessageResponse {
  sid: string;
  status: string;
  error_code: number | null;
  error_message: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(data: SendSmsResponse, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/** Returns last 4 digits of a phone number for safe logging */
function maskPhone(phone: string): string {
  return phone.slice(-4);
}

/**
 * Insert a row into sms_notification_logs.
 * Silently absorbs failures — log errors must never block SMS delivery.
 */
async function writeLog(
  supabase: ReturnType<typeof createClient>,
  params: {
    event_type: string;
    user_id?: string | null;
    phone_last4: string;
    message_body: string;
    status: "queued" | "sent" | "failed" | "skipped" | "simulated";
    provider_message_sid?: string | null;
    provider_status?: string | null;
    error_message?: string | null;
    skip_reason?: string | null;
    queue_id?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("sms_notification_logs")
      .insert({
        event_type:           params.event_type,
        user_id:              params.user_id ?? null,
        phone_last4:          params.phone_last4,
        message_body:         params.message_body,
        status:               params.status,
        provider_message_sid: params.provider_message_sid ?? null,
        provider_status:      params.provider_status      ?? null,
        error_message:        params.error_message        ?? null,
        skip_reason:          params.skip_reason          ?? null,
        queue_id:             params.queue_id             ?? null,
        metadata:             params.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("[send-sms] ⚠️  Log insert failed:", error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (e: unknown) {
    console.error("[send-sms] ⚠️  Log insert threw:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  console.log("[send-sms] === INVOKED ===", new Date().toISOString());

  // ── Secrets ─────────────────────────────────────────────────────────────────
  const TWILIO_ACCOUNT_SID   = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN    = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_PHONE_NUMBER  = Deno.env.get("TWILIO_PHONE_NUMBER");
  const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const missingSecrets = [
    !TWILIO_ACCOUNT_SID  && "TWILIO_ACCOUNT_SID",
    !TWILIO_AUTH_TOKEN   && "TWILIO_AUTH_TOKEN",
    !TWILIO_PHONE_NUMBER && "TWILIO_PHONE_NUMBER",
  ].filter(Boolean) as string[];

  if (missingSecrets.length > 0) {
    console.error("[send-sms] ❌ Missing Twilio secrets:", missingSecrets.join(", "));
    return jsonResponse(
      { success: false, error: `Twilio not configured. Missing: ${missingSecrets.join(", ")}` },
      500
    );
  }

  if (!E164_US_REGEX.test(TWILIO_PHONE_NUMBER!)) {
    console.error("[send-sms] ❌ TWILIO_PHONE_NUMBER is not valid E.164 US format");
    return jsonResponse({ success: false, error: "Twilio sender number is misconfigured" }, 500);
  }

  // ── Parse & validate request ─────────────────────────────────────────────────
  let payload: SendSmsRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  const {
    to,
    body,
    recipient_user_id,
    event_type = "direct",
    metadata   = {},
    dry_run    = false,
    queue_id,
  } = payload;

  if (!to || typeof to !== "string")
    return jsonResponse({ success: false, error: "Missing required field: to" }, 400);
  if (!body || typeof body !== "string")
    return jsonResponse({ success: false, error: "Missing required field: body" }, 400);
  if (!E164_US_REGEX.test(to))
    return jsonResponse(
      { success: false, error: "Invalid destination phone. Must be E.164 US format (+1XXXXXXXXXX)." },
      400
    );
  if (body.length > MAX_BODY_LENGTH)
    return jsonResponse(
      { success: false, error: `Message body exceeds ${MAX_BODY_LENGTH} character limit.` },
      400
    );

  const toMasked = maskPhone(to);
  console.log(
    `[send-sms] 📤 event=${event_type} | to=****${toMasked} | len=${body.length} | dry_run=${dry_run}`
  );

  // ── Supabase client (logging only — secrets stay server-side) ──────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Dry-run: log as "simulated", skip Twilio ─────────────────────────────────
  if (dry_run) {
    const logId = await writeLog(supabase, {
      event_type,
      user_id:      recipient_user_id ?? null,
      phone_last4:  toMasked,
      message_body: body,
      status:       "simulated",
      skip_reason:  "dry_run=true — message was not sent to Twilio",
      queue_id:     queue_id ?? null,
      metadata:     { ...metadata, dry_run: true },
    });
    console.log(`[send-sms] 🧪 DRY RUN | log_id=${logId ?? "-"} | would have sent to ****${toMasked}`);
    return jsonResponse({ success: true, simulated: true, log_id: logId ?? undefined });
  }

  // ── Write "queued" entry before calling Twilio ──────────────────────────────
  // Guarantees a record exists even if the process crashes mid-flight.
  const queuedLogId = await writeLog(supabase, {
    event_type,
    user_id:      recipient_user_id ?? null,
    phone_last4:  toMasked,
    message_body: body,
    status:       "queued",
    queue_id:     queue_id ?? null,
    metadata:     { ...metadata, queued_at: new Date().toISOString() },
  });
  console.log(`[send-sms] 📝 Queued | log_id=${queuedLogId ?? "-"}`);

  // ── Call Twilio REST API ─────────────────────────────────────────────────────
  const twilioUrl  = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const basicAuth  = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`); // never logged
  const formBody   = new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER!, Body: body });

  let twilioData:    TwilioMessageResponse | null = null;
  let twilioStatus   = 0;
  let sendError:     string | null = null;

  try {
    const twilioRes = await fetch(twilioUrl, {
      method:  "POST",
      headers: {
        Authorization:  `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept:         "application/json",
      },
      body: formBody.toString(),
    });

    twilioStatus = twilioRes.status;
    const raw    = await twilioRes.json();

    if (!twilioRes.ok) {
      // Extract only safe fields — avoid logging any encoded credential fragments
      sendError = raw?.message
        ? `Twilio error ${raw.code ?? twilioStatus}: ${raw.message}`
        : `Twilio HTTP ${twilioStatus}`;
      console.error(
        `[send-sms] ❌ Twilio rejected | http=${twilioStatus} | code=${raw?.code ?? "-"} | to=****${toMasked}`
      );
    } else {
      twilioData = raw as TwilioMessageResponse;
      console.log(
        `[send-sms] ✅ Twilio accepted | sid=${twilioData.sid} | status=${twilioData.status} | to=****${toMasked}`
      );
    }
  } catch (fetchErr: unknown) {
    const msg  = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    sendError  = `Network error reaching Twilio: ${msg}`;
    console.error("[send-sms] ❌ Twilio fetch threw:", msg);
  }

  const success      = twilioData !== null && sendError === null;
  const finalStatus  = success ? "sent" : "failed";

  // ── Update queued row → final status ─────────────────────────────────────────
  if (queuedLogId) {
    try {
      const { error: updateErr } = await supabase
        .from("sms_notification_logs")
        .update({
          status:               finalStatus,
          provider_message_sid: twilioData?.sid    ?? null,
          provider_status:      twilioData?.status ?? null,
          error_message:        sendError          ?? null,
          metadata: {
            ...metadata,
            completed_at:  new Date().toISOString(),
            twilio_status: twilioData?.status ?? null,
          },
        })
        .eq("id", queuedLogId);

      if (updateErr) {
        console.error("[send-sms] ⚠️  Log update failed:", updateErr.message);
      } else {
        console.log(`[send-sms] 📝 Log finalised | log_id=${queuedLogId} | status=${finalStatus}`);
      }
    } catch (e: unknown) {
      console.error("[send-sms] ⚠️  Log update threw:", e instanceof Error ? e.message : String(e));
    }
  } else {
    // Queued row never wrote — insert a fallback final row so no send is unlogged
    const fallbackId = await writeLog(supabase, {
      event_type,
      user_id:             recipient_user_id ?? null,
      phone_last4:         toMasked,
      message_body:        body,
      status:              finalStatus,
      provider_message_sid: twilioData?.sid    ?? null,
      provider_status:      twilioData?.status ?? null,
      error_message:       sendError ?? null,
      queue_id:            queue_id ?? null,
      metadata: {
        ...metadata,
        completed_at:  new Date().toISOString(),
        twilio_status: twilioData?.status ?? null,
        note:          "queued row was not written; this is a fallback final row",
      },
    });
    console.log(`[send-sms] 📝 Fallback log written | log_id=${fallbackId ?? "-"}`);
  }

  // ── Respond ──────────────────────────────────────────────────────────────────
  if (success && twilioData) {
    return jsonResponse({
      success:              true,
      provider_message_sid: twilioData.sid,
      provider_status:      twilioData.status,
      log_id:               queuedLogId ?? undefined,
    });
  }

  return jsonResponse(
    {
      success: false,
      error:   sendError ?? "Unknown send failure",
      log_id:  queuedLogId ?? undefined,
    },
    500
  );
});
