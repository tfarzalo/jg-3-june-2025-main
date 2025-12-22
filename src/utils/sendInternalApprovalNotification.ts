import { supabase } from './supabase';

interface NotificationData {
  decision: 'approved' | 'declined';
  jobId: string;
  workOrderNum: number;
  propertyName: string;
  unitNumber: string;
  propertyAddress: string;
  extraChargesAmount: number;
  approverName?: string;
  approverEmail: string;
  declineReason?: string;
}

/**
 * Sends an internal notification email to office staff when Extra Charges are approved or declined
 * This function retrieves the BCC emails from email_configurations and sends a notification
 * @param data - The notification data
 * @returns Promise<boolean> - True if sent successfully, false otherwise
 */
export async function sendInternalApprovalNotification(data: NotificationData): Promise<boolean> {
  try {
    console.log('Sending internal approval notification:', data);

    // Get email configuration with BCC emails
    const { data: emailConfig, error: configError } = await supabase
      .from('email_configurations')
      .select('from_email, from_name, default_bcc_emails')
      .eq('is_active', true)
      .single();

    if (configError || !emailConfig) {
      console.warn('No email configuration found, skipping internal notification');
      return false;
    }

    // Check if there are BCC emails configured
    if (!emailConfig.default_bcc_emails || emailConfig.default_bcc_emails.length === 0) {
      console.warn('No BCC emails configured for internal notifications');
      return false;
    }

    const decisionLabel = data.decision === 'approved' ? 'APPROVED' : 'DECLINED';
    const decisionColor = data.decision === 'approved' ? '#10B981' : '#EF4444';
    const decisionAction = data.decision === 'approved' ? 'approved' : 'declined';

    const subject = `[${decisionLabel}] Extra Charges ${decisionLabel} - WO-${String(data.workOrderNum).padStart(6, '0')}`;

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

      <div class="info-row">
        <span class="label">Work Order:</span>
        <span class="value">WO-${String(data.workOrderNum).padStart(6, '0')}</span>
      </div>

      <div class="info-row">
        <span class="label">Property:</span>
        <span class="value">${data.propertyName}</span>
      </div>

      <div class="info-row">
        <span class="label">Unit:</span>
        <span class="value">${data.unitNumber}</span>
      </div>

      <div class="info-row">
        <span class="label">Address:</span>
        <span class="value">${data.propertyAddress}</span>
      </div>

      <div class="info-row">
        <span class="label">Extra Charges Amount:</span>
        <span class="value">$${data.extraChargesAmount.toFixed(2)}</span>
      </div>

      <div class="info-row">
        <span class="label">Decision By:</span>
        <span class="value">${data.approverName || 'Unknown'} (${data.approverEmail})</span>
      </div>

      <div class="info-row">
        <span class="label">Decision Time:</span>
        <span class="value">${new Date().toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}</span>
      </div>

      ${data.declineReason ? `
      <div class="info-row">
        <span class="label">Decline Reason:</span>
        <span class="value">${data.declineReason}</span>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p style="margin: 5px 0;">This is an automated internal notification from JG Painting Pros Inc.</p>
      <p style="margin: 5px 0;">Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email to the first BCC email as primary recipient
    // and BCC all others
    const primaryRecipient = emailConfig.default_bcc_emails[0];
    const bccRecipients = emailConfig.default_bcc_emails;

    const { data: result, error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: primaryRecipient,
        bcc: bccRecipients,
        subject,
        html: htmlBody,
        from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
      },
    });

    if (emailError) {
      console.error('Error sending internal notification email:', emailError);
      return false;
    }

    console.log('Internal notification email sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Exception in sendInternalApprovalNotification:', error);
    return false;
  }
}
