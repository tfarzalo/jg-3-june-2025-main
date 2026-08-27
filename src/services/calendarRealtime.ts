import { supabase } from '../utils/supabase';

export const CALENDAR_SCHEDULE_CHANNEL = 'calendar-schedule-broadcast';
export const CALENDAR_SCHEDULE_CHANGED_EVENT = 'calendar_schedule_changed';

type CalendarScheduleChangedPayload = {
  source: string;
  jobId?: string | null;
  scheduledDate?: string | null;
  previousScheduledDate?: string | null;
  changedAt: string;
};

export async function broadcastCalendarScheduleChanged(
  payload: Omit<CalendarScheduleChangedPayload, 'changedAt'>
) {
  const channel = supabase.channel(CALENDAR_SCHEDULE_CHANNEL);

  try {
    const status = await new Promise<string>((resolve) => {
      const timeout = window.setTimeout(() => resolve('TIMED_OUT'), 3000);

      channel.subscribe((subscriptionStatus) => {
        if (
          subscriptionStatus === 'SUBSCRIBED' ||
          subscriptionStatus === 'CHANNEL_ERROR' ||
          subscriptionStatus === 'TIMED_OUT' ||
          subscriptionStatus === 'CLOSED'
        ) {
          window.clearTimeout(timeout);
          resolve(subscriptionStatus);
        }
      });
    });

    if (status !== 'SUBSCRIBED') {
      console.warn('[CalendarRealtime] Broadcast channel not ready:', status);
      return;
    }

    await channel.send({
      type: 'broadcast',
      event: CALENDAR_SCHEDULE_CHANGED_EVENT,
      payload: {
        ...payload,
        changedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.warn('[CalendarRealtime] Failed to broadcast schedule change:', error);
  } finally {
    await supabase.removeChannel(channel);
  }
}
