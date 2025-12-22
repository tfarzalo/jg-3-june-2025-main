import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

    const token = crypto.randomUUID()
    const now = new Date()
    // Previews last 1 hour, real approvals last 30 minutes
    const expires_at = new Date(now.getTime() + (is_preview ? 60 * 60 * 1000 : 30 * 60 * 1000)).toISOString()
    const sent_at = is_preview ? null : now.toISOString()

    const { data, error } = await supabaseClient
      .from('approval_tokens')
      .insert({
        job_id,
        token,
        expires_at,
        approval_type,
        approver_email: approver_email || null,
        approver_name: approver_name || null,
        status: 'pending',
        sent_at,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating approval token:', error)
      throw error
    }

    return new Response(JSON.stringify({ token: data.token, expires_at: data.expires_at }), {
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
