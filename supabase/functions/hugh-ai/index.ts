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
    if (!message) throw new Error("message is required");

    // ── Gather rich app context ──────────────────────────────────────────────
    const [
      { data: jobs },
      { data: properties },
      { data: phases },
      { data: profiles },
      { data: jobTypes },
      { data: unitSizes },
      { data: propertyGroups },
      { data: workOrders },
      { data: jobCategories },
    ] = await Promise.all([
      // Jobs — use correct FK name jobs_assigned_to_fkey and correct job_type column
      supabase
        .from("jobs")
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          status,
          assignment_status,
          priority,
          invoice_sent,
          invoice_paid,
          total_billing_amount,
          purchase_order,
          is_occupied,
          created_at,
          property:properties(property_name, city, state),
          phase:job_phases!jobs_current_phase_id_fkey(job_phase_label),
          job_type:job_types!jobs_job_type_id_fkey(job_type_label),
          assigned_to:profiles!jobs_assigned_to_fkey(full_name, company_name),
          unit_size:unit_sizes!jobs_unit_size_id_fkey(unit_size_label)
        `)
        .order("created_at", { ascending: false })
        .limit(200),

      // Properties
      supabase
        .from("properties")
        .select(`
          id, property_name, address, city, state, is_active, is_archived,
          community_manager_name, community_manager_email,
          property_management_group:property_management_groups(company_name)
        `)
        .eq("is_archived", false)
        .limit(300),

      // Job phases in order
      supabase
        .from("job_phases")
        .select("id, job_phase_label, sort_order")
        .order("sort_order"),

      // All users/subcontractors
      supabase
        .from("profiles")
        .select("id, full_name, role, email, company_name, phone")
        .limit(200),

      // Job types — correct column name is job_type_label
      supabase
        .from("job_types")
        .select("id, job_type_label"),

      // Unit sizes
      supabase
        .from("unit_sizes")
        .select("id, unit_size_label")
        .limit(100),

      // Property management groups
      supabase
        .from("property_management_groups")
        .select("id, company_name, group_status")
        .eq("is_archived", false)
        .limit(100),

      // Work orders — most recent
      supabase
        .from("work_orders")
        .select(`
          id, unit_number, unit_size, is_occupied, is_full_paint,
          bill_amount, sub_pay_amount, profit_amount,
          submission_date, created_at,
          job:jobs!work_orders_job_id_fkey(
            work_order_num,
            property:properties(property_name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100),

      // Job categories
      supabase
        .from("job_categories")
        .select("id, name")
        .eq("is_hidden", false)
        .limit(100),
    ]);

    // ── Build summaries ──────────────────────────────────────────────────────
    const activeProperties = (properties || []).filter(p => p.is_active !== false);
    const subcontractors = (profiles || []).filter(p => p.role === "subcontractor");
    const adminUsers = (profiles || []).filter(p => ["admin", "is_super_admin", "jg_management"].includes(p.role));

    const phaseLabels = (phases || []).map(p => p.job_phase_label);

    // Format work order number as WO-XXXXXX (zero-padded to 6 digits)
    const formatWO = (num: number | null | undefined): string =>
      num != null ? `WO-${String(num).padStart(6, "0")}` : "N/A";

    // Jobs with all key fields + IDs for deep linking
    const jobSummaries = (jobs || []).slice(0, 150).map(j => ({
      wo: formatWO(j.work_order_num),
      job_link: `/dashboard/jobs/${j.id}`,
      unit: j.unit_number,
      property: (j.property as any)?.property_name,
      property_link: j.property_id ? `/dashboard/properties/${j.property_id}` : null,
      city: (j.property as any)?.city,
      phase: (j.phase as any)?.job_phase_label,
      type: (j.job_type as any)?.job_type_label,
      size: (j.unit_size as any)?.unit_size_label,
      sub: (j.assigned_to as any)?.full_name || (j.assigned_to as any)?.company_name,
      sub_link: j.assigned_to ? `/dashboard/profile/${(j.assigned_to as any)?.id || j.assigned_to}` : null,
      status: j.status,
      assignment_status: j.assignment_status,
      priority: j.priority,
      scheduled: j.scheduled_date ? j.scheduled_date.split("T")[0] : null,
      invoice_sent: j.invoice_sent,
      invoice_paid: j.invoice_paid,
      bill_amount: j.total_billing_amount,
      po: j.purchase_order,
      occupied: j.is_occupied,
    }));

    // Phase breakdown counts
    const phaseBreakdown: Record<string, number> = {};
    for (const j of jobSummaries) {
      const p = j.phase || "Unknown";
      phaseBreakdown[p] = (phaseBreakdown[p] || 0) + 1;
    }

    // Subcontractor workload
    const subWorkload: Record<string, number> = {};
    for (const j of jobSummaries) {
      if (j.sub) subWorkload[j.sub] = (subWorkload[j.sub] || 0) + 1;
    }

    // Work order billing summary
    const woTotal = (workOrders || []).reduce((sum, wo) => sum + (Number(wo.bill_amount) || 0), 0);
    const woProfitTotal = (workOrders || []).reduce((sum, wo) => sum + (Number(wo.profit_amount) || 0), 0);

    // Invoice stats
    const invoicePending = jobSummaries.filter(j => !j.invoice_sent).length;
    const invoiceUnpaid = jobSummaries.filter(j => j.invoice_sent && !j.invoice_paid).length;

    const appContext = `
You are Hugh, an AI assistant built exclusively into the JG Painting Pros property management and job tracking application. You have live, real-time access to the application's database. Always answer from this data — never say you don't have access to job or property information.

Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

═══════════════════════════════════════════════
APPLICATION LIVE DATA SNAPSHOT
═══════════════════════════════════════════════

## JOB PHASES (in workflow order)
${phaseLabels.join(" → ")}

## JOB TYPES
${(jobTypes || []).map(t => t.job_type_label).join(", ")}

## JOB CATEGORIES
${(jobCategories || []).map(c => c.name).join(", ")}

## UNIT SIZES AVAILABLE
${(unitSizes || []).map(u => u.unit_size_label).join(", ")}

## PROPERTIES (${activeProperties.length} active)
${activeProperties.map(p => {
  const mgGroup = (p.property_management_group as any)?.company_name;
  return `- ${p.property_name} | ${p.city}, ${p.state}${mgGroup ? ` | Managed by: ${mgGroup}` : ""}`;
}).join("\n")}

## PROPERTY MANAGEMENT GROUPS
${(propertyGroups || []).map(g => `- ${g.company_name} (${g.group_status || "active"})`).join("\n")}

## TEAM MEMBERS (Admins/Management)
${adminUsers.map(u => `- ${u.full_name} (${u.role}) | ${u.email}`).join("\n")}

## SUBCONTRACTORS (${subcontractors.length} total)
${subcontractors.map(s => `- ${s.full_name}${s.company_name ? ` / ${s.company_name}` : ""} | Active jobs: ${subWorkload[s.full_name] || 0}`).join("\n")}

## JOB PHASE BREAKDOWN (all ${jobSummaries.length} jobs)
${Object.entries(phaseBreakdown).sort((a, b) => b[1] - a[1]).map(([phase, count]) => `- ${phase}: ${count} jobs`).join("\n")}

## INVOICE STATUS
- Jobs with invoice NOT sent: ${invoicePending}
- Jobs invoiced but NOT paid: ${invoiceUnpaid}
- Jobs invoiced and paid: ${jobSummaries.filter(j => j.invoice_paid).length}

## WORK ORDER BILLING SUMMARY (last ${(workOrders || []).length} work orders)
- Total billed: $${woTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
- Total profit: $${woProfitTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}

## ALL JOBS (work order #, unit, property, phase, type, size, assigned sub, status, scheduled date, billing)
${JSON.stringify(jobSummaries, null, 2)}

═══════════════════════════════════════════════
YOUR ROLE & INSTRUCTIONS
═══════════════════════════════════════════════
- You have FULL access to this live data — always answer with specifics
- Reference work order numbers, property names, subcontractor names, phases, and dates
- Answer questions about any job, property, subcontractor, phase, billing, or scheduling
- Provide counts, lists, summaries, and analysis when asked
- Proactively surface insights: overdue jobs, unassigned work, invoice gaps, subcontractor workload imbalances
- Recommend subcontractors based on current workload and property preferences
- Be concise, professional, and direct — you're a tool for busy operations managers
- Format responses clearly using bullet points or short tables when listing multiple items
`;

    // ── Build Gemini conversation ────────────────────────────────────────────
    const geminiContents: any[] = [];

    // Inject system context as first turn
    geminiContents.push({
      role: "user",
      parts: [{ text: `${appContext}\n\n---\nBegin. Acknowledge you're ready with one brief sentence.` }],
    });
    geminiContents.push({
      role: "model",
      parts: [{ text: "Hi! I'm Hugh — I have live access to your jobs, properties, subcontractors, phases, and billing data. What can I help you with?" }],
    });

    // Append conversation history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        geminiContents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Current user message
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
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
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
