/**
 * smsTemplates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized SMS message template system for dispatch-sms-notification.
 *
 * Design goals:
 *   • One template function per event type — single source of truth.
 *   • Payload normalisation happens here, not in the dispatcher.
 *   • Every template accepts a SmsTemplateData object (normalised) — no raw
 *     DB shapes or nested payloads passed directly into template logic.
 *   • Graceful fallback at every field — never produce malformed strings.
 *   • Max length guard ensures messages stay below Twilio's 1600-char limit
 *     and practical mobile readability limits.
 *   • Extendable: add a new event key + template function, nothing else changes.
 *
 * Usage:
 *   const data = buildSmsTemplateData(eventType, rawJobCtx, rawWoCtx, senderName, callerCtx, recipientName);
 *   const body = renderSmsTemplate(eventType, data);
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Canonical SMS event keys.
 * Must stay in sync with VALID_EVENT_TYPES in dispatch-sms-notification/index.ts.
 */
export type SmsEventType =
  | "chat_received"
  | "job_assigned"
  | "charges_approved"
  | "work_order_submitted"
  | "job_accepted";

/**
 * Raw DB context objects passed in from context fetchers.
 * These are nullable/partial — normalisation converts them to SmsTemplateData.
 */
export interface RawJobContext {
  work_order_num?: number | null;
  unit_number?: string | null;
  property_name?: string | null;
  property_address?: string | null;
  job_type?: string | null;
  scheduled_date?: string | null;
  assigned_to_name?: string | null;
  assignment_deadline?: string | null;
}

export interface RawWorkOrderContext {
  work_order_num?: number | null;
  unit_number?: string | null;
  property_name?: string | null;
  bill_amount?: number | null;
}

/**
 * Normalised, flat data bag passed to every template builder.
 * All fields are string | null — no nested objects, no coercions inside templates.
 *
 * Templates only use the fields relevant to their event type.
 * Unused fields are always present but null.
 */
export interface SmsTemplateData {
  /** First name (or full name) of the SMS recipient */
  recipientName: string | null;
  /** Name of the subcontractor (for admin-facing notifications) */
  subcontractorName: string | null;
  /** Zero-padded work order string, e.g. "WO-001234" */
  workOrderLabel: string | null;
  /** Raw work order number (for metadata / logging) */
  workOrderNum: number | null;
  /** Property / complex name, e.g. "Oak Ridge Apartments" */
  propertyName: string | null;
  /** Street address of the property */
  propertyAddress: string | null;
  /** Unit number, e.g. "12B" */
  unitNumber: string | null;
  /** Job type / category label */
  jobType: string | null;
  /** Scheduled date (human-readable, already formatted) */
  scheduledDate: string | null;
  /** Assignment response deadline (human-readable, already formatted) */
  assignmentDeadline: string | null;
  /** Name of the person who triggered the event (chat sender, etc.) */
  senderName: string | null;
  /** Dollar amount for bill / charges, e.g. "$150.00" */
  chargeAmount: string | null;
  /** Whether multiple jobs are included in a single notification */
  isMultiJob: boolean;
  /** Number of jobs in a batch assignment (job_assigned only) */
  jobCount: number;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Format a number as a zero-padded work order label.
 * Returns null if woNum is falsy.
 */
function woLabel(woNum: number | null | undefined): string | null {
  if (!woNum) return null;
  return `WO-${String(woNum).padStart(6, "0")}`;
}

/**
 * Format an ISO date string into a short human-readable form.
 * Returns null on invalid input.
 */
export function formatSmsDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
  } catch {
    return iso;
  }
}

/**
 * Format a numeric amount as a dollar string, e.g. "$150.00".
 * Returns null if amount is null/undefined/NaN.
 */
function dollarAmount(amount: number | null | undefined): string | null {
  if (amount == null || isNaN(amount)) return null;
  return `$${Number(amount).toFixed(2)}`;
}

/**
 * Extract the first name from a full name string.
 * Falls back to the full string if no space found.
 */
function firstName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

/**
 * Merge a value from DB context OR caller-supplied context object.
 * DB value wins if present (it's more authoritative).
 */
function coalesce<T>(
  dbVal: T | null | undefined,
  callerVal: T | null | undefined
): T | null {
  if (dbVal !== null && dbVal !== undefined) return dbVal;
  if (callerVal !== null && callerVal !== undefined) return callerVal;
  return null;
}

/**
 * buildSmsTemplateData
 * ─────────────────────────────────────────────────────────────────────────────
 * Normalises all raw inputs into a clean, flat SmsTemplateData object.
 *
 * Callers pass whatever they have — every field is optional.
 * This function never throws; all missing values become null.
 *
 * @param rawJob       DB-fetched job context (may be undefined)
 * @param rawWo        DB-fetched work order context (may be undefined)
 * @param senderName   Full name of the triggering user (already fetched from DB)
 * @param callerCtx    Caller-supplied context from the dispatch request body
 * @param recipientFullName  Full name of the SMS recipient (from profiles)
 */
export function buildSmsTemplateData(
  rawJob: RawJobContext | null | undefined,
  rawWo: RawWorkOrderContext | null | undefined,
  senderName: string | null | undefined,
  callerCtx: Record<string, unknown> | null | undefined,
  recipientFullName: string | null | undefined
): SmsTemplateData {
  const ctx = callerCtx ?? {};

  // ── Work order number: DB context wins, then caller ctx ──────────────────
  const rawWoNum = coalesce<number>(
    rawJob?.work_order_num ?? rawWo?.work_order_num,
    (ctx.workOrderNum as number | null) ??
      (ctx.work_order_num as number | null) ??
      // job_assigned in SubScheduler sends workOrderNums[] — use first element
      ((Array.isArray(ctx.workOrderNums) && ctx.workOrderNums.length > 0)
        ? (ctx.workOrderNums[0] as number)
        : null)
  );

  // ── Property name ─────────────────────────────────────────────────────────
  const rawPropertyName = coalesce<string>(
    rawJob?.property_name ?? rawWo?.property_name,
    (ctx.propertyName as string | null) ?? (ctx.property_name as string | null)
  );

  // ── Unit number ───────────────────────────────────────────────────────────
  const rawUnitNumber = coalesce<string>(
    rawJob?.unit_number ?? rawWo?.unit_number,
    (ctx.unitNumber as string | null) ?? (ctx.unit_number as string | null)
  );

  // ── Billing / charge amount ───────────────────────────────────────────────
  const rawAmount = coalesce<number>(
    rawWo?.bill_amount,
    (ctx.extraChargesTotal as number | null) ??
      (ctx.bill_amount as number | null) ??
      (ctx.chargeAmount as number | null)
  );

  // ── Multi-job detection ───────────────────────────────────────────────────
  const jobCount = typeof ctx.jobCount === "number"
    ? ctx.jobCount
    : (Array.isArray(ctx.jobIds) ? ctx.jobIds.length : 1);
  const isMultiJob = jobCount > 1;

  // ── Sender / sub name ─────────────────────────────────────────────────────
  const resolvedSenderName = coalesce<string>(
    senderName,
    (ctx.senderName as string | null) ??
      (ctx.subcontractorName as string | null) ??
      (ctx.submitterName as string | null)
  );

  return {
    recipientName:      firstName(recipientFullName ?? (ctx.recipientName as string | null)),
    subcontractorName:  resolvedSenderName,
    workOrderLabel:     woLabel(rawWoNum),
    workOrderNum:       rawWoNum,
    propertyName:       rawPropertyName,
    propertyAddress:    coalesce<string>(rawJob?.property_address, ctx.propertyAddress as string | null),
    unitNumber:         rawUnitNumber,
    jobType:            coalesce<string>(rawJob?.job_type, ctx.jobType as string | null),
    scheduledDate:      formatSmsDate(
                          coalesce<string>(rawJob?.scheduled_date, ctx.scheduledDate as string | null)
                        ),
    assignmentDeadline: formatSmsDate(
                          coalesce<string>(rawJob?.assignment_deadline, ctx.assignmentDeadline as string | null)
                        ),
    senderName:         resolvedSenderName,
    chargeAmount:       dollarAmount(rawAmount),
    isMultiJob,
    jobCount,
  };
}

// ─── Safe string helpers ──────────────────────────────────────────────────────

/**
 * Join non-empty parts with a separator, cleanly.
 * Filters out null, undefined, and empty strings.
 */
function join(parts: (string | null | undefined)[], sep = " "): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(sep);
}

/**
 * Cleans up a rendered message string:
 *   - Collapses multiple spaces
 *   - Removes space before punctuation
 *   - Removes trailing/leading whitespace
 *   - Enforces max length with ellipsis
 */
function clean(msg: string, maxLen = 320): string {
  return msg
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/,\s*\./g, ".")
    .trim()
    .slice(0, maxLen);
}

// ─── Template builders ────────────────────────────────────────────────────────

/**
 * Template registry type — one builder function per event type.
 */
type TemplateBuilderMap = {
  [K in SmsEventType]: (data: SmsTemplateData) => string;
};

const BRAND = "JG Painting:";

const TEMPLATES: TemplateBuilderMap = {
  // ── chat_received ──────────────────────────────────────────────────────────
  // Recipient: any user who has a chat notification open with the sender.
  // Context available: senderName (from ChatWindow)
  chat_received(data) {
    const greeting = data.recipientName ? `${data.recipientName}, ` : "";
    const from = data.senderName ?? "Someone";
    return clean(
      `${BRAND} ${greeting}${from} sent you a message. Log in to reply.`
    );
  },

  // ── job_assigned ───────────────────────────────────────────────────────────
  // Recipient: subcontractor being assigned.
  // DB context: job (via job_id) — work_order_num, property_name, unit_number,
  //             scheduled_date, assignment_deadline.
  // Caller context fallback: workOrderNums[], workOrderNum, propertyName, etc.
  job_assigned(data) {
    const greeting = data.recipientName
      ? `${data.recipientName}, `
      : "You have been ";

    if (data.isMultiJob && data.jobCount > 1) {
      // Multi-job assignment — list the count, fallback gracefully
      const prop = data.propertyName ? ` at ${data.propertyName}` : "";
      return clean(
        `${BRAND} ${data.recipientName ? `${data.recipientName}, you have` : "You have"} been assigned ${data.jobCount} jobs${prop}. Log in to review and accept.`
      );
    }

    const wo = data.workOrderLabel ?? "a new job";
    const prop = data.propertyName ?? "a property";
    const unitPart = data.unitNumber ? `, Unit ${data.unitNumber}` : "";
    const datePart = data.scheduledDate ? ` on ${data.scheduledDate}` : "";
    const deadlinePart = data.assignmentDeadline
      ? ` Respond by ${data.assignmentDeadline}.`
      : "";

    return clean(
      `${BRAND} ${greeting}been assigned ${wo} at ${prop}${unitPart}${datePart}. Log in to accept.${deadlinePart}`
    );
  },

  // ── job_accepted ───────────────────────────────────────────────────────────
  // Recipient: admin/JG management being notified.
  // DB context: job (via job_id if sent) — but this event is fired directly
  //             from SubcontractorDashboardActions with all fields in callerCtx.
  job_accepted(data) {
    const sub = data.subcontractorName ?? "A subcontractor";
    const wo = data.workOrderLabel ?? "a job";
    const prop = data.propertyName ? ` at ${data.propertyName}` : "";
    const unitPart = data.unitNumber ? `, Unit ${data.unitNumber}` : "";

    return clean(
      `${BRAND} ${sub} accepted ${wo}${prop}${unitPart}.`
    );
  },

  // ── work_order_submitted ───────────────────────────────────────────────────
  // Recipient: admin/JG management being notified.
  // DB context: can use jobId (NewWorkOrder passes jobId in caller ctx) OR
  //             workOrderId if a true work_order record id is passed.
  // Caller ctx: submittedByUserId, jobId, workOrderNum, unitNumber, propertyName.
  work_order_submitted(data) {
    const sub = data.subcontractorName ?? "A subcontractor";
    const wo = data.workOrderLabel ?? "a work order";
    const prop = data.propertyName ? ` for ${data.propertyName}` : "";
    const unitPart = data.unitNumber ? `, Unit ${data.unitNumber}` : "";
    const amountPart = data.chargeAmount ? ` Billed: ${data.chargeAmount}.` : "";

    return clean(
      `${BRAND} ${sub} submitted ${wo}${prop}${unitPart}.${amountPart} Review in the app.`
    );
  },

  // ── charges_approved ───────────────────────────────────────────────────────
  // Recipient: subcontractor whose extra charges were approved.
  // DB context: job (via job_id from ApprovalPage's caller ctx.jobId).
  // Caller ctx: jobId, workOrderNum, propertyName, unitNumber, extraChargesTotal.
  charges_approved(data) {
    const greeting = data.recipientName
      ? `${data.recipientName}, your`
      : "Your";
    const amountPart = data.chargeAmount ? ` (${data.chargeAmount})` : "";
    const wo = data.workOrderLabel ?? "a job";
    const prop = data.propertyName ? ` at ${data.propertyName}` : "";
    const unitPart = data.unitNumber ? `, Unit ${data.unitNumber}` : "";

    return clean(
      `${BRAND} ${greeting} extra charges${amountPart} for ${wo}${prop}${unitPart} have been approved. You may proceed.`
    );
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * renderSmsTemplate
 * ─────────────────────────────────────────────────────────────────────────────
 * Render the final SMS message string for a given event type.
 *
 * @param eventType  One of the five SMS event keys.
 * @param data       Normalised template data from buildSmsTemplateData().
 * @returns          Final SMS-ready string, cleaned and length-capped.
 */
export function renderSmsTemplate(
  eventType: SmsEventType,
  data: SmsTemplateData
): string {
  const builder = TEMPLATES[eventType];
  if (!builder) {
    // Should never happen for valid event types; safe fallback
    return clean(`${BRAND} You have a new notification. Log in to view details.`);
  }
  return builder(data);
}

/**
 * Convenience: join parts for a location string.
 * e.g. "Oak Ridge Apartments, Unit 12B" or just "Oak Ridge Apartments"
 */
export function formatLocation(
  propertyName: string | null,
  unitNumber: string | null
): string | null {
  if (!propertyName && !unitNumber) return null;
  if (propertyName && unitNumber) return `${propertyName}, Unit ${unitNumber}`;
  return propertyName ?? (unitNumber ? `Unit ${unitNumber}` : null);
}
