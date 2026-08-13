import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const MANAGEMENT_ROLES = new Set([
  "admin",
  "is_super_admin",
  "jg_management",
  "assistant_manager",
  "manager",
]);

const SUBCONTRACTOR_DASHBOARD_URL = "https://portal.jgpaintingprosinc.com/dashboard/subcontractor";
const ASSIGNMENT_DECISION_URL = "https://portal.jgpaintingprosinc.com/assignment/decision";

type ArchiveDecision = {
  jobId: string;
  action: "reassign" | "unassign";
  replacementSubcontractorId?: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}

function displayName(profile: any): string {
  return profile?.full_name || profile?.email || "Unknown subcontractor";
}

function formatWorkOrder(num: number | null | undefined): string {
  return num ? `WO-${String(num).padStart(6, "0")}` : "Job Request";
}

function formatAddress(property: any): string {
  const cityState = [property?.city, property?.state].filter(Boolean).join(", ");
  return [property?.address, [cityState, property?.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ") || "Address on file";
}

function generateTempToken(): string {
  return crypto.randomUUID();
}

async function getRequester(supabase: any, req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: jsonResponse({ success: false, error: "Missing authorization header" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return {
      error: jsonResponse(
        { success: false, error: `Authentication failed: ${userError?.message || "No user found"}` },
        401,
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || (user.app_metadata as Record<string, unknown> | null)?.role;
  if (profileError || !role || !MANAGEMENT_ROLES.has(String(role))) {
    return {
      error: jsonResponse(
        {
          success: false,
          code: "not_authorized",
          error: "User not allowed to archive subcontractors",
          requesterRole: role || null,
        },
        403,
      ),
    };
  }

  return { user, role: String(role) };
}

async function calculateAssignmentDeadline(supabase: any, assignedAt: string) {
  const { data, error } = await supabase.rpc("calculate_assignment_deadline", {
    p_assigned_at: assignedAt,
  });

  if (!error && data) {
    return data;
  }

  const fallback = new Date(Date.now() + 24 * 60 * 60 * 1000);
  fallback.setUTCHours(20, 30, 0, 0);
  return fallback.toISOString();
}

async function createAssignmentToken(supabase: any, jobId: string, subcontractorId: string) {
  const token = generateTempToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const sentAt = new Date().toISOString();

  const { error } = await supabase.from("assignment_tokens").insert({
    job_id: jobId,
    subcontractor_id: subcontractorId,
    token,
    expires_at: expiresAt,
    sent_at: sentAt,
  });

  if (error) {
    throw new Error(`Failed to create assignment token: ${error.message}`);
  }

  return token;
}

function assignmentEmail(subcontractor: any, jobs: any[], tokensByJobId: Record<string, string>) {
  const firstName = displayName(subcontractor).split(" ")[0] || "there";
  const subject = "New Job Assignment - Please Accept or Decline";

  const htmlItems = jobs.map((job) => {
    const token = tokensByJobId[job.id];
    const decisionUrl = token
      ? `${ASSIGNMENT_DECISION_URL}?token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(job.id)}`
      : SUBCONTRACTOR_DASHBOARD_URL;
    return `
      <li style="margin-bottom: 18px; padding: 14px 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
        <div style="font-weight: 600; color: #111827; font-size: 15px;">${job.property?.property_name || "Property"}</div>
        <div style="margin-top: 6px; color: #374151; font-size: 14px;">
          <div><strong>Work Order:</strong> ${formatWorkOrder(job.work_order_num)}</div>
          <div><strong>Unit:</strong> ${job.unit_number || "N/A"}</div>
          <div><strong>Address:</strong> ${formatAddress(job.property)}</div>
        </div>
        <div style="margin-top: 12px;">
          <a href="${decisionUrl}" style="display: inline-block; padding: 12px 16px; background: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Review &amp; Accept / Decline
          </a>
        </div>
      </li>
    `;
  }).join("");

  const textItems = jobs.map((job) => {
    const token = tokensByJobId[job.id];
    const decisionUrl = token
      ? `${ASSIGNMENT_DECISION_URL}?token=${token}&jobId=${job.id}`
      : SUBCONTRACTOR_DASHBOARD_URL;
    return `${job.property?.property_name || "Property"}
Work Order: ${formatWorkOrder(job.work_order_num)}
Unit: ${job.unit_number || "N/A"}
Address: ${formatAddress(job.property)}
Respond: ${decisionUrl}`;
  }).join("\n\n");

  return {
    subject,
    html: `<p>Hi ${firstName},</p><p>You have been assigned to the following job${jobs.length === 1 ? "" : "s"}. Please review and accept or decline:</p><ul>${htmlItems}</ul><p>Thank you,<br/>JG Painting Pros Inc.</p>`,
    text: `Hi ${firstName},

You have been assigned to the following job${jobs.length === 1 ? "" : "s"}. Please review and accept or decline:

${textItems}

Thank you,
JG Painting Pros Inc.`,
  };
}

async function sendAssignmentNotifications(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  actorId: string,
  groupedJobs: Map<string, any[]>,
  subcontractorsById: Map<string, any>,
) {
  for (const [subcontractorId, jobs] of groupedJobs.entries()) {
    const subcontractor = subcontractorsById.get(subcontractorId);
    if (!subcontractor?.email || jobs.length === 0) continue;

    const tokensByJobId: Record<string, string> = {};
    for (const job of jobs) {
      tokensByJobId[job.id] = await createAssignmentToken(supabase, job.id, subcontractorId);
    }

    const { subject, html, text } = assignmentEmail(subcontractor, jobs, tokensByJobId);
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ to: subcontractor.email, subject, html, text }),
    });

    if (!emailResponse.ok) {
      const body = await emailResponse.text();
      throw new Error(`Failed to send assignment email: ${body}`);
    }

    await fetch(`${supabaseUrl}/functions/v1/dispatch-sms-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        eventType: "job_assigned",
        recipientUserId: subcontractorId,
        job_id: jobs[0]?.id,
        context: {
          subcontractorName: displayName(subcontractor),
          jobCount: jobs.length,
          jobIds: jobs.map((job) => job.id),
          workOrderNums: jobs.map((job) => job.work_order_num),
          workOrderNum: jobs.length === 1 ? jobs[0].work_order_num : undefined,
          propertyName: jobs.length === 1 ? jobs[0].property?.property_name ?? null : null,
        },
      }),
    }).catch((error) => console.warn("Best-effort SMS dispatch failed:", error));

    const { error: logError } = await supabase.from("email_logs").insert(jobs.map((job) => ({
      job_id: job.id,
      recipient_email: subcontractor.email,
      subject,
      content: text,
      notification_type: "sub_assignment",
      template_id: "assignment_decision",
      cc_emails: null,
      bcc_emails: null,
      sent_by: actorId,
    })));

    if (logError) {
      console.warn("Failed to log assignment email:", logError.message);
    }
  }
}

async function invalidateAssignmentTokens(supabase: any, jobId: string, subcontractorId: string, now: string) {
  const { error } = await supabase
    .from("assignment_tokens")
    .update({
      used_at: now,
      decision: "declined",
      decision_at: now,
    })
    .eq("job_id", jobId)
    .eq("subcontractor_id", subcontractorId)
    .is("used_at", null);

  if (error) {
    throw new Error(`Failed to invalidate assignment tokens: ${error.message}`);
  }
}

function buildReassignmentPayload(jobRequestJobs: any[], activeSubs: any[]) {
  const activeById = new Map(activeSubs.map((sub) => [sub.id, sub]));

  return jobRequestJobs.map((job) => {
    const prefs = [
      { slot: "A", id: job.property?.preferred_subcontractor_a_id },
      { slot: "B", id: job.property?.preferred_subcontractor_b_id },
      { slot: "C", id: job.property?.preferred_subcontractor_c_id },
      { slot: "D", id: job.property?.preferred_subcontractor_d_id },
    ].filter((pref) => pref.id && activeById.has(pref.id));

    const preferredCandidates = prefs.map((pref) => {
      const sub = activeById.get(pref.id);
      return {
        id: pref.id,
        name: displayName(sub),
        email: sub?.email || null,
        slot: pref.slot,
      };
    });

    return {
      id: job.id,
      work_order_num: job.work_order_num,
      label: `${formatWorkOrder(job.work_order_num)} - ${job.property?.property_name || "Property"}${job.unit_number ? ` - Unit ${job.unit_number}` : ""}`,
      property_id: job.property?.id || null,
      property_name: job.property?.property_name || null,
      unit_number: job.unit_number || null,
      assignment_status: job.assignment_status || null,
      preferredCandidates,
      allCandidates: activeSubs.map((sub) => ({
        id: sub.id,
        name: displayName(sub),
        email: sub.email || null,
      })),
      defaultReplacementSubcontractorId: preferredCandidates[0]?.id || activeSubs[0]?.id || null,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const requester = await getRequester(supabase, req);
    if ("error" in requester) return requester.error;

    const body = await req.json();
    const userId = body.userId || body.subcontractorId;
    const decisions = Array.isArray(body.decisions) ? body.decisions as ArchiveDecision[] : [];
    const sendNotifications = body.sendNotifications !== false;
    if (!userId) {
      return jsonResponse({ success: false, error: "Missing userId" }, 400);
    }

    if (requester.user.id === userId) {
      return jsonResponse({ success: false, code: "self_archive", error: "Cannot archive your own account" }, 400);
    }

    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, archived_at")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) throw new Error(`Failed to fetch subcontractor: ${targetError.message}`);
    if (!target) return jsonResponse({ success: false, code: "not_found", error: "Subcontractor not found" }, 404);
    if (target.role !== "subcontractor") {
      return jsonResponse({ success: false, code: "not_subcontractor", error: "Only subcontractors can be archived by this workflow" }, 400);
    }
    if (target.archived_at) {
      return jsonResponse({ success: false, code: "already_archived", error: "Subcontractor is already archived" }, 409);
    }

    const historicalName = displayName(target);
    const historicalEmail = target.email || null;
    const now = new Date().toISOString();

    const { data: assignedJobs, error: assignedJobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        work_order_num,
        unit_number,
        scheduled_date,
        assigned_to,
        assigned_at,
        assignment_status,
        assignment_decision_at,
        assignment_deadline,
        declined_reason_code,
        declined_reason_text,
        assigned_to_name_snapshot,
        assigned_to_email_snapshot,
        property:properties(
          id,
          property_name,
          address,
          city,
          state,
          zip,
          preferred_subcontractor_a_id,
          preferred_subcontractor_b_id,
          preferred_subcontractor_c_id,
          preferred_subcontractor_d_id
        ),
        phase:job_phases!jobs_current_phase_id_fkey(id, job_phase_label)
      `)
      .eq("assigned_to", userId);

    if (assignedJobsError) {
      throw new Error(`Failed to fetch assigned jobs: ${assignedJobsError.message}`);
    }

    const normalizedJobs = (assignedJobs || []).map((job: any) => ({
      ...job,
      property: Array.isArray(job.property) ? job.property[0] : job.property,
      phase: Array.isArray(job.phase) ? job.phase[0] : job.phase,
    }));

    const jobRequestJobs = normalizedJobs.filter((job: any) => job.phase?.job_phase_label === "Job Request");
    const historicalJobs = normalizedJobs.filter((job: any) => job.phase?.job_phase_label !== "Job Request");

    const { data: activeSubcontractors, error: subsError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, archived_at")
      .eq("role", "subcontractor")
      .is("archived_at", null)
      .neq("id", userId)
      .order("full_name");

    if (subsError) {
      throw new Error(`Failed to fetch replacement subcontractors: ${subsError.message}`);
    }

    const activeSubs = activeSubcontractors || [];
    const reassignmentPayload = buildReassignmentPayload(jobRequestJobs, activeSubs);

    if (jobRequestJobs.length > 0 && decisions.length === 0) {
      return jsonResponse({
        success: false,
        code: "job_requests_require_decisions",
        message: "Assigned Job Requests must be reassigned or returned to the unassigned pool before archiving.",
        jobs: reassignmentPayload,
      }, 409);
    }

    const decisionsByJobId = new Map(decisions.map((decision) => [decision.jobId, decision]));
    for (const job of jobRequestJobs) {
      const decision = decisionsByJobId.get(job.id);
      if (!decision) {
        return jsonResponse({
          success: false,
          code: "missing_job_request_decision",
          error: `Missing reassignment decision for ${formatWorkOrder(job.work_order_num)}`,
          jobs: reassignmentPayload,
        }, 400);
      }

      if (decision.action === "reassign") {
        if (!decision.replacementSubcontractorId) {
          return jsonResponse({ success: false, code: "missing_replacement", error: "Replacement subcontractor is required" }, 400);
        }
        if (!activeSubs.some((sub: any) => sub.id === decision.replacementSubcontractorId)) {
          return jsonResponse({ success: false, code: "invalid_replacement", error: "Replacement subcontractor is not active or eligible" }, 400);
        }
      } else if (decision.action !== "unassign") {
        return jsonResponse({ success: false, code: "invalid_decision", error: "Invalid reassignment decision" }, 400);
      }
    }

    if (historicalJobs.length > 0) {
      const { error: freezeError } = await supabase
        .from("jobs")
        .update({
          assigned_to_name_snapshot: historicalName,
          assigned_to_email_snapshot: historicalEmail,
        })
        .in("id", historicalJobs.map((job: any) => job.id));

      if (freezeError) {
        throw new Error(`Failed to freeze historical job assignment data: ${freezeError.message}`);
      }
    }

    const groupedNotifications = new Map<string, any[]>();
    const activeSubsById = new Map(activeSubs.map((sub: any) => [sub.id, sub]));

    for (const job of jobRequestJobs) {
      const decision = decisionsByJobId.get(job.id)!;
      await invalidateAssignmentTokens(supabase, job.id, userId, now);

      if (decision.action === "unassign") {
        const { error: unassignError } = await supabase
          .from("jobs")
          .update({
            assigned_to: null,
            assigned_at: null,
            assignment_deadline: null,
            assignment_status: null,
            assignment_decision_at: null,
            declined_reason_code: null,
            declined_reason_text: null,
          })
          .eq("id", job.id);

        if (unassignError) {
          throw new Error(`Failed to return ${formatWorkOrder(job.work_order_num)} to the unassigned pool: ${unassignError.message}`);
        }
      } else {
        const replacementId = decision.replacementSubcontractorId!;
        const assignedAt = new Date().toISOString();
        const assignmentDeadline = await calculateAssignmentDeadline(supabase, assignedAt);

        const { error: reassignError } = await supabase
          .from("jobs")
          .update({
            assigned_to: replacementId,
            assigned_at: assignedAt,
            assignment_deadline: assignmentDeadline,
            assignment_status: "pending",
            assignment_decision_at: null,
            declined_reason_code: null,
            declined_reason_text: null,
          })
          .eq("id", job.id);

        if (reassignError) {
          throw new Error(`Failed to reassign ${formatWorkOrder(job.work_order_num)}: ${reassignError.message}`);
        }

        if (!groupedNotifications.has(replacementId)) groupedNotifications.set(replacementId, []);
        groupedNotifications.get(replacementId)!.push(job);
      }
    }

    if (sendNotifications) {
      await sendAssignmentNotifications(
        supabase,
        supabaseUrl,
        serviceKey,
        requester.user.id,
        groupedNotifications,
        activeSubsById,
      );
    }

    const preferredSlotUpdates = [
      {
        matchColumn: "preferred_subcontractor_a_id",
        update: {
          preferred_subcontractor_a_name_snapshot: historicalName,
          preferred_subcontractor_a_email_snapshot: historicalEmail,
          preferred_subcontractor_a_deleted_at: now,
          preferred_subcontractor_a_id: null,
        },
      },
      {
        matchColumn: "preferred_subcontractor_b_id",
        update: {
          preferred_subcontractor_b_name_snapshot: historicalName,
          preferred_subcontractor_b_email_snapshot: historicalEmail,
          preferred_subcontractor_b_deleted_at: now,
          preferred_subcontractor_b_id: null,
        },
      },
      {
        matchColumn: "preferred_subcontractor_c_id",
        update: {
          preferred_subcontractor_c_name_snapshot: historicalName,
          preferred_subcontractor_c_email_snapshot: historicalEmail,
          preferred_subcontractor_c_deleted_at: now,
          preferred_subcontractor_c_id: null,
        },
      },
      {
        matchColumn: "preferred_subcontractor_d_id",
        update: {
          preferred_subcontractor_d_name_snapshot: historicalName,
          preferred_subcontractor_d_email_snapshot: historicalEmail,
          preferred_subcontractor_d_deleted_at: now,
          preferred_subcontractor_d_id: null,
        },
      },
    ];

    for (const slotUpdate of preferredSlotUpdates) {
      const { error: preferredError } = await supabase
        .from("properties")
        .update(slotUpdate.update)
        .eq(slotUpdate.matchColumn, userId);

      if (preferredError) {
        throw new Error(`Failed to clear preferred subcontractor assignments: ${preferredError.message}`);
      }
    }

    const { error: archiveError } = await supabase
      .from("profiles")
      .update({
        archived_at: now,
        archived_by: requester.user.id,
      })
      .eq("id", userId);

    if (archiveError) {
      throw new Error(`Failed to archive subcontractor profile: ${archiveError.message}`);
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });

    if (authError) {
      console.warn("Profile archived, but auth ban failed:", authError.message);
    }

    return jsonResponse({
      success: true,
      message: "Subcontractor archived successfully",
      archivedUserId: userId,
      reassignedJobCount: Array.from(groupedNotifications.values()).reduce((sum, jobs) => sum + jobs.length, 0),
      unassignedJobCount: decisions.filter((decision) => decision.action === "unassign").length,
      historicalJobCount: historicalJobs.length,
      notificationsSent: sendNotifications,
      authDisabled: !authError,
    });
  } catch (error) {
    console.error("archive-subcontractor error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to archive subcontractor",
    }, 400);
  }
});
