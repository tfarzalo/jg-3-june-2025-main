import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatCurrency = (value: unknown) => {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

interface ExtraChargeReceiptItem {
  description?: string;
  cost?: number;
  quantity?: number;
  hours?: number;
  unit?: string;
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const { token, decision, approverName, approverEmail, reviewUrl } = await req.json();

    if (!token || !["approved", "declined"].includes(decision)) {
      return new Response(JSON.stringify({ error: "token and decision are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: approval, error: approvalError } = await supabase
      .from("approval_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (approvalError || !approval) {
      throw new Error(approvalError?.message || "Approval token not found");
    }

    const recipientEmail = approverEmail || approval.approver_email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "No approver email available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const extraData = approval.extra_charges_data || {};
    const jobDetails = extraData.job_details || {};
    const workOrderNum = jobDetails.work_order_num
      ? `WO-${String(jobDetails.work_order_num).padStart(6, "0")}`
      : "Work Order";
    const propertyName = jobDetails.property_name || "Property";
    const unitNumber = jobDetails.unit_number || "N/A";
    const total = Number(extraData.total || 0);
    const decisionLabel = decision === "approved" ? "Approved" : "Declined";
    const decisionColor = decision === "approved" ? "#15803d" : "#b91c1c";

    const items = Array.isArray(extraData.items) ? extraData.items : [];
    const rows = items.map((item: ExtraChargeReceiptItem) => {
      const quantity = item.quantity ? `${escapeHtml(item.quantity)} ${escapeHtml(item.unit || "items")}` : "";
      const hours = item.hours ? `${escapeHtml(item.hours)} hour${Number(item.hours) === 1 ? "" : "s"}` : "";
      const qtyText = quantity || hours || "-";
      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">${qtyText}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.cost)}</td>
        </tr>
      `;
    }).join("");

    const attachments: Array<{
      filename: string;
      content: string;
      contentType: string;
      encoding: string;
      cid: string;
    }> = [];

    const imageEntries = Array.isArray(extraData.selected_image_entries)
      ? extraData.selected_image_entries
      : [];

    const imageCards: string[] = [];
    for (const entry of imageEntries) {
      const bucket = entry.bucket || (entry.source === "files" ? "files" : "job-images");
      const { data: blob, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(entry.file_path);

      if (downloadError || !blob) {
        console.warn("Unable to attach approval image", entry.file_path, downloadError);
        continue;
      }

      const contentType = blob.type || "image/jpeg";
      const cid = `approval_${String(entry.id || crypto.randomUUID()).replace(/-/g, "")}@jgpaintingpros.com`;
      const filename = entry.file_name || entry.file_path?.split("/").pop() || "approval-photo.jpg";

      attachments.push({
        filename,
        content: await toBase64(blob),
        contentType,
        encoding: "base64",
        cid,
      });

      imageCards.push(`
        <td style="padding:8px;width:50%;vertical-align:top;">
          <img src="cid:${cid}" alt="${escapeHtml(filename)}" style="width:100%;max-width:240px;height:160px;object-fit:cover;border:1px solid #e5e7eb;border-radius:6px;" />
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">${escapeHtml(filename)}</div>
        </td>
      `);
    }

    const imageRows = imageCards.reduce<string[]>((rows, card, index) => {
      if (index % 2 === 0) rows.push(`<tr>${card}`);
      else rows[rows.length - 1] += `${card}</tr>`;
      return rows;
    }, []).map((row) => row.endsWith("</tr>") ? row : `${row}<td></td></tr>`).join("");

    const safeReviewUrl = reviewUrl || `${supabaseUrl.replace(".supabase.co", "")}/approval/${token}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#111827;line-height:1.5;">
        <h2 style="color:${decisionColor};margin-bottom:8px;">Extra Charges ${decisionLabel}</h2>
        <p>This is a copy of the extra charges record for your reference.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:18px 0;">
          <p style="margin:0 0 6px;"><strong>Work Order:</strong> ${escapeHtml(workOrderNum)}</p>
          <p style="margin:0 0 6px;"><strong>Property:</strong> ${escapeHtml(propertyName)}</p>
          <p style="margin:0 0 6px;"><strong>Unit:</strong> ${escapeHtml(unitNumber)}</p>
          <p style="margin:0;"><strong>${decisionLabel} by:</strong> ${escapeHtml(approverName || approval.approver_name || recipientEmail)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;margin:18px 0;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Description</th>
              <th style="padding:10px;text-align:center;">Qty/Hrs</th>
              <th style="padding:10px;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:12px;text-align:right;font-weight:bold;">Total</td>
              <td style="padding:12px;text-align:right;font-weight:bold;">${formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
        ${imageRows ? `
          <h3 style="margin:22px 0 8px;">Attached Photos</h3>
          <table style="width:100%;border-collapse:collapse;">${imageRows}</table>
        ` : ""}
        <p style="margin-top:22px;">
          <a href="${escapeHtml(safeReviewUrl)}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 16px;border-radius:6px;font-weight:bold;">
            View approval record
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280;margin-top:18px;">
          This email is for your records and can be searched later from your inbox.
        </p>
      </div>
    `;

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject: `${workOrderNum} Extra Charges ${decisionLabel} - ${propertyName}`,
        html,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    });

    if (!emailResponse.ok) {
      throw new Error(`send-email failed: ${await emailResponse.text()}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error sending approval receipt email:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
