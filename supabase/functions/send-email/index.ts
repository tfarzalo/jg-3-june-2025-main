import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTransport } from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type EmailProvider = "zoho" | "mailgun";
type AddressInput = string | string[] | null | undefined;

interface EmailAttachment {
  filename: string;
  content?: string;
  path?: string;
  contentType?: string;
  encoding?: string;
  cid?: string;
}

interface EmailRequestBody {
  to: AddressInput;
  cc?: AddressInput;
  bcc?: AddressInput;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  emailType?: string;
  notificationType?: string;
  jobId?: string;
  job_id?: string;
  metadata?: Record<string, unknown>;
}

interface NormalizedRecipients {
  to: string[];
  cc: string[];
  bcc: string[];
}

type OriginalRecipientField = "to" | "cc" | "bcc";

interface IsolatedRecipient {
  address: string;
  originalField: OriginalRecipientField;
}

interface AttachmentMetric {
  filename: string;
  extension: string | null;
  content_type: string;
  raw_bytes: number | null;
  estimated_encoded_bytes: number | null;
  inline: boolean;
  size_known: boolean;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function splitAddressList(value: AddressInput): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => splitAddressList(item));

  const values: string[] = [];
  let current = "";
  let angleDepth = 0;
  let quoted = false;

  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (!quoted && character === "<") angleDepth += 1;
    if (!quoted && character === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (!quoted && angleDepth === 0 && (character === "," || character === ";")) {
      if (current.trim()) values.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) values.push(current.trim());
  return values;
}

function emailAddressKey(value: string): string | null {
  const bracketed = value.match(/<([^<>]+)>/);
  const candidate = (bracketed?.[1] || value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

function normalizeReplyTo(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/[\r\n]/.test(value) || !emailAddressKey(value)) {
    throw new Error("Invalid Reply-To email address");
  }
  return value.trim();
}

function plainTextFromHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, label) => {
      const cleanLabel = String(label).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const cleanHref = String(href).replace(/&amp;/gi, "&").trim();
      return cleanLabel && cleanLabel !== cleanHref ? `${cleanLabel}: ${cleanHref}` : cleanHref;
    })
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function inferEmailType(body: EmailRequestBody): string {
  const explicitType = (body.emailType || body.notificationType || "").trim().toLowerCase();
  if (explicitType) return explicitType;

  const subject = body.subject.toLowerCase();
  if (subject.startsWith("jg daily job summary")) return "daily_job_summary";
  if (subject.includes("new job assignment") || subject.includes("assignment")) return "assignment_notification";
  if (subject.includes("extra charge") && subject.includes("approval")) return "extra_charge_approval";
  if (subject.includes("sprinkler")) return "sprinkler_notification";
  if (subject.includes("drywall")) return "drywall_notification";
  if (subject.includes("work order update")) return "general_work_order";
  if (subject.includes("approval receipt") || subject.includes("approval confirmation")) return "approval_receipt";
  if (subject.includes("password")) return "password_reset";
  if (subject.includes("welcome") || subject.includes("account created")) return "user_onboarding";
  if (subject.includes("support")) return "support_notification";
  return "other";
}

function normalizeRecipients(to: AddressInput, cc: AddressInput, bcc: AddressInput): NormalizedRecipients {
  const seen = new Set<string>();
  const normalize = (input: AddressInput) => {
    const result: string[] = [];
    for (const address of splitAddressList(input)) {
      const key = emailAddressKey(address);
      if (!key) throw new Error(`Invalid recipient email address: ${address}`);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(address);
    }
    return result;
  };

  return { to: normalize(to), cc: normalize(cc), bcc: normalize(bcc) };
}

function isolateRecipients(recipients: NormalizedRecipients): IsolatedRecipient[] {
  return [
    ...recipients.to.map((address) => ({ address, originalField: "to" as const })),
    ...recipients.cc.map((address) => ({ address, originalField: "cc" as const })),
    ...recipients.bcc.map((address) => ({ address, originalField: "bcc" as const })),
  ];
}

function decodedContentBytes(attachment: EmailAttachment): number | null {
  if (typeof attachment.content !== "string") return null;
  if ((attachment.encoding || "base64").toLowerCase() !== "base64") {
    return new TextEncoder().encode(attachment.content).byteLength;
  }

  const encoded = attachment.content.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(encoded.length * 3 / 4) - padding);
}

const INLINE_IMAGE_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
};

function detectInlineImageMime(base64Content: string): string | null {
  try {
    const normalized = base64Content.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
    const bytes = Uint8Array.from(atob(normalized.slice(0, 64)), (character) => character.charCodeAt(0));
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
    if (bytes.length >= 6) {
      const header = String.fromCharCode(...bytes.slice(0, 6));
      if (header === "GIF87a" || header === "GIF89a") return "image/gif";
    }
    if (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    ) return "image/webp";
    return null;
  } catch {
    return null;
  }
}

function validateInlineImageAttachment(attachment: EmailAttachment): void {
  if (!attachment.cid) return;
  if (typeof attachment.content !== "string" || (attachment.encoding || "base64").toLowerCase() !== "base64") {
    throw new Error(`Inline attachment ${attachment.filename} must contain base64 image data`);
  }

  const declaredMime = (attachment.contentType || "").toLowerCase().split(";")[0].trim();
  if (declaredMime === "image/svg+xml") {
    throw new Error(`Inline SVG attachment ${attachment.filename} is not permitted`);
  }

  const detectedMime = detectInlineImageMime(attachment.content);
  if (!detectedMime || !INLINE_IMAGE_EXTENSIONS[detectedMime]) {
    throw new Error(`Inline attachment ${attachment.filename} is not a supported JPEG, PNG, GIF, or WebP image`);
  }
  if (declaredMime !== detectedMime) {
    throw new Error(`Inline attachment ${attachment.filename} declares ${declaredMime || "no MIME type"} but contains ${detectedMime}`);
  }

  const extension = attachment.filename.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  if (!INLINE_IMAGE_EXTENSIONS[detectedMime].includes(extension)) {
    throw new Error(`Inline attachment ${attachment.filename} has an extension that does not match ${detectedMime}`);
  }
}

function estimatedBase64MimeBytes(rawBytes: number): number {
  const encodedCharacters = Math.ceil(rawBytes / 3) * 4;
  const lineBreakBytes = Math.ceil(encodedCharacters / 76) * 2;
  return encodedCharacters + lineBreakBytes;
}

function attachmentMetrics(attachments: EmailAttachment[]): AttachmentMetric[] {
  return attachments.map((attachment) => {
    const rawBytes = decodedContentBytes(attachment);
    const extensionMatch = attachment.filename.trim().match(/\.([^.\s]+)$/);
    return {
      filename: attachment.filename,
      extension: extensionMatch?.[1]?.toLowerCase() || null,
      content_type: attachment.contentType || "application/octet-stream",
      raw_bytes: rawBytes,
      estimated_encoded_bytes: rawBytes === null ? null : estimatedBase64MimeBytes(rawBytes),
      inline: Boolean(attachment.cid),
      size_known: rawBytes !== null,
    };
  });
}

function positiveIntegerEnvironment(name: string, fallback: number): number {
  const value = Number.parseInt(Deno.env.get(name) || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getProvider(): EmailProvider {
  const configured = (Deno.env.get("OUTBOUND_EMAIL_PROVIDER") || "zoho").trim().toLowerCase();
  if (configured !== "zoho" && configured !== "mailgun") {
    throw new Error(`Unsupported outbound email provider: ${configured}`);
  }
  return configured;
}

function providerConfiguration(provider: EmailProvider) {
  if (provider === "mailgun") {
    const user = Deno.env.get("MAILGUN_SMTP_USERNAME");
    const pass = Deno.env.get("MAILGUN_SMTP_PASSWORD");
    const host = Deno.env.get("MAILGUN_SMTP_HOST") || "smtp.mailgun.org";
    const port = Number.parseInt(Deno.env.get("MAILGUN_SMTP_PORT") || "587", 10);
    const fromEmail = Deno.env.get("MAILGUN_FROM_EMAIL") || "admin@jgpaintingprosinc.com";
    const fromName = Deno.env.get("MAILGUN_FROM_NAME") || "JG Painting Pros Inc.";
    const replyTo = Deno.env.get("MAILGUN_REPLY_TO_EMAIL") || fromEmail;

    if (!user || !pass) throw new Error("Mailgun SMTP credentials are not configured");
    if (!Number.isFinite(port)) throw new Error("Mailgun SMTP port is invalid");

    return {
      host,
      port,
      user,
      pass,
      from: `"${fromName.replace(/[\r\n"]/g, "").trim()}" <${fromEmail}>`,
      replyTo,
      transport: {
        host,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: { user, pass },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 60_000,
        tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
      },
    };
  }

  const user = Deno.env.get("ZOHO_EMAIL");
  const pass = Deno.env.get("ZOHO_PASSWORD");
  const host = Deno.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com";
  const port = Number.parseInt(Deno.env.get("ZOHO_SMTP_PORT") || "587", 10);
  if (!user || !pass) throw new Error("Zoho Mail credentials are not configured");
  if (!Number.isFinite(port)) throw new Error("Zoho SMTP port is invalid");

  return {
    host,
    port,
    user,
    pass,
    from: `"JG Painting Pros" <${user}>`,
    replyTo: user,
    // Preserve the current Zoho transport until the Mailgun cutover is verified.
    transport: {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false, ciphers: "SSLv3" },
    },
  };
}

function auditClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? createClient(url, key) : null;
}

async function createAuditRecord(values: Record<string, unknown>): Promise<string | null> {
  const client = auditClient();
  if (!client) return null;
  const { data, error } = await client.from("outbound_email_sends").insert(values).select("id").single();
  if (error) {
    console.warn("Unable to create outbound email audit record:", error.message);
    return null;
  }
  return data.id as string;
}

async function updateAuditRecord(id: string | null, values: Record<string, unknown>) {
  if (!id) return;
  const client = auditClient();
  if (!client) return;
  const { error } = await client.from("outbound_email_sends").update(values).eq("id", id);
  if (error) console.warn("Unable to update outbound email audit record:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    try {
      const provider = getProvider();
      const config = providerConfiguration(provider);
      return jsonResponse({
        success: true,
        message: "Send-email function is configured",
        timestamp: new Date().toISOString(),
        provider,
        env_check: { configured: Boolean(config.user && config.pass), host: config.host, port: config.port },
      });
    } catch (error) {
      return jsonResponse({ success: false, error: errorMessage(error) }, 500);
    }
  }

  let provider: EmailProvider | null = null;

  try {
    provider = getProvider();
    const config = providerConfiguration(provider);
    const body = await req.json() as EmailRequestBody;

    if (!body.subject || (!body.text && !body.html)) throw new Error("Missing required email fields");

    const recipients = normalizeRecipients(body.to, body.cc, body.bcc);
    if (!recipients.to.length) throw new Error("At least one valid To recipient is required");
    const isolatedRecipients = isolateRecipients(recipients);

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const processedAttachments = attachments.map((attachment) => {
      if (!attachment.filename || (!attachment.content && !attachment.path)) {
        throw new Error(`Attachment ${attachment.filename || "(unnamed)"} is missing a filename, content, or path`);
      }
      validateInlineImageAttachment(attachment);
      return {
        filename: attachment.filename,
        content: attachment.content,
        path: attachment.path,
        contentType: attachment.contentType || "application/octet-stream",
        encoding: attachment.encoding || "base64",
        cid: attachment.cid,
      };
    });

    const textContent = body.text || plainTextFromHtml(body.html);
    const encoder = new TextEncoder();
    const htmlBytes = body.html ? encoder.encode(body.html).byteLength : 0;
    const textBytes = textContent ? encoder.encode(textContent).byteLength : 0;
    const measuredAttachments = attachmentMetrics(attachments);
    const attachmentBytes = measuredAttachments.reduce((sum, item) => sum + (item.raw_bytes || 0), 0);
    const estimatedEncodedAttachmentBytes = measuredAttachments
      .reduce((sum, item) => sum + (item.estimated_encoded_bytes || 0), 0);
    const imageAttachmentCount = measuredAttachments
      .filter((item) => item.content_type.toLowerCase().startsWith("image/")).length;
    const addressingBytes = encoder.encode([
      body.subject,
      ...recipients.to,
      ...recipients.cc,
      ...recipients.bcc,
    ].join("\r\n")).byteLength;
    const estimatedMimeOverheadBytes = 2_048 + addressingBytes + measuredAttachments.length * 600;
    const estimatedMessageBytes = htmlBytes + textBytes + estimatedEncodedAttachmentBytes + estimatedMimeOverheadBytes;

    const messageWarningBytes = positiveIntegerEnvironment("EMAIL_SIZE_WARNING_BYTES", 10 * 1024 * 1024);
    const attachmentWarningBytes = positiveIntegerEnvironment("EMAIL_ATTACHMENT_WARNING_BYTES", 5 * 1024 * 1024);
    const htmlWarningBytes = positiveIntegerEnvironment("EMAIL_HTML_WARNING_BYTES", 100 * 1024);
    const maximumMessageBytes = positiveIntegerEnvironment("EMAIL_SIZE_MAX_BYTES", 18 * 1024 * 1024);
    const sizeWarnings: string[] = [];
    if (estimatedMessageBytes >= maximumMessageBytes) {
      sizeWarnings.push(`Estimated message size exceeds the ${maximumMessageBytes} byte sending limit`);
    }
    if (estimatedMessageBytes >= messageWarningBytes) {
      sizeWarnings.push(`Estimated message size is at or above ${messageWarningBytes} bytes`);
    }
    if (htmlBytes >= htmlWarningBytes) {
      sizeWarnings.push(`HTML body size is at or above ${htmlWarningBytes} bytes`);
    }
    for (const attachment of measuredAttachments) {
      if (attachment.raw_bytes !== null && attachment.raw_bytes >= attachmentWarningBytes) {
        sizeWarnings.push(`Attachment ${attachment.filename} is at or above ${attachmentWarningBytes} bytes`);
      }
    }
    if (measuredAttachments.some((attachment) => !attachment.size_known)) {
      sizeWarnings.push("One or more attachment sizes could not be measured before submission");
    }

    const requestedFrom = provider === "zoho" ? body.from : undefined;
    const requestedReplyTo = normalizeReplyTo(body.replyTo, config.replyTo);
    const auditValuesFor = (
      recipient: IsolatedRecipient,
      index: number,
      status: "sending" | "failed" = "sending",
      lastError: string | null = null,
    ) => ({
      provider,
      email_type: inferEmailType(body),
      job_id: body.jobId || body.job_id || null,
      to_emails: [recipient.address],
      cc_emails: [],
      bcc_emails: [],
      subject: body.subject,
      status,
      attachment_count: processedAttachments.length,
      attachment_bytes: attachmentBytes,
      html_bytes: htmlBytes,
      text_bytes: textBytes,
      image_attachment_count: imageAttachmentCount,
      estimated_encoded_attachment_bytes: estimatedEncodedAttachmentBytes,
      estimated_message_bytes: estimatedMessageBytes,
      attachment_metadata: measuredAttachments,
      size_warnings: sizeWarnings,
      attempt_count: 1,
      last_error: lastError,
      failed_at: status === "failed" ? new Date().toISOString() : null,
      metadata: {
        ...(body.metadata || {}),
        isolated_delivery: true,
        original_recipient_field: recipient.originalField,
        isolated_recipient_index: index,
        isolated_recipient_count: isolatedRecipients.length,
      },
    });

    if (estimatedMessageBytes >= maximumMessageBytes) {
      const sizeError =
        `Estimated email size (${estimatedMessageBytes} bytes) exceeds the configured ${maximumMessageBytes} byte limit. ` +
        "Remove attachments or provide the remaining images through the secure notification or approval page.";
      await Promise.all(isolatedRecipients.map((recipient, index) =>
        createAuditRecord(auditValuesFor(recipient, index, "failed", sizeError))
      ));
      throw new Error(sizeError);
    }

    console.log("Submitting outbound email", {
      provider,
      toCount: recipients.to.length,
      ccCount: recipients.cc.length,
      bccCount: recipients.bcc.length,
      isolatedMessageCount: isolatedRecipients.length,
      attachmentCount: processedAttachments.length,
      attachmentBytes,
      imageAttachmentCount,
      estimatedEncodedAttachmentBytes,
      estimatedMessageBytes,
      sizeWarnings,
    });

    const transporter = createTransport(config.transport);
    const deliveryResults: Array<Record<string, unknown>> = [];

    // Submit sequentially so every address receives a genuinely independent
    // message and provider message ID without creating a sudden SMTP burst.
    for (const [index, recipient] of isolatedRecipients.entries()) {
      const auditId = await createAuditRecord(auditValuesFor(recipient, index));

      try {
        const info = await transporter.sendMail({
          from: requestedFrom || config.from,
          replyTo: requestedReplyTo,
          to: recipient.address,
          subject: body.subject,
          text: textContent,
          html: body.html,
          attachments: processedAttachments.length ? processedAttachments : undefined,
        });

        const accepted = (info.accepted || []).map(String);
        const rejected = (info.rejected || []).map(String);
        const status = rejected.length ? (accepted.length ? "partially_accepted" : "rejected") : "submitted";
        const submittedAt = new Date().toISOString();
        await updateAuditRecord(auditId, {
          status,
          provider_message_id: info.messageId || null,
          accepted_recipients: accepted,
          rejected_recipients: rejected,
          pending_recipients: info.pending || [],
          smtp_response: info.response || null,
          submitted_at: submittedAt,
          last_error: null,
          updated_at: submittedAt,
        });
        deliveryResults.push({
          success: accepted.length > 0 && rejected.length === 0,
          recipient: recipient.address,
          originalField: recipient.originalField,
          auditId,
          messageId: info.messageId || null,
          accepted,
          rejected,
          pending: info.pending || [],
          response: info.response || null,
          status,
        });
      } catch (deliveryError) {
        const message = errorMessage(deliveryError);
        const failedAt = new Date().toISOString();
        await updateAuditRecord(auditId, {
          status: "failed",
          last_error: message,
          failed_at: failedAt,
          updated_at: failedAt,
        });
        deliveryResults.push({
          success: false,
          recipient: recipient.address,
          originalField: recipient.originalField,
          auditId,
          messageId: null,
          accepted: [],
          rejected: [recipient.address],
          pending: [],
          response: null,
          status: "failed",
          error: message,
        });
      }
    }

    const successfulDeliveries = deliveryResults.filter((result) => result.success === true);
    const failedDeliveries = deliveryResults.filter((result) => result.success !== true);
    if (!successfulDeliveries.length) {
      const firstError = String(failedDeliveries[0]?.error || "All isolated email submissions failed");
      throw new Error(firstError);
    }

    const status = failedDeliveries.length ? "partially_accepted" : "submitted";
    const primaryResult = deliveryResults[0];
    console.log("Isolated outbound emails submitted", {
      provider,
      status,
      submitted: successfulDeliveries.length,
      failed: failedDeliveries.length,
    });
    return jsonResponse({
      success: true,
      provider,
      auditId: primaryResult?.auditId || null,
      messageId: primaryResult?.messageId || null,
      accepted: successfulDeliveries.flatMap((result) => result.accepted as string[]),
      rejected: failedDeliveries.flatMap((result) => result.rejected as string[]),
      pending: deliveryResults.flatMap((result) => result.pending as string[]),
      response: primaryResult?.response || null,
      status,
      isolated: true,
      deliveryResults,
      sizeMetrics: {
        htmlBytes,
        textBytes,
        attachmentBytes,
        estimatedEncodedAttachmentBytes,
        estimatedMessageBytes,
        imageAttachmentCount,
        warnings: sizeWarnings,
      },
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error("Outbound email submission failed", { provider, error: message });
    return jsonResponse({ success: false, provider, auditId: null, error: message }, 500);
  }
});
