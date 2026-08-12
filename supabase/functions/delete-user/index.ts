import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const jobRequestPhaseLabels = new Set(["Job Request"]);

const optionalSchemaErrorCodes = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "PGRST200",
  "PGRST204",
  "PGRST205",
]);

function isMissingSchemaError(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return optionalSchemaErrorCodes.has(String(error?.code || "")) ||
    (!error?.code && !error?.message) ||
    message.includes("could not find the table") ||
    (message.includes("could not find the") && message.includes("column")) ||
    message.includes("schema cache");
}

function formatJobLabel(job: any): string {
  const wo = job?.work_order_num ? `WO #${job.work_order_num}` : "Work order";
  const property = job?.property?.property_name || job?.properties?.property_name;
  const unit = job?.unit_number ? `Unit ${job.unit_number}` : null;
  return [wo, property, unit].filter(Boolean).join(" - ");
}

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
    // First try to read role from the profiles table, but be resilient if the profile row is missing
    let currentUserRole: string | null = null;
    const { data: currentUserProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (currentProfileError) {
      // Non-fatal: warn and attempt fallbacks below
      console.warn("Warning fetching current user's profile:", currentProfileError.message);
    } else if (currentUserProfile && (currentUserProfile as any).role) {
      currentUserRole = (currentUserProfile as any).role;
    }

    // Fallbacks: some deployments store role in auth user metadata / app_metadata
    if (!currentUserRole && user && (user.user_metadata as any)?.role) {
      currentUserRole = (user.user_metadata as any).role;
    }
    if (!currentUserRole && user && (user.app_metadata as any)?.role) {
      currentUserRole = (user.app_metadata as any).role;
    }

    // Admin, management, assistant managers, managers, and super admins can delete users
    const allowedRoles = ["admin", "jg_management", "assistant_manager", "manager", "is_super_admin"];

    if (!currentUserRole || !allowedRoles.includes(currentUserRole)) {
      console.warn("Delete-user denied: requester role not allowed", { requesterId: user.id, requesterRole: currentUserRole });
      return new Response(
        JSON.stringify({ 
          code: "not_admin",
          message: "User not allowed to delete users",
          success: false,
          requesterRole: currentUserRole || null,
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
      .select("avatar_url, full_name, email, role, archived_at")
      .eq("id", userId)
      .single();

    if (profileFetchError) {
      throw new Error("Error fetching target profile: " + profileFetchError.message);
    }

    const deletedAt = new Date().toISOString();
    const historicalName = userProfile?.full_name || userProfile?.email || "Deleted user";
    const historicalEmail = userProfile?.email || null;

    if (userProfile?.role === "subcontractor" && !userProfile?.archived_at) {
      return new Response(
        JSON.stringify({
          code: "active_subcontractor_must_be_archived",
          success: false,
          message: "Active subcontractors must be archived before they can be permanently deleted.",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 409,
        },
      );
    }

    const { data: assignedJobs, error: assignedJobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        work_order_num,
        unit_number,
        historical_data_mode,
        snapshot_frozen_at,
        property:properties(property_name),
        phase:job_phases!jobs_current_phase_id_fkey(job_phase_label)
      `)
      .eq("assigned_to", userId);

    if (assignedJobsError) {
      throw new Error(
        `Failed to check assigned jobs before deletion: ${assignedJobsError.message}`,
      );
    }

    const blockingJobs = (assignedJobs || []).filter((job: any) => {
      const phaseLabel = job?.phase?.job_phase_label || "";
      return jobRequestPhaseLabels.has(phaseLabel);
    });

    if (blockingJobs.length > 0) {
      const jobLabels = blockingJobs.slice(0, 5).map(formatJobLabel);
      const remainingCount = Math.max(blockingJobs.length - jobLabels.length, 0);
      const suffix = remainingCount > 0 ? ` and ${remainingCount} more` : "";
      return new Response(
        JSON.stringify({
          code: "assigned_frozen_jobs_block",
          success: false,
          message:
            `This user cannot be deleted yet because they are assigned to ${blockingJobs.length} Job Request${blockingJobs.length === 1 ? "" : "s"}: ${jobLabels.join("; ")}${suffix}. Reassign or return those Job Requests to the unassigned pool before deleting this user.`,
          jobs: blockingJobs.map((job: any) => ({
            id: job.id,
            label: formatJobLabel(job),
            phase: job?.phase?.job_phase_label || null,
            snapshot_frozen_at: job?.snapshot_frozen_at || null,
          })),
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 409,
        },
      );
    }

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
      {
        matchColumn: "preferred_subcontractor_d_id",
        update: {
          preferred_subcontractor_d_name_snapshot: historicalName,
          preferred_subcontractor_d_email_snapshot: historicalEmail,
          preferred_subcontractor_d_deleted_at: deletedAt,
          preferred_subcontractor_d_id: null,
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

    let authReferenceUserId = systemUserId;
    const { data: replacementAuthUser, error: replacementAuthError } =
      await supabase.auth.admin.getUserById(systemUserId);

    if (replacementAuthError || !replacementAuthUser?.user) {
      const { data: fallbackAuthAdmin } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["admin", "jg_management", "is_super_admin"])
        .neq("id", userId)
        .limit(1)
        .maybeSingle();

      if (!fallbackAuthAdmin?.id) {
        throw new Error(
          "No admin auth user available to preserve required historical references",
        );
      }

      authReferenceUserId = fallbackAuthAdmin.id;
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
        if (isMissingSchemaError(referenceError)) {
          console.warn(
            `Skipping missing required profile reference ${reference.table}.${reference.column}:`,
            referenceError.message,
          );
          continue;
        }
        throw new Error(
          `Failed to reassign ${reference.table}.${reference.column}: ${referenceError.message}`,
        );
      }
    }

    const nullableProfileReferences = [
      { table: "job_snapshots", column: "frozen_by" },
      { table: "job_snapshots", column: "reopened_by" },
      { table: "whats_new_entries", column: "created_by" },
      { table: "whats_new_entries", column: "updated_by" },
      { table: "user_role_assignments", column: "assigned_by" },
      { table: "conversations", column: "deleted_by" },
      { table: "job_quality_control_submissions", column: "submitted_by" },
      { table: "lead_forms", column: "created_by" },
      { table: "leads", column: "assigned_to" },
      { table: "contacts", column: "assigned_to" },
      { table: "contact_history", column: "created_by" },
    ];

    for (const reference of nullableProfileReferences) {
      const { error: referenceError } = await supabase
        .from(reference.table)
        .update({ [reference.column]: null })
        .eq(reference.column, userId);

      if (referenceError) {
        if (isMissingSchemaError(referenceError)) {
          console.warn(
            `Skipping missing optional profile reference ${reference.table}.${reference.column}:`,
            referenceError.message,
          );
          continue;
        }
        console.warn(
          `Failed to clear optional profile reference ${reference.table}.${reference.column}:`,
          referenceError.message || JSON.stringify(referenceError),
        );
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
        .update({ [reference.column]: authReferenceUserId })
        .eq(reference.column, userId);

      if (referenceError) {
        if (isMissingSchemaError(referenceError)) {
          console.warn(
            `Skipping missing required auth reference ${reference.table}.${reference.column}:`,
            referenceError.message,
          );
          continue;
        }
        throw new Error(
          `Failed to reassign ${reference.table}.${reference.column}: ${referenceError.message}`,
        );
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
      { table: "sms_notification_queue", column: "user_id" },
      { table: "notifications", column: "user_id" },
      { table: "user_notifications", column: "user_id" },
      { table: "password_reset_tokens", column: "user_id" },
      { table: "calendar_tokens", column: "user_id" },
      { table: "daily_email_settings", column: "user_id" },
      { table: "report_templates", column: "user_id" },
      { table: "report_runs", column: "user_id" },
    ];

    for (const reference of nullableAuthReferences) {
      const { error: referenceError } = await supabase
        .from(reference.table)
        .update({ [reference.column]: null })
        .eq(reference.column, userId);

      if (referenceError) {
        if (isMissingSchemaError(referenceError)) {
          console.warn(
            `Skipping missing optional auth reference ${reference.table}.${reference.column}:`,
            referenceError.message,
          );
        } else {
          console.warn(
            `Failed to clear optional ${reference.table}.${reference.column}:`,
            referenceError.message,
          );
        }
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
    // avoids deleting the visible profile if auth deletion is blocked. Supabase
    // can return an empty database error when hard delete is blocked by managed
    // schema references such as storage ownership, so fall back to soft delete.
    console.log("Deleting user from auth...");
    let authDeleteMode: "hard" | "soft" | "missing" = "hard";
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth deletion failed:", authError);
      const authMessage = authError.message || JSON.stringify(authError);
      const authStatus = "status" in authError
        ? Number(authError.status)
        : undefined;
      const authUserMissing = authStatus === 404 ||
        authMessage.toLowerCase().includes("not found");

      if (!authUserMissing) {
        console.warn("Hard auth delete failed; attempting soft auth delete");
        const { error: softDeleteError } = await supabase.auth.admin.deleteUser(
          userId,
          true,
        );

        if (softDeleteError) {
          const softDeleteMessage = softDeleteError.message ||
            JSON.stringify(softDeleteError);
          throw new Error(
            `Auth user deletion failed; profile was not deleted: ${softDeleteMessage}`,
          );
        }

        authDeleteMode = "soft";
      } else {
        authDeleteMode = "missing";
      }
    }

    console.log(
      authDeleteMode === "missing"
        ? "Auth user already absent"
        : `User ${authDeleteMode}-deleted successfully from auth`,
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
        message: authDeleteMode === "soft"
          ? "User deleted successfully. Auth account was soft-deleted because database references prevented hard deletion."
          : "User deleted successfully",
        authDeleteMode,
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
