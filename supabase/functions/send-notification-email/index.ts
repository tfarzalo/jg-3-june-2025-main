import { Resend } from "npm:resend@3.2.0";

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
    const outboundProvider = (Deno.env.get("OUTBOUND_EMAIL_PROVIDER") || "zoho").trim().toLowerCase();

    // During the staged Mailgun cutover, route this legacy endpoint through
    // the shared dispatcher. Until then, preserve its existing Resend path.
    if (outboundProvider === "mailgun") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceKey) throw new Error("Supabase function credentials are not configured");

      const emailData: EmailData = await req.json();
      if (!emailData.to || !emailData.subject || !emailData.content) {
        throw new Error("Missing required email fields");
      }

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
          metadata: { legacy_endpoint: "send-notification-email" },
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
    }

    if (outboundProvider !== "zoho" && outboundProvider !== "resend") {
      throw new Error(`Unsupported outbound email provider: ${outboundProvider}`);
    }

    // Get environment variables for the existing Resend configuration.
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      throw new Error("Resend API key not configured");
    }

    // Initialize Resend
    const resend = new Resend(RESEND_API_KEY);

    // Parse request body
    const emailData: EmailData = await req.json();
    
    // Validate required fields
    if (!emailData.to || !emailData.subject || !emailData.content) {
      throw new Error("Missing required email fields");
    }

    console.log(`Sending notification email to ${emailData.to} with subject: ${emailData.subject}`);

    // Set up email options
    const emailOptions: any = {
      from: emailData.from_email ? 
        `"${emailData.from_name || 'JG Painting Pros Inc.'}" <${emailData.from_email}>` : 
        `"JG Painting Pros Inc." <no-reply@jgpaintingprosinc.com>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.content,
      reply_to: "info@jgpaintingprosinc.com",
    };

    // Add CC if provided
    if (emailData.cc) {
      emailOptions.cc = emailData.cc;
    }

    // Add BCC if provided
    if (emailData.bcc) {
      emailOptions.bcc = emailData.bcc;
    }

    // Add attachments if provided
    if (emailData.attachments && emailData.attachments.length > 0) {
      emailOptions.attachments = emailData.attachments.map(attachment => ({
        filename: attachment.file_name,
        content: attachment.content,
        type: attachment.mime_type,
        disposition: 'attachment'
      }));
    }

    // Send email
    const { data, error } = await resend.emails.send(emailOptions);
    
    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log(`Notification email sent successfully: ${data?.id}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        messageId: data?.id,
        message: 'Notification email sent successfully'
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
