/**
 * SMS Notification Settings — data access layer
 *
 * Provides typed read/write access to public.user_sms_notification_settings.
 *
 * KEY DESIGN DECISIONS:
 *  - Phone numbers are NEVER stored or handled here.
 *    They come exclusively from profiles.sms_phone.
 *  - All shared types are imported from src/types/sms.ts.
 *    Do not re-declare them here — import from that file in other modules too.
 *  - Role eligibility is enforced at the UI/API layer (see SMS_ROLE_ELIGIBILITY).
 *    The DB stores all flag columns for all users, regardless of role.
 *  - upsertOwnSmsSettings resolves user_id from auth.getUser() — callers
 *    never pass their own user_id, preventing spoofing.
 *  - adminUpsertSmsSettings requires admin/super admin RLS to pass.
 *    If a non-admin calls it, Supabase will return a permission denied error.
 *
 * Role eligibility reference:
 *   Subcontractors    → chat_received, job_assigned, charges_approved
 *   Admin / Super     → chat_received, work_order_submitted, job_accepted
 *                       (+ optionally job_assigned, charges_approved)
 *   JG Management     → same as Admin / Super
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../utils/supabase';

// Re-export everything from the canonical types file so existing imports
// that point to this module continue to work without changes.
export type {
  SmsNotificationEventKey,
  SmsEligibleRole,
  UserSmsNotificationSettings,
  UserSmsNotificationSettingsUpdate,
  UserSmsNotificationSettingsWithProfile,
  SmsSendEligibilityResult,
} from '../../types/sms';

export {
  SMS_ROLE_ELIGIBILITY,
  SMS_EVENT_LABELS,
  SMS_EVENT_TO_FIELD,
  SMS_SETTINGS_DEFAULTS,
  getSmsEligibleEvents,
} from '../../types/sms';

// Import locally for use within this file
import type {
  SmsNotificationEventKey,
  UserSmsNotificationSettings,
  UserSmsNotificationSettingsUpdate,
  UserSmsNotificationSettingsWithProfile,
  SmsSendEligibilityResult,
} from '../../types/sms';
import { SMS_SETTINGS_DEFAULTS, SMS_EVENT_TO_FIELD } from '../../types/sms';

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch SMS notification settings for the currently authenticated user.
 *
 * Returns null if no row exists (should not happen post-migration since the
 * auto-seed trigger now creates a row on every profile INSERT, but callers
 * should still handle null gracefully in case of a race condition).
 */
export async function getOwnSmsSettings(): Promise<UserSmsNotificationSettings | null> {
  const { data, error } = await supabase
    .from('user_sms_notification_settings')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No row found — caller should upsert defaults
    console.error('[smsNotificationSettings] getOwnSmsSettings error:', error);
    throw error;
  }

  return data as UserSmsNotificationSettings;
}

/**
 * Fetch SMS notification settings for a specific user by user_id.
 *
 * Requires admin / super admin RLS to read another user's settings.
 * A non-admin calling this for a different user_id will receive null (row
 * filtered out by RLS), not a permission error.
 *
 * Returns null if no row exists.
 */
export async function getSmsSettingsForUser(
  userId: string
): Promise<UserSmsNotificationSettings | null> {
  const { data, error } = await supabase
    .from('user_sms_notification_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[smsNotificationSettings] getSmsSettingsForUser error:', error);
    throw error;
  }

  return data as UserSmsNotificationSettings;
}

/**
 * Fetch SMS notification settings for ALL users, joined with essential profile
 * fields (full_name, email, role, sms_phone).
 *
 * Only succeeds for admin / super admin / jg_management callers (enforced by
 * RLS). Non-admins will receive an empty array because the admin SELECT policy
 * filters them out.
 *
 * Results are ordered by created_at (oldest first) to keep admin UIs stable.
 */
export async function getAllSmsSettings(): Promise<UserSmsNotificationSettingsWithProfile[]> {
  const { data, error } = await supabase
    .from('user_sms_notification_settings')
    .select(`
      *,
      profile:profiles!user_sms_notification_settings_user_id_fkey (
        full_name,
        email,
        role,
        sms_phone
      )
    `)
    .order('created_at');

  if (error) {
    console.error('[smsNotificationSettings] getAllSmsSettings error:', error);
    throw error;
  }

  return (data ?? []) as unknown as UserSmsNotificationSettingsWithProfile[];
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Upsert SMS notification settings for the currently authenticated user.
 *
 * Creates the row if it doesn't exist, updates it if it does.
 * The user_id is resolved from the authenticated session — callers NEVER
 * pass their own user_id (prevents ID spoofing).
 *
 * Partial updates are safe: only the fields present in `updates` are changed;
 * all other flags keep their existing values (or defaults on first create).
 *
 * @throws If the user is not authenticated or if the DB write fails.
 */
export async function upsertOwnSmsSettings(
  updates: Partial<UserSmsNotificationSettingsUpdate>
): Promise<UserSmsNotificationSettings> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('[smsNotificationSettings] Not authenticated. Cannot update SMS settings.');
  }

  // Fetch current state so partial updates preserve existing flags
  const existing = await getOwnSmsSettings();

  const payload = {
    user_id: user.id,
    ...SMS_SETTINGS_DEFAULTS,
    ...(existing ?? {}),
    ...updates,
  };

  // Strip read-only fields that must not appear in the upsert payload
  const { id, created_at, updated_at, user_id: _uid, ...writePayload } = payload as any;

  const { data, error } = await supabase
    .from('user_sms_notification_settings')
    .upsert({ user_id: user.id, ...writePayload }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('[smsNotificationSettings] upsertOwnSmsSettings error:', error);
    throw error;
  }

  return data as UserSmsNotificationSettings;
}

/**
 * Admin: upsert SMS notification settings for a specific user by user_id.
 *
 * Requires admin / super admin RLS. If called by a non-admin the DB will
 * reject the write (the admin UPDATE policy uses is_admin_like()).
 *
 * Partial updates are safe: only the fields present in `updates` are changed.
 *
 * @param userId - The profiles.id of the target user.
 * @param updates - Partial settings to apply.
 */
export async function adminUpsertSmsSettings(
  userId: string,
  updates: Partial<UserSmsNotificationSettingsUpdate>
): Promise<UserSmsNotificationSettings> {
  // Fetch existing to avoid clobbering flags that weren't passed
  const existing = await getSmsSettingsForUser(userId);

  const writePayload = {
    user_id: userId,
    ...SMS_SETTINGS_DEFAULTS,
    ...(existing
      ? {
          sms_enabled: existing.sms_enabled,
          notify_chat_received: existing.notify_chat_received,
          notify_job_assigned: existing.notify_job_assigned,
          notify_charges_approved: existing.notify_charges_approved,
          notify_work_order_submitted: existing.notify_work_order_submitted,
          notify_job_accepted: existing.notify_job_accepted,
        }
      : {}),
    ...updates,
  };

  const { data, error } = await supabase
    .from('user_sms_notification_settings')
    .upsert(writePayload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('[smsNotificationSettings] adminUpsertSmsSettings error:', error);
    throw error;
  }

  return data as UserSmsNotificationSettings;
}

// ─── Convenience toggles ──────────────────────────────────────────────────────

/**
 * Toggle the master sms_enabled switch for the currently authenticated user.
 * Does not affect any of the individual notify_* flags.
 */
export async function toggleOwnSmsEnabled(
  enabled: boolean
): Promise<UserSmsNotificationSettings> {
  return upsertOwnSmsSettings({ sms_enabled: enabled });
}

/**
 * Toggle a single notification event flag for the currently authenticated user.
 * The master sms_enabled switch is NOT affected.
 *
 * @param event - One of the SmsNotificationEventKey values.
 * @param enabled - New value for the flag.
 */
export async function toggleOwnSmsEvent(
  event: SmsNotificationEventKey,
  enabled: boolean
): Promise<UserSmsNotificationSettings> {
  return upsertOwnSmsSettings({ [SMS_EVENT_TO_FIELD[event]]: enabled });
}

// ─── Dispatcher helper ────────────────────────────────────────────────────────

/**
 * Determine whether a specific user should receive an SMS for a given event.
 *
 * Called by the future SMS dispatcher BEFORE sending a message.
 * This function is intentionally READ-ONLY — it never sends anything.
 *
 * All three conditions must be true for `should` to be true:
 *  1. `profiles.sms_phone` is a valid E.164 number (non-null).
 *  2. `sms_enabled` is true (master switch).
 *  3. The specific `notify_<event>` flag is true.
 *
 * @param userId - The profiles.id of the user to check.
 * @param event - The notification event to evaluate.
 * @returns SmsSendEligibilityResult with should, phone, and reason fields.
 */
export async function shouldSendSmsForEvent(
  userId: string,
  event: SmsNotificationEventKey
): Promise<SmsSendEligibilityResult> {
  const { data, error } = await supabase
    .from('user_sms_notification_settings')
    .select(`
      sms_enabled,
      notify_chat_received,
      notify_job_assigned,
      notify_charges_approved,
      notify_work_order_submitted,
      notify_job_accepted,
      profile:profiles!user_sms_notification_settings_user_id_fkey (
        sms_phone
      )
    `)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      should: false,
      phone: null,
      reason: 'No SMS settings row found for user.',
    };
  }

  const phone = (data.profile as any)?.sms_phone ?? null;

  if (!phone) {
    return {
      should: false,
      phone: null,
      reason: 'User has no sms_phone set in profile.',
    };
  }

  if (!data.sms_enabled) {
    return {
      should: false,
      phone,
      reason: 'SMS notifications are disabled for this user (master switch is off).',
    };
  }

  const fieldKey = SMS_EVENT_TO_FIELD[event];
  if (!data[fieldKey as keyof typeof data]) {
    return {
      should: false,
      phone,
      reason: `Notification for event "${event}" is disabled for this user.`,
    };
  }

  return { should: true, phone, reason: 'OK' };
}

// ─── Real-time subscription ───────────────────────────────────────────────────

/**
 * Subscribe to real-time changes on the caller's own SMS settings row.
 *
 * Uses the supabase_realtime publication added in migration
 * `sms_settings_gaps_and_auto_seed`. RLS applies — the subscription will only
 * receive events for rows the caller is permitted to see.
 *
 * @param userId - The auth.uid() / profiles.id of the current user.
 * @param onUpdate - Callback invoked whenever the settings row changes.
 * @returns The RealtimeChannel — call `.unsubscribe()` to clean up.
 *
 * @example
 * ```typescript
 * const channel = subscribeSmsSettings(userId, (settings) => {
 *   setSmsSettings(settings);
 * });
 * // On unmount:
 * channel.unsubscribe();
 * ```
 */
export function subscribeSmsSettings(
  userId: string,
  onUpdate: (settings: UserSmsNotificationSettings) => void
): RealtimeChannel {
  return supabase
    .channel(`sms_settings:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'user_sms_notification_settings',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') return; // Row deleted — let callers handle via null
        onUpdate(payload.new as UserSmsNotificationSettings);
      }
    )
    .subscribe();
}
