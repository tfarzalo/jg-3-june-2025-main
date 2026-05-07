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
    
    // Admin, management, assistant managers, and super admins can delete users
    const allowedRoles = ["admin", "jg_management", "assistant_manager", "is_super_admin"];
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

    // Get user profile to preserve historical labels and check for avatar
    const { data: userProfile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("avatar_url, full_name, email")
      .eq("id", userId)
      .single();

    if (profileFetchError) {
      throw new Error("Error fetching target profile: " + profileFetchError.message);
    }

    const deletedAt = new Date().toISOString();
    const historicalName = userProfile?.full_name || userProfile?.email || "Deleted user";
    const historicalEmail = userProfile?.email || null;

    // Freeze any live job assignment labels before removing the profile FK target.
    const { error: jobHistoryError } = await supabase
      .from("jobs")
      .update({
        assigned_to_name_snapshot: historicalName,
        assigned_to_email_snapshot: historicalEmail,
        assigned_to_deleted_at: deletedAt,
        assigned_to: null,
      })
      .eq("assigned_to", userId);

    if (jobHistoryError) {
      throw new Error(`Failed to preserve assigned job history: ${jobHistoryError.message}`);
    }

    const preferredSlotUpdates = [
      {
        matchColumn: "preferred_subcontractor_a_id",
        update: {
          preferred_subcontractor_a_name_snapshot: historicalName,
          preferred_subcontractor_a_email_snapshot: historicalEmail,
          preferred_subcontractor_a_deleted_at: deletedAt,
          preferred_subcontractor_a_id: null,
        },
      },
      {
        matchColumn: "preferred_subcontractor_b_id",
        update: {
          preferred_subcontractor_b_name_snapshot: historicalName,
          preferred_subcontractor_b_email_snapshot: historicalEmail,
          preferred_subcontractor_b_deleted_at: deletedAt,
          preferred_subcontractor_b_id: null,
        },
      },
      {
        matchColumn: "preferred_subcontractor_c_id",
        update: {
          preferred_subcontractor_c_name_snapshot: historicalName,
          preferred_subcontractor_c_email_snapshot: historicalEmail,
          preferred_subcontractor_c_deleted_at: deletedAt,
          preferred_subcontractor_c_id: null,
        },
      },
    ];

    for (const slotUpdate of preferredSlotUpdates) {
      const { error: preferredError } = await supabase
        .from("properties")
        .update(slotUpdate.update)
        .eq(slotUpdate.matchColumn, userId);

      if (preferredError) {
        throw new Error(`Failed to preserve preferred subcontractor history: ${preferredError.message}`);
      }
    }

    let systemUserId = "00000000-0000-0000-0000-000000000000";
    const { data: systemProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", systemUserId)
      .maybeSingle();

    if (!systemProfile) {
      const { data: fallbackAdmin } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["admin", "is_super_admin"])
        .neq("id", userId)
        .limit(1)
        .maybeSingle();

      if (!fallbackAdmin?.id) {
        throw new Error("No system or admin profile available to preserve required historical references");
      }

      systemUserId = fallbackAdmin.id;
    }

    const requiredProfileReferences = [
      { table: "job_phase_changes", column: "changed_by" },
      { table: "property_callbacks", column: "posted_by" },
      { table: "property_updates", column: "posted_by" },
    ];

    for (const reference of requiredProfileReferences) {
      const { error: referenceError } = await supabase
        .from(reference.table)
        .update({ [reference.column]: systemUserId })
        .eq(reference.column, userId);

      if (referenceError) {
        throw new Error(`Failed to reassign ${reference.table}.${reference.column}: ${referenceError.message}`);
      }
    }

    const nullableProfileReferences = [
      { table: "job_snapshots", column: "frozen_by" },
      { table: "job_snapshots", column: "reopened_by" },
      { table: "whats_new_entries", column: "created_by" },
      { table: "whats_new_entries", column: "updated_by" },
      { table: "user_role_assignments", column: "assigned_by" },
      { table: "conversations", column: "deleted_by" },
    ];

    for (const reference of nullableProfileReferences) {
      const { error: referenceError } = await supabase
        .from(reference.table)
        .update({ [reference.column]: null })
        .eq(reference.column, userId);

      if (referenceError) {
        throw new Error(`Failed to clear ${reference.table}.${reference.column}: ${referenceError.message}`);
      }
    }

    const requiredAuthReferences = [
      { table: "jobs", column: "created_by" },
      { table: "work_orders", column: "prepared_by" },
      { table: "files", column: "uploaded_by" },
      { table: "employees", column: "created_by" },
    ];

    for (const reference of requiredAuthReferences) {
      const { error: referenceError } = await supabase
        .from(reference.table)
        .update({ [reference.column]: systemUserId })
        .eq(reference.column, userId);

      if (referenceError) {
        throw new Error(`Failed to reassign ${reference.table}.${reference.column}: ${referenceError.message}`);
      }
    }

    const nullableAuthReferences = [
      { table: "activity_log", column: "changed_by" },
      { table: "billing_audit_log", column: "performed_by" },
      { table: "changelog", column: "created_by" },
      { table: "app_config", column: "updated_by" },
      { table: "daily_email_config", column: "updated_by" },
      { table: "employees", column: "onboarding_packet_sent_by" },
      { table: "employees", column: "updated_by" },
      { table: "employee_form_tokens", column: "created_by" },
      { table: "employee_form_pdf_files", column: "created_by" },
      { table: "employee_form_submissions", column: "last_saved_by" },
      { table: "sms_notification_logs", column: "user_id" },
    ];

    for (const reference of nullableAuthReferences) {
      const { error: referenceError } = await supabase
        .from(reference.table)
        .update({ [reference.column]: null })
        .eq(reference.column, userId);

      if (referenceError) {
        console.warn(`Failed to clear optional ${reference.table}.${reference.column}:`, referenceError.message);
      }
    }

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

    // Delete user from auth first. profiles.id cascades from auth.users, so this
    // avoids deleting the visible profile if auth deletion is blocked.
    console.log("Deleting user from auth...");
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth deletion failed:", authError);
      const authMessage = authError.message || "";
      const authStatus = "status" in authError
        ? Number(authError.status)
        : undefined;
      const authUserMissing = authStatus === 404 ||
        authMessage.toLowerCase().includes("not found");

      if (!authUserMissing) {
        throw new Error(`Auth user deletion failed; profile was not deleted: ${authMessage}`);
      }

      console.warn("Auth user was already missing; deleting orphaned profile only");
    }

    console.log(
      authError ? "Auth user already absent" : "User deleted successfully from auth",
    );

    // The auth delete should cascade to profiles. This cleanup is intentionally
    // kept as an idempotent fallback for orphaned profiles or cascade drift.
    console.log("Deleting profile fallback from database...");
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("Profile deletion failed:", profileError);
      throw new Error(`Profile deletion failed: ${profileError.message}`);
    }
    console.log("Profile cleanup completed");

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
