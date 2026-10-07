import type { AssignmentNotificationStatus } from '../../services/assignmentNotifications';

export type CalendarAssignmentStatus = 'pending' | 'accepted' | 'declined' | 'in_progress' | 'completed' | null;

export interface StatusPresentation {
  label: string;
  shortLabel: string;
  className: string;
}
export function assignmentStatusPresentation(
  status: string | null | undefined,
  assignedTo?: string | null,
): StatusPresentation | null {
  if (status === 'pending' && assignedTo === null) return null;
  switch (status) {
    case 'pending':
      return { label: 'Pending Acceptance', shortLabel: 'Pending', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' };
    case 'accepted':
      return { label: 'Accepted', shortLabel: 'Accepted', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' };
    case 'declined':
      return { label: 'Declined', shortLabel: 'Declined', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' };
    case 'in_progress':
      return { label: 'In Progress', shortLabel: 'In Progress', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' };
    case 'completed':
      return { label: 'Completed', shortLabel: 'Completed', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' };
    default:
      return null;
  }
}

export function notificationStatusPresentation(
  status: AssignmentNotificationStatus | null | undefined,
  sentAt?: string | null,
): StatusPresentation | null {
  switch (status) {
    case 'sent':
      return {
        label: `Sent${sentAt ? ` ${new Date(sentAt).toLocaleString()}` : ''}`,
        shortLabel: 'Sent',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
      };
    case 'pending':
      return { label: 'Not sent — marked to send later', shortLabel: 'Send later', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' };
    case 'processing':
      return { label: 'Sending', shortLabel: 'Sending', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' };
    case 'failed':
      return { label: 'Send failed — retry available', shortLabel: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' };
    default:
      return null;
  }
}
