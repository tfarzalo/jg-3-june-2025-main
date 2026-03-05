import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const ALLOWED_ROLES = ["admin", "jg_management", "subcontractor", "is_super_admin"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { email, redirectBase } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const baseUrl = (redirectBase || Deno.env.get("PASSWORD_RESET_REDIRECT_BASE") || supabaseUrl).replace(/\/$/, "");

    // Look up profile by email (profiles table holds canonical email + role)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name, email")
      .ilike("email", email)
      .single();

    if (profileError || !profile) {
      console.warn("Password reset requested for unknown email", email, profileError);
      return new Response(
        JSON.stringify({ success: true, sent: false, message: "If this admin account exists, a reset link will be sent." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (!ALLOWED_ROLES.includes(profile.role)) {
      console.warn("Password reset blocked for non-admin role", { email, role: profile?.role });
      return new Response(
        JSON.stringify({ success: true, sent: false, message: "If this admin account exists, a reset link will be sent." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Invalidate any existing unused tokens for this user
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .is("used_at", null);

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const { error: insertError } = await supabase.from("password_reset_tokens").insert({
      user_id: profile.id,
      token,
      role: profile.role,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Failed to store reset token", insertError);
      throw new Error("Could not create reset token");
    }

    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    const subject = "JG Portal password reset";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #1d4ed8;">Reset your JG Portal password</h2>
        <p>Hello ${profile.full_name || ""},</p>
        <p>We received a request to reset the password for your ${profile.role.replace("_", " ")} account.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;">Create a new password</a></p>
        <p>Or copy and paste this link into your browser:<br><span style="color:#111827;font-size:14px;">${resetUrl}</span></p>
        <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
      </div>
    `;

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: email,
        subject,
        html,
        text: `Reset your JG Portal password using this link: ${resetUrl}\nThis link expires in 1 hour.`,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("send-email failed", errorText);
      throw new Error("Failed to send password reset email");
    }

    return new Response(
      JSON.stringify({ success: true, sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("request-password-reset error", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unexpected error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
