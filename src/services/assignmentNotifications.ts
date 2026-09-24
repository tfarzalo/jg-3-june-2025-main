import { supabase } from '../utils/supabase';

export type AssignmentNotificationStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface AssignmentNotificationRow {
  id: string;
  job_id: string;
  subcontractor_id: string | null;
  assignment_assigned_at: string;
  recipient_email: string | null;
  status: AssignmentNotificationStatus;
  requested_by: string | null;
  sent_at: string | null;
  provider_message_id: string | null;
  last_error: string | null;
  created_at: string;
  scheduled_date_snapshot: string | null;
  scheduled_end_date_snapshot: string | null;
  job: {
    id: string;
    work_order_num: number;
    unit_number: string;
    scheduled_date: string;
    scheduled_end_date: string | null;
    assigned_to: string | null;
    assigned_at: string | null;
    property: { property_name: string } | { property_name: string }[] | null;
    subcontractor: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
  } | null;
}

export async function listAssignmentNotifications() {
  const { data, error } = await supabase
    .from('job_assignment_notifications')
    .select(`
      id, job_id, subcontractor_id, assignment_assigned_at, recipient_email,
      status, requested_by, sent_at, provider_message_id, last_error, created_at,
      scheduled_date_snapshot, scheduled_end_date_snapshot,
      job:jobs!job_assignment_notifications_job_id_fkey (
        id, work_order_num, unit_number, scheduled_date, scheduled_end_date,
        assigned_to, assigned_at,
        property:properties (property_name),
        subcontractor:profiles!jobs_assigned_to_fkey (full_name, email)
      )
    `)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AssignmentNotificationRow[];
}

export async function sendAssignmentNotifications(notificationIds: string[], groupBySubcontractor = true) {
  const { data, error } = await supabase.functions.invoke('send-assignment-notifications', {
    body: { notificationIds, groupBySubcontractor },
  });
  if (error) throw error;
  if (!data?.success && !data?.results) throw new Error(data?.error || 'Unable to send assignment notifications');
  return data as { success: boolean; results: Array<{ subcontractorId: string; success: boolean; count: number; error?: string }> };
}

export async function findCurrentAssignmentNotification(jobId: string, assignedAt: string) {
  const { data, error } = await supabase
    .from('job_assignment_notifications')
    .select('id')
    .eq('job_id', jobId)
    .eq('assignment_assigned_at', assignedAt)
    .in('status', ['pending', 'failed'])
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}
