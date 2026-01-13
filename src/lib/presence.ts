import { supabase } from '../utils/supabase';

export interface PresencePayload {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
}

class PresenceManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private isSubscribed = false;

  async joinChannel(userId: string, email: string, displayName: string, role: string) {
    if (this.channel) {
      await this.leaveChannel();
    }

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
          this.channel.track({
            user_id: userId,
            email: email,
            display_name: displayName,
            role: role,
          });
        }
      });

    return this.channel;
  }

  async leaveChannel() {
    if (!this.channel) return;
    try {
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
