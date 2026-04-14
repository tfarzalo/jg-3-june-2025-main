import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildSmsTemplateData,
  renderSmsTemplate,
  type RawJobContext,
  type RawWorkOrderContext,
  type SmsEventType,
} from "../_shared/smsTemplates.ts";

/**
 * dispatch-sms-notification Edge Function  (v2 — queue-backed)
 * ─────────────────────────────────────────────────────────────────────────────
 * Event-driven SMS dispatcher. Resolves eligible recipients, applies all safety
 * gates, renders a personalised message, then INSERTS into sms_notification_queue
 * (status=pending) for async delivery by process-sms-queue.
 *
 * No Twilio call is made here. That happens in process-sms-queue → send-sms.
 *
 * Request body:
 * {
 *   eventType:           string    — one of the five SMS event keys
 *   recipientUserId?:    string    — explicit single recipient
 *   recipient_user_ids?: string[]  — explicit list
 *   job_id?:             string
 *   work_order_id?:      string
 *   conversation_id?:    string
 *   sender_user_id?:     string
 *   context?:            object
 *   metadata?:           object
 *   dry_run?:            boolean   — simulate; logs as "simulated", no queue insert
 * }
 *
 * Response body:
 * {
 *   success:   boolean
 *   eventType: string
 *   attempted: number
 *   queued:    number
 *   skipped:   number
 *   results:   ResultEntry[]
 *   error?:    string
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

const VALID_EVENT_TYPES = [
  "job_assigned",
  "job_accepted",
  "work_order_submitted",
  "charges_approved",
  "chat_received",
] as const;

type EventType = (typeof VALID_EVENT_TYPES)[number];

const MAX_RECIPIENTS_PER_CALL = 50;
const DEDUP_WINDOW_SECONDS    = 60;

function parseAllowList(raw: string | undefined): Set<string> {
  if (!raw || raw.trim() === "") return new Set();
  return new Set(raw.split(",").map((n) => n.trim()).filter(Boolean));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DispatchRequest {
  eventType?: string;
  event_type?: string;
  recipientUserId?: string;
  recipient_user_ids?: string[];
  job_id?: string;
  work_order_id?: string;
  conversation_id?: string;
  sender_user_id?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  dry_run?: boolean;
}

interface ResultEntry {
  user_id:      string;
  status:       "queued" | "skipped" | "simulated" | "failed";
  phone_last4?: string;
  queue_id?:    string;
  log_id?:      string;
  skip_reason?: string;
  error?:       string;
}

interface DispatchResponse {
  success:   boolean;
  eventType: string;
  attempted: number;
  queued:    number;
  skipped:   number;
  results:   ResultEntry[];
  error?:    string;
}

interface Recipient {
  user_id:   string;
  full_name: string | null;
  sms_phone: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(
  data: DispatchResponse | { success: false, error: string },
  status = 200
): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function isValidEventType(v: string): v is EventType {
  return (VALID_EVENT_TYPES as readonly string[]).includes(v);
}

function eventToSettingColumn(e: EventType): string {
  const map: Record<EventType, string> = {
    job_assigned:         "notify_job_assigned",
    job_accepted:         "notify_job_accepted",
    work_order_submitted: "notify_work_order_submitted",
    charges_approved:     "notify_charges_approved",
    chat_received:        "notify_chat_received",
  };
  return map[e];
}

async function logSkip(
  supabase: ReturnType<typeof createClient>,
  params: {
    event_type:    string;
    user_id?:      string | null;
    phone_last4?:  string | null;
    skip_reason:   string;
    status:        "skipped" | "simulated";
    message_body?: string | null;
    queue_id?:     string | null;
    metadata?:     Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("sms_notification_logs")
      .insert({
        event_type:   params.event_type,
        user_id:      params.user_id   ?? null,
        phone_last4:  params.phone_last4 ?? null,
        message_body: params.message_body ?? null,
        status:       params.status,
        skip_reason:  params.skip_reason,
        queue_id:     params.queue_id  ?? null,
        metadata:     params.metadata  ?? {},
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[dispatch-sms] ⚠️  Skip log insert failed:", error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Context Fetchers ─────────────────────────────────────────────────────────

async function fetchJobContext(
  supabase: ReturnType<typeof createClient>,
  jobId: string
): Promise<RawJobContext> {
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      work_order_num, unit_number, scheduled_date, assignment_deadline, assigned_to,
      properties!inner ( property_name, address ),
      job_types ( job_type_label )
    `)
    .eq("id", jobId)
    .single();

  if (error || !data) {
    console.warn(`[dispatch-sms] ⚠️  Job context fetch failed for ${jobId}:`, error?.message);
    return {};
  }

  let assignedToName: string | null = null;
  if (data.assigned_to) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", data.assigned_to)
      .single();
    assignedToName = p?.full_name ?? null;
  }

  const props = data.properties as { property_name?: string; address?: string } | null;
  const jt    = data.job_types  as { job_type_label?: string } | null;

  return {
    work_order_num:      data.work_order_num      ?? null,
    unit_number:         data.unit_number         ?? null,
    property_name:       props?.property_name     ?? null,
    property_address:    props?.address           ?? null,
    job_type:            jt?.job_type_label       ?? null,
    scheduled_date:      data.scheduled_date      ?? null,
    assigned_to_name:    assignedToName,
    assignment_deadline: data.assignment_deadline ?? null,
  };
}

async function fetchWorkOrderContext(
  supabase: ReturnType<typeof createClient>,
  workOrderId: string
): Promise<RawWorkOrderContext> {
  const { data, error } = await supabase
    .from("work_orders")
    .select(`unit_number, bill_amount, jobs!inner ( work_order_num, properties!inner ( property_name ) )`)
    .eq("id", workOrderId)
    .single();

  if (error || !data) {
    console.warn(`[dispatch-sms] ⚠️  Work order context fetch failed for ${workOrderId}:`, error?.message);
    return {};
  }

  const job   = data.jobs   as { work_order_num?: number; properties?: { property_name?: string } } | null;
  const props = job?.properties as { property_name?: string } | null;

  return {
    work_order_num: job?.work_order_num  ?? null,
    unit_number:    data.unit_number     ?? null,
    property_name:  props?.property_name ?? null,
    bill_amount:    data.bill_amount     ?? null,
  };
}

async function fetchSenderName(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();
  return data?.full_name ?? null;
}

// ─── Recipient Resolution ─────────────────────────────────────────────────────

async function resolveEligibleRecipients(
  supabase: ReturnType<typeof createClient>,
  eventType: EventType,
  senderUserId: string | null | undefined,
  explicitUserIds?: string[]
): Promise<{ recipients: Recipient[]; skippedNoPhone: Array<{ user_id: string; reason: string }> }> {
  const settingColumn = eventToSettingColumn(eventType);

  let query = supabase
    .from("user_sms_notification_settings")
    .select(`user_id, sms_enabled, ${settingColumn}, profiles!inner ( id, full_name, sms_phone, sms_consent_given )`)
    .not("profiles.sms_phone", "is", null)
    .eq("profiles.sms_consent_given", true);

  if (explicitUserIds && explicitUserIds.length > 0) {
    query = query.in("user_id", explicitUserIds);
  } else {
    query = query.eq("sms_enabled", true).eq(settingColumn, true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[dispatch-sms] ❌ Recipient query failed:", error.message);
    throw new Error(`Failed to query SMS recipients: ${error.message}`);
  }

  const recipients:     Recipient[]                                 = [];
  const skippedNoPhone: Array<{ user_id: string; reason: string }> = [];

  for (const row of data ?? []) {
    const profile = row.profiles as { id: string; full_name: string | null; sms_phone: string | null; sms_consent_given: boolean | null } | null;
    const phone   = profile?.sms_phone ?? null;

    if (explicitUserIds && explicitUserIds.length > 0) {
      if (!row.sms_enabled) {
        skippedNoPhone.push({ user_id: row.user_id, reason: "sms_enabled=false" });
        continue;
      }
      if (!(row as Record<string, unknown>)[settingColumn]) {
        skippedNoPhone.push({ user_id: row.user_id, reason: `${settingColumn}=false` });
        continue;
      }
      if (!profile?.sms_consent_given) {
        skippedNoPhone.push({ user_id: row.user_id, reason: "sms_consent_not_given" });
        continue;
      }
    }

    if (!phone) {
      skippedNoPhone.push({ user_id: row.user_id, reason: "no sms_phone on profile" });
      continue;
    }

    if (senderUserId && row.user_id === senderUserId) {
      skippedNoPhone.push({ user_id: row.user_id, reason: "sender_excluded" });
      continue;
    }

    recipients.push({
      user_id:   row.user_id,
      full_name: profile?.full_name ?? null,
      sms_phone: phone,
    });
  }

  return { recipients, skippedNoPhone };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST")
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  console.log("[dispatch-sms] === INVOKED ===", new Date().toISOString());

  const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SMS_ALLOW_LIST_RAW   = Deno.env.get("SMS_ALLOW_LIST");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ success: false, error: "Server configuration error" }, 500);
  }

  const allowList    = parseAllowList(SMS_ALLOW_LIST_RAW);
  const hasAllowList = allowList.size > 0;
  if (hasAllowList) {
    console.log(`[dispatch-sms] 🔒 Allow-list active with ${allowList.size} number(s)`);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: DispatchRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  const rawEventType   = payload.eventType ?? payload.event_type;
  const dry_run        = payload.dry_run ?? false;
  const callerCtx      = payload.context ?? {};
  const metadata       = payload.metadata ?? {};
  const senderUserId   = payload.sender_user_id;
  const conversationId = payload.conversation_id;

  const jobId: string | undefined =
    payload.job_id ??
    (typeof callerCtx.jobId === "string" ? callerCtx.jobId : undefined);
  const workOrderId: string | undefined = payload.work_order_id;

  const explicitIds: string[] | undefined = payload.recipientUserId
    ? [payload.recipientUserId]
    : payload.recipient_user_ids;

  if (!rawEventType || typeof rawEventType !== "string") {
    return jsonResponse({ success: false, error: "Missing required field: eventType" }, 400);
  }
  if (!isValidEventType(rawEventType)) {
    return jsonResponse(
      { success: false, error: `Invalid eventType "${rawEventType}". Valid: ${VALID_EVENT_TYPES.join(", ")}` },
      400
    );
  }

  const eventType = rawEventType as EventType;
  console.log(
    `[dispatch-sms] 📣 event=${eventType} | dry_run=${dry_run} | job_id=${jobId ?? "-"} | wo_id=${workOrderId ?? "-"}`
  );

  // ── Fetch DB context ─────────────────────────────────────────────────────────
  let rawJobCtx:  RawJobContext | null        = null;
  let rawWoCtx:   RawWorkOrderContext | null  = null;
  let senderName: string | null              = null;

  if (jobId) {
    rawJobCtx = await fetchJobContext(supabase, jobId);
    console.log(`[dispatch-sms] 📋 Job: WO-${rawJobCtx.work_order_num ?? "?"} @ ${rawJobCtx.property_name ?? "?"}`);
  }
  if (workOrderId && eventType === "work_order_submitted") {
    rawWoCtx = await fetchWorkOrderContext(supabase, workOrderId);
  }
  if (senderUserId) {
    senderName = await fetchSenderName(supabase, senderUserId);
  }
  if (!senderName && typeof callerCtx.submittedByUserId === "string") {
    senderName = await fetchSenderName(supabase, callerCtx.submittedByUserId);
  }

  // ── Resolve recipients ───────────────────────────────────────────────────────
  let recipients:     Recipient[];
  let skippedNoPhone: Array<{ user_id: string; reason: string }>;

  try {
    ({ recipients, skippedNoPhone } = await resolveEligibleRecipients(
      supabase, eventType, senderUserId, explicitIds
    ));
  } catch (e: unknown) {
    return jsonResponse(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }

  console.log(`[dispatch-sms] 👥 Resolved ${recipients.length} eligible, ${skippedNoPhone.length} skipped at gate`);

  for (const s of skippedNoPhone) {
    await logSkip(supabase, {
      event_type:  eventType,
      user_id:     s.user_id,
      skip_reason: s.reason,
      status:      "skipped",
      metadata:    { ...metadata, job_id: jobId ?? null, work_order_id: workOrderId ?? null },
    });
  }

  if (recipients.length > MAX_RECIPIENTS_PER_CALL) {
    console.warn(`[dispatch-sms] ⚠️  Clamping recipients from ${recipients.length} to ${MAX_RECIPIENTS_PER_CALL}`);
    recipients = recipients.slice(0, MAX_RECIPIENTS_PER_CALL);
  }

  if (recipients.length === 0) {
    return jsonResponse({
      success: true, eventType, attempted: 0, queued: 0,
      skipped: skippedNoPhone.length,
      results: skippedNoPhone.map((s) => ({ user_id: s.user_id, status: "skipped" as const, skip_reason: s.reason })),
    });
  }

  // ── Enqueue loop ─────────────────────────────────────────────────────────────
  const results: ResultEntry[] = skippedNoPhone.map((s) => ({
    user_id: s.user_id, status: "skipped" as const, skip_reason: s.reason,
  }));

  let queued = 0;

  for (const recipient of recipients) {
    const phoneLast4 = recipient.sms_phone.slice(-4);

    const templateData = buildSmsTemplateData(rawJobCtx, rawWoCtx, senderName, callerCtx, recipient.full_name);
    const messageBody  = renderSmsTemplate(eventType as SmsEventType, templateData);

    console.log(
      `[dispatch-sms] ✉️  [${recipient.user_id}] ${messageBody.substring(0, 120)}${messageBody.length > 120 ? "…" : ""}`
    );

    // Dedup window
    let isDuplicate = false;
    try {
      const { data: dedupCount, error: dedupErr } = await supabase.rpc("sms_recent_count", {
        p_user_id: recipient.user_id, p_event_type: eventType, p_window_seconds: DEDUP_WINDOW_SECONDS,
      });
      if (!dedupErr && Number(dedupCount) > 0) {
        isDuplicate = true;
        console.log(`[dispatch-sms] 🔄 Dedup skip | user=${recipient.user_id}`);
      }
    } catch (dedupEx) {
      console.warn("[dispatch-sms] ⚠️  Dedup check threw — allowing enqueue:", dedupEx);
    }

    if (isDuplicate) {
      const logId = await logSkip(supabase, {
        event_type: eventType, user_id: recipient.user_id, phone_last4: phoneLast4,
        skip_reason: `dedup_window: already sent within ${DEDUP_WINDOW_SECONDS}s`,
        status: "skipped", message_body: messageBody,
        metadata: { ...metadata, job_id: jobId ?? null, dedup_window_seconds: DEDUP_WINDOW_SECONDS },
      });
      results.push({ user_id: recipient.user_id, status: "skipped", phone_last4: phoneLast4, log_id: logId ?? undefined, skip_reason: `dedup_window (${DEDUP_WINDOW_SECONDS}s)` });
      continue;
    }

    // Allow-list gate
    if (hasAllowList && !allowList.has(recipient.sms_phone)) {
      const skipReason = "allow_list: phone not in SMS_ALLOW_LIST";
      console.log(`[dispatch-sms] 🔒 Allow-list skip | user=${recipient.user_id} | to=****${phoneLast4}`);
      const logId = await logSkip(supabase, {
        event_type: eventType, user_id: recipient.user_id, phone_last4: phoneLast4,
        skip_reason: skipReason, status: "skipped", message_body: messageBody,
        metadata: { ...metadata, job_id: jobId ?? null },
      });
      results.push({ user_id: recipient.user_id, status: "skipped", phone_last4: phoneLast4, log_id: logId ?? undefined, skip_reason: skipReason });
      continue;
    }

    // Dry-run
    if (dry_run) {
      const logId = await logSkip(supabase, {
        event_type: eventType, user_id: recipient.user_id, phone_last4: phoneLast4,
        skip_reason: "dry_run=true", status: "simulated", message_body: messageBody,
        metadata: { ...metadata, job_id: jobId ?? null, message_preview: messageBody.substring(0, 160) },
      });
      console.log(`[dispatch-sms] 🧪 DRY RUN | user=${recipient.user_id} | to=****${phoneLast4}`);
      results.push({ user_id: recipient.user_id, status: "simulated", phone_last4: phoneLast4, log_id: logId ?? undefined });
      queued++;
      continue;
    }

    // Queue insert
    try {
      const { data: qRow, error: qErr } = await supabase
        .from("sms_notification_queue")
        .insert({
          event_type:      eventType,
          user_id:         recipient.user_id,
          phone_number:    recipient.sms_phone,
          message_body:    messageBody,
          status:          "pending",
          next_attempt_at: new Date().toISOString(),
          job_id:          jobId          ?? null,
          work_order_id:   workOrderId    ?? null,
          conversation_id: conversationId ?? null,
          metadata: {
            ...metadata,
            dispatched_by:           "dispatch-sms-notification",
            sender_user_id:          senderUserId ?? null,
            template_recipient_name: templateData.recipientName,
            template_work_order:     templateData.workOrderLabel,
            template_property:       templateData.propertyName,
          },
        })
        .select("id")
        .single();

      if (qErr || !qRow) {
        console.error(`[dispatch-sms] ❌ Queue insert failed | user=${recipient.user_id} |`, qErr?.message);
        results.push({ user_id: recipient.user_id, status: "failed", phone_last4: phoneLast4, error: qErr?.message ?? "Queue insert failed" });
        continue;
      }

      const queueId = (qRow as { id: string }).id;
      queued++;
      console.log(`[dispatch-sms] 📬 Queued | user=${recipient.user_id} | queue_id=${queueId} | to=****${phoneLast4}`);
      results.push({ user_id: recipient.user_id, status: "queued", phone_last4: phoneLast4, queue_id: queueId });
    } catch (insertEx: unknown) {
      console.error(`[dispatch-sms] ❌ Queue insert threw | user=${recipient.user_id} |`, insertEx instanceof Error ? insertEx.message : String(insertEx));
      results.push({ user_id: recipient.user_id, status: "failed", phone_last4: phoneLast4, error: insertEx instanceof Error ? insertEx.message : "Unexpected queue error" });
    }
  }

  const totalSkipped = results.filter((r) => r.status === "skipped").length;
  console.log(`[dispatch-sms] 📊 Done | queued=${queued} | skipped=${totalSkipped} | event=${eventType}`);

  return jsonResponse({ success: true, eventType, attempted: recipients.length, queued, skipped: totalSkipped, results });
});
