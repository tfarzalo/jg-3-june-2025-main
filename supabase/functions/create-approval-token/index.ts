import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Keep this function self-contained so it can be deployed from either the
// Supabase CLI or the Dashboard editor, which does not include ../_shared.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { job_id, approval_type, approver_email, approver_name, is_preview } = await req.json()

    if (!job_id || !approval_type) {
      return new Response(JSON.stringify({ error: 'job_id and approval_type are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { data, error } = await supabaseClient
      .rpc('create_or_refresh_approval_token', {
        p_job_id: job_id,
        p_approval_type: approval_type,
        p_approver_email: approver_email || null,
        p_approver_name: approver_name || null,
        p_extra_charges_data: null,
        p_is_preview: Boolean(is_preview),
      })
      .single()

    if (error) {
      console.error('Error creating approval token:', error)
      throw error
    }

    return new Response(JSON.stringify({ token: data.token, expires_at: data.expires_at, reused: data.reused }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
