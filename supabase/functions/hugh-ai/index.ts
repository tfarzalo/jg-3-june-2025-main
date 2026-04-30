import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured. Please add GEMINI_API_KEY to your Supabase secrets." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { message, history } = await req.json();

    if (!message) {
      throw new Error("message is required");
    }

    // ── Gather rich app context for Gemini ──────────────────────────────────

    const [
      { data: jobs },
      { data: properties },
      { data: phases },
      { data: profiles },
      { data: jobTypes },
      { data: propertyGroups },
    ] = await Promise.all([
      supabase
        .from("jobs")
        .select(`
          id, work_order_num, unit_number, scheduled_date, created_at,
          property:properties(property_name, city, state),
          job_phase:job_phases(job_phase_label),
          job_type:job_types(name),
          assigned_subcontractor:profiles!jobs_assigned_subcontractor_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(200),

      supabase
        .from("properties")
        .select("id, property_name, address, city, state, is_active, is_archived")
        .eq("is_archived", false)
        .limit(300),

      supabase
        .from("job_phases")
        .select("id, job_phase_label, sort_order"),

      supabase
        .from("profiles")
        .select("id, full_name, role, email")
        .limit(200),

      supabase
        .from("job_types")
        .select("id, name"),

      supabase
        .from("property_management_groups")
        .select("id, company_name")
        .limit(100),
    ]);

    // Build a compact context string
    const activeProperties = (properties || []).filter(p => p.is_active !== false);
    const inactiveProperties = (properties || []).filter(p => p.is_active === false);

    const subcontractors = (profiles || []).filter(p =>
      p.role === "subcontractor"
    );

    const phaseLabels = (phases || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(p => p.job_phase_label);

    const recentJobs = (jobs || []).slice(0, 100).map(j => ({
      work_order: j.work_order_num,
      unit: j.unit_number,
      property: (j.property as any)?.property_name,
      city: (j.property as any)?.city,
      phase: (j.job_phase as any)?.job_phase_label,
      type: (j.job_type as any)?.name,
      scheduled: j.scheduled_date,
      sub: (j.assigned_subcontractor as any)?.full_name,
    }));

    const appContext = `
You are Hugh, an AI assistant built into the JG Painting Pros property management and job tracking application. You have access to live data from the application.

## APPLICATION DATA SUMMARY (as of now)

### Job Phases (in order)
${phaseLabels.join(" → ")}

### Job Types
${(jobTypes || []).map(t => t.name).join(", ")}

### Properties
Active: ${activeProperties.length} properties
Inactive: ${inactiveProperties.length} properties
Active property list: ${activeProperties.slice(0, 50).map(p => `${p.property_name} (${p.city}, ${p.state})`).join("; ")}

### Property Management Groups
${(propertyGroups || []).map(g => g.company_name).join(", ")}

### Subcontractors
${subcontractors.map(s => s.full_name).join(", ")}

### Recent Jobs (last 100)
${JSON.stringify(recentJobs, null, 2)}

## YOUR ROLE
- Help admins find, understand, analyze and act on anything in the app
- Answer questions about jobs, properties, phases, subcontractors, schedules
- Suggest which subcontractor might be best for a job based on patterns
- Summarize workloads, statuses, upcoming schedules
- Be concise, professional, and helpful
- When referencing specific items, include key identifiers (work order #, property name, unit, etc.)
- You can give recommendations, highlight issues, and proactively surface insights
- Always respond in plain language suitable for a property management professional
`;

    // ── Build Gemini API request ─────────────────────────────────────────────

    // Convert history to Gemini format
    const geminiContents = [];

    // Add system context as first user turn (Gemini doesn't have system role)
    geminiContents.push({
      role: "user",
      parts: [{ text: `${appContext}\n\n---\nBegin conversation. Acknowledge you're ready.` }],
    });
    geminiContents.push({
      role: "model",
      parts: [{ text: "Hi! I'm Hugh, your JG Painting Pros AI assistant. I have access to your live job data, properties, subcontractors, and phases. How can I help you today?" }],
    });

    // Add prior conversation history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        geminiContents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Add current user message
    geminiContents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const replyText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't generate a response. Please try again.";

    return new Response(
      JSON.stringify({ reply: replyText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Hugh AI error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
