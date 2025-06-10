import { Resend } from "npm:resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables for email configuration
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      throw new Error("Resend API key not configured");
    }

    // Initialize Resend
    const resend = new Resend(RESEND_API_KEY);

    // Parse request body
    const { to, subject, text, html, from, replyTo } = await req.json();
    
    // Validate required fields
    if (!to || !subject || (!text && !html)) {
      throw new Error("Missing required email fields");
    }

    console.log(`Sending email to ${to} with subject: ${subject}`);

    // Set up email options
    const emailOptions = {
      from: from || `"JG Painting Pros" <no-reply@jgpaintingprosinc.com>`,
      to,
      subject,
      text,
      html,
      reply_to: replyTo || "info@jgpaintingprosinc.com",
    };

    // Send email
    const { data, error } = await resend.emails.send(emailOptions);
    
    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log(`Email sent successfully: ${data?.id}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        messageId: data?.id,
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
    console.error("Error sending email:", error);
    
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