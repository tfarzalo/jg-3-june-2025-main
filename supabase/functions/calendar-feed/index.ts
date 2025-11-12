// supabase/functions/calendar-feed/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

// Edge Functions Secrets are accessed via Deno.env.get()
// These should match exactly what you set in the Edge Functions Secrets section
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Log what we're getting (for debugging)
console.log("SUPABASE_URL:", SUPABASE_URL ? "Set" : "Missing");
console.log("SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY ? "Set" : "Missing");
console.log("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Missing");

// Hard fail early if misconfigured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  console.error("Available env vars:", Object.keys(Deno.env.toObject()));
  throw new Error("Environment variables not configured");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
  global: {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, // service role power, RLS deferred
  },
});

type Scope = "events" | "events_and_job_requests" | "completed_jobs" | "subcontractor";
const OPEN_STATES = ["Open", "Scheduled", "Pending"];
const CANCEL_STATES = ["Cancelled", "Canceled"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (dt: string | Date) => {
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
const esc = (t?: string) =>
  (t ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

// Helper function to format address
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
  return parts.join(" ");
};

// Helper function to format event summary with date/time
const eventSummary = (title: string, startAt: string | Date, userFullName?: string) => {
  const d = typeof startAt === "string" ? new Date(startAt) : startAt;
  const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
  
  const dateStr = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
  
  const timeStr = hasTime ? d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  }) : "";
  
  const dateTimeStr = hasTime ? `${dateStr} ${timeStr}` : dateStr;
  const userStr = userFullName ? ` — ${userFullName}` : "";
  
  return `${title} — ${dateTimeStr}${userStr}`;
};

// Helper function to build job summary
const jobSummary = (job: any, property: any) => {
  const parts = [];
  
  // Work Order number
  const wo = job.work_order_number || job.work_order_num || job.id;
  parts.push(`WO #${wo}`);
  
  // Property name or formatted address
  const propName = property.property_name || property.name || formatAddress(property);
  parts.push(propName);
  
  // Unit number
  if (job.unit_number || job.unit) {
    parts.push(`Unit ${job.unit_number || job.unit}`);
  }
  
  // Job type (handle joined data)
  const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
  const jobTypeLabel = jobType?.job_type_label;
  if (jobTypeLabel) {
    parts.push(jobTypeLabel);
  }
  
  return parts.join(" — ");
};

// Helper function to build job description
const jobDescription = (job: any, property: any, assigneeName?: string) => {
  const lines = [];
  
  // Work Order
  const wo = job.work_order_number || job.work_order_num || job.id;
  lines.push(`Work Order: WO #${wo}`);
  
  // Property
  const propName = property.property_name || property.name || formatAddress(property);
  lines.push(`Property: ${propName}`);
  
  // Address
  const address = formatAddress(property);
  lines.push(`Address: ${address}`);
  
  // Unit
  const unit = job.unit_number || job.unit || "N/A";
  lines.push(`Unit: ${unit}`);
  
  // Job Type (handle joined data)
  const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
  const jobTypeLabel = jobType?.job_type_label || "N/A";
  lines.push(`Job Type: ${jobTypeLabel}`);
  
  // Assigned Subcontractor
  const assignee = assigneeName || "Unassigned";
  lines.push(`Assigned Subcontractor: ${assignee}`);
  
  return lines.join("\\n");
};

Deno.serve(async (req) => {
  // Allow HEAD probes from Apple/GCal
  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") || "") as Scope;
    const token = url.searchParams.get("token") || "";
    const subcontractorId = url.searchParams.get("subcontractor_id");

    if (!token) return new Response("Missing token", { status: 400 });
    if (!["events", "events_and_job_requests", "completed_jobs", "subcontractor"].includes(scope)) {
      return new Response("Invalid scope", { status: 400 });
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response("Server misconfigured (env)", { status: 500 });
    }

    // Validate token + owner role
    const { data: ct, error: ctErr } = await supabase
      .from("calendar_tokens")
      .select("user_id, token")
      .eq("token", token)
      .maybeSingle();
    if (ctErr || !ct) return new Response("Invalid token", { status: 403 });

    const tokenOwnerId = ct.user_id as string;
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", tokenOwnerId)
      .maybeSingle();
    const ownerRole = ownerProfile?.role ?? "user";
    const isAdminLike = ["admin", "jg_management", "is_super_admin"].includes(ownerRole);

    if (scope === "subcontractor" && subcontractorId && subcontractorId !== tokenOwnerId && !isAdminLike) {
      return new Response("Forbidden", { status: 403 });
    }

    type Item = { 
      uid: string; 
      title: string; 
      description?: string; 
      start: string | Date; 
      end: string | Date;
      location?: string;
      url?: string;
      categories?: string;
    };
    const items: Item[] = [];

    // Get today's date for Today's Agenda calculations
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (scope === "events" || scope === "events_and_job_requests") {
      // Fetch events with user information
      const { data: events, error: eErr } = await supabase
        .from("calendar_events")
        .select(`
          id, 
          title, 
          details, 
          start_at, 
          end_at,
          location,
          portal_path,
          user_id,
          created_by
        `)
        .order("start_at", { ascending: true });
      if (eErr) throw eErr;

      // Get user information for events
      const userIds = [...new Set(events?.map(e => e.user_id || e.created_by).filter(Boolean) || [])];
      const { data: profiles } = userIds.length > 0 ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds) : { data: [] };
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Calculate today's totals for Today's Agenda events
      const totalEventsToday = events?.filter(e => {
        const eventDate = new Date(e.start_at).toISOString().split('T')[0];
        return eventDate === todayStr;
      }).length || 0;

      // Get today's jobs with job type information for categorization
      const { data: jobsToday } = await supabase
        .from("jobs")
        .select(`
          id,
          job_type:job_types(job_type_label)
        `)
        .eq("scheduled_date", todayStr)
        .in("status", OPEN_STATES);

      // Categorize jobs by type (Paint, Callback, Repair)
      let paintCount = 0;
      let callbackCount = 0;
      let repairCount = 0;

      jobsToday?.forEach(job => {
        const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
        const label = jobType?.job_type_label?.toLowerCase() || '';
        
        if (label.includes('paint')) {
          paintCount++;
        } else if (label.includes('callback')) {
          callbackCount++;
        } else if (label.includes('repair')) {
          repairCount++;
        } else {
          // Default to paint for any other job types
          paintCount++;
        }
      });

      const totalJobsToday = paintCount + callbackCount + repairCount;
      const totalAllToday = totalEventsToday + totalJobsToday;

      for (const e of events ?? []) {
        const userFullName = profileMap.get(e.user_id || e.created_by);
        
        // Check if this is a "Today's Agenda" event
        const isTodaysAgenda = e.title?.toLowerCase().includes("today's agenda") || 
                              e.title?.toLowerCase().includes("todays agenda");
        
        let title, description, location, url;
        
        if (isTodaysAgenda) {
          title = `${paintCount} Paint | ${callbackCount} Callback | ${repairCount} Repair | Total: ${totalAllToday}`;
          description = `Today's work schedule breakdown with ${totalAllToday} total items scheduled.`;
          location = e.location || undefined;
          url = e.portal_path ? `https://portal.jgpaintingpros.com${e.portal_path}` : undefined;
        } else {
          title = eventSummary(e.title, e.start_at, userFullName);
          description = `${e.title}\\n${userFullName ? `User: ${userFullName}\\n` : ''}${e.details || ''}`;
          location = e.location || undefined;
          url = e.portal_path ? `https://portal.jgpaintingpros.com${e.portal_path}` : undefined;
        }

        items.push({
          uid: `event-${e.id}@app`,
          title,
          description,
          start: e.start_at,
          end: e.end_at,
          location,
          url,
        });
      }
    }

    if (scope === "events_and_job_requests") {
      // Fetch jobs with all needed fields
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select(`
          id, 
          work_order_number,
          work_order_num,
          job_type:job_types(job_type_label),
          unit_number,
          unit,
          property_id, 
          assigned_to,
          scheduled_date, 
          status
        `)
        .not("scheduled_date", "is", null)
        .in("status", OPEN_STATES as any);
      if (jErr) throw jErr;

      if (jobs && jobs.length > 0) {
        // Get property IDs and assigned user IDs
        const propertyIds = [...new Set(jobs.map(j => j.property_id).filter(Boolean))];
        const assignedUserIds = [...new Set(jobs.map(j => j.assigned_to).filter(Boolean))];

        // Batch fetch properties
        const { data: properties } = propertyIds.length > 0 ? await supabase
          .from("properties")
          .select(`
            id, 
            property_name, 
            name, 
            address, 
            address_1, 
            address_2, 
            city, 
            state, 
            postal_code, 
            zip
          `)
          .in("id", propertyIds) : { data: [] };

        // Batch fetch profiles for assigned users
        const { data: profiles } = assignedUserIds.length > 0 ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", assignedUserIds) : { data: [] };

        const propertyMap = new Map(properties?.map(p => [p.id, p]) || []);
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

        for (const j of jobs) {
          const property = propertyMap.get(j.property_id);
          const assigneeName = profileMap.get(j.assigned_to);
          
          if (!property) continue; // Skip jobs without valid property

          // Create all-day event (12:01 AM to 11:59 PM Eastern)
          const startDate = new Date(j.scheduled_date);
          startDate.setHours(0, 1, 0, 0); // 12:01 AM
          
          const endDate = new Date(j.scheduled_date);
          endDate.setHours(23, 59, 59, 999); // 11:59 PM
          
          const title = jobSummary(j, property);
          const description = jobDescription(j, property, assigneeName);
          const location = formatAddress(property);
          const url = `https://portal.jgpaintingpros.com/jobs/${j.id}`;

          items.push({
            uid: `jobreq-${j.id}@app`,
            title,
            description,
            start: startDate,
            end: endDate,
            location,
            url,
            categories: "Job Request",
          });
        }
      }
    }

    if (scope === "completed_jobs") {
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select(`
          id, 
          work_order_number,
          work_order_num,
          job_type:job_types(job_type_label),
          unit_number,
          unit,
          property_id, 
          assigned_to,
          scheduled_date, 
          status, 
          current_phase_id
        `)
        .order("scheduled_date", { ascending: true });
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
        // Get property IDs and assigned user IDs
        const propertyIds = [...new Set(completed.map(j => j.property_id).filter(Boolean))];
        const assignedUserIds = [...new Set(completed.map(j => j.assigned_to).filter(Boolean))];

        // Batch fetch properties
        const { data: properties } = propertyIds.length > 0 ? await supabase
          .from("properties")
          .select(`
            id, 
            property_name, 
            name, 
            address, 
            address_1, 
            address_2, 
            city, 
            state, 
            postal_code, 
            zip
          `)
          .in("id", propertyIds) : { data: [] };

        // Batch fetch profiles for assigned users
        const { data: profiles } = assignedUserIds.length > 0 ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", assignedUserIds) : { data: [] };

        const propertyMap = new Map(properties?.map(p => [p.id, p]) || []);
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

        for (const j of completed) {
          const property = propertyMap.get(j.property_id);
          const assigneeName = profileMap.get(j.assigned_to);
          
          if (!property) continue; // Skip jobs without valid property

          // Create all-day event (12:01 AM to 11:59 PM Eastern)
          const scheduledDate = j.scheduled_date || new Date().toISOString().split('T')[0];
          const startDate = new Date(scheduledDate);
          startDate.setHours(0, 1, 0, 0); // 12:01 AM
          
          const endDate = new Date(scheduledDate);
          endDate.setHours(23, 59, 59, 999); // 11:59 PM
          
          const title = jobSummary(j, property);
          const description = jobDescription(j, property, assigneeName);
          const location = formatAddress(property);
          const url = `https://portal.jgpaintingpros.com/jobs/${j.id}`;

          items.push({
            uid: `jobdone-${j.id}@app`,
            title,
            description,
            start: startDate,
            end: endDate,
            location,
            url,
            categories: "Completed Job",
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
          work_order_number,
          work_order_num,
          job_type:job_types(job_type_label),
          unit_number,
          unit,
          property_id, 
          assigned_to,
          scheduled_date, 
          status
        `)
        .eq("assigned_to", targetId)
        .not("scheduled_date", "is", null);
      if (jErr) throw jErr;

      if (jobs && jobs.length > 0) {
        // Get property IDs
        const propertyIds = [...new Set(jobs.map(j => j.property_id).filter(Boolean))];

        // Batch fetch properties
        const { data: properties } = propertyIds.length > 0 ? await supabase
          .from("properties")
          .select(`
            id, 
            property_name, 
            name, 
            address, 
            address_1, 
            address_2, 
            city, 
            state, 
            postal_code, 
            zip
          `)
          .in("id", propertyIds) : { data: [] };

        const propertyMap = new Map(properties?.map(p => [p.id, p]) || []);

        for (const j of jobs) {
          if (CANCEL_STATES.includes(j.status ?? "")) continue;
          
          const property = propertyMap.get(j.property_id);
          if (!property) continue; // Skip jobs without valid property

          // Create all-day event (12:01 AM to 11:59 PM Eastern)
          const startDate = new Date(j.scheduled_date);
          startDate.setHours(0, 1, 0, 0); // 12:01 AM
          
          const endDate = new Date(j.scheduled_date);
          endDate.setHours(23, 59, 59, 999); // 11:59 PM
          
          const title = jobSummary(j, property);
          const description = jobDescription(j, property);
          const location = formatAddress(property);
          const url = `https://portal.jgpaintingpros.com/jobs/${j.id}`;

          items.push({
            uid: `sub-${targetId}-${j.id}@app`,
            title,
            description,
            start: startDate,
            end: endDate,
            location,
            url,
            categories: "Assigned Job",
          });
        }
      }
    }

    // Build ICS
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//YourApp//Calendar Feed//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];
    for (const it of items) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${esc(it.uid)}`);
      lines.push(`DTSTAMP:${fmt(new Date())}`);
      lines.push(`DTSTART:${fmt(it.start)}`);
      lines.push(`DTEND:${fmt(it.end)}`);
      lines.push(`SUMMARY:${esc(it.title)}`);
      if (it.description) lines.push(`DESCRIPTION:${esc(it.description)}`);
      if (it.location) lines.push(`LOCATION:${esc(it.location)}`);
      if (it.url) lines.push(`URL:${esc(it.url)}`);
      if (it.categories) lines.push(`CATEGORIES:${esc(it.categories)}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");

    const body = lines.join("\r\n");
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="calendar-${scope}.ics"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("Feed error:", e);
    return new Response("Feed error", { status: 500 });
  }
});