import { createTransport } from "npm:nodemailer@6.9.8";

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

  console.log("=== SEND-EMAIL FUNCTION CALLED ===");
  console.log("Request method:", req.method);
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  // Simple test endpoint
  if (req.method === "GET") {
    const ZOHO_EMAIL = Deno.env.get("ZOHO_EMAIL");
    const ZOHO_PASSWORD = Deno.env.get("ZOHO_PASSWORD");
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Send-email function is working",
        timestamp: new Date().toISOString(),
        env_check: {
          ZOHO_EMAIL: ZOHO_EMAIL ? "SET" : "NOT SET",
          ZOHO_PASSWORD: ZOHO_PASSWORD ? "SET" : "NOT SET"
        }
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  }

  try {
    // Get environment variables for Zoho Mail configuration
    const ZOHO_EMAIL = Deno.env.get("ZOHO_EMAIL");
    const ZOHO_PASSWORD = Deno.env.get("ZOHO_PASSWORD");
    const ZOHO_SMTP_HOST = Deno.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com";
    const ZOHO_SMTP_PORT = parseInt(Deno.env.get("ZOHO_SMTP_PORT") || "587");
    
    console.log("Environment variables check:", {
      ZOHO_EMAIL: ZOHO_EMAIL ? "SET" : "NOT SET",
      ZOHO_PASSWORD: ZOHO_PASSWORD ? "SET" : "NOT SET",
      ZOHO_SMTP_HOST,
      ZOHO_SMTP_PORT
    });
    
    if (!ZOHO_EMAIL || !ZOHO_PASSWORD) {
      throw new Error(`Zoho Mail credentials not configured. ZOHO_EMAIL: ${ZOHO_EMAIL ? 'SET' : 'NOT SET'}, ZOHO_PASSWORD: ${ZOHO_PASSWORD ? 'SET' : 'NOT SET'}`);
    }

    // Parse request body
    const { to, subject, text, html, from, replyTo, cc, bcc } = await req.json();
    
    // Validate required fields
    if (!to || !subject || (!text && !html)) {
      throw new Error("Missing required email fields");
    }

    console.log(`Sending email to ${to} with subject: ${subject}`);
    console.log(`Using Zoho email: ${ZOHO_EMAIL}`);
    console.log(`Using SMTP host: ${ZOHO_SMTP_HOST}:${ZOHO_SMTP_PORT}`);

    // Create transporter for Zoho Mail with proper authentication
    const transporter = createTransport({
      host: ZOHO_SMTP_HOST,
      port: ZOHO_SMTP_PORT,
      secure: ZOHO_SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: ZOHO_EMAIL,
        pass: ZOHO_PASSWORD,
      },
      // Zoho specific settings
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      }
    });
    
    console.log('Attempting SMTP connection with:', {
      host: ZOHO_SMTP_HOST,
      port: ZOHO_SMTP_PORT,
      secure: ZOHO_SMTP_PORT === 465,
      user: ZOHO_EMAIL
    });
    
    // Test the connection
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    // Set up email options
    const mailOptions = {
      from: from || `"JG Painting Pros" <${ZOHO_EMAIL}>`,
      to,
      subject,
      text,
      html,
      replyTo: replyTo || ZOHO_EMAIL,
      cc: cc || undefined,
      bcc: bcc || undefined,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email sent successfully: ${info.messageId}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
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
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Return error response with more details
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack || error.toString()
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