import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('[Auto-Decline] Running auto-decline function at:', new Date().toISOString())

    // Call the database function to auto-decline expired assignments
    const { data, error } = await supabaseClient.rpc('auto_decline_expired_assignments')

    if (error) {
      console.error('[Auto-Decline] Error running auto-decline:', error)
      throw error
    }

    console.log('[Auto-Decline] Result:', data)

    // If jobs were auto-declined, log the details
    if (data && data.auto_declined_count > 0) {
      console.log(`[Auto-Decline] ✅ Auto-declined ${data.auto_declined_count} job(s)`)
      console.log('[Auto-Decline] Job IDs:', data.job_ids)
      
      if (data.details && Array.isArray(data.details)) {
        data.details.forEach((detail: any) => {
          console.log(`[Auto-Decline]   - WO-${String(detail.work_order_num).padStart(6, '0')}: ${detail.subcontractor_name} at ${detail.property_name}`)
        })
      }

      // TODO: Send notification email to admins about auto-declined jobs
      // await sendAdminNotification(data.details)
    } else {
      console.log('[Auto-Decline] No jobs to auto-decline at this time.')
    }

    return new Response(
      JSON.stringify({
        success: true,
        auto_declined_count: data?.auto_declined_count || 0,
        job_ids: data?.job_ids || [],
        details: data?.details || [],
        processed_at: data?.processed_at || new Date().toISOString(),
        message: data?.auto_declined_count > 0 
          ? `Successfully auto-declined ${data.auto_declined_count} job(s)`
          : 'No jobs to auto-decline'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('[Auto-Decline] Fatal error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        processed_at: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
