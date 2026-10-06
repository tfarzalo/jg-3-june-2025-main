import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const response = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return response({ success: false, error: "Queue worker is not configured" }, 500);

  const authorization = req.headers.get("Authorization") || "";
  if (authorization !== `Bearer ${serviceKey}`) return response({ success: false, error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const processed: Array<Record<string, unknown>> = [];
  const maximumPerInvocation = 20;

  for (let index = 0; index < maximumPerInvocation; index += 1) {
    const { data, error } = await admin.rpc("claim_outbound_email_delivery", { p_spacing_seconds: 2 });
    if (error) return response({ success: false, error: error.message, processed }, 500);
    const delivery = data?.[0];
    if (!delivery) break;

    const waitMilliseconds = Math.max(0, new Date(delivery.send_at).getTime() - Date.now());
    if (waitMilliseconds > 0) await sleep(waitMilliseconds);

    try {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...delivery.payload,
          to: delivery.recipient,
          cc: [],
          bcc: [],
          _queueDirect: true,
          _queueDeliveryId: delivery.delivery_id,
          _queueAuditId: delivery.audit_id,
          metadata: {
            ...(delivery.payload?.metadata || {}),
            queued_delivery: true,
            original_recipient_field: delivery.original_recipient_field,
          },
        }),
      });
      const result = await emailResponse.json();
      if (!emailResponse.ok || !result.success) throw new Error(result.error || "Queued email submission failed");

      const submittedAt = new Date().toISOString();
      await admin.from("outbound_email_queue_deliveries").update({
        status: "submitted", submitted_at: submittedAt, locked_at: null,
        last_error: null, updated_at: submittedAt,
      }).eq("id", delivery.delivery_id);
      processed.push({ deliveryId: delivery.delivery_id, success: true, messageId: result.messageId || null });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);
      const canRetry = Number(delivery.attempt_count) < 4;
      const retryDelaySeconds = Math.min(120, 10 * (2 ** Math.max(0, Number(delivery.attempt_count) - 1)));
      const nextAttempt = new Date(Date.now() + retryDelaySeconds * 1000).toISOString();
      await admin.from("outbound_email_queue_deliveries").update({
        status: canRetry ? "retrying" : "failed",
        available_at: canRetry ? nextAttempt : new Date().toISOString(),
        locked_at: null, last_error: message, updated_at: new Date().toISOString(),
      }).eq("id", delivery.delivery_id);
      await admin.from("outbound_email_sends").update({
        status: canRetry ? "retrying" : "failed",
        last_error: message,
        failed_at: canRetry ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", delivery.audit_id);
      processed.push({ deliveryId: delivery.delivery_id, success: false, retrying: canRetry, error: message });
    }

    const { count: remainingForMessage } = await admin
      .from("outbound_email_queue_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("message_id", delivery.queue_message_id)
      .in("status", ["queued", "processing", "retrying"]);
    if ((remainingForMessage || 0) === 0) {
      // The potentially large attachment payload is no longer needed after all
      // recipient deliveries have reached a terminal queue state.
      await admin.from("outbound_email_queue_messages").update({
        payload: {}, completed_at: new Date().toISOString(),
      }).eq("id", delivery.queue_message_id);
    }
  }

  const { data: nextRows } = await admin
    .from("outbound_email_queue_deliveries")
    .select("available_at")
    .in("status", ["queued", "retrying"])
    .order("available_at", { ascending: true })
    .limit(1);
  if (processed.length > 0 && nextRows?.[0]?.available_at) {
    const { data: throttle } = await admin
      .from("outbound_email_queue_throttle")
      .select("next_send_at")
      .eq("singleton", true)
      .maybeSingle();
    const nextAvailableAt = Math.max(
      new Date(nextRows[0].available_at).getTime(),
      throttle?.next_send_at ? new Date(throttle.next_send_at).getTime() : Date.now(),
    );
    const delay = Math.max(0, Math.min(60_000, nextAvailableAt - Date.now()));
    const continueProcessing = (async () => {
      if (delay > 0) await sleep(delay);
      await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source: "queue-continuation" }),
      });
    })().catch((continuationError) => console.warn("Unable to continue email queue:", continuationError));
    // deno-lint-ignore no-explicit-any
    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(continueProcessing);
  }

  return response({ success: true, processedCount: processed.length, processed });
});
