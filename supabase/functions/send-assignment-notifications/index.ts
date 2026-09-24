import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const decisionBaseUrl = 'https://portal.jgpaintingprosinc.com/assignment/decision';

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] || character));
}

function formatWorkOrder(value: number) {
  return `WO-${String(value).padStart(6, '0')}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function buildEmail(subcontractor: any, rows: any[], tokens: Record<string, string>) {
  const name = subcontractor?.full_name || subcontractor?.email || 'there';
  const firstName = name.split(' ')[0];
  const htmlItems = rows.map((row) => {
    const job = row.job;
    const property = Array.isArray(job.property) ? job.property[0] : job.property;
    const url = `${decisionBaseUrl}?token=${encodeURIComponent(tokens[job.id])}&jobId=${encodeURIComponent(job.id)}`;
    return `<li style="margin-bottom:18px;padding:14px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb">
      <div style="font-weight:600;color:#111827;font-size:15px">${escapeHtml(property?.property_name || 'Property')}</div>
      <div style="margin-top:6px;color:#374151;font-size:14px">
        <div><strong>Work Order:</strong> ${escapeHtml(formatWorkOrder(job.work_order_num))}</div>
        <div><strong>Unit:</strong> ${escapeHtml(job.unit_number || 'Not set')}</div>
        <div><strong>Scheduled Date:</strong> ${escapeHtml(formatDate(job.scheduled_date))}</div>
      </div>
      <div style="margin-top:12px"><a href="${url}" style="display:inline-block;padding:12px 16px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Review &amp; Accept / Decline</a></div>
    </li>`;
  }).join('');

  const textItems = rows.map((row) => {
    const job = row.job;
    const property = Array.isArray(job.property) ? job.property[0] : job.property;
    const url = `${decisionBaseUrl}?token=${tokens[job.id]}&jobId=${job.id}`;
    return `${property?.property_name || 'Property'}\nWork Order: ${formatWorkOrder(job.work_order_num)}\nUnit: ${job.unit_number || 'Not set'}\nScheduled Date: ${formatDate(job.scheduled_date)}\nRespond: ${url}`;
  }).join('\n\n');

  const plural = rows.length === 1 ? 'job' : 'jobs';
  return {
    subject: 'New Job Assignment - Please Accept or Decline',
    html: `<p>Hi ${escapeHtml(firstName)},</p><p>You have been assigned to the following ${plural}. Please review and accept or decline:</p><ul style="padding-left:0;list-style:none">${htmlItems}</ul><p>Thank you,<br>JG Painting Pros Inc.</p>`,
    text: `Hi ${firstName},\n\nYou have been assigned to the following ${plural}. Please review and accept or decline:\n\n${textItems}\n\nThank you,\nJG Painting Pros Inc.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error('Authentication required');

    const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).single();
    if (!profile || profile.role === 'subcontractor') throw new Error('Not authorized');

    const body = await req.json();
    const ids = Array.isArray(body.notificationIds) ? [...new Set(body.notificationIds)].slice(0, 200) : [];
    const groupBySubcontractor = body.groupBySubcontractor !== false;
    if (!ids.length) throw new Error('No assignment notifications selected');

    const { data: claimed, error: claimError } = await userClient.rpc('claim_job_assignment_notifications', { p_ids: ids });
    if (claimError) throw claimError;
    if (!claimed?.length) return Response.json({ success: true, results: [] }, { headers: corsHeaders });

    const claimedIds = claimed.map((row: any) => row.id);
    const { data: rows, error: rowsError } = await admin
      .from('job_assignment_notifications')
      .select(`*, job:jobs(id, work_order_num, unit_number, scheduled_date, assigned_to, assigned_at, property:properties(property_name)), subcontractor:profiles!job_assignment_notifications_subcontractor_id_fkey(id, full_name, email)`)
      .in('id', claimedIds);
    if (rowsError) throw rowsError;

    const groups = new Map<string, any[]>();
    for (const row of rows || []) {
      const key = groupBySubcontractor ? row.subcontractor_id : row.id;
      groups.set(key, [...(groups.get(key) || []), row]);
    }

    const results: any[] = [];
    for (const [, group] of groups) {
      const subcontractorId = group[0].subcontractor_id;
      const subcontractor = Array.isArray(group[0].subcontractor) ? group[0].subcontractor[0] : group[0].subcontractor;
      const recipient = subcontractor?.email || group[0].recipient_email;
      try {
        if (!recipient) throw new Error('Subcontractor does not have an email address');

        const tokens: Record<string, string> = {};
        for (const row of group) {
          const token = crypto.randomUUID();
          const { error: tokenError } = await admin.from('assignment_tokens').insert({
            job_id: row.job.id, subcontractor_id: subcontractorId, token,
            expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), sent_at: null,
          });
          if (tokenError) throw tokenError;
          tokens[row.job.id] = token;
        }

        const message = buildEmail(subcontractor, group, tokens);
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: recipient, ...message }),
        });
        const emailResult = await response.json();
        if (!response.ok || !emailResult.success) throw new Error(emailResult.error || 'Email service rejected the message');

        const sentAt = new Date().toISOString();
        await admin.from('job_assignment_notifications').update({
          status: 'sent', sent_at: sentAt, provider_message_id: emailResult.messageId || null,
          last_error: null, updated_at: sentAt,
        }).in('id', group.map((row) => row.id));
        await admin.from('assignment_tokens').update({ sent_at: sentAt }).in('token', Object.values(tokens));
        await admin.from('email_logs').insert(group.map((row) => ({
          job_id: row.job.id, recipient_email: recipient, subject: message.subject,
          content: message.text, notification_type: 'sub_assignment', sent_by: authData.user.id,
        })));
        results.push({ subcontractorId, success: true, count: group.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown send error';
        await admin.from('job_assignment_notifications').update({
          status: 'failed', last_error: message, updated_at: new Date().toISOString(),
        }).in('id', group.map((row) => row.id));
        results.push({ subcontractorId, success: false, count: group.length, error: message });
      }
    }

    return Response.json({ success: results.every((result) => result.success), results }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400, headers: corsHeaders });
  }
});
