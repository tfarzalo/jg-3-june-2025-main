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
    const { email, password, full_name, role, working_days, sendWelcomeEmail = true } = await req.json();
    
    // Validate inputs
    if (!email || !password || !full_name || !role) {
      throw new Error("Missing required fields");
    }

    // Validate password length
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Validate role
    const validRoles = ["admin", "user", "editor", "is_super_admin", "jg_management", "subcontractor"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role");
    }

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
    
    // Only admin, jg_management, and is_super_admin can create users
    const allowedRoles = ["admin", "jg_management", "is_super_admin"];
    if (!allowedRoles.includes(currentUserProfile.role)) {
      return new Response(
        JSON.stringify({ 
          code: "not_admin",
          message: "User not allowed",
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

    // Additional check: only admins can create other admin users
    if (role === "admin" && currentUserProfile.role !== "admin") {
      throw new Error("Only admins can create admin users");
    }

    // Create the user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("User creation succeeded but no user data returned");
    }

    // The database trigger (handle_new_user) already creates a basic profile row
    // when the auth user is created. We just need to update it with additional fields
    // like working_days that the trigger doesn't set.
    console.log("Auth user created, updating profile with additional fields...");
    
    // Build the update data with only the fields we want to set
    const profileUpdateData: any = {
      full_name,
      role,
    };

    // Add working_days if provided
    if (working_days) {
      profileUpdateData.working_days = working_days;
    }

    console.log("Updating profile for user:", data.user.id, profileUpdateData);

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdateData)
      .eq("id", data.user.id);

    if (profileError) {
      // If profile update fails, we should delete the auth user to maintain consistency
      console.error("Profile update failed, attempting to clean up auth user:", profileError);
      await supabase.auth.admin.deleteUser(data.user.id);
      throw new Error(`Profile update failed: ${profileError.message}`);
    }
    
    console.log("Profile updated successfully for user:", data.user.id);

    // Track if email was sent successfully
    let emailSent = false;

    // Send welcome email if requested
    if (sendWelcomeEmail) {
      try {
        // Get email credentials
        const ZOHO_EMAIL = Deno.env.get("ZOHO_EMAIL");
        const ZOHO_PASSWORD = Deno.env.get("ZOHO_PASSWORD");
        
        if (!ZOHO_EMAIL || !ZOHO_PASSWORD) {
          console.warn("Email credentials not configured, skipping welcome email");
        } else {
          // Call the send-email function directly
          const functionUrl = `${supabaseUrl}/functions/v1/send-email`;
          console.log("Calling send-email function at:", functionUrl);
          
          const emailResponse = await fetch(functionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              to: email,
              subject: "Welcome to JG Painting Pros Portal",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #2563eb;">Welcome to JG Painting Pros Portal</h2>
                  <p>Hello ${full_name},</p>
                  <p>Your account has been created successfully. You can now log in to the JG Painting Pros portal.</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Role:</strong> ${role}</p>
                  <p>If you have any questions, please contact the administrator.</p>
                  <p>Thank you,<br>JG Painting Pros Team</p>
                </div>
              `,
            }),
          });
          
          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.warn("Failed to send welcome email:", errorText);
            throw new Error(`Email service error: ${errorText}`);
          }
          
          const emailResult = await emailResponse.json();
          if (!emailResult.success) {
            console.warn("Failed to send welcome email:", emailResult.error);
            throw new Error(emailResult.error || "Unknown email error");
          }
          
          emailSent = true;
          console.log("Welcome email sent successfully");
        }
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
        // Don't fail the user creation if email fails
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        user: data.user,
        emailSent
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
    console.error("Error creating user:", error);
    
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