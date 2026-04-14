/**
 * useSmsNotificationSettings
 *
 * React hook for reading and writing the current user's SMS notification
 * settings. Designed for use in profile settings components and the future
 * Admin Settings UI.
 *
 * Features:
 *  - Loads the authenticated user's settings row on mount.
 *  - Subscribes to real-time Postgres changes so the UI stays in sync if
 *    an admin edits settings elsewhere.
 *  - Exposes typed, ergonomic helpers: toggleMaster, toggleEvent, saveAll.
 *  - Provides loading, saving, and error states independently.
 *  - Computes `eligibleEvents` from the user's role so components can show
 *    only the toggles relevant to that user.
 *  - Never surfaces raw DB errors to the UI — maps them to a human-readable
 *    `error` string and logs the original to the console.
 *
 * Phone number handling:
 *  - The hook exposes `hasSmsPhone` (boolean) and `smsPhone` (string | null).
 *    It reads sms_phone from profiles, not from user_sms_notification_settings.
 *  - If the user has no sms_phone set, the master toggle and all event toggles
 *    should be rendered as disabled in the UI (use hasSmsPhone as guard).
 *
 * Usage:
 * ```tsx
 * const {
 *   settings,
 *   loading,
 *   saving,
 *   error,
 *   hasSmsPhone,
 *   eligibleEvents,
 *   toggleMaster,
 *   toggleEvent,
 * } = useSmsNotificationSettings();
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase';
import {
  getOwnSmsSettings,
  upsertOwnSmsSettings,
  subscribeSmsSettings,
} from '../lib/sms/smsNotificationSettings';
import {
  getSmsEligibleEvents,
  SMS_SETTINGS_DEFAULTS,
} from '../types/sms';
import type {
  UserSmsNotificationSettings,
  UserSmsNotificationSettingsUpdate,
  SmsNotificationEventKey,
} from '../types/sms';

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseSmsNotificationSettingsResult {
  /** The current settings row, or null while loading / if no row found. */
  settings: UserSmsNotificationSettings | null;
  /** True while the initial load is in progress. */
  loading: boolean;
  /** True while a save operation is in flight. */
  saving: boolean;
  /** Human-readable error string, or null if no error. */
  error: string | null;
  /**
   * True if the user has a non-null sms_phone in their profile.
   * Use this to gate the enable switch and all event toggles in the UI.
   */
  hasSmsPhone: boolean;
  /** The user's E.164 phone number from profiles.sms_phone, or null. */
  smsPhone: string | null;
  /**
   * The SMS notification events that are eligible for the current user's role.
   * Render only these toggles in the settings UI.
   */
  eligibleEvents: SmsNotificationEventKey[];
  /**
   * Toggle the master sms_enabled switch.
   * Optimistically updates local state and writes to the DB.
   */
  toggleMaster: (enabled: boolean) => Promise<void>;
  /**
   * Toggle a single notification event flag.
   * Optimistically updates local state and writes to the DB.
   */
  toggleEvent: (event: SmsNotificationEventKey, enabled: boolean) => Promise<void>;
  /**
   * Write a full or partial settings payload in one call.
   * Useful for a "Save all" pattern instead of individual toggles.
   */
  saveAll: (updates: Partial<UserSmsNotificationSettingsUpdate>) => Promise<void>;
  /** Re-fetch the settings row from the server (bypass cache). */
  refetch: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSmsNotificationSettings(): UseSmsNotificationSettingsResult {
  const [settings, setSettings] = useState<UserSmsNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsPhone, setSmsPhone] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);

  // Track the realtime channel so we can unsubscribe on unmount
  const channelRef = useRef<ReturnType<typeof subscribeSmsSettings> | null>(null);

  // ─── Initial load ───────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError('Not authenticated.');
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // Fetch profile for sms_phone and role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('sms_phone, role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('[useSmsNotificationSettings] Profile fetch error:', profileError);
        setError('Failed to load profile.');
        setLoading(false);
        return;
      }

      setSmsPhone(profile?.sms_phone ?? null);
      setUserRole(profile?.role ?? '');

      // Fetch or auto-initialize the SMS settings row
      let row = await getOwnSmsSettings();

      if (!row) {
        // The auto-seed trigger should have created this, but guard anyway.
        // upsertOwnSmsSettings will create the row with defaults.
        row = await upsertOwnSmsSettings({});
      }

      setSettings(row);
    } catch (err: any) {
      console.error('[useSmsNotificationSettings] Load error:', err);
      setError('Failed to load SMS notification settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Real-time subscription ─────────────────────────────────────────────────

  useEffect(() => {
    // Only subscribe once userId is known
    if (!userId) return;

    // Unsubscribe any existing channel before creating a new one
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    channelRef.current = subscribeSmsSettings(userId, (updated) => {
      setSettings(updated);
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [userId]);

  // ─── Mount: load settings ───────────────────────────────────────────────────

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ─── Write helpers ──────────────────────────────────────────────────────────

  const applyUpdate = useCallback(
    async (updates: Partial<UserSmsNotificationSettingsUpdate>) => {
      setSaving(true);
      setError(null);

      // Optimistic update
      setSettings((prev) =>
        prev ? { ...prev, ...updates } : null
      );

      try {
        const saved = await upsertOwnSmsSettings(updates);
        setSettings(saved); // Sync with server response (has updated_at etc.)
      } catch (err: any) {
        console.error('[useSmsNotificationSettings] Save error:', err);
        setError('Failed to save SMS notification settings.');
        // Rollback optimistic update by re-fetching from server
        await loadSettings();
      } finally {
        setSaving(false);
      }
    },
    [loadSettings]
  );

  const toggleMaster = useCallback(
    (enabled: boolean) => applyUpdate({ sms_enabled: enabled }),
    [applyUpdate]
  );

  const toggleEvent = useCallback(
    (event: SmsNotificationEventKey, enabled: boolean) => {
      const fieldKey = ({
        chat_received: 'notify_chat_received',
        job_assigned: 'notify_job_assigned',
        charges_approved: 'notify_charges_approved',
        work_order_submitted: 'notify_work_order_submitted',
        job_accepted: 'notify_job_accepted',
      } as const)[event];
      return applyUpdate({ [fieldKey]: enabled });
    },
    [applyUpdate]
  );

  const saveAll = useCallback(
    (updates: Partial<UserSmsNotificationSettingsUpdate>) => applyUpdate(updates),
    [applyUpdate]
  );

  const refetch = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  // ─── Derived state ──────────────────────────────────────────────────────────

  const hasSmsPhone = smsPhone !== null && smsPhone !== '';
  const eligibleEvents = getSmsEligibleEvents(userRole);

  // ─── Return ─────────────────────────────────────────────────────────────────

  return {
    settings,
    loading,
    saving,
    error,
    hasSmsPhone,
    smsPhone,
    eligibleEvents,
    toggleMaster,
    toggleEvent,
    saveAll,
    refetch,
  };
}
