import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type DeleteJobsResult = {
  success?: boolean
  file_paths?: string[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authorization = req.headers.get('Authorization') ?? ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization },
      },
    })

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

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

    const { data, error } = await userClient.rpc('delete_jobs_safely', {
      p_job_ids: jobIds,
    })

    if (error) {
      console.error('Error deleting jobs:', error)
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to delete jobs' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result = (data || {}) as DeleteJobsResult
    const filePaths = (result.file_paths || [])
      .filter((path) => typeof path === 'string' && path.trim().length > 0)

    if (filePaths.length > 0) {
      const { error: storageError } = await serviceClient.storage
        .from('files')
        .remove(filePaths)

      if (storageError) {
        console.error('Jobs deleted, but storage cleanup failed:', storageError)
      }
    }

    return new Response(
      JSON.stringify(data),
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
