export const DEFAULT_BELL_NOTIFICATION_SETTINGS = {
  new_job_requests: true,
  job_phase_changes: true,
  work_order_submissions: true,
  approval_responses: true,
  assignment_responses: true,
  email_activity: true,
  files: true,
  notes: true,
  callbacks: true,
  contacts: true,
  properties: true,
  system_alerts: true,
} as const;

export type BellNotificationSettingKey = keyof typeof DEFAULT_BELL_NOTIFICATION_SETTINGS;

export type BellNotificationSettings = Record<BellNotificationSettingKey, boolean>;

export const BELL_NOTIFICATION_OPTIONS: Array<{
  key: BellNotificationSettingKey;
  title: string;
  description: string;
}> = [
  {
    key: 'new_job_requests',
    title: 'New Job Requests',
    description: 'New jobs, job requests, and job creation activity',
  },
  {
    key: 'job_phase_changes',
    title: 'Job Phase Changes',
    description: 'Jobs moving between phases or status buckets',
  },
  {
    key: 'work_order_submissions',
    title: 'Work Order Submissions',
    description: 'Submitted or created work orders and related work order activity',
  },
  {
    key: 'approval_responses',
    title: 'Approval Responses',
    description: 'Approved or declined extra charges and other approval decisions',
  },
  {
    key: 'assignment_responses',
    title: 'Assignment Responses',
    description: 'Subcontractor assignment acceptances and declines',
  },
  {
    key: 'email_activity',
    title: 'Email Activity',
    description: 'Emails sent from inside the application',
  },
  {
    key: 'files',
    title: 'Files and Photos',
    description: 'Uploaded files, photos, and attachments',
  },
  {
    key: 'notes',
    title: 'Notes',
    description: 'Job notes, painter notes, and general note activity',
  },
  {
    key: 'callbacks',
    title: 'Callbacks',
    description: 'Property callback scheduling and callback updates',
  },
  {
    key: 'contacts',
    title: 'Contacts',
    description: 'Contact creation and contact-related activity',
  },
  {
    key: 'properties',
    title: 'Properties',
    description: 'Property and property group activity',
  },
  {
    key: 'system_alerts',
    title: 'System Alerts',
    description: 'Important system notifications and uncategorized activity',
  },
];

export function normalizeBellNotificationSettings(value: unknown): BellNotificationSettings {
  let parsed = value;

  if (typeof value === 'string' && value.trim()) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = {};
    }
  }

  const settings = parsed && typeof parsed === 'object'
    ? parsed as Record<string, unknown>
    : {};
  const aliases: Partial<Record<BellNotificationSettingKey, string>> = {
    work_order_submissions: 'work_orders',
  };

  return {
    ...DEFAULT_BELL_NOTIFICATION_SETTINGS,
    ...Object.fromEntries(
      Object.keys(DEFAULT_BELL_NOTIFICATION_SETTINGS).map((key) => [
        key,
        typeof settings[key] === 'boolean'
          ? settings[key]
          : aliases[key as BellNotificationSettingKey] && typeof settings[aliases[key as BellNotificationSettingKey]!] === 'boolean'
            ? settings[aliases[key as BellNotificationSettingKey]!]
          : DEFAULT_BELL_NOTIFICATION_SETTINGS[key as BellNotificationSettingKey],
      ])
    ),
  } as BellNotificationSettings;
}

export function getBellNotificationPreferenceKey(notification: {
  type?: string | null;
  activity_action?: string | null;
  metadata?: Record<string, any> | null;
  activity_metadata?: Record<string, any> | null;
}): BellNotificationSettingKey {
  const metadata = notification.metadata || notification.activity_metadata || {};
  const eventType = typeof metadata.event_type === 'string' ? metadata.event_type : '';
  const templateType = typeof metadata.template_type === 'string' ? metadata.template_type : '';
  const action = notification.activity_action || '';
  const type = notification.type || '';

  if (type === 'job_phase_change') return 'job_phase_changes';
  if (type === 'new_job_request') return 'new_job_requests';
  if (type === 'work_order') return 'work_order_submissions';
  if (type === 'email') return 'email_activity';
  if (type === 'file') return 'files';
  if (type === 'note') return 'notes';
  if (type === 'callback') return 'callbacks';
  if (type === 'contact') return 'contacts';
  if (type === 'property' || type === 'property_group') return 'properties';

  if (type === 'job') {
    if (eventType === 'email_sent') return 'email_activity';
    if (eventType.includes('approval') || templateType.includes('approval')) return 'approval_responses';
    if (eventType.includes('assignment') || templateType === 'sub_assignment') return 'assignment_responses';
    if (action === 'approved' || action === 'rejected') return 'assignment_responses';
    if (action === 'created') return 'new_job_requests';
  }

  if (type === 'other' || type === 'user' || type === 'job_status_change') return 'system_alerts';
  return 'system_alerts';
}
