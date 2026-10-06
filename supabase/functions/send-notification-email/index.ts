const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface EmailData {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  content: string;
  job_id: string;
  template_type: string;
  from_email?: string;
  from_name?: string;
  has_attachments?: boolean;
  attachment_count?: number;
  attachments?: Array<{
    file_path: string;
    file_name: string;
    mime_type: string;
    content: string; // base64 encoded
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase function credentials are not configured");

    const emailData: EmailData = await req.json();
    if (!emailData.to || !emailData.subject || !emailData.content) {
      throw new Error("Missing required email fields");
    }

    // This endpoint is retained for compatibility, but all transport, provider
    // selection, recipient normalization, auditing, and limits are centralized
    // in send-email.
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
      to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
      subject: emailData.subject,
      html: emailData.content,
        emailType: emailData.template_type || "notification",
        jobId: emailData.job_id || null,
        attachments: (emailData.attachments || []).map((attachment) => ({
          filename: attachment.file_name,
          content: attachment.content,
          contentType: attachment.mime_type,
          encoding: "base64",
        })),
        metadata: {
          legacy_endpoint: "send-notification-email",
          attachment_count: emailData.attachment_count || emailData.attachments?.length || 0,
        },
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Shared email dispatcher rejected the message");
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending notification email:", error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
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
