import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
type Row = { id: string; label: string };

// Keep helpers in this file so it can be deployed from the Supabase dashboard.
export const businessTimeZone = "America/New_York";

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function shiftDay(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return dateOnly(result);
}

export function businessMidnight(date: string) {
  // 05:00 UTC falls at midnight or 1 a.m. Eastern, before the DST switch.
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimeZone,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${date}T05:00:00Z`)).find(part => part.type === "timeZoneName");
  return `${date}T00:00:00${offset!.value.replace("GMT", "")}`;
}

export function dateContext(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const weekdayOffset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const thisStart = shiftDay(today, -weekdayOffset);
  return {
    today,
    weekday: parts.weekday,
    thisStart,
    thisEnd: shiftDay(thisStart, 6),
    lastStart: shiftDay(thisStart, -7),
    lastEnd: shiftDay(thisStart, -1),
  };
}

export function regularPaintWeek(message: string, dates: ReturnType<typeof dateContext>) {
  const match = /^how many regular paint jobs (?:were there |were scheduled |are there |are scheduled )?(last|this) week[?.!]?$/i.exec(message.trim());
  if (!match) return null;

  const lastWeek = match[1].toLowerCase() === "last";
  return {
    from: lastWeek ? dates.lastStart : dates.thisStart,
    through: lastWeek ? dates.lastEnd : dates.thisEnd,
  };
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required." }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return json({ error: "Invalid or expired session." }, 401);
    const { data: caller } = await db.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    if (!caller?.role || caller.role === "subcontractor") return json({ error: "You do not have permission to use Hugh." }, 403);

    const body = await req.json();
    const message = String(body?.message || "").trim();
    if (!message) return json({ error: "message is required" }, 400);
    const dates = dateContext(new Date());
    const paintWeek = regularPaintWeek(message, dates);
    if (paintWeek) {
      const { from, through } = paintWeek;
      const { count, error } = await db.from("jobs")
        .select("id,job_categories!inner(name)", { count: "exact", head: true })
        .ilike("job_categories.name", "Regular Paint")
        .gte("scheduled_date", businessMidnight(from))
        .lt("scheduled_date", businessMidnight(shiftDay(through, 1)));
      if (error || count === null) {
        console.error("Hugh Regular Paint count failed", error);
        return json({ reply: "I couldn't verify the Regular Paint job count. Please try again later." });
      }
      const jobLabel = count === 1 ? "job" : "jobs";
      return json({
        reply: `${count.toLocaleString("en-US")} Regular Paint ${jobLabel} scheduled from ${from} through ${through} (Eastern time).`,
        followUp: count > 0 ? {
          question: `Would you like me to list ${count === 1 ? "that job" : "those jobs"} with the property, unit number, and work order number?`,
          options: [{ label: "Yes, list the jobs", message: regularPaintListMessage(from, through) }],
        } : undefined,
      });
    }

    const paintList = /^List Regular Paint jobs scheduled from (\d{4}-\d{2}-\d{2}) through (\d{4}-\d{2}-\d{2}) with property, unit number, and work order number(?: \(page ([1-9]\d{0,3})\))?\.$/i.exec(message);
    if (paintList) {
      const [, from, through, pageNumber] = paintList;
      const page = Number(pageNumber || 1);
      const pageSize = 25;
      const offset = (page - 1) * pageSize;
      const { data, count, error } = await db.from("jobs")
        .select("id,work_order_num,unit_number,property:properties(property_name),job_categories!inner(name)", { count: "exact" })
        .ilike("job_categories.name", "Regular Paint")
        .gte("scheduled_date", businessMidnight(from))
        .lt("scheduled_date", businessMidnight(shiftDay(through, 1)))
        .order("scheduled_date")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error || count === null) {
        console.error("Hugh Regular Paint list failed", error);
        return json({ reply: "I couldn't retrieve the Regular Paint jobs. Please try again later." });
      }
      if (!data?.length) return json({ reply: `No Regular Paint jobs to show for this page (${from} through ${through}, Eastern time).` });
      const rows = data.map(job => {
        const property = job.property as unknown as { property_name: string } | null;
        return `- [${woFormat(job.work_order_num)}](/dashboard/jobs/${job.id}) · ${property?.property_name || "Property unavailable"} · Unit ${job.unit_number || "unavailable"}`;
      });
      const lastRow = offset + data.length;
      return json({
        reply: `Regular Paint jobs ${offset + 1}–${lastRow} of ${count}, scheduled from ${from} through ${through} (Eastern time).\n\n${rows.join("\n")}`,
        followUp: lastRow < count ? {
          question: "Would you like to see the next jobs?",
          options: [{ label: "Show next jobs", message: regularPaintListMessage(from, through, page + 1) }],
        } : undefined,
      });
    }

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "Gemini API key not configured." }, 503);
    const [p, t, s, c, g] = await Promise.all([
      db.from("job_phases").select("id,job_phase_label").order("sort_order"),
      db.from("job_types").select("id,job_type_label"), db.from("unit_sizes").select("id,unit_size_label"),
      db.from("job_categories").select("id,name,is_hidden"), db.from("property_management_groups").select("id,company_name"),
    ]);
    const cats = {
      phases: catalog(p.data, "job_phase_label"), types: catalog(t.data, "job_type_label"), sizes: catalog(s.data, "unit_size_label"),
      categories: catalog((c.data || []).filter((x: any) => !x.is_hidden), "name"), groups: catalog(g.data, "company_name"),
    };
    const contents: any[] = [
      { role: "user", parts: [{ text: prompt(dates, cats) }] },
      { role: "model", parts: [{ text: "Understood. I will query live data before answering." }] },
    ];
    for (const m of Array.isArray(body.history) ? body.history.slice(-10) : []) if (m?.content) contents.push({ role: m.role === "user" ? "user" : "model", parts: [{ text: String(m.content).slice(0, 8000) }] });
    contents.push({ role: "user", parts: [{ text: message }] });

    let answer = "", links: any[] = [];
    for (let round = 0; round < 4; round++) {
      const gemini = await askGemini(key, contents);
      const parts = gemini?.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter((x: any) => x.functionCall).map((x: any) => x.functionCall);
      if (!calls.length) { answer = parts.map((x: any) => x.text || "").join("\n").trim(); break; }
      contents.push({ role: "model", parts });
      const responses = [];
      for (const call of calls) {
        const result = await runTool(db, call.name, call.args || {}, cats);
        links = links.concat(getLinks(result));
        responses.push({ functionResponse: { name: call.name, response: result } });
      }
      contents.push({ role: "user", parts: responses });
    }
    const { reply, followUp } = parseFollowUp(answer);
    return json({ reply: linkify(reply || "I couldn't complete that lookup. Please try again.", links), followUp });
  } catch (e) {
    console.error("Hugh AI error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function regularPaintListMessage(from: string, through: string, page = 1) {
  const pageSuffix = page > 1 ? ` (page ${page})` : "";
  return `List Regular Paint jobs scheduled from ${from} through ${through} with property, unit number, and work order number${pageSuffix}.`;
}

export function parseFollowUp(answer: string) {
  const marker = "\nHUGH_FOLLOW_UP:";
  const markerIndex = answer.indexOf(marker);
  if (markerIndex < 0) return { reply: answer };
  const reply = answer.slice(0, markerIndex).trim();
  try {
    const suggestion = JSON.parse(answer.slice(markerIndex + marker.length));
    const question = typeof suggestion?.question === "string" ? suggestion.question.trim() : "";
    if (!reply || !question || question.length > 200 || !Array.isArray(suggestion.options)) return { reply };
    const options = suggestion.options.flatMap((option: { label?: unknown; message?: unknown } | null) => {
      const label = typeof option?.label === "string" ? option.label.trim() : "";
      const message = typeof option?.message === "string" ? option.message.trim() : "";
      return label && label.length <= 48 && message && message.length <= 500 ? [{ label, message }] : [];
    }).slice(0, 2);
    return options.length ? { reply, followUp: { question, options } } : { reply };
  } catch {
    return { reply };
  }
}

async function askGemini(key: string, contents: any[]) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents, tools: [{ functionDeclarations: tools }], generationConfig: { temperature: .1, maxOutputTokens: 3072 } }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} - ${await res.text()}`);
  return res.json();
}

const tools = [
  { name: "search_jobs", description: "Query and exactly count live jobs. ALWAYS use for job questions, especially counts, dates, types, categories, sizes, properties, phases, assignees, billing, invoices, occupancy, or work orders.", parameters: { type: "OBJECT", properties: {
    work_order_number: { type: "STRING" }, property_name: { type: "STRING" }, job_type: { type: "STRING" }, job_category: { type: "STRING" }, unit_size: { type: "STRING" }, unit_number: { type: "STRING" }, phase: { type: "STRING" }, assigned_to: { type: "STRING" }, status: { type: "STRING" }, assignment_status: { type: "STRING" }, scheduled_from: { type: "STRING", description: "Inclusive YYYY-MM-DD" }, scheduled_to: { type: "STRING", description: "Inclusive YYYY-MM-DD" }, created_from: { type: "STRING" }, created_to: { type: "STRING" }, invoice_sent: { type: "BOOLEAN" }, invoice_paid: { type: "BOOLEAN" }, occupied: { type: "BOOLEAN" }, full_paint: { type: "BOOLEAN", description: "Whether the submitted work order is marked as full paint" }, limit: { type: "INTEGER", description: "Rows to show; exact_count is unaffected" },
  } } },
  { name: "search_properties", description: "Search and exactly count properties and property information, contacts, addresses, groups, and status.", parameters: { type: "OBJECT", properties: { search: { type: "STRING" }, management_group: { type: "STRING" }, active_only: { type: "BOOLEAN" }, include_archived: { type: "BOOLEAN" }, limit: { type: "INTEGER" } } } },
  { name: "search_users", description: "Search and exactly count application users and user information, roles, companies, and contact details.", parameters: { type: "OBJECT", properties: { search: { type: "STRING" }, role: { type: "STRING" }, include_archived: { type: "BOOLEAN" }, limit: { type: "INTEGER" } } } },
];

async function runTool(db: any, name: string, a: any, cats: any) {
  if (name === "search_jobs") return jobs(db, a, cats);
  if (name === "search_properties") return properties(db, a, cats);
  if (name === "search_users") return users(db, a);
  return { error: `Unknown tool ${name}` };
}

async function jobs(db: any, a: any, cats: any) {
  const resolved: Record<string, string[]> = {};
  for (const [col, value, rows] of [["job_type_id", a.job_type, cats.types], ["job_category_id", a.job_category, cats.categories], ["unit_size_id", a.unit_size, cats.sizes], ["current_phase_id", a.phase, cats.phases]]) {
    if (value) { const ids = resolve(value, rows as Row[]); if (!ids.length) return empty(`No ${String(col).replace(/_id$/, "")} matched “${value}”.`); resolved[String(col)] = ids; }
  }
  if (a.property_name) {
    const { data } = await db.from("properties").select("id").ilike("property_name", `%${like(a.property_name)}%`).limit(100);
    if (!data?.length) return empty(`No property matched “${a.property_name}”.`); resolved.property_id = data.map((x: any) => x.id);
  }
  if (a.assigned_to) {
    const x = filter(a.assigned_to), { data } = await db.from("profiles").select("id").or(`full_name.ilike.%${x}%,company_name.ilike.%${x}%,email.ilike.%${x}%`).limit(100);
    if (!data?.length) return empty(`No user matched “${a.assigned_to}”.`); resolved.assigned_to = data.map((x: any) => x.id);
  }
  const workOrdersJoin = typeof a.full_paint === "boolean" ? "work_orders!inner" : "work_orders";
  let q = db.from("jobs").select(`id,work_order_num,unit_number,description,scheduled_date,scheduled_end_date,created_at,updated_at,status,assignment_status,priority,purchase_order,invoice_sent,invoice_paid,total_billing_amount,is_occupied,assigned_to,property:properties(id,property_name,address,city,state,zip),phase:job_phases!jobs_current_phase_id_fkey(id,job_phase_label),job_type:job_types!jobs_job_type_id_fkey(id,job_type_label),job_category:job_categories(id,name),unit_size:unit_sizes!jobs_unit_size_id_fkey(id,unit_size_label),assigned_to_profile:profiles!jobs_assigned_to_fkey(id,full_name,company_name,email),${workOrdersJoin}(id,submission_date,is_active,is_full_paint,unit_size,job_category_id,bill_amount,sub_pay_amount,profit_amount,additional_comments)`, { count: "exact" });
  for (const [col, ids] of Object.entries(resolved)) q = q.in(col, ids);
  const wo = String(a.work_order_number || "").replace(/\D/g, "");
  if (wo) q = q.eq("work_order_num", Number(wo));
  if (a.unit_number) q = q.ilike("unit_number", a.unit_number);
  if (a.status) q = q.ilike("status", a.status);
  if (a.assignment_status) q = q.ilike("assignment_status", a.assignment_status);
  if (a.scheduled_from) q = q.gte("scheduled_date", businessMidnight(a.scheduled_from));
  if (a.scheduled_to) q = q.lt("scheduled_date", businessMidnight(shiftDay(a.scheduled_to, 1)));
  if (a.created_from) q = q.gte("created_at", businessMidnight(a.created_from));
  if (a.created_to) q = q.lt("created_at", businessMidnight(shiftDay(a.created_to, 1)));
  for (const col of ["invoice_sent", "invoice_paid"] as const) if (typeof a[col] === "boolean") q = q.eq(col, a[col]);
  if (typeof a.occupied === "boolean") q = q.eq("is_occupied", a.occupied);
  if (typeof a.full_paint === "boolean") q = q.eq("work_orders.is_full_paint", a.full_paint).eq("work_orders.is_active", true);
  const { data, count, error } = await q.order("scheduled_date", { ascending: false }).limit(limit(a.limit));
  if (error) return { error: error.message };
  const results = (data || []).map((x: any) => ({ ...x, work_order: woFormat(x.work_order_num), job_link: `/dashboard/jobs/${x.id}`, property_link: x.property?.id ? `/dashboard/properties/${x.property.id}` : null, user_link: x.assigned_to ? `/dashboard/users/subcontractors/${x.assigned_to}` : null }));
  return { exact_count: count || 0, results_returned: results.length, applied_filters: a, results };
}

async function properties(db: any, a: any, cats: any) {
  let q = db.from("properties").select(`id,property_name,address,address_2,city,state,zip,is_active,is_archived,community_manager_name,community_manager_email,community_manager_phone,maintenance_supervisor_name,maintenance_supervisor_email,maintenance_supervisor_phone,primary_contact_name,primary_contact_email,primary_contact_phone,ap_name,ap_email,ap_phone,quickbooks_number,property_management_group:property_management_groups(id,company_name)`, { count: "exact" });
  if (a.search) { const x = filter(a.search); q = q.or(`property_name.ilike.%${x}%,address.ilike.%${x}%,city.ilike.%${x}%,state.ilike.%${x}%,community_manager_name.ilike.%${x}%,community_manager_email.ilike.%${x}%`); }
  if (a.management_group) { const ids = resolve(a.management_group, cats.groups); if (!ids.length) return empty(`No management group matched “${a.management_group}”.`); q = q.in("property_management_group_id", ids); }
  if (a.active_only !== false) q = q.eq("is_active", true); if (!a.include_archived) q = q.eq("is_archived", false);
  const { data, count, error } = await q.order("property_name").limit(limit(a.limit)); if (error) return { error: error.message };
  const results = (data || []).map((x: any) => ({ ...x, property_link: `/dashboard/properties/${x.id}` }));
  return { exact_count: count || 0, results_returned: results.length, applied_filters: a, results };
}

async function users(db: any, a: any) {
  let q = db.from("profiles").select(`id,full_name,email,role,company_name,phone,mobile_phone,sms_phone,preferred_contact_method,address,address_line_1,address_line_2,city,state,zip_code,archived_at,created_at`, { count: "exact" });
  if (a.search) { const x = filter(a.search); q = q.or(`full_name.ilike.%${x}%,email.ilike.%${x}%,company_name.ilike.%${x}%,phone.ilike.%${x}%,mobile_phone.ilike.%${x}%`); }
  if (a.role) q = q.ilike("role", a.role); if (!a.include_archived) q = q.is("archived_at", null);
  const { data, count, error } = await q.order("full_name").limit(limit(a.limit)); if (error) return { error: error.message };
  const results = (data || []).map((x: any) => ({ ...x, user_link: x.role === "subcontractor" ? `/dashboard/users/subcontractors/${x.id}` : `/dashboard/profile/${x.id}` }));
  return { exact_count: count || 0, results_returned: results.length, applied_filters: a, results };
}

function prompt(d: any, c: any) { return `You are Hugh, the JG Painting Pros operations assistant. Answer only from live application data.
Business timezone: ${businessTimeZone}. Today: ${d.today} (${d.weekday}). This week (Mon-Sun): ${d.thisStart} through ${d.thisEnd}. Last week (Mon-Sun): ${d.lastStart} through ${d.lastEnd}.
Job types: ${labels(c.types)}. Job categories: ${labels(c.categories)}. Unit sizes: ${labels(c.sizes)}. Phases: ${labels(c.phases)}. Property groups: ${labels(c.groups)}.
RULES: You MUST call the relevant tool before answering any application-data question. For “last week”, “this month”, etc. filter scheduled dates unless the user explicitly asks when records were created. Date ranges are inclusive. Distinguish job type from job category and map wording to the matching known value; if ambiguous, query both. exact_count is authoritative; results_returned is never the total. Query again for follow-ups. Never guess after an error. Include applied date/filter in count answers. Use supplied links. Do not expose raw JSON, internal IDs, or tool names.
When there is a useful next step or a clarification with clear choices, append one line after the answer in this format:
HUGH_FOLLOW_UP: {"question":"Would you like to see the matching jobs?","options":[{"label":"Yes, list the jobs","message":"List the matching jobs with property, unit and work order number, using the same filters."}]}
Write a self-contained message for each option with the actual dates and filters applied. Offer one or two short, distinct buttons with useful next requests. The UI provides its own No thanks button. Omit this line for errors or when there is no meaningful next step or clarification. Include the follow-up question only in the metadata, once.`; }

function catalog(rows: any[] | null, key: string): Row[] { return (rows || []).filter(x => x.id && x[key]).map(x => ({ id: x.id, label: String(x[key]) })); }
function resolve(v: string, rows: Row[]) { const n = norm(v), exact = rows.filter(x => norm(x.label) === n); return (exact.length ? exact : rows.filter(x => norm(x.label).includes(n) || n.includes(norm(x.label)))).map(x => x.id); }
function norm(v: string) { return String(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function labels(rows: Row[]) { return rows.map(x => x.label).join(", ") || "none"; }
function limit(v: any) { return Math.min(100, Math.max(1, Number(v) || 25)); }
function like(v: any) { return String(v).replace(/[%,_]/g, ""); } function filter(v: any) { return String(v).replace(/[(),.%]/g, " ").trim(); }
function empty(note: string) { return { exact_count: 0, results_returned: 0, results: [], note }; } function woFormat(v: any) { return v == null ? "N/A" : `WO-${String(v).padStart(6, "0")}`; }
function json(v: any, status = 200) { return new Response(JSON.stringify(v), { status, headers: { ...cors, "Content-Type": "application/json" } }); }

function getLinks(r: any) { const out: any[] = []; for (const x of r?.results || []) { if (x.work_order && x.job_link) out.push({ label: x.work_order, href: x.job_link }); if (x.property?.property_name && x.property_link) out.push({ label: x.property.property_name, href: x.property_link }); if (x.property_name && x.property_link) out.push({ label: x.property_name, href: x.property_link }); if (x.full_name && x.user_link) out.push({ label: x.full_name, href: x.user_link }); if (x.assigned_to_profile?.full_name && x.user_link) out.push({ label: x.assigned_to_profile.full_name, href: x.user_link }); } return out; }
function linkify(text: string, targets: any[]) { const unique: any[] = Array.from(new Map(targets.filter(x => x.label?.length >= 3).map(x => [x.label.toLowerCase(), x])).values()).sort((a: any, b: any) => b.label.length - a.label.length); let out = text; for (const t of unique) out = outside(out, s => s.replace(new RegExp(`(^|[^\\w\\]/])(${escapeRx(t.label)})(?=$|[^\\w\\)])`, "gi"), (_: any, p: string, l: string) => `${p}[${l}](${t.href})`)); return out; }
function outside(text: string, fn: (s: string) => string) { const re = /\[[^\]]+\]\([^)]+\)/g, parts = []; let pos = 0, m; while ((m = re.exec(text))) { parts.push(fn(text.slice(pos, m.index)), m[0]); pos = m.index + m[0].length; } parts.push(fn(text.slice(pos))); return parts.join(""); }
function escapeRx(v: string) { return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
