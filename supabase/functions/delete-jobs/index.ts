import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the request body
    const { jobIds } = await req.json()

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid job IDs' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Delete in the correct order to maintain referential integrity
    // 1. Delete work orders first (no cascade)
    const { error: workOrdersError } = await supabaseClient
      .from('work_orders')
      .delete()
      .in('job_id', jobIds)

    if (workOrdersError) {
      console.error('Error deleting work orders:', workOrdersError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete work orders' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. Delete files associated with the jobs (no cascade)
    const { error: filesError } = await supabaseClient
      .from('files')
      .delete()
      .in('job_id', jobIds)

    if (filesError) {
      console.error('Error deleting files:', filesError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete files' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. Delete the jobs themselves
    const { error: jobsError } = await supabaseClient
      .from('jobs')
      .delete()
      .in('id', jobIds)

    if (jobsError) {
      console.error('Error deleting jobs:', jobsError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete jobs' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in delete handler:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 