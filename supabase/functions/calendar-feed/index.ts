import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatInTimeZone } from "npm:date-fns-tz";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "text/calendar",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();
    const calendarToken = url.searchParams.get("token");
    
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the calendar token and get the associated user
    const { data: tokenData, error: tokenError } = await supabase
      .from('calendar_tokens')
      .select('user_id')
      .eq('token', calendarToken)
      .single();

    if (tokenError || !tokenData) {
      return new Response("Invalid calendar token", { status: 401 });
    }

    const userId = tokenData.user_id;

    // Determine which jobs to fetch based on the path
    let query = supabase
      .from("jobs")
      .select(`
        id,
        work_order_num,
        unit_number,
        description,
        scheduled_date,
        property:properties (
          property_name,
          address,
          city,
          state
        ),
        job_phase:current_phase_id (
          job_phase_label
        ),
        job_type:job_types (
          job_type_label
        )
      `);

    // Filter by path
    if (path === "job-requests") {
      // Get Job Request phase ID
      const { data: phaseData } = await supabase
        .from("job_phases")
        .select("id")
        .eq("job_phase_label", "Job Request")
        .single();
        
      if (phaseData) {
        query = query.eq("current_phase_id", phaseData.id);
      }
    } else if (path === "work-orders") {
      // Get Work Order and Pending Work Order phase IDs
      const { data: phaseData } = await supabase
        .from("job_phases")
        .select("id")
        .in("job_phase_label", ["Work Order", "Pending Work Order"]);
        
      if (phaseData && phaseData.length > 0) {
        query = query.in("current_phase_id", phaseData.map(p => p.id));
      }
    } else {
      // Filter by assigned user
      query = query.eq("assigned_to", userId);
    }

    // Get future jobs only
    query = query.gte("scheduled_date", new Date().toISOString());
    
    // Execute query
    const { data: jobs, error } = await query;

    if (error) {
      throw error;
    }

    // Generate calendar content
    const now = new Date();
    const calendarName = path === "job-requests" ? "Job Requests" :
                        path === "work-orders" ? "Work Orders" :
                        "All Jobs";

    let calendarContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//JG Painting Pros//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:JG Painting - ${calendarName}
X-WR-TIMEZONE:America/New_York
X-WR-CALDESC:JG Painting ${calendarName} Calendar
BEGIN:VTIMEZONE
TZID:America/New_York
X-LIC-LOCATION:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE`;

    if (!jobs || jobs.length === 0) {
      calendarContent += "\nEND:VCALENDAR";
    } else {
      // Add events
      calendarContent += "\n" + jobs.map(job => {
        const scheduledDate = new Date(job.scheduled_date);
        const nextDay = new Date(scheduledDate);
        nextDay.setDate(nextDay.getDate() + 1);

        // Format dates in Eastern Time
        const startDate = formatInTimeZone(scheduledDate, 'America/New_York', "yyyyMMdd'T'HHmmss");
        const endDate = formatInTimeZone(nextDay, 'America/New_York', "yyyyMMdd'T'HHmmss");
        const nowStr = formatInTimeZone(now, 'America/New_York', "yyyyMMdd'T'HHmmss");

        // Escape special characters in text fields
        const escapeText = (text: string) => text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
        const title = escapeText(`${job.job_type.job_type_label} - ${job.property.property_name} Unit ${job.unit_number}`);
        const description = escapeText([
          `Work Order #: ${job.work_order_num}`,
          `Description: ${job.description || 'No description provided'}`,
          `Phase: ${job.job_phase.job_phase_label}`,
          `Type: ${job.job_type.job_type_label}`
        ].join('\\n'));
        const location = escapeText(`${job.property.address || ''}, ${job.property.city || ''}, ${job.property.state || ''}`);

        return `BEGIN:VEVENT
UID:job-${job.id}@portal.jgpaintingprosinc.com
DTSTAMP:${nowStr}
DTSTART;TZID=America/New_York:${startDate}
DTEND;TZID=America/New_York:${endDate}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
STATUS:CONFIRMED
SEQUENCE:0
TRANSP:OPAQUE
CATEGORIES:${escapeText(job.job_phase.job_phase_label)},${escapeText(job.job_type.job_type_label)}
ORGANIZER;CN="JG Painting Pros":mailto:admin@jgpaintingprosinc.com
URL:${window.location.origin}/jobs/${job.id}
END:VEVENT`;
      }).join('\n') + "\nEND:VCALENDAR";
    }

    return new Response(calendarContent, {
      headers: {
        ...corsHeaders,
        "Content-Disposition": `attachment; filename="jg-painting-${path || "all-jobs"}.ics"`,
      },
    });
  } catch (error) {
    console.error("Error generating calendar:", error);
    return new Response("Error generating calendar", { status: 500 });
  }
});