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
const eventSummary = (title: string | null | undefined, startAt: string | Date, userFullName?: string) => {
  try {
    const safeTitle = title || "Untitled Event";
    const d = typeof startAt === "string" ? new Date(startAt) : startAt;
    const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
    
    // Use simpler date formatting that works in Deno
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    
    const timeStr = hasTime ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` : "";
    
    const dateTimeStr = hasTime ? `${dateStr} ${timeStr}` : dateStr;
    const userStr = userFullName ? ` — ${userFullName}` : "";
    
    return `${safeTitle} — ${dateTimeStr}${userStr}`;
  } catch (err) {
    console.error("Error in eventSummary:", err);
    return String(title || "Event");
  }
};

// Helper function to build job summary with all required details
const jobSummary = (job: any, property: any, assigneeName?: string) => {
  const parts = [];
  
  // Property name first
  const propName = property.property_name || property.name;
  if (propName) {
    parts.push(propName);
  }
  
  // Unit number
  const unit = job.unit_number || job.unit;
  if (unit) {
    parts.push(`Unit ${unit}`);
  }
  
  // Address (full formatted address)
  const address = formatAddress(property);
  if (address) {
    parts.push(address);
  }
  
  // Work Order number
  const wo = job.work_order_number || job.work_order_num || job.id;
  parts.push(`WO#${wo}`);
  
  // Assigned Subcontractor (if provided and not for subcontractor-specific feeds)
  if (assigneeName) {
    parts.push(assigneeName);
  }
  
  // Job type (handle joined data)
  const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
  const jobTypeLabel = jobType?.job_type_label;
  if (jobTypeLabel) {
    parts.push(jobTypeLabel);
  }
  
  // Ensure we always have at least something
  if (parts.length === 0) {
    parts.push(`Job #${job.id}`);
  }
  
  return parts.join(" | ");
};

// Helper function to build job description
const jobDescription = (job: any, property: any, assigneeName?: string) => {
  const lines = [];
  
  // Work Order
  const wo = job.work_order_number || job.work_order_num || job.id;
  lines.push(`Work Order: WO#${wo}`);
  
  // Property
  const propName = property.property_name || property.name || "N/A";
  lines.push(`Property: ${propName}`);
  
  // Address
  const address = formatAddress(property);
  if (address) {
    lines.push(`Address: ${address}`);
  }
  
  // Unit
  const unit = job.unit_number || job.unit || "N/A";
  lines.push(`Unit: ${unit}`);
  
  // Job Type (handle joined data)
  const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
  const jobTypeLabel = jobType?.job_type_label || "N/A";
  lines.push(`Job Type: ${jobTypeLabel}`);
  
  // Assigned Subcontractor (if provided)
  if (assigneeName) {
    lines.push(`Assigned Subcontractor: ${assigneeName}`);
  }
  
  // Status
  if (job.status) {
    lines.push(`Status: ${job.status}`);
  }
  
  return lines.join("\\n");
};

// Common headers for all responses
const commonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle OPTIONS for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: commonHeaders,
    });
  }

  // Allow HEAD probes from Apple/GCal
  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=300",
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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response("Server misconfigured (env)", { status: 500, headers: commonHeaders });
    }

    // Validate token + owner role
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
      try {
        // Fetch events with user information
        const { data: events, error: eErr } = await supabase
          .from("calendar_events")
          .select(`
            id, 
            title, 
            details, 
            start_at, 
            end_at,
            created_by
          `)
          .order("start_at", { ascending: true });
        if (eErr) {
          console.error("Error fetching calendar_events:", eErr);
          throw eErr;
        }
        
        console.log(`Fetched ${events?.length || 0} calendar events`);

        // Get user information for events
        const userIds = [...new Set(events?.map(e => e.created_by).filter(Boolean) || [])];
        const { data: profiles } = userIds.length > 0 ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds) : { data: [] };
        
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

        // Calculate today's totals for Today's Agenda events
        const totalEventsToday = events?.filter(e => {
          try {
            const eventDate = new Date(e.start_at).toISOString().split('T')[0];
            return eventDate === todayStr;
          } catch {
            return false;
          }
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
          try {
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
          } catch (jobErr) {
            console.error("Error categorizing job:", jobErr);
          }
        });

        const totalJobsToday = paintCount + callbackCount + repairCount;
        const totalAllToday = totalEventsToday + totalJobsToday;

      for (const e of events ?? []) {
        try {
          const userFullName = profileMap.get(e.created_by);
          
          // Check if this is a "Today's Agenda" event
          const eventTitle = e.title || "";
          const isTodaysAgenda = eventTitle.toLowerCase().includes("today's agenda") || 
                                eventTitle.toLowerCase().includes("todays agenda");
          
          let title, description, location, url;
          
          if (isTodaysAgenda) {
            title = `${paintCount} Paint | ${callbackCount} Callback | ${repairCount} Repair | Total: ${totalAllToday}`;
            description = `Today's work schedule breakdown with ${totalAllToday} total items scheduled.`;
            location = undefined;
            url = undefined; // calendar_events table doesn't have portal_path column
          } else {
            title = eventSummary(e.title, e.start_at, userFullName);
            description = `${eventTitle}\\n${userFullName ? `User: ${userFullName}\\n` : ''}${e.details || ''}`;
            location = undefined;
            url = undefined; // calendar_events table doesn't have portal_path column
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
        } catch (eventErr) {
          console.error(`Error processing event ${e.id}:`, eventErr);
          // Continue with next event
        }
      }
      } catch (eventsErr) {
        console.error("Error in events processing:", eventsErr);
        throw eventsErr;
      }
    }

    if (scope === "events_and_job_requests") {
      // Fetch jobs with all needed fields
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select(`
          id, 
          work_order_num,
          job_type:job_types(job_type_label),
          unit_number,
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
          try {
            const property = propertyMap.get(j.property_id);
            const assigneeName = profileMap.get(j.assigned_to);
            
            if (!property) {
              console.log(`Skipping job ${j.id}: no property found`);
              continue; // Skip jobs without valid property
            }
            
            if (!j.scheduled_date) {
              console.log(`Skipping job ${j.id}: no scheduled_date`);
              continue;
            }

            // Create all-day event (12:01 AM to 11:59 PM)
            // Parse manually to ensuring we target the correct calendar day in UTC without shifting
            const [y, m, d] = j.scheduled_date.split('-').map(Number);
            // Create UTC dates to avoid local timezone shifts (e.g. UTC midnight -> Prev Day ET)
            // 12:00 PM UTC is generally safe for "That Day" across US timezones
            const startDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); 
            const endDate = new Date(Date.UTC(y, m - 1, d, 13, 0, 0)); // 1 hour duration or just a marker

            // Ideally we want 00:01 to 23:59 but floating time.
            // But since we are patching existing logic:
            // Let's create dates that definitely fall into the target day in ET (UTC-5/4)
            // 12:01 ET is 17:01 UTC.
            const startDateFixed = new Date(Date.UTC(y, m - 1, d, 17, 1, 0));
            // 11:59 PM ET is 04:59 AM NEXT DAY UTC. This might span days in UTC.
            // Let's stick to a safe midday window or just using the date property if ical supports it
            // Reusing existing variables start/end but initiated correctly
            
            const start = new Date(Date.UTC(y, m-1, d, 5, 1, 0)); // 05:01 UTC = 00:01 EST
            const end = new Date(Date.UTC(y, m-1, d, 23, 59, 0)); // 23:59 UTC = 18:59 EST (same day)
            
            // Previous code used start/end variable names
            
            const title = jobSummary(j, property, assigneeName);
            const description = jobDescription(j, property, assigneeName);
            const location = formatAddress(property);
            const url = `https://portal.jgpaintingpros.com/jobs/${j.id}`;

            items.push({
              uid: `jobreq-${j.id}@app`,
              title,
              description,
              start: start,
              end: end,
              location,
              url,
              categories: "Job Request",
            });
          } catch (jobErr) {
            console.error(`Error processing job ${j.id}:`, jobErr);
            // Continue with next job
          }
        }
      }
    }

    if (scope === "completed_jobs") {
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select(`
          id, 
          work_order_num,
          job_type:job_types(job_type_label),
          unit_number,
          property_id, 
          assigned_to,
          scheduled_date, 
          status, 
          current_phase_id
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
          try {
            const property = propertyMap.get(j.property_id);
            const assigneeName = profileMap.get(j.assigned_to);
            
            if (!property) {
              console.log(`Skipping completed job ${j.id}: no property found`);
              continue;
            }

            // Create all-day event
            const dateStr = j.scheduled_date || new Date().toISOString().split('T')[0];
            const [y, m, d] = dateStr.split('-').map(Number);
            
            const start = new Date(Date.UTC(y, m-1, d, 5, 1, 0)); // 05:01 UTC
            const end = new Date(Date.UTC(y, m-1, d, 23, 59, 0)); // 23:59 UTC
            
            const title = jobSummary(j, property, assigneeName);
            const description = jobDescription(j, property, assigneeName);
            const location = formatAddress(property);
            const url = `https://portal.jgpaintingpros.com/jobs/${j.id}`;

            items.push({
              uid: `jobdone-${j.id}@app`,
              title,
              description,
              start: start,
              end: end,
              location,
              url,
              categories: "Completed Job",
            });
          } catch (jobErr) {
            console.error(`Error processing completed job ${j.id}:`, jobErr);
            // Continue with next job
          }
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
          job_type:job_types(job_type_label),
          unit_number,
          property_id, 
          assigned_to,
          scheduled_date, 
          status
        `)
        .eq("assigned_to", targetId)
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
          try {
            const property = propertyMap.get(j.property_id);
            const assigneeName = profileMap.get(j.assigned_to);
            
            if (!property) {
              console.log(`Skipping subcontractor job ${j.id}: no property found`);
              continue;
            }
            
            if (!j.scheduled_date) {
              console.log(`Skipping subcontractor job ${j.id}: no scheduled_date`);
              continue;
            }

            // Create all-day event
            const [y, m, d] = j.scheduled_date.split('-').map(Number);
            const start = new Date(Date.UTC(y, m-1, d, 5, 1, 0)); // 05:01 UTC = 00:01 EST
            const end = new Date(Date.UTC(y, m-1, d, 23, 59, 0)); // 23:59 UTC = 18:59 EST
            
            const title = jobSummary(j, property, assigneeName);
            const description = jobDescription(j, property, assigneeName);
            const location = formatAddress(property);
            const url = `https://portal.jgpaintingpros.com/jobs/${j.id}`;

            items.push({
              uid: `sub-job-${j.id}@app`,
              title,
              description,
              start: start,
              end: end,
              location,
              url,
              categories: "Subcontractor Job",
            });
          } catch (jobErr) {
            console.error(`Error processing subcontractor job ${j.id}:`, jobErr);
            // Continue with next job
          }
        }
      }
    }
    // Generate iCal format
    const now = new Date();
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Paint Manager Pro//Calendar Feed//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Paint Manager Pro",
      "X-WR-TIMEZONE:America/New_York",
    ];

    for (const item of items) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${item.uid}`);
      lines.push(`DTSTAMP:${fmt(now)}`);
      lines.push(`DTSTART:${fmt(item.start)}`);
      lines.push(`DTEND:${fmt(item.end)}`);
      lines.push(`SUMMARY:${esc(item.title)}`);
      if (item.description) {
        lines.push(`DESCRIPTION:${esc(item.description)}`);
      }
      if (item.location) {
        lines.push(`LOCATION:${esc(item.location)}`);
      }
      if (item.url) {
        lines.push(`URL:${item.url}`);
      }
      if (item.categories) {
        lines.push(`CATEGORIES:${item.categories}`);
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const icsData = lines.join("\r\n");

    return new Response(icsData, {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="calendar.ics"',
      },
    });
  } catch (err) {
    console.error("Calendar feed error:", err);
    return new Response(`Internal error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
      headers: commonHeaders,
    });
  }
});
