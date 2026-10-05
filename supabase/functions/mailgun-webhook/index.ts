import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MailgunPayload {
  signature?: { timestamp?: string; token?: string; signature?: string };
  "event-data"?: Record<string, any>;
}

const encoder = new TextEncoder();

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifySignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}${token}`));
  return safeEqual(hex(digest), signature.toLowerCase());
}

function eventTime(value: unknown): string {
  const seconds = typeof value === "number" ? value : Number(value);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const signingKey = Deno.env.get("MAILGUN_WEBHOOK_SIGNING_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!signingKey || !supabaseUrl || !serviceKey) throw new Error("Webhook configuration is incomplete");

    const payload = await req.json() as MailgunPayload;
    const signature = payload.signature || {};
    const timestamp = String(signature.timestamp || "");
    const token = String(signature.token || "");
    const signatureValue = String(signature.signature || "");
    if (!timestamp || !token || !signatureValue ||
      !(await verifySignature(signingKey, timestamp, token, signatureValue))) {
      return response({ error: "Invalid signature" }, 401);
    }

    // Reject stale requests while allowing normal provider retry delays.
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 24 * 60 * 60) {
      return response({ error: "Stale webhook" }, 401);
    }

    const event = payload["event-data"] || {};
    const eventId = String(event.id || "");
    const eventType = String(event.event || "").toLowerCase();
    const messageId = String(event.message?.headers?.["message-id"] || "");
    const recipient = String(event.recipient || "").toLowerCase() || null;
    if (!eventId || !eventType) return response({ error: "Incomplete event" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);
    let sendId: string | null = null;
    if (messageId) {
      const bareId = messageId.replace(/^<|>$/g, "");
      const { data } = await supabase
        .from("outbound_email_sends")
        .select("id")
        .in("provider_message_id", [messageId, bareId, `<${bareId}>`])
        .maybeSingle();
      sendId = data?.id || null;
    }

    const severity = event.severity ? String(event.severity) : null;
    const reason = event["delivery-status"]?.message || event.reason || event.description || null;
    const { error: insertError } = await supabase.from("outbound_email_events").upsert({
      outbound_email_send_id: sendId,
      provider: "mailgun",
      provider_event_id: eventId,
      provider_message_id: messageId || null,
      event_type: eventType,
      severity,
      recipient_email: recipient,
      reason: reason ? String(reason) : null,
      event_at: eventTime(event.timestamp),
      payload: event,
    }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
    if (insertError) throw insertError;

    if (sendId) {
      let status: string | null = null;
      if (eventType === "complained") status = "complained";
      if (eventType === "failed") status = severity === "temporary" ? "deferred" : "bounced";
      if (eventType === "delivered") {
        const [{ data: send }, { data: deliveryEvents }] = await Promise.all([
          supabase.from("outbound_email_sends").select("status,to_emails,cc_emails,bcc_emails").eq("id", sendId).single(),
          supabase.from("outbound_email_events").select("recipient_email")
            .eq("outbound_email_send_id", sendId).eq("event_type", "delivered"),
        ]);
        const expected = new Set(
          [...(send?.to_emails || []), ...(send?.cc_emails || []), ...(send?.bcc_emails || [])]
            .map((address: string) => (address.match(/<([^<>]+)>/)?.[1] || address).trim().toLowerCase()),
        );
        const delivered = new Set((deliveryEvents || []).map((row) => row.recipient_email).filter(Boolean));
        if (send && !["bounced", "complained"].includes(send.status) &&
          [...expected].every((address) => delivered.has(address))) {
          status = "delivered";
        }
      }
      if (status) {
        const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
        if (status === "delivered") update.delivered_at = eventTime(event.timestamp);
        if (status === "bounced" || status === "complained") {
          update.failed_at = eventTime(event.timestamp);
          update.last_error = reason ? String(reason) : eventType;
        }
        await supabase.from("outbound_email_sends").update(update).eq("id", sendId);
      }
    }

    return response({ received: true });
  } catch (error) {
    console.error("Mailgun webhook processing failed", error);
    return response({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
