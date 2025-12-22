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

  console.log("=== DELETE-USER FUNCTION CALLED ===");

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
    const { userId } = await req.json();
    
    // Validate inputs
    if (!userId) {
      throw new Error("Missing userId");
    }

    console.log("Deleting user:", userId);

    // Check if the current user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Authentication failed: " + (userError?.message || "No user found"));
    }

    // Check if the current user has admin privileges
    const { data: currentUserProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
      
    if (currentProfileError) {
      throw new Error("Error fetching user profile: " + currentProfileError.message);
    }
    
    // Only admin, jg_management, and is_super_admin can delete users
    const allowedRoles = ["admin", "jg_management", "is_super_admin"];
    if (!allowedRoles.includes(currentUserProfile.role)) {
      return new Response(
        JSON.stringify({ 
          code: "not_admin",
          message: "User not allowed to delete users",
          success: false, 
        }),
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
          },
          status: 403,
        }
      );
    }

    // Prevent self-deletion
    if (user.id === userId) {
      return new Response(
        JSON.stringify({ 
          code: "self_deletion",
          message: "Cannot delete your own account",
          success: false, 
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

    // Get user profile to check for avatar
    const { data: userProfile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .single();

    // Delete avatar from storage if exists
    if (userProfile?.avatar_url) {
      const avatarPath = userProfile.avatar_url.split('/').pop();
      if (avatarPath) {
        console.log("Deleting avatar:", avatarPath);
        const { error: storageError } = await supabase.storage
          .from('avatars')
          .remove([avatarPath]);
        
        if (storageError) {
          console.warn("Failed to delete avatar:", storageError);
        }
      }
    }

    // Delete profile from database
    console.log("Deleting profile from database...");
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("Profile deletion failed:", profileError);
      throw new Error(`Profile deletion failed: ${profileError.message}`);
    }
    console.log("Profile deleted successfully");

    // Delete user from auth
    console.log("Deleting user from auth...");
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth deletion failed:", authError);
      // Profile is already deleted, so we'll return a partial success
      return new Response(
        JSON.stringify({ 
          success: true,
          partial: true,
          message: "Profile deleted but auth user deletion failed",
          authError: authError.message
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

    console.log("User deleted successfully from auth");

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "User deleted successfully"
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
    console.error("Error deleting user:", error);
    
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
