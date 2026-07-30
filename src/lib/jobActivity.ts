import { supabase } from '../utils/supabase';

type JobActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'phase_changed'
  | 'assigned'
  | 'completed'
  | 'cancelled'
  | 'approved'
  | 'rejected'
  | 'other';

interface LogJobActivityInput {
  jobId: string;
  eventType: string;
  title: string;
  description: string;
  action?: JobActivityAction;
  metadata?: Record<string, unknown>;
}

export async function logJobActivity({
  jobId,
  eventType,
  title,
  description,
  action = 'other',
  metadata = {},
}: LogJobActivityInput) {
  try {
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('activity_log').insert({
      entity_type: 'job',
      entity_id: jobId,
      action,
      description,
      changed_by: userData.user?.id ?? null,
      metadata: {
        ...metadata,
        job_id: jobId,
        event_type: eventType,
        title,
      },
    });

    if (error) {
      console.warn('Failed to write job activity log:', error);
    }
  } catch (error) {
    console.warn('Failed to write job activity log:', error);
  }
}
