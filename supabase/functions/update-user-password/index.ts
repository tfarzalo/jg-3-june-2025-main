import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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

    // Get request body
    const { userId, password } = await req.json();
    
    // Validate inputs
    if (!userId || !password) {
      throw new Error("Missing required fields");
    }

    // Validate password length
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Check if the current user is an admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError) {
        throw new Error("Authentication error: " + userError.message);
      }

      // Check if the current user is an admin
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user?.id)
        .single();
        
      if (profileError) {
        throw new Error("Error fetching user profile");
      }
      
      if (profile.role !== "admin") {
        throw new Error("Only admins can change user passwords");
      }
    } else {
      throw new Error("Authorization header is required");
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
    return new Response(
      JSON.stringify({ 
        success: true
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
    console.error("Error updating user password:", error);
    
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
        status: 400,
      }
    );
  }
});