import { supabase } from '../utils/supabase';

export interface PresencePayload {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  current_path: string;
  context_type: 'job' | 'work_order' | 'dashboard' | 'other';
  job_id: string | null;
  last_activity_at: string;
  activity_level: number;
}

class PresenceManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private isSubscribed = false;
  private userId: string | null = null;
  private basePayload: Pick<PresencePayload, 'user_id' | 'email' | 'display_name' | 'role'> | null = null;
  private consumers = 0;
  private lastActivityAt = Date.now();
  private lastTrackAt = 0;
  private coolingTimer: ReturnType<typeof setInterval> | null = null;
  private interactionHandler: (() => void) | null = null;

  private getContext() {
    const path = window.location.pathname;
    const jobMatch = path.match(/\/dashboard\/jobs\/([0-9a-f-]{36})(?:\/|$)/i);
    return {
      current_path: path,
      context_type: (jobMatch
        ? path.includes('work-order') ? 'work_order' : 'job'
        : path === '/dashboard' ? 'dashboard' : 'other') as PresencePayload['context_type'],
      job_id: jobMatch?.[1] || null,
    };
  }

  private activityLevel() {
    const idleSeconds = (Date.now() - this.lastActivityAt) / 1000;
    if (idleSeconds < 15) return 1;
    if (idleSeconds < 60) return 0.72;
    if (idleSeconds < 180) return 0.42;
    if (idleSeconds < 300) return 0.2;
    return 0.08;
  }

  private async trackActivity(force = false) {
    if (!this.channel || !this.isSubscribed || !this.basePayload) return;
    if (!force && Date.now() - this.lastTrackAt < 5000) return;
    this.lastTrackAt = Date.now();
    await this.channel.track({
      ...this.basePayload,
      ...this.getContext(),
      last_activity_at: new Date(this.lastActivityAt).toISOString(),
      activity_level: this.activityLevel(),
    } satisfies PresencePayload);
  }

  private startActivityTracking() {
    if (this.interactionHandler) return;
    this.interactionHandler = () => {
      this.lastActivityAt = Date.now();
      void this.trackActivity();
    };
    ['pointerdown', 'pointermove', 'keydown', 'input', 'scroll'].forEach((eventName) => {
      window.addEventListener(eventName, this.interactionHandler!, { passive: true });
    });
    this.coolingTimer = setInterval(() => void this.trackActivity(true), 15000);
  }

  private stopActivityTracking() {
    if (this.interactionHandler) {
      ['pointerdown', 'pointermove', 'keydown', 'input', 'scroll'].forEach((eventName) => {
        window.removeEventListener(eventName, this.interactionHandler!);
      });
    }
    if (this.coolingTimer) clearInterval(this.coolingTimer);
    this.interactionHandler = null;
    this.coolingTimer = null;
  }

  async joinChannel(userId: string, email: string, displayName: string, role: string) {
    if (this.channel && this.userId === userId) {
      this.consumers += 1;
      return this.channel;
    }
    if (this.channel) {
      this.consumers = 1;
      await this.leaveChannel(true);
    }

    this.consumers = 1;
    this.userId = userId;
    this.basePayload = { user_id: userId, email, display_name: displayName, role };

    this.channel = supabase.channel('presence:online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        // This will be handled by the hook
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          this.lastActivityAt = Date.now();
          this.startActivityTracking();
          void this.trackActivity(true);
        }
      });

    return this.channel;
  }

  async leaveChannel(force = false) {
    if (!this.channel) return;
    if (!force && this.consumers > 1) {
      this.consumers -= 1;
      return;
    }
    try {
      this.stopActivityTracking();
      const st = (this.channel as any)?.state;
      if (st && st !== 'closed' && st !== 'errored') {
        if (this.isSubscribed) {
          await this.channel.untrack();
        }
        await this.channel.unsubscribe();
      }
    } catch (e) {
      console.warn('presence: leaveChannel error', e);
    } finally {
      this.channel = null;
      this.isSubscribed = false;
      this.userId = null;
      this.basePayload = null;
      this.consumers = 0;
    }
  }

  getChannel() {
    return this.channel;
  }

  isChannelSubscribed() {
    return this.isSubscribed;
  }
}

// Export singleton instance
export const presenceManager = new PresenceManager();
