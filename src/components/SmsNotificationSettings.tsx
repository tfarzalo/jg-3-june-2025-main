/**
 * SmsNotificationSettings
 *
 * Admin-only component rendered inside AppSettings under the "SMS Notifications" tab.
 *
 * Behaviour:
 *  - Loads all users + their SMS settings in one query via getAllSmsSettings().
 *  - Groups users by role: Super Admin → Admin → JG Management → Subcontractor.
 *  - For each user shows:
 *      • Name / email / phone (read-only from profiles.sms_phone)
 *      • Master "SMS Enabled" toggle
 *      • Per-event checkboxes filtered by SMS_ROLE_ELIGIBILITY for their role
 *  - Each change is written to the DB immediately via adminUpsertSmsSettings().
 *  - Shows inline saving spinners and error toasts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Phone, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllSmsSettings,
  adminUpsertSmsSettings,
} from '../lib/sms/smsNotificationSettings';
import {
  SMS_ROLE_ELIGIBILITY,
  SMS_EVENT_LABELS,
  SMS_EVENT_TO_FIELD,
  SMS_SETTINGS_DEFAULTS,
  getSmsEligibleEvents,
} from '../types/sms';
import type {
  UserSmsNotificationSettingsWithProfile,
  SmsNotificationEventKey,
} from '../types/sms';

// ─── Role display helpers ─────────────────────────────────────────────────────

const ROLE_DISPLAY: Record<string, string> = {
  is_super_admin: 'Super Admin',
  admin: 'Admin',
  jg_management: 'JG Management',
  subcontractor: 'Subcontractor',
};

const ROLE_ORDER = ['is_super_admin', 'admin', 'jg_management', 'subcontractor'];

const ROLE_BADGE_CLASSES: Record<string, string> = {
  is_super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  jg_management: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  subcontractor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── User row component ───────────────────────────────────────────────────────

interface UserRowProps {
  row: UserSmsNotificationSettingsWithProfile;
  onUpdate: (
    userId: string,
    field: keyof typeof SMS_SETTINGS_DEFAULTS,
    value: boolean
  ) => Promise<void>;
  savingField: string | null; // "<userId>:<field>"
}

function UserRow({ row, onUpdate, savingField }: UserRowProps) {
  const { profile } = row;
  const role = profile.role;
  const eligibleEvents = getSmsEligibleEvents(role);
  const isSaving = (field: string) => savingField === `${row.user_id}:${field}`;

  return (
    <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      {/* User header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {profile.full_name || profile.email}
            </span>
            {ROLE_DISPLAY[role] && (
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  ROLE_BADGE_CLASSES[role] ??
                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {ROLE_DISPLAY[role] ?? role}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{profile.email}</p>

          {/* Phone number */}
          <div className="flex items-center gap-1.5 mt-1">
            <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
            {profile.sms_phone ? (
              <span className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                {profile.sms_phone}
              </span>
            ) : (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                No phone set — SMS will not send
              </span>
            )}
          </div>
        </div>

        {/* Master toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSaving('sms_enabled') && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          )}
          <span className="text-xs text-gray-600 dark:text-gray-400">SMS</span>
          <Toggle
            checked={row.sms_enabled}
            onChange={(v) => onUpdate(row.user_id, 'sms_enabled', v)}
            disabled={isSaving('sms_enabled')}
            label="Master SMS toggle"
          />
        </div>
      </div>

      {/* Event checkboxes */}
      {eligibleEvents.length > 0 ? (
        <div className={`grid gap-2 ${row.sms_enabled ? '' : 'opacity-50 pointer-events-none'}`}>
          {eligibleEvents.map((event: SmsNotificationEventKey) => {
            const field = SMS_EVENT_TO_FIELD[event];
            const checked = row[field as keyof typeof row] as boolean;
            const saving = isSaving(field);

            return (
              <label
                key={event}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                ) : (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onUpdate(row.user_id, field as keyof typeof SMS_SETTINGS_DEFAULTS, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                )}
                <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {SMS_EVENT_LABELS[event]}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          No SMS events configured for role: {role}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SmsNotificationSettings() {
  const [rows, setRows] = useState<UserSmsNotificationSettingsWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "<userId>:<fieldName>" — tracks which specific field is being saved
  const [savingField, setSavingField] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await getAllSmsSettings();
      // Filter to only SMS-eligible roles
      const eligible = data.filter((r) =>
        Object.keys(SMS_ROLE_ELIGIBILITY).includes(r.profile?.role ?? '')
      );
      setRows(eligible);
    } catch (err) {
      console.error('[SmsNotificationSettings] load error:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load SMS settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = useCallback(
    async (
      userId: string,
      field: keyof typeof SMS_SETTINGS_DEFAULTS,
      value: boolean
    ) => {
      const key = `${userId}:${field}`;
      setSavingField(key);

      // Optimistic update
      setRows((prev) =>
        prev.map((r) =>
          r.user_id === userId ? { ...r, [field]: value } : r
        )
      );

      try {
        await adminUpsertSmsSettings(userId, { [field]: value });
      } catch (err) {
        console.error('[SmsNotificationSettings] save error:', err);
        toast.error('Failed to save SMS setting');
        // Rollback optimistic update
        setRows((prev) =>
          prev.map((r) =>
            r.user_id === userId ? { ...r, [field]: !value } : r
          )
        );
      } finally {
        setSavingField(null);
      }
    },
    []
  );

  // Group rows by role using ROLE_ORDER
  const grouped = ROLE_ORDER.reduce<
    Record<string, UserSmsNotificationSettingsWithProfile[]>
  >((acc, role) => {
    const group = rows.filter((r) => r.profile?.role === role);
    if (group.length > 0) acc[role] = group;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading SMS notification settings…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            Failed to load SMS settings
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            SMS Notification Settings
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Control which users receive SMS text message notifications for each event type. 
            Phone numbers are managed on each user's profile. Changes take effect immediately.
          </p>
        </div>

        {/* Legend */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-6 gap-y-1">
          <span className="font-medium text-gray-700 dark:text-gray-300">Event eligibility by role:</span>
          <span><strong>Subcontractors:</strong> Chat, Job Assigned, Charges Approved</span>
          <span><strong>Admins / JG Mgmt:</strong> Chat, Work Order Submitted, Job Accepted, Job Assigned, Charges Approved</span>
        </div>
      </div>

      {/* User groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
          No SMS-eligible users found. Users must have a role of Admin, Super Admin, JG Management, or Subcontractor.
        </div>
      ) : (
        ROLE_ORDER.filter((role) => grouped[role]).map((role) => (
          <div key={role} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  ROLE_BADGE_CLASSES[role] ??
                  'bg-gray-100 text-gray-600'
                }`}
              >
                {ROLE_DISPLAY[role] ?? role}
              </span>
              <span className="text-gray-400 dark:text-gray-500 font-normal normal-case tracking-normal text-xs">
                {grouped[role].length} user{grouped[role].length !== 1 ? 's' : ''}
              </span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {grouped[role].map((row) => (
                <UserRow
                  key={row.user_id}
                  row={row}
                  onUpdate={handleUpdate}
                  savingField={savingField}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
