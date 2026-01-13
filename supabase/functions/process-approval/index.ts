import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { token, action, notes } = await req.json();
    
    if (!token) {
      throw new Error("Token is required");
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      throw new Error("Valid action (approve/reject) is required");
    }

    // Get client IP and user agent for logging
    const clientIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Convert action to status
    const status = action === 'approve' ? 'approved' : 'rejected';

    // Process the approval using the database function
    const { data: result, error: processError } = await supabase
      .rpc('process_public_approval', {
        token: token,
        new_status: status,
        ip_addr: clientIp,
        user_agent: userAgent
      });

    if (processError) {
      throw new Error(`Processing error: ${processError.message}`);
    }

    if (!result || !result.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: result?.error || "Failed to process approval"
        }),
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
          },
          status: 400,
        }
      );
    }

    // Add notes if provided
    if (notes) {
      await supabase
        .from('approvals')
        .update({ notes: notes })
        .eq('id', result.approval_id);
    }

    // Fetch the updated approval and job details for notification
    const { data: approval } = await supabase
      .from('approvals')
      .select(`
        *,
        job:jobs(
          *,
          property:properties(*)
        )
      `)
      .eq('id', result.approval_id)
      .single();

    // Send notification email to requester (if configured)
    try {
      const { data: requester } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', approval.requested_by)
        .single();

      if (requester && requester.email) {
        // Call send-email function to notify requester
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: requester.email,
            subject: `Approval ${status === 'approved' ? 'Approved' : 'Rejected'} - ${approval.job.property.property_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: ${status === 'approved' ? '#10b981' : '#ef4444'};">
                  Approval ${status === 'approved' ? 'Approved' : 'Rejected'}
                </h2>
                <p>Hello ${requester.full_name || 'there'},</p>
                <p>Your ${approval.approval_type} request has been <strong>${status}</strong>.</p>
                <p><strong>Job Details:</strong></p>
                <ul>
                  <li>Property: ${approval.job.property.property_name}</li>
                  <li>Unit: ${approval.job.unit_number || 'N/A'}</li>
                  <li>Approval Type: ${approval.approval_type}</li>
                </ul>
                ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                <p>You can view the job details in the portal.</p>
                <p>Thank you,<br>JG Painting Pros Team</p>
              </div>
            `
          })
        });

        if (!emailResponse.ok) {
          console.error('Failed to send notification email:', await emailResponse.text());
        }
      }
    } catch (emailError) {
      // Don't fail the approval if email fails
      console.error('Error sending notification email:', emailError);
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully ${status} the request`,
        approvalId: result.approval_id,
        jobId: result.job_id,
        status: status
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error processing approval:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Unknown error occurred"
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});
