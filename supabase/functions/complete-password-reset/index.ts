import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const ALLOWED_ROLES = ["admin", "jg_management", "is_super_admin"];

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status },
  );
}

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

    // GET allows token pre-validation
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) return errorResponse("Token is required", 400);

      const { data: tokenRow, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("user_id, role, expires_at, used_at")
        .eq("token", token)
        .single();

      if (tokenError || !tokenRow) return errorResponse("Invalid or expired token", 400);
      if (tokenRow.used_at) return errorResponse("This link has already been used", 400);
      if (new Date(tokenRow.expires_at).getTime() < Date.now()) return errorResponse("This link has expired", 400);
      if (!ALLOWED_ROLES.includes(tokenRow.role)) return errorResponse("Not authorized", 403);

      return new Response(
        JSON.stringify({ success: true, valid: true, role: tokenRow.role, expires_at: tokenRow.expires_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    const { token, password } = await req.json();

    if (!token || !password) return errorResponse("Token and password are required", 400);
    if (password.length < 8) return errorResponse("Password must be at least 8 characters", 400);

    const { data: tokenRow, error: tokenError } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, role, expires_at, used_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) return errorResponse("Invalid or expired token", 400);
    if (tokenRow.used_at) return errorResponse("This link has already been used", 400);
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) return errorResponse("This link has expired", 400);
    if (!ALLOWED_ROLES.includes(tokenRow.role)) return errorResponse("Not authorized", 403);

    const { error: updateError } = await supabase.auth.admin.updateUserById(tokenRow.user_id, { password });

    if (updateError) {
      console.error("Failed to update password", updateError);
      return errorResponse("Unable to update password", 400);
    }

    // Mark token used
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    // Clean up any other outstanding tokens for the user
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", tokenRow.user_id)
      .is("used_at", null);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("complete-password-reset error", error);
    return errorResponse(error.message || "Unexpected error", 400);
  }
});
