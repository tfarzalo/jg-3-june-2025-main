export type ApprovalListStatus = 'not_sent' | 'sent' | 'approved' | 'declined';

export interface ApprovalStatusRecord {
  job_id: string;
  decision?: string | null;
  used_at?: string | null;
  invalidated_at?: string | null;
  created_at: string;
}

export function latestApprovalStatuses(records: ApprovalStatusRecord[]) {
  const result: Record<string, ApprovalListStatus> = {};
  const sorted = [...records].sort((a, b) => b.created_at.localeCompare(a.created_at));

  for (const record of sorted) {
    if (result[record.job_id]) continue;
    if (record.invalidated_at) result[record.job_id] = 'not_sent';
    else if (record.decision === 'approved') result[record.job_id] = 'approved';
    else if (record.decision === 'declined') result[record.job_id] = 'declined';
    else result[record.job_id] = 'sent';
  }

  return result;
}

export const approvalStatusPresentation: Record<ApprovalListStatus, { label: string; className: string }> = {
  not_sent: { label: 'Notice Not Sent', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  sent: { label: 'Notification Sent', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' },
  declined: { label: 'Declined — High Priority', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200' },
};
