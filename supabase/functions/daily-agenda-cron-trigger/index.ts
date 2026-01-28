import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Lightweight cron trigger function
 * Called by pg_cron daily to trigger the existing send-daily-agenda-email function
 */
Deno.serve(async (req) => {
  // Verify this is a legitimate cron trigger
  const authHeader = req.headers.get('Authorization');
  
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    console.error('Unauthorized cron trigger attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log('🕐 Daily agenda cron trigger activated at:', new Date().toISOString());
  console.log('🌍 Current time (ET):', new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

  try {
    // Call the existing send-daily-agenda-email function
    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-daily-agenda-email`;
    
    console.log('📞 Calling send-daily-agenda-email function...');
    
    const response = await fetch(sendEmailUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: 'all',      // Send to all enabled users
        test: false       // This is not a test, it's the real daily send
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Send-daily-agenda-email function failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Daily agenda emails sent:', result);

    // Log to tracking table
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('📝 Logging to daily_summary_log table...');
    const { data: logData, error: logError } = await supabase
      .from('daily_summary_log')
      .insert({
        sent_at: new Date().toISOString(),
        recipient_count: (result.sent || 0) + (result.failed || 0),
        success_count: result.sent || 0,
        failure_count: result.failed || 0,
        triggered_by: 'cron',
        error_details: result.failed > 0 ? result.results : null
      })
      .select();

    if (logError) {
      console.error('❌ Failed to log to daily_summary_log:', logError);
    } else {
      console.log('✅ Successfully logged to daily_summary_log:', logData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily agenda cron completed successfully',
        timestamp: new Date().toISOString(),
        ...result
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Cron trigger error:', error);
    
    // Log the failure
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error: logError } = await supabase
        .from('daily_summary_log')
        .insert({
          sent_at: new Date().toISOString(),
          recipient_count: 0,
          success_count: 0,
          failure_count: 0,
          triggered_by: 'cron',
          error_details: { error: error.message }
        });
      
      if (logError) {
        console.error('❌ Failed to log error to daily_summary_log:', logError);
      } else {
        console.log('✅ Error logged to daily_summary_log');
      }
    } catch (logError) {
      console.error('❌ Exception while logging error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});
