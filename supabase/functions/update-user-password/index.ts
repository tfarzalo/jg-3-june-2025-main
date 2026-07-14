import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    // Create Supabase client with service role key (has admin privileges)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    if (req.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed" }, 405);
    }

    // Get request body
    const { userId, password } = await req.json();
    
    // Validate inputs
    if (!userId || !password) {
      return jsonResponse({ success: false, error: "Missing required fields" }, 400);
    }

    // Validate password length
    if (password.length < 8) {
      return jsonResponse({ success: false, error: "Password must be at least 8 characters long" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization header is required" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return jsonResponse(
        {
          success: false,
          error: "Authentication failed: " + (userError?.message || "No user found"),
        },
        401,
      );
    }

    let currentUserRole: string | null = null;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.warn("Warning fetching current user's profile:", profileError.message);
    } else if (profile?.role) {
      currentUserRole = profile.role;
    }

    // app_metadata is server-controlled; user_metadata is intentionally not
    // trusted for authorization decisions.
    if (!currentUserRole && (user.app_metadata as Record<string, unknown> | null)?.role) {
      currentUserRole = String((user.app_metadata as Record<string, unknown>).role);
    }
    
    if (!currentUserRole || currentUserRole === "subcontractor") {
      return jsonResponse(
        {
          success: false,
          code: "not_admin",
          error: "Only non-subcontractor users can change subcontractor passwords",
          requesterRole: currentUserRole,
        },
        403,
      );
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) {
      throw new Error("Error fetching target user profile: " + targetProfileError.message);
    }

    if (!targetProfile) {
      return jsonResponse(
        {
          success: false,
          code: "target_not_found",
          error: "Target user profile was not found",
        },
        404,
      );
    }

    if (targetProfile.role !== "subcontractor") {
      return jsonResponse(
        {
          success: false,
          code: "target_not_subcontractor",
          error: "This function can only change subcontractor passwords",
        },
        403,
      );
    }

    // Update the user's password
    const { error } = await supabase.auth.admin.updateUserById(
      userId,
      { password }
    );

    if (error) {
      throw error;
    }

    // Return success response
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Error updating user password:", error);
    
    return jsonResponse(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to update user password",
      },
      400,
    );
  }
});
