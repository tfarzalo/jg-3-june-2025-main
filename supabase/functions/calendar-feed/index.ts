import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("SUPABASE_URL:", SUPABASE_URL ? "Set" : "Missing");
console.log("SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY ? "Set" : "Missing");
console.log("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Missing");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  console.error("Available env vars:", Object.keys(Deno.env.toObject()));
  throw new Error("Environment variables not configured");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
  global: {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  },
});

type Scope = "events" | "events_and_job_requests" | "completed_jobs" | "subcontractor";
const OPEN_STATES = ["Open", "Scheduled", "Pending"];
const CANCEL_STATES = ["Cancelled", "Canceled"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDateTime = (dt: string | Date) => {
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
};

const fmtDate = (dt: string | Date) => {
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate())
  );
};

const esc = (t?: string) =>
  (t ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

const generateUID = (type: string, id: string, createdAt?: string) => {
  const timestamp = createdAt ? new Date(createdAt).getTime() : Date.now();
  return `${type}-${id}-${timestamp}@jgpaintingpros.com`;
};

const calculateSequence = (createdAt?: string, updatedAt?: string) => {
  if (!createdAt || !updatedAt) return 0;
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (updated <= created) return 0;
  return Math.floor((updated - created) / 1000);
};

function checkJobAcceptance(job: any): boolean {
  if (job.assignment_status === "accepted") return true;
  return false;
}

function checkJobDeclined(job: any): boolean {
  if (job.assignment_status === "declined") return true;
  return false;
}

function checkNeedsAssignment(job: any): boolean {
  if (!job.assigned_to) return true;
  if (checkJobDeclined(job)) return true;
  return false;
}

const formatAddress = (property: any) => {
  const parts = [];
  if (property.address || property.address_1) {
    parts.push(property.address || property.address_1);
  }
  if (property.address_2) {
    parts.push(property.address_2);
  }
  if (property.city) {
    parts.push(property.city);
  }
  if (property.state) {
    parts.push(property.state);
  }
  if (property.postal_code || property.zip) {
    parts.push(property.postal_code || property.zip);
  }
  return parts.join(", ");
};

const formatWorkOrderNumber = (workOrderNum: number | string) => {
  if (!workOrderNum) return "N/A";
  const num = typeof workOrderNum === 'string' ? workOrderNum : String(workOrderNum);
  return num.padStart(6, '0');
};

const formatStreetAddress = (property: any) => {
  const parts = [];
  if (property.address || property.address_1) {
    parts.push(property.address || property.address_1);
  }
  if (property.address_2) {
    parts.push(property.address_2);
  }
  return parts.join(" ");
};

const buildJobTitle = (job: any, property: any, assigneeName?: string, needsAssignment?: boolean) => {
  const parts = [];
  
  const wo = formatWorkOrderNumber(job.work_order_num || job.id);
  parts.push(`WO#${wo}`);
  
  // Just use property name
  if (property?.property_name) {
    parts.push(property.property_name);
  }
  
  const unit = job.unit_number;
  if (unit) {
    parts.push(`Unit ${unit}`);
  }
  
  const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
  const jobTypeLabel = jobType?.job_type_label;
  if (jobTypeLabel) {
    parts.push(jobTypeLabel);
  }
  
  if (needsAssignment) {
    parts.push("⚠️ NEEDS ASSIGNMENT");
  } else if (assigneeName) {
    parts.push(assigneeName);
  }
  
  return parts.join(" • ");
};

const buildJobDescription = (job: any, property: any, assigneeName?: string, isAccepted?: boolean, needsAssignment?: boolean) => {
  const lines = [];
  
  const wo = formatWorkOrderNumber(job.work_order_num || job.id);
  lines.push(`Work Order: #${wo}`);
  lines.push("");
  
  const propName = property?.property_name;
  if (propName) {
    lines.push(`Property: ${propName}`);
  }
  
  const unit = job.unit_number;
  if (unit) {
    lines.push(`Unit: ${unit}`);
  }
  
  lines.push("");
  
  const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
  const jobTypeLabel = jobType?.job_type_label;
  if (jobTypeLabel) {
    lines.push(`Job Type: ${jobTypeLabel}`);
  }
  
  if (needsAssignment) {
    lines.push("");
    lines.push(`⚠️ ASSIGNMENT STATUS: NEEDS ASSIGNMENT`);
    if (job.assigned_to && checkJobDeclined(job)) {
      lines.push(`Previous assignment was declined`);
    } else {
      lines.push(`No subcontractor assigned`);
    }
  } else if (assigneeName) {
    lines.push(`Assigned To: ${assigneeName}`);
    
    if (isAccepted === true) {
      lines.push(`Acceptance Status: ✓ Accepted`);
    } else if (isAccepted === false) {
      lines.push(`Acceptance Status: ⏳ Pending Acceptance`);
    }
  }
  
  if (job.status) {
    lines.push(`Job Status: ${job.status}`);
  }
  
  lines.push("");
  lines.push("View in Portal: https://portal.jgpaintingpros.com/dashboard/jobs/" + job.id);
  
  return lines.join("\n");
};

const eventSummary = (title: string | null | undefined) => {
  return title || "Untitled Event";
};

const buildEventDescription = (event: any, userFullName?: string) => {
  const lines = [];
  
  const eventTitle = event.title || "Untitled Event";
  lines.push(eventTitle);
  
  if (event.details) {
    lines.push("");
    lines.push(event.details);
  }
  
  lines.push("");
  lines.push("---");
  
  if (userFullName) {
    lines.push(`Created by: ${userFullName}`);
  }
  
  try {
    const d = new Date(event.start_at);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    
    const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
    if (hasTime) {
      const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
      lines.push(`Date: ${dateStr} at ${timeStr}`);
    } else {
      lines.push(`Date: ${dateStr}`);
    }
  } catch (err) {
    // Skip date formatting if error
  }
  
  return lines.join("\n");
};

const commonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: commonHeaders,
    });
  }

  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=900",
      },
    });
  }
  
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: commonHeaders });
  }

  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") || "") as Scope;
    const token = url.searchParams.get("token") || "";
    const subcontractorId = url.searchParams.get("subcontractor_id");

    if (!token) return new Response("Missing token", { status: 400, headers: commonHeaders });
    if (!["events", "events_and_job_requests", "completed_jobs", "subcontractor"].includes(scope)) {
      return new Response("Invalid scope", { status: 400, headers: commonHeaders });
    }

    const { data: ct, error: ctErr } = await supabase
      .from("calendar_tokens")
      .select("user_id, token")
      .eq("token", token)
      .maybeSingle();
    if (ctErr || !ct) return new Response("Invalid token", { status: 403, headers: commonHeaders });

    const tokenOwnerId = ct.user_id as string;
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", tokenOwnerId)
      .maybeSingle();
    const ownerRole = ownerProfile?.role ?? "user";
    const isAdminLike = ["admin", "jg_management", "is_super_admin"].includes(ownerRole);

    if (scope === "subcontractor" && subcontractorId && subcontractorId !== tokenOwnerId && !isAdminLike) {
      return new Response("Forbidden", { status: 403, headers: commonHeaders });
    }

    type Item = { 
      uid: string; 
      sequence: number;
      title: string; 
      description?: string; 
      start: string | Date; 
      end: string | Date;
      isAllDay: boolean;
      location?: string;
      url?: string;
      categories?: string;
      status?: string;
      lastModified?: Date;
    };
    const items: Item[] = [];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (scope === "events" || scope === "events_and_job_requests") {
      const { data: events, error: eErr } = await supabase
        .from("calendar_events")
        .select("id, title, details, start_at, end_at, created_by, created_at, updated_at")
        .order("start_at", { ascending: true });
      if (eErr) throw eErr;

      const userIds = [...new Set(events?.map(e => e.created_by).filter(Boolean) || [])];
      const { data: profiles } = userIds.length > 0 ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds) : { data: [] };
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      for (const e of events ?? []) {
        const userFullName = profileMap.get(e.created_by);
        const title = eventSummary(e.title);
        const description = buildEventDescription(e, userFullName);
        const startDate = new Date(e.start_at);
        const hasTime = startDate.getUTCHours() !== 0 || startDate.getUTCMinutes() !== 0 || startDate.getUTCSeconds() !== 0;

        items.push({
          uid: generateUID("event", e.id, e.created_at),
          sequence: calculateSequence(e.created_at, e.updated_at),
          title,
          description,
          start: e.start_at,
          end: e.end_at,
          isAllDay: !hasTime,
          status: "CONFIRMED",
          lastModified: e.updated_at ? new Date(e.updated_at) : new Date(e.created_at),
        });
      }
    }

    if (scope === "events_and_job_requests") {
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          status,
          created_at,
          updated_at,
          assignment_status,
          assignment_decision_at,
          assigned_to,
          property:properties(
            id,
            property_name
          ),
          job_type:job_types(
            job_type_label
          ),
          profiles:assigned_to(
            full_name
          )
        `)
        .not("scheduled_date", "is", null);
      if (jErr) {
        console.error("[events_and_job_requests] Query error:", jErr);
        throw jErr;
      }
      
      console.log(`[events_and_job_requests] Found ${jobs?.length || 0} jobs with scheduled dates`);

      if (jobs && jobs.length > 0) {
        for (const j of jobs) {
          if (!j.scheduled_date) {
            console.log(`[events_and_job_requests] Skipping job ${j.id} - no scheduled_date`);
            continue;
          }
          
          // Property and profile are now embedded in the job object from the join
          const property = Array.isArray(j.property) ? j.property[0] : j.property;
          const profile = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles;
          const assigneeName = profile?.full_name;
          
          if (!property) {
            console.log(`[events_and_job_requests] Job ${j.id} missing property data - skipping`);
            continue;
          }

          const startDate = new Date(j.scheduled_date);
          if (isNaN(startDate.getTime())) continue;
          
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          
          const needsAssignment = checkNeedsAssignment(j);
          const isAccepted = checkJobAcceptance(j);
          
          const title = buildJobTitle(j, property, assigneeName, needsAssignment);
          const description = buildJobDescription(j, property, assigneeName, isAccepted, needsAssignment);
          const location = property?.property_name || "";
          const url = `https://portal.jgpaintingpros.com/dashboard/jobs/${j.id}`;

          let jobStatus = "CONFIRMED";
          if (needsAssignment) {
            jobStatus = "TENTATIVE";
          } else if (j.assigned_to && !isAccepted) {
            jobStatus = "TENTATIVE";
          }

          items.push({
            uid: generateUID("jobreq", j.id, j.created_at),
            sequence: calculateSequence(j.created_at, j.updated_at),
            title,
            description,
            start: startDate,
            end: endDate,
            isAllDay: true,
            location,
            url,
            categories: needsAssignment ? "Needs Assignment" : "Job Request",
            status: jobStatus,
            lastModified: j.updated_at ? new Date(j.updated_at) : new Date(j.created_at),
          });
        }
      }
    }

    if (scope === "completed_jobs") {
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          status,
          current_phase_id,
          created_at,
          updated_at,
          assignment_status,
          assignment_decision_at,
          assigned_to,
          property:properties(
            id,
            property_name
          ),
          job_type:job_types(
            job_type_label
          ),
          profiles:assigned_to(
            full_name
          )
        `)
        .order("scheduled_date", { ascending: true});
      if (jErr) throw jErr;

      const completed: typeof jobs = [];
      for (const j of jobs ?? []) {
        if (j.status === "Completed") {
          completed.push(j);
          continue;
        }
        if (!j.current_phase_id) continue;
        const { data: phase } = await supabase
          .from("job_phases")
          .select("job_phase_label")
          .eq("id", j.current_phase_id)
          .maybeSingle();
        const lbl = (phase?.job_phase_label || "").toLowerCase();
        if (lbl.includes("complete") || lbl.includes("done") || lbl.includes("closed")) {
          completed.push(j);
        }
      }

      if (completed.length > 0) {
        for (const j of completed) {
          const property = Array.isArray(j.property) ? j.property[0] : j.property;
          const profile = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles;
          const assigneeName = profile?.full_name;
          
          if (!property) continue;

          const scheduledDate = j.scheduled_date || new Date().toISOString().split('T')[0];
          const startDate = new Date(scheduledDate);
          if (isNaN(startDate.getTime())) continue;
          
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          
          const needsAssignment = checkNeedsAssignment(j);
          const isAccepted = checkJobAcceptance(j);
          
          const title = buildJobTitle(j, property, assigneeName, needsAssignment);
          const description = buildJobDescription(j, property, assigneeName, isAccepted, needsAssignment);
          const location = property?.property_name || "";
          const url = `https://portal.jgpaintingpros.com/dashboard/jobs/${j.id}`;

          items.push({
            uid: generateUID("jobdone", j.id, j.created_at),
            sequence: calculateSequence(j.created_at, j.updated_at),
            title,
            description,
            start: startDate,
            end: endDate,
            isAllDay: true,
            location,
            url,
            categories: "Completed Job",
            status: "CONFIRMED",
            lastModified: j.updated_at ? new Date(j.updated_at) : new Date(j.created_at),
          });
        }
      }
    }

    if (scope === "subcontractor") {
      const targetId = subcontractorId || tokenOwnerId;
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          status,
          created_at,
          updated_at,
          assignment_status,
          assignment_decision_at,
          assigned_to,
          property:properties(
            id,
            property_name
          ),
          job_type:job_types(
            job_type_label
          ),
          profiles:assigned_to(
            full_name
          )
        `)
        .eq("assigned_to", targetId)
        .not("scheduled_date", "is", null);
      if (jErr) throw jErr;

      if (jobs && jobs.length > 0) {
        for (const j of jobs) {
          const property = Array.isArray(j.property) ? j.property[0] : j.property;
          const profile = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles;
          const assigneeName = profile?.full_name;
          
          if (!property || !j.scheduled_date) continue;

          const isCancelled = CANCEL_STATES.includes(j.status ?? "");
          const isAccepted = checkJobAcceptance(j);
          const isDeclined = checkJobDeclined(j);

          const startDate = new Date(j.scheduled_date);
          if (isNaN(startDate.getTime())) continue;
          
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          
          const title = buildJobTitle(j, property, assigneeName, false);
          const description = buildJobDescription(j, property, assigneeName, isAccepted, false);
          const location = property?.property_name || "";
          const url = `https://portal.jgpaintingpros.com/dashboard/jobs/${j.id}`;

          let jobStatus = "CONFIRMED";
          if (isCancelled) {
            jobStatus = "CANCELLED";
          } else if (isDeclined) {
            jobStatus = "CANCELLED";
          } else if (!isAccepted) {
            jobStatus = "TENTATIVE";
          }

          items.push({
            uid: generateUID("sub", `${targetId}-${j.id}`, j.created_at),
            sequence: calculateSequence(j.created_at, j.updated_at),
            title,
            description,
            start: startDate,
            end: endDate,
            isAllDay: true,
            location,
            url,
            status: jobStatus,
            lastModified: j.updated_at ? new Date(j.updated_at) : new Date(j.created_at),
          });
        }
      }
    }

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//JG Painting Pros//Calendar Feed//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:JG Painting Pros",
      "X-WR-TIMEZONE:UTC",
    ];
    
    for (const it of items) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${esc(it.uid)}`);
      lines.push(`SEQUENCE:${it.sequence}`);
      lines.push(`DTSTAMP:${fmtDateTime(new Date())}`);
      
      if (it.lastModified) {
        lines.push(`LAST-MODIFIED:${fmtDateTime(it.lastModified)}`);
      }
      
      if (it.isAllDay) {
        lines.push(`DTSTART;VALUE=DATE:${fmtDate(it.start)}`);
        lines.push(`DTEND;VALUE=DATE:${fmtDate(it.end)}`);
      } else {
        lines.push(`DTSTART:${fmtDateTime(it.start)}`);
        lines.push(`DTEND:${fmtDateTime(it.end)}`);
      }
      
      lines.push(`SUMMARY:${esc(it.title)}`);
      
      if (it.status) {
        lines.push(`STATUS:${it.status}`);
      }
      
      if (it.description) {
        lines.push(`DESCRIPTION:${esc(it.description)}`);
      }
      
      if (it.location) {
        lines.push(`LOCATION:${esc(it.location)}`);
      }
      
      if (it.url) {
        lines.push(`URL:${esc(it.url)}`);
      }
      
      if (it.categories) {
        lines.push(`CATEGORIES:${esc(it.categories)}`);
      }
      
      lines.push("END:VEVENT");
    }
    
    lines.push("END:VCALENDAR");

    const body = lines.join("\r\n");
    console.log(`Generated ICS feed for scope=${scope}, items=${items.length}`);
    
    return new Response(body, {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="jg-calendar-${scope}.ics"`,
        "Cache-Control": "public, max-age=900",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error("Feed error:", e);
    let errorMessage = "Unknown error";
    let errorDetails = "";
    
    if (e instanceof Error) {
      errorMessage = e.message;
      errorDetails = e.stack || "";
    } else if (typeof e === "object" && e !== null) {
      try {
        errorMessage = JSON.stringify(e);
      } catch {
        errorMessage = String(e);
      }
    } else {
      errorMessage = String(e);
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorDetails
    }), { 
      status: 500, 
      headers: {
        ...commonHeaders,
        "Content-Type": "application/json",
      }
    });
  }
});
