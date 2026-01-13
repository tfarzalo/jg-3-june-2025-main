import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` : undefined } }
});

// Function to get the next Monday-Friday date
function getNextWorkday(): Date {
  const now = new Date();
  
  // Format in Eastern Time to get correctly day-of-week logic
  // Create a date that represents "Tomorrow ET"
  const etNowStr = now.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const etNow = new Date(etNowStr); 
  
  const tomorrow = new Date(etNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Find next Monday-Friday
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  
  return tomorrow;
}

// Function to get job counts for a specific date
async function getJobCountsForDate(date: Date): Promise<{ paint: number; callback: number; repair: number }> {
    // We are receiving a Javascript Date object that represents midnight local time (or UTC) of the target day.
    // However, scheduled_date in DB is YYYY-MM-DD.
    // If we convert this JS date to ISO string it becomes YYYY-MM-DDT...Z
    // If we use string comparison it is safer.
    
    // Format date to YYYY-MM-DD string
    const dateStr = date.toISOString().split('T')[0];
    // NOTE: If 'date' is constructed in local time but equals UTC midnight, .toISOString() might shift it if not careful.
    // Assuming 'date' passed in is correct UTC midnight for the day.
    
    // Actually, ensure we search for string match on scheduled_date (TEXT or DATE column)
    // rather than timestamp comparison which causes TZ issues.
  
  // Get jobs for the date
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('job_type:job_types(job_type_label)')
    .eq('scheduled_date', dateStr) // Use exact string match YYYY-MM-DD
    .not('status', 'eq', 'Cancelled');
  
  if (error) {
    console.error('Error fetching jobs:', error);
    return { paint: 0, callback: 0, repair: 0 };
  }
  
  let paint = 0;
  let callback = 0;
  let repair = 0;
  
  jobs?.forEach(job => {
    const jobType = Array.isArray(job.job_type) ? job.job_type[0] : job.job_type;
    const label = jobType?.job_type_label?.toLowerCase() || '';
    
    if (label.includes('paint')) {
      paint++;
    } else if (label.includes('callback')) {
      callback++;
    } else if (label.includes('repair')) {
      repair++;
    }
  });
  
  return { paint, callback, repair };
}

// Function to create agenda summary event
async function createAgendaSummaryEvent(date: Date, counts: { paint: number; callback: number; repair: number }) {
  const dateStr = date.toISOString().split('T')[0];
  const startTimeStr = `${dateStr}T00:00:00`;
  const endTimeStr = `${dateStr}T23:59:59`;
  
  const totalJobs = counts.paint + counts.callback + counts.repair;
  const title = `${counts.paint} Paint | ${counts.callback} Callback | ${counts.repair} Repair | Total: ${totalJobs}`;
  const details = `Paint: ${counts.paint} | Callback: ${counts.callback} | Repair: ${counts.repair} | Total: ${totalJobs}`;
  
  // Create the event with transparent background and job-specific colors
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      title,
      details,
      color: '#3b82f6', // Blue color for paint jobs (primary)
      is_all_day: true,
      start_at: startTimeStr,
      end_at: endTimeStr,
      created_by: '00000000-0000-0000-0000-000000000000' // System user ID (admin role)
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating agenda summary event:', error);
    return null;
  }
  
  return data;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Check if this is a cron job or manual trigger
    const url = new URL(req.url);
    const manual = url.searchParams.get('manual') === 'true';
    const pastWeek = url.searchParams.get('pastWeek') === 'true';
    
    if (!manual && !pastWeek) {
      // This should be called by a cron job at 12:01 AM Eastern
      // For now, we'll allow manual triggers for testing
    }
    
    if (pastWeek) {
      // Create events for the past 7 days (Monday-Friday only)
      const events = [];
      const today = new Date();
      
      for (let i = 7; i >= 1; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) {
          continue;
        }
        
        // Check if we already have an event for this date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const { data: existingEvent } = await supabase
          .from('calendar_events')
          .select('id')
          .like('title', '%Paint%Callback%Repair%')
          .gte('start_at', startOfDay.toISOString())
          .lte('start_at', endOfDay.toISOString())
          .single();
        
        if (!existingEvent) {
          // Get job counts for the date
          const counts = await getJobCountsForDate(date);
          
          // Create the agenda summary event
          const event = await createAgendaSummaryEvent(date, counts);
          if (event) {
            events.push({ date: date.toISOString(), event, counts });
          }
        } else {
          events.push({ date: date.toISOString(), message: 'Event already exists', existing: true });
        }
      }
      
      return new Response(JSON.stringify({ 
        message: 'Past week agenda summary events processed',
        events,
        totalCreated: events.filter(e => !e.existing).length,
        totalSkipped: events.filter(e => e.existing).length
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    // Get the next workday
    const nextWorkday = getNextWorkday();
    
    // Check if we already have an event for this date
    const startOfDay = new Date(nextWorkday);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(nextWorkday);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data: existingEvents } = await supabase
      .from('calendar_events')
      .select('id')
      .like('title', '%Paint%Callback%Repair%')
      .gte('start_at', startOfDay.toISOString())
      .lte('start_at', endOfDay.toISOString())
      .single();
    
    if (existingEvents) {
      return new Response(JSON.stringify({ 
        message: 'Agenda summary event already exists for this date',
        date: nextWorkday.toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    // Get job counts for the date
    const counts = await getJobCountsForDate(nextWorkday);
    
    // Create the agenda summary event
    const event = await createAgendaSummaryEvent(nextWorkday, counts);
    
    if (event) {
      return new Response(JSON.stringify({ 
        message: 'Agenda summary event created successfully',
        event,
        counts,
        date: nextWorkday.toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } else {
      return new Response(JSON.stringify({ 
        message: 'Failed to create agenda summary event'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
  } catch (error) {
    console.error('Error in daily agenda summary function:', error);
    return new Response(JSON.stringify({ 
      message: 'Internal server error',
      error: error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
});
