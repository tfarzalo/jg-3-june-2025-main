import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const MANAGEMENT_ROLES = new Set([
  "admin",
  "is_super_admin",
  "jg_management",
  "assistant_manager",
  "manager",
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((value) => chars[value % chars.length]).join("");
}

async function getRequester(supabase: any, req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: jsonResponse({ success: false, error: "Missing authorization header" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return {
      error: jsonResponse(
        { success: false, error: `Authentication failed: ${userError?.message || "No user found"}` },
        401,
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || (user.app_metadata as Record<string, unknown> | null)?.role;
  if (profileError || !role || !MANAGEMENT_ROLES.has(String(role))) {
    return {
      error: jsonResponse(
        {
          success: false,
          code: "not_authorized",
          error: "User not allowed to restore subcontractors",
          requesterRole: role || null,
        },
        403,
      ),
    };
  }

  return { user, role: String(role) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const requester = await getRequester(supabase, req);
    if ("error" in requester) return requester.error;

    const { userId } = await req.json();
    if (!userId) {
      return jsonResponse({ success: false, error: "Missing userId" }, 400);
    }

    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, archived_at")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) throw new Error(`Failed to fetch subcontractor: ${targetError.message}`);
    if (!target) return jsonResponse({ success: false, code: "not_found", error: "Subcontractor not found" }, 404);
    if (target.role !== "subcontractor") {
      return jsonResponse({ success: false, code: "not_subcontractor", error: "Only subcontractors can be restored by this workflow" }, 400);
    }
    if (!target.archived_at) {
      return jsonResponse({ success: false, code: "not_archived", error: "Subcontractor is not archived" }, 409);
    }

    const temporaryPassword = generateTempPassword();
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      ban_duration: "none",
      email_confirm: true,
    });

    if (authError) {
      throw new Error(`Failed to reactivate auth user: ${authError.message}`);
    }

    const now = new Date().toISOString();
    const { error: restoreError } = await supabase
      .from("profiles")
      .update({
        archived_at: null,
        archived_by: null,
        restored_at: now,
        restored_by: requester.user.id,
      })
      .eq("id", userId);

    if (restoreError) {
      throw new Error(`Failed to restore subcontractor profile: ${restoreError.message}`);
    }

    return jsonResponse({
      success: true,
      message: "Subcontractor restored with a new temporary password",
      userId,
      email: target.email,
      temporaryPassword,
    });
  } catch (error) {
    console.error("restore-subcontractor error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore subcontractor",
    }, 400);
  }
});
