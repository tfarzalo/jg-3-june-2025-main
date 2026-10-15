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
  private engagementScore = 0.18;
  private coolingTimer: ReturnType<typeof setInterval> | null = null;
  private interactionHandler: (() => void) | null = null;
  private listeners = new Set<(users: Map<string, PresencePayload>) => void>();
  private onlineUsers = new Map<string, PresencePayload>();

  private publishPresenceState() {
    const nextUsers = new Map<string, PresencePayload>();
    const state = this.channel?.presenceState() || {};
    Object.entries(state).forEach(([userId, presences]) => {
      const entries = presences as unknown as PresencePayload[];
      const latest = entries[entries.length - 1];
      if (latest) nextUsers.set(userId, { ...latest, user_id: latest.user_id || userId });
    });
    this.onlineUsers = nextUsers;
    this.listeners.forEach((listener) => listener(new Map(nextUsers)));
  }

  subscribe(listener: (users: Map<string, PresencePayload>) => void) {
    this.listeners.add(listener);
    listener(new Map(this.onlineUsers));
    return () => this.listeners.delete(listener);
  }

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
    const freshness = idleSeconds < 15 ? 1 : idleSeconds < 60 ? 0.72 : idleSeconds < 180 ? 0.42 : idleSeconds < 300 ? 0.2 : 0.08;
    return Math.max(0.08, Math.min(1, this.engagementScore * freshness));
  }

  private async trackActivity(force = false, interaction = false) {
    if (!this.channel || !this.isSubscribed || !this.basePayload) return;
    if (!force && Date.now() - this.lastTrackAt < 5000) return;
    this.lastTrackAt = Date.now();
    if (interaction) {
      this.engagementScore = Math.min(1, this.engagementScore + 0.1);
    } else if (Date.now() - this.lastActivityAt > 15000) {
      this.engagementScore = Math.max(0.08, this.engagementScore - 0.08);
    }
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
      void this.trackActivity(false, true);
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
        this.publishPresenceState();
      })
      .on('presence', { event: 'join' }, () => {
        this.publishPresenceState();
      })
      .on('presence', { event: 'leave' }, () => {
        this.publishPresenceState();
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          this.lastActivityAt = Date.now();
          this.engagementScore = 0.18;
          this.startActivityTracking();
          void this.trackActivity(true);
          this.publishPresenceState();
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
      this.engagementScore = 0.18;
      this.consumers = 0;
      this.onlineUsers = new Map();
      this.listeners.forEach((listener) => listener(new Map()));
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
