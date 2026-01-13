import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface JobData {
  work_order_number: string;
  property_name: string;
  unit_number: string;
  assigned_to: string;
  job_type: string;
}

// Format work order number as WO-XXXXXX
function formatWorkOrderNumber(woNum: string | number | null): string {
  if (!woNum) return 'N/A';
  
  // If it's already formatted (starts with WO-), return as is
  const woStr = String(woNum);
  if (woStr.startsWith('WO-')) {
    return woStr;
  }
  
  // Otherwise, format as WO-XXXXXX with leading zeros (6 digits)
  const numericPart = woStr.replace(/\D/g, ''); // Remove any non-digits
  const paddedNumber = numericPart.padStart(6, '0');
  return `WO-${paddedNumber}`;
}

interface JobSummary {
  paint: number;
  callback: number;
  repair: number;
  total: number;
}

// Get jobs for a specific date (DATE-based, not time-based)
async function getJobsForDate(date: string): Promise<JobData[]> {
  // Use PostgreSQL's date casting with ET timezone
  // This matches exactly how the calendar displays jobs by date
  console.log('Querying jobs for date:', date);
  
  // Calculate next day for range query to optimize fetch
  // We want to fetch jobs where scheduled_date (Midnight ET) falls on this day
  // Since Midnight ET = 05:00 UTC, a UTC date range of [date, date+1] covers it
  const dateObj = new Date(date);
  const nextDateObj = new Date(dateObj);
  nextDateObj.setDate(dateObj.getDate() + 1);
  const nextDate = nextDateObj.toISOString().split('T')[0];

  console.log(`Querying jobs between ${date} and ${nextDate} (UTC range covering ET day)`);
  
  // Query jobs within the date range
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      work_order_num,
      properties(property_name),
      unit_number,
      profiles(full_name),
      job_types(job_type_label),
      scheduled_date,
      status
    `)
    .not('scheduled_date', 'is', null)
    .not('status', 'eq', 'Cancelled')
    .gte('scheduled_date', date)
    .lt('scheduled_date', nextDate)
    .order('scheduled_date', { ascending: true });
  
  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
  
  console.log(`Fetched ${data?.length || 0} total non-cancelled jobs with scheduled dates`);
  
  // Filter to jobs matching the target DATE in ET timezone
  const filteredJobs = (data || []).filter((job: any) => {
    if (!job.scheduled_date) return false;
    
    // Convert the job's scheduled_date to ET timezone and extract date
    // If scheduled_date is YYYY-MM-DD, we can compare directly!
    // The issue with previous code was creating new Date("YYYY-MM-DD") which is UTC midnight
    // converting that to ET made it previous day.
    // simpler: If job.scheduled_date is YYYY-MM-DD string, just compare it to date (which is YYYY-MM-DD)
    
    // Check if scheduled_date is strictly YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(job.scheduled_date)) {
       return job.scheduled_date === date;
    }

    // Fallback for full ISO strings
    const jobDate = new Date(job.scheduled_date);
    const etDateString = jobDate.toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Convert MM/DD/YYYY to YYYY-MM-DD for comparison
    const [month, day, year] = etDateString.split('/');
    const jobDateET = `${year}-${month}-${day}`;
    
    return jobDateET === date;
  });
  
  console.log(`Found ${filteredJobs.length} jobs for date ${date} (after ET date filtering)`);
  
  if (filteredJobs.length > 0) {
    console.log('Sample job:', {
      work_order: filteredJobs[0].work_order_num,
      scheduled_date: filteredJobs[0].scheduled_date,
      status: filteredJobs[0].status
    });
  } else {
    console.log('No jobs found for target date. Showing recent jobs for debugging:');
    
    // Show the 5 most recent jobs with their ET dates
    const recentJobs = data?.slice(0, 5).map((job: any) => {
      // Allow direct string debug if it is YYYY-MM-DD
      if (typeof job.scheduled_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(job.scheduled_date)) {
         return {
            work_order: job.work_order_num,
            raw_date: job.scheduled_date,
            et_date: job.scheduled_date // it IS the date
         };
      }

      const jobDate = new Date(job.scheduled_date);
      const etDateString = jobDate.toLocaleDateString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [month, day, year] = etDateString.split('/');
      return {
        work_order: job.work_order_num,
        scheduled_date_raw: job.scheduled_date,
        scheduled_date_ET: `${year}-${month}-${day}`,
        status: job.status
      };
    });
    
    console.log('Recent jobs:', JSON.stringify(recentJobs, null, 2));
  }
  
  return filteredJobs.map((job: any) => ({
    work_order_number: formatWorkOrderNumber(job.work_order_num),
    property_name: job.properties?.property_name || 'Unknown Property',
    unit_number: job.unit_number || 'N/A',
    assigned_to: job.profiles?.full_name || 'Unassigned',
    job_type: job.job_types?.job_type_label || 'Unknown'
  }));
}

// Calculate job summary
function calculateSummary(jobs: JobData[]): JobSummary {
  const summary = {
    paint: 0,
    callback: 0,
    repair: 0,
    total: jobs.length
  };
  
  jobs.forEach(job => {
    const type = job.job_type.toLowerCase();
    if (type.includes('paint')) {
      summary.paint++;
    } else if (type.includes('callback')) {
      summary.callback++;
    } else if (type.includes('repair')) {
      summary.repair++;
    }
  });
  
  return summary;
}

// Generate email HTML
function generateEmailHTML(jobs: JobData[], summary: JobSummary, date: string): string {
  const dateObj = new Date(date);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; 
            background: #f5f5f5; 
            padding: 20px; 
            margin: 0;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px;
            overflow: hidden;
        }
        .header {
            padding: 20px;
            background: #1e293b;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .summary-header { 
            background: #f0f4f8; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px;
        }
        .summary-stats { 
            display: flex; 
            justify-content: space-around; 
            text-align: center;
            flex-wrap: wrap;
        }
        .stat { 
            padding: 10px;
            min-width: 80px;
        }
        .stat-number { 
            font-size: 48px; 
            font-weight: bold; 
            margin-bottom: 5px;
        }
        .stat-label { 
            font-size: 16px; 
            color: #666;
            font-weight: 600;
        }
        .paint { color: #3b82f6; }
        .callback { color: #f97316; }
        .repair { color: #ef4444; }
        .total { color: #8b5cf6; }
        
        .jobs-container {
            padding: 0 20px 20px 20px;
        }
        
        .job-card { 
            background: white; 
            border: 1px solid #e5e7eb; 
            border-radius: 8px; 
            padding: 15px; 
            margin-bottom: 15px;
        }
        .job-header { 
            font-weight: bold; 
            font-size: 18px; 
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .job-details { 
            font-size: 14px; 
            color: #666; 
            line-height: 1.8;
        }
        .job-request-badge { 
            background: #2563eb; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 12px; 
            font-size: 12px;
            white-space: nowrap;
        }
        .footer {
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${dayName}, ${formattedDate}</h1>
        </div>
        
        <div class="summary-header" style="background: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px;">
            <div class="summary-stats" style="display: flex; justify-content: space-around; text-align: center; flex-wrap: wrap;">
                <div class="stat" style="padding: 10px; min-width: 80px;">
                    <div class="stat-number paint" style="font-size: 48px; font-weight: bold; margin-bottom: 5px; color: #3b82f6;">${summary.paint}</div>
                    <div class="stat-label" style="font-size: 16px; color: #666; font-weight: 600;">Paint</div>
                </div>
                <div class="stat" style="padding: 10px; min-width: 80px;">
                    <div class="stat-number callback" style="font-size: 48px; font-weight: bold; margin-bottom: 5px; color: #f97316;">${summary.callback}</div>
                    <div class="stat-label" style="font-size: 16px; color: #666; font-weight: 600;">Callback</div>
                </div>
                <div class="stat" style="padding: 10px; min-width: 80px;">
                    <div class="stat-number repair" style="font-size: 48px; font-weight: bold; margin-bottom: 5px; color: #ef4444;">${summary.repair}</div>
                    <div class="stat-label" style="font-size: 16px; color: #666; font-weight: 600;">Repair</div>
                </div>
                <div class="stat" style="padding: 10px; min-width: 80px;">
                    <div class="stat-number total" style="font-size: 48px; font-weight: bold; margin-bottom: 5px; color: #8b5cf6;">${summary.total}</div>
                    <div class="stat-label" style="font-size: 16px; color: #666; font-weight: 600;">Total</div>
                </div>
            </div>
        </div>
        
        <div class="jobs-container">
            ${jobs.length === 0 ? '<p style="text-align: center; color: #666; padding: 40px;">No jobs scheduled for this day.</p>' : ''}
            ${jobs.map(job => `
                <div class="job-card">
                    <div class="job-header">
                        <span>${job.work_order_number}</span>
                        <span class="job-request-badge">Job Request</span>
                    </div>
                    <div class="job-details">
                        <div><strong>Property:</strong> ${job.property_name}</div>
                        <div><strong>Unit:</strong> #${job.unit_number}</div>
                        <div><strong>Assigned To:</strong> ${job.assigned_to}</div>
                        <div><strong>Type:</strong> ${job.job_type}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>This is an automated email from your JG Painting Pros Inc. Portal.</p>
            <p>Sent at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
        </div>
    </div>
</body>
</html>
  `;
}

// Send email via Supabase send-email function
async function sendEmail(to: string, subject: string, html: string) {
  try {
    console.log('Invoking send-email function for:', to);
    
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject,
        html,
        text: `Please view this email in an HTML-enabled email client.` // Fallback text
      }
    });
    
    if (error) {
      console.error('Send-email function error:', error);
      throw error;
    }
    
    if (!data || !data.success) {
      throw new Error(data?.error || 'Failed to send email');
    }
    
    console.log('Email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log("=== SEND-DAILY-AGENDA-EMAIL FUNCTION CALLED ===");
  console.log("Request method:", req.method);

  try {
    const { mode, recipient, test } = await req.json();
    
    console.log('Request params:', { mode, recipient: recipient ? 'provided' : 'none', test });
    
    // Get today's date in ET timezone (DATE only, not time)
    const now = new Date();
    const etDateString = now.toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Convert from MM/DD/YYYY to YYYY-MM-DD
    const [month, day, year] = etDateString.split('/');
    const dateStr = `${year}-${month}-${day}`;
    
    console.log('Processing date (ET):', dateStr, `(from ${etDateString})`);
    
    // Get jobs for today
    const jobs = await getJobsForDate(dateStr);
    const summary = calculateSummary(jobs);
    
    console.log('Job summary:', summary);
    
    // Generate email - use the ET date for display
    const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const subject = `JG Daily Job Summary - ${etDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`;
    const html = generateEmailHTML(jobs, summary, dateStr);
    
    // If this is not a test run and there are no jobs, skip sending and log
    if (!test && jobs.length === 0) {
      console.log('No jobs scheduled for today; skipping send for non-test run');
      const logInsert = await supabase
        .from('daily_email_send_log')
        .insert({
          recipients: [],
          job_count: 0,
          success: true,
          error_message: null,
          triggered_by: 'cron'
        });
      if (logInsert.error) {
        console.error('Failed to insert skip log:', logInsert.error);
      } else {
        console.log('Skip log inserted');
      }
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No jobs scheduled today; email not sent',
          sent: 0,
          failed: 0,
          summary,
          totalJobs: jobs.length
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    let sent = 0;
    let failed = 0;
    const results = [];
    const recipientsSent: string[] = [];
    
    if (mode === 'single' && recipient) {
      // Send to single test recipient
      console.log('Sending to single recipient:', recipient);
      const result = await sendEmail(recipient, subject, html);
      if (result.success) {
        sent++;
        recipientsSent.push(recipient);
      } else {
        failed++;
      }
      results.push({ recipient, ...result });
    } else {
      // Send to all enabled users
      console.log('Sending to all enabled users, mode:', mode);
      
      // Use a raw SQL query to avoid PostgREST relationship issues
      const { data: settings, error: settingsError } = await supabase.rpc('get_enabled_email_recipients');
      
      if (settingsError) {
        console.error('Error fetching settings:', settingsError);
        throw new Error(`Failed to fetch email settings: ${settingsError.message}`);
      }
      
      console.log(`Found ${settings?.length || 0} enabled recipients`);
      
      if (!settings || settings.length === 0) {
        console.warn('No enabled recipients found in daily_email_settings');
        throw new Error('No enabled recipients found. Please enable at least one user in Daily Agenda Email Settings.');
      }
      
      for (const setting of settings) {
        const email = setting.email;
        const name = setting.full_name;
        if (email) {
          console.log('Sending to:', email, `(${name})`);
          const result = await sendEmail(email, subject, html);
          if (result.success) {
            sent++;
            recipientsSent.push(email);
            console.log(`✓ Email sent successfully to ${email}`);
          } else {
            failed++;
            console.error(`✗ Failed to send email to ${email}:`, result.error);
          }
          results.push({ recipient: email, name, ...result });
        } else {
          console.warn('Skipping setting with no email:', setting);
        }
      }
    }
    
    // Insert send log
    const logInsert = await supabase
      .from('daily_email_send_log')
      .insert({
        recipients: recipientsSent,
        job_count: jobs.length,
        success: failed === 0,
        error_message: failed > 0 ? `Failed: ${failed} recipient(s)` : null,
        triggered_by: test ? 'manual' : 'cron'
      });
    if (logInsert.error) {
      console.error('Failed to insert send log:', logInsert.error);
    } else {
      console.log('Send log inserted');
    }
    
    const response = {
      success: true,
      message: `Successfully sent ${sent} email(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      sent,
      failed,
      summary,
      totalJobs: jobs.length,
      results: test ? results : undefined
    };
    
    console.log('Response:', response);
    
    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
    
  } catch (error) {
    console.error('Error in send-daily-agenda-email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
