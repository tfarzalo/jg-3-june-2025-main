import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * process-sms-queue Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Batch queue processor for sms_notification_queue.
 * Called periodically by a pg_cron job (every minute recommended).
 *
 * Behaviour:
 *   1. Fetch up to BATCH_SIZE rows where status IN ('pending','processing')
 *      AND next_attempt_at <= now()
 *   2. Mark each row status='processing' (optimistic lock)
 *   3. Call send-sms for each row
 *   4. On success: status='sent', write log row to sms_notification_logs
 *   5. On failure:
 *      - retry_count < max_retries → schedule retry with backoff, status='pending'
 *      - retry_count >= max_retries → status='failed', write failure log
 *
 * Retry schedule (backoff):
 *   retry 1 → +1 minute
 *   retry 2 → +5 minutes
 *   retry 3 → +15 minutes
 *   > max_retries → permanent failure
 *
 * Safety:
 *   - CRON_SECRET header check prevents unsolicited calls
 *   - BATCH_SIZE caps concurrent Twilio calls per run
 *   - Processing rows older than MAX_PROCESSING_AGE_MINUTES are automatically
 *     reclaimed (handles worker crashes)
 *
 * Request: POST with Authorization: Bearer <CRON_SECRET>
 *   Body (optional): { dry_run?: boolean, batch_size?: number }
 *
 * Response:
 * {
 *   success: boolean
 *   processed: number
 *   sent: number
 *   failed: number
 *   retried: number
 *   duration_ms: number
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

const DEFAULT_BATCH_SIZE           = 30;
const MAX_BATCH_SIZE               = 50;
const MAX_PROCESSING_AGE_MINUTES   = 5;   // reclaim stale processing rows

/** Retry delay schedule: index = retry_count (0-based attempt number that failed) */
const RETRY_DELAYS_SECONDS = [60, 300, 900]; // 1m, 5m, 15m

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueRow {
  id:                   string;
  event_type:           string;
  user_id:              string | null;
  phone_number:         string;
  message_body:         string;
  status:               string;
  retry_count:          number;
  max_retries:          number;
  next_attempt_at:      string;
  job_id:               string | null;
  work_order_id:        string | null;
  conversation_id:      string | null;
  metadata:             Record<string, unknown>;
  provider_message_sid: string | null;
  error_message:        string | null;
  log_id:               string | null;
  created_at:           string;
}

interface SendSmsResponse {
  success:              boolean;
  provider_message_sid?: string;
  provider_status?:      string;
  log_id?:               string;
  simulated?:            boolean;
  error?:                string;
}

interface ProcessResult {
  success:      boolean;
  processed:    number;
  sent:         number;
  failed:       number;
  retried:      number;
  duration_ms:  number;
  error?:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(data: ProcessResult | { success: false; error: string }, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function nextAttemptAt(retryCount: number): string {
  const delaySec = RETRY_DELAYS_SECONDS[retryCount] ?? RETRY_DELAYS_SECONDS[RETRY_DELAYS_SECONDS.length - 1];
  return new Date(Date.now() + delaySec * 1000).toISOString();
}

/**
 * Write a final log row to sms_notification_logs for a queue-sourced send.
 * Silently absorbs failures — log errors must never block processing.
 */
async function writeQueueLog(
  supabase: ReturnType<typeof createClient>,
  params: {
    event_type:           string;
    user_id:              string | null;
    phone_last4:          string;
    message_body:         string;
    status:               "sent" | "failed";
    provider_message_sid?: string | null;
    provider_status?:      string | null;
    error_message?:        string | null;
    queue_id:              string;
    metadata?:             Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("sms_notification_logs")
      .insert({
        event_type:           params.event_type,
        user_id:              params.user_id              ?? null,
        phone_last4:          params.phone_last4,
        message_body:         params.message_body,
        status:               params.status,
        provider_message_sid: params.provider_message_sid ?? null,
        provider_status:      params.provider_status      ?? null,
        error_message:        params.error_message        ?? null,
        queue_id:             params.queue_id,
        metadata:             {
          ...(params.metadata ?? {}),
          processed_at: new Date().toISOString(),
          source: "process-sms-queue",
        },
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[process-sms-queue] ⚠️  Log insert failed:", error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.warn("[process-sms-queue] ⚠️  Log insert threw:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST")
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  const startMs = Date.now();
  console.log("[process-sms-queue] === INVOKED ===", new Date().toISOString());

  // ── Secrets ──────────────────────────────────────────────────────────────────
  const CRON_SECRET          = Deno.env.get("CRON_SECRET");
  const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ success: false, error: "Server configuration error" }, 500);
  }

  // ── Auth: CRON_SECRET check ──────────────────────────────────────────────────
  if (CRON_SECRET) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error("[process-sms-queue] ❌ Unauthorized — bad or missing CRON_SECRET");
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }
  }

  // ── Parse optional body ──────────────────────────────────────────────────────
  let dry_run    = false;
  let batchSize  = DEFAULT_BATCH_SIZE;

  try {
    const body = await req.json().catch(() => ({}));
    dry_run   = body.dry_run   === true;
    batchSize = Math.min(
      typeof body.batch_size === "number" ? body.batch_size : DEFAULT_BATCH_SIZE,
      MAX_BATCH_SIZE
    );
  } catch {
    /* ignore — use defaults */
  }

  if (dry_run) {
    console.log("[process-sms-queue] 🧪 DRY RUN mode — no sends or updates");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Reclaim stale processing rows (worker crash recovery) ─────────────────────
  // Any row stuck in 'processing' longer than MAX_PROCESSING_AGE_MINUTES
  // is reset to 'pending' so it can be retried.
  try {
    const staleThreshold = new Date(
      Date.now() - MAX_PROCESSING_AGE_MINUTES * 60 * 1000
    ).toISOString();

    const { count: reclaimedCount, error: reclaimErr } = await supabase
      .from("sms_notification_queue")
      .update({ status: "pending", next_attempt_at: new Date().toISOString() })
      .eq("status", "processing")
      .lt("updated_at", staleThreshold)
      .select("id", { count: "exact", head: true });

    if (!reclaimErr && reclaimedCount && reclaimedCount > 0) {
      console.log(`[process-sms-queue] ♻️  Reclaimed ${reclaimedCount} stale processing rows`);
    }
  } catch (reclaimEx) {
    console.warn("[process-sms-queue] ⚠️  Stale reclaim threw:", reclaimEx instanceof Error ? reclaimEx.message : String(reclaimEx));
  }

  // ── Fetch eligible rows ──────────────────────────────────────────────────────
  const { data: rows, error: fetchErr } = await supabase
    .from("sms_notification_queue")
    .select("*")
    .in("status", ["pending"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    console.error("[process-sms-queue] ❌ Queue fetch failed:", fetchErr.message);
    return jsonResponse({ success: false, error: `Queue fetch failed: ${fetchErr.message}` }, 500);
  }

  const queueRows = (rows ?? []) as QueueRow[];
  console.log(`[process-sms-queue] 📋 Fetched ${queueRows.length} rows to process (batch_size=${batchSize})`);

  if (queueRows.length === 0) {
    console.log("[process-sms-queue] ℹ️  Nothing to process.");
    return jsonResponse({ success: true, processed: 0, sent: 0, failed: 0, retried: 0, duration_ms: Date.now() - startMs });
  }

  // ── Lock all fetched rows to 'processing' ────────────────────────────────────
  const rowIds = queueRows.map((r) => r.id);

  if (!dry_run) {
    const { error: lockErr } = await supabase
      .from("sms_notification_queue")
      .update({ status: "processing" })
      .in("id", rowIds)
      .eq("status", "pending");   // guard: only update rows still in pending

    if (lockErr) {
      console.error("[process-sms-queue] ❌ Lock update failed:", lockErr.message);
      // Don't abort — we'll proceed and each row's update will handle conflicts
    }
  }

  // ── Process each row ─────────────────────────────────────────────────────────
  let sent    = 0;
  let failed  = 0;
  let retried = 0;

  for (const row of queueRows) {
    const phoneLast4 = row.phone_number.slice(-4);
    console.log(
      `[process-sms-queue] 📤 Processing | id=${row.id} | event=${row.event_type} | to=****${phoneLast4} | retry=${row.retry_count}`
    );

    if (dry_run) {
      console.log(`[process-sms-queue] 🧪 DRY RUN skip | id=${row.id}`);
      sent++;
      continue;
    }

    // ── Invoke send-sms ────────────────────────────────────────────────────────
    let sendResult: SendSmsResponse = { success: false, error: "Not attempted" };

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "apikey":        SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({
          to:                row.phone_number,
          body:              row.message_body,
          recipient_user_id: row.user_id ?? undefined,
          event_type:        row.event_type,
          dry_run:           false,
          metadata: {
            ...row.metadata,
            queue_id:        row.id,
            retry_count:     row.retry_count,
            job_id:          row.job_id          ?? null,
            work_order_id:   row.work_order_id   ?? null,
            conversation_id: row.conversation_id ?? null,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        sendResult = { success: false, error: `send-sms HTTP ${res.status}: ${errText.substring(0, 200)}` };
      } else {
        sendResult = (await res.json()) as SendSmsResponse;
      }
    } catch (fetchEx: unknown) {
      sendResult = {
        success: false,
        error: `Network error calling send-sms: ${fetchEx instanceof Error ? fetchEx.message : String(fetchEx)}`,
      };
    }

    // ── Handle result ──────────────────────────────────────────────────────────
    if (sendResult.success) {
      // ── SUCCESS ────────────────────────────────────────────────────────────
      const logId = await writeQueueLog(supabase, {
        event_type:           row.event_type,
        user_id:              row.user_id,
        phone_last4:          phoneLast4,
        message_body:         row.message_body,
        status:               "sent",
        provider_message_sid: sendResult.provider_message_sid ?? null,
        provider_status:      sendResult.provider_status      ?? null,
        queue_id:             row.id,
        metadata:             row.metadata,
      });

      await supabase
        .from("sms_notification_queue")
        .update({
          status:               "sent",
          provider_message_sid: sendResult.provider_message_sid ?? null,
          log_id:               logId ?? null,
        })
        .eq("id", row.id);

      sent++;
      console.log(
        `[process-sms-queue] ✅ Sent | id=${row.id} | sid=${sendResult.provider_message_sid ?? "-"} | log_id=${logId ?? "-"}`
      );
    } else {
      // ── FAILURE ────────────────────────────────────────────────────────────
      const newRetryCount = row.retry_count + 1;
      const isExhausted   = newRetryCount >= row.max_retries;
      const errorMsg      = sendResult.error ?? "Unknown send-sms error";

      if (isExhausted) {
        // Permanent failure
        const logId = await writeQueueLog(supabase, {
          event_type:    row.event_type,
          user_id:       row.user_id,
          phone_last4:   phoneLast4,
          message_body:  row.message_body,
          status:        "failed",
          error_message: errorMsg,
          queue_id:      row.id,
          metadata:      row.metadata,
        });

        await supabase
          .from("sms_notification_queue")
          .update({
            status:        "failed",
            retry_count:   newRetryCount,
            error_message: errorMsg.substring(0, 500),
            log_id:        logId ?? null,
          })
          .eq("id", row.id);

        failed++;
        console.error(
          `[process-sms-queue] ❌ Failed permanently | id=${row.id} | retries=${newRetryCount} | error=${errorMsg.substring(0, 100)}`
        );
      } else {
        // Schedule retry
        const retryAt = nextAttemptAt(row.retry_count);

        await supabase
          .from("sms_notification_queue")
          .update({
            status:         "pending",
            retry_count:    newRetryCount,
            next_attempt_at: retryAt,
            error_message:  errorMsg.substring(0, 500),
          })
          .eq("id", row.id);

        retried++;
        console.warn(
          `[process-sms-queue] 🔁 Retry scheduled | id=${row.id} | attempt=${newRetryCount}/${row.max_retries} | next=${retryAt} | error=${errorMsg.substring(0, 80)}`
        );
      }
    }
  }

  const durationMs = Date.now() - startMs;
  console.log(
    `[process-sms-queue] 📊 Done | sent=${sent} | failed=${failed} | retried=${retried} | duration=${durationMs}ms`
  );

  return jsonResponse({
    success:    true,
    processed:  queueRows.length,
    sent,
    failed,
    retried,
    duration_ms: durationMs,
  });
});
