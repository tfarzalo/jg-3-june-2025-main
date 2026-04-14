/**
 * dispatchSmsNotification
 *
 * Thin client-side helper that calls the `dispatch-sms-notification` Supabase
 * Edge Function.
 *
 * ALL workflow trigger points (chat, job assignment, work order submission,
 * charges approved, job accepted) import from here so the invocation contract
 * stays in one place.
 *
 * Design:
 *  - Fire-and-forget by default (errors are logged but never bubble up to the
 *    caller so they can't break the primary workflow).
 *  - Pass `throwOnError: true` when you want the caller to handle failures
 *    (useful for testing / diagnostics).
 *  - The Edge Function is responsible for checking per-user SMS settings,
 *    phone presence, and Twilio delivery. This helper just invokes it.
 *
 * Edge Function contract (request body):
 *   {
 *     eventType:       SmsNotificationEventKey,
 *     recipientUserId: string,
 *     job_id?:         string,    // preferred top-level field for DB context fetching
 *     context:         SmsEventContext[K],
 *   }
 *
 * Per-event context types are exported so callers get compile-time safety
 * on what fields each event understands.
 */

import { supabase } from '../../utils/supabase';
import type { SmsNotificationEventKey } from '../../types/sms';

// ─── Per-event context interfaces ─────────────────────────────────────────────
// These document exactly which fields the Edge Function's template system
// recognises for each event. All fields are optional — the template gracefully
// falls back when data is missing.

/** context for chat_received — sent by ChatWindow */
export interface ChatReceivedContext {
  /** Full name or email of the message sender */
  senderName?: string | null;
  conversationId?: string;
  /** Not included in the SMS; available for future use */
  messageBody?: string;
}

/** context for job_assigned — sent by SubScheduler */
export interface JobAssignedContext {
  /** Sub's display name (for logging; recipient name comes from profiles) */
  subcontractorName?: string | null;
  /** Number of jobs in this batch */
  jobCount?: number;
  /** IDs of the assigned jobs (first one used for DB context fetch) */
  jobIds?: string[];
  /**
   * Work order numbers of assigned jobs.
   * If jobIds is also present and job_id is set at top level, the DB fetch
   * will resolve authoritative data. These are used as fallback only.
   */
  workOrderNums?: number[];
  /** Single work order number (used when assigning exactly one job) */
  workOrderNum?: number | null;
  propertyName?: string | null;
  unitNumber?: string | null;
  scheduledDate?: string | null;
  assignmentDeadline?: string | null;
}

/** context for job_accepted — sent by SubcontractorDashboardActions */
export interface JobAcceptedContext {
  /** Subcontractor's full name */
  subcontractorName?: string | null;
  jobId?: string;
  workOrderNum?: number | null;
  propertyName?: string | null;
  unitNumber?: string | null;
  scheduledDate?: string | null;
}

/** context for work_order_submitted — sent by NewWorkOrder */
export interface WorkOrderSubmittedContext {
  /**
   * profiles.id of the subcontractor who submitted.
   * The Edge Function fetches their full_name from profiles.
   */
  submittedByUserId?: string;
  /**
   * The job's UUID — used as job_id for DB context fetching when
   * the top-level job_id field is not set.
   */
  jobId?: string;
  workOrderNum?: number | null;
  unitNumber?: string | null;
  propertyName?: string | null;
}

/** context for charges_approved — sent by ApprovalPage */
export interface ChargesApprovedContext {
  /**
   * The job's UUID — used as job_id for DB context fetching when
   * the top-level job_id field is not set.
   */
  jobId?: string;
  workOrderNum?: number | null;
  propertyName?: string | null;
  unitNumber?: string | null;
  /** Total approved extra charge amount in dollars */
  extraChargesTotal?: number | null;
}

/** Union of all per-event context types */
export type SmsEventContext =
  | ChatReceivedContext
  | JobAssignedContext
  | JobAcceptedContext
  | WorkOrderSubmittedContext
  | ChargesApprovedContext;

// ─── Payload type ─────────────────────────────────────────────────────────────

export interface DispatchSmsPayload {
  /** The SMS event key — must match a notify_* column name. */
  eventType: SmsNotificationEventKey;
  /** profiles.id of the intended recipient. */
  recipientUserId: string;
  /**
   * Optional: top-level job_id for DB context fetching.
   * The Edge Function will also check context.jobId as a fallback.
   * Setting this explicitly is more reliable for job_assigned / job_accepted.
   */
  job_id?: string;
  /** Arbitrary context data forwarded to the Edge Function for message templating. */
  context?: SmsEventContext | Record<string, unknown>;
}

// ─── Dispatch functions ───────────────────────────────────────────────────────

/**
 * Invoke the `dispatch-sms-notification` Edge Function for a single recipient.
 *
 * @param payload - Event type, recipient user ID, optional job_id, and context.
 * @param throwOnError - When true, rethrows Edge Function errors to the caller.
 *                       Defaults to false (fire-and-forget / best-effort).
 */
export async function dispatchSmsNotification(
  payload: DispatchSmsPayload,
  throwOnError = false
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('dispatch-sms-notification', {
      body: payload,
    });

    if (error) {
      console.warn(
        `[dispatchSms] Edge Function error for event "${payload.eventType}" → user "${payload.recipientUserId}":`,
        error
      );
      if (throwOnError) throw error;
    }
  } catch (err) {
    console.warn(
      `[dispatchSms] Unexpected error dispatching "${payload.eventType}" → user "${payload.recipientUserId}":`,
      err
    );
    if (throwOnError) throw err;
  }
}

/**
 * Dispatch SMS notifications to multiple recipients for the same event.
 * All calls are made in parallel; individual failures are swallowed unless
 * throwOnError is true (in which case the first rejection propagates).
 *
 * @param payloads - Array of dispatch payloads.
 * @param throwOnError - Propagate errors to caller. Default: false.
 */
export async function dispatchSmsNotificationBatch(
  payloads: DispatchSmsPayload[],
  throwOnError = false
): Promise<void> {
  await Promise.all(
    payloads.map((p) => dispatchSmsNotification(p, throwOnError))
  );
}
