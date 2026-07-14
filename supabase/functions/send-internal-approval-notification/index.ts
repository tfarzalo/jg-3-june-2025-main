import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface NotificationData {
  decision: 'approved' | 'declined';
  jobId: string;
  workOrderNum: number;
  propertyName: string;
  unitNumber: string;
  propertyAddress: string;
  extraChargesAmount: number;
  approverName?: string | null;
  approverEmail?: string | null;
  declineReason?: string | null;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatWorkOrderNumber(value: number) {
  return `WO-${String(value || 0).padStart(6, '0')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase function environment variables');
    }

    const payload = await req.json() as NotificationData;
    if (!payload.jobId || !payload.workOrderNum || !payload.propertyName || typeof payload.extraChargesAmount !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required notification fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    if (!['approved', 'declined'].includes(payload.decision)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid approval decision' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: emailConfig, error: configError } = await supabase
      .from('email_configurations')
      .select('from_email, from_name, default_bcc_emails')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (configError || !emailConfig) {
      console.warn('No active email configuration found for internal approval notification:', configError);
      return new Response(
        JSON.stringify({ success: false, skipped: true, error: 'No active email configuration found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const recipients = Array.isArray(emailConfig.default_bcc_emails)
      ? emailConfig.default_bcc_emails.filter((email: unknown): email is string => typeof email === 'string' && email.includes('@'))
      : [];

    if (recipients.length === 0) {
      console.warn('No default BCC emails configured for internal approval notification');
      return new Response(
        JSON.stringify({ success: false, skipped: true, error: 'No internal recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const decisionLabel = payload.decision === 'approved' ? 'APPROVED' : 'DECLINED';
    const decisionColor = payload.decision === 'approved' ? '#10B981' : '#EF4444';
    const decisionAction = payload.decision === 'approved' ? 'approved' : 'declined';
    const workOrder = formatWorkOrderNumber(payload.workOrderNum);
    const subject = `[${decisionLabel}] Extra Charges ${decisionLabel} - ${workOrder}`;
    const primaryRecipient = recipients[0];
    const bccRecipients = recipients.slice(1);
    const approverLabel = payload.approverEmail
      ? `${escapeHtml(payload.approverName || 'Unknown')} (${escapeHtml(payload.approverEmail)})`
      : escapeHtml(payload.approverName || 'Unknown');

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${decisionColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .info-row { margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #6b7280; display: inline-block; min-width: 140px; }
    .value { color: #111827; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
    h2 { margin: 0; font-size: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Extra Charges ${decisionLabel}</h2>
    </div>
    <div class="content">
      <p style="margin-top: 0; font-size: 16px; color: #374151;">
        The extra charges for the following job have been <strong>${decisionAction}</strong>:
      </p>
      <div class="info-row"><span class="label">Work Order:</span><span class="value">${workOrder}</span></div>
      <div class="info-row"><span class="label">Property:</span><span class="value">${escapeHtml(payload.propertyName)}</span></div>
      <div class="info-row"><span class="label">Unit:</span><span class="value">${escapeHtml(payload.unitNumber || 'N/A')}</span></div>
      <div class="info-row"><span class="label">Address:</span><span class="value">${escapeHtml(payload.propertyAddress || 'N/A')}</span></div>
      <div class="info-row"><span class="label">Extra Charges Amount:</span><span class="value">$${payload.extraChargesAmount.toFixed(2)}</span></div>
      <div class="info-row"><span class="label">Decision By:</span><span class="value">${approverLabel}</span></div>
      <div class="info-row"><span class="label">Decision Time:</span><span class="value">${new Date().toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}</span></div>
      ${payload.declineReason ? `<div class="info-row"><span class="label">Decline Reason:</span><span class="value">${escapeHtml(payload.declineReason)}</span></div>` : ''}
    </div>
    <div class="footer">
      <p style="margin: 5px 0;">This is an automated internal notification from JG Painting Pros Inc.</p>
      <p style="margin: 5px 0;">Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: primaryRecipient,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject,
        html: htmlBody,
        from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
      }),
    });

    const emailResult = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      console.error('send-email failed for internal approval notification:', emailResult);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.error || 'Failed to send email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      );
    }

    return new Response(
      JSON.stringify({ success: true, recipient_count: recipients.length, message_id: emailResult.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    console.error('send-internal-approval-notification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
