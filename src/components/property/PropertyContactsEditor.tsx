/**
 * Property Contacts Editor
 *
 * Clean, collapsible contact cards for all property contacts.
 * System contacts: Community Manager, Maintenance Supervisor, Primary Contact, AP.
 * Additional contacts: user-defined, full CRUD.
 *
 * UX principles:
 * – Each contact is a compact collapsed row showing name + role badges.
 * – Click / chevron to expand the full edit form inline.
 * – Role assignments use pill-toggle buttons — no cluttered checkbox grids.
 * – Email recipients summary banner at top gives a quick at-a-glance view.
 * – "+ Add Contact" button always visible at the bottom of the list.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Mail,
  Phone,
  User,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { ContactRoles, SystemContactKey } from '../../types/contacts';
import { useUserRole } from '../../contexts/UserRoleContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyContact {
  id: string;
  property_id?: string;
  position: string;
  name: string;
  email: string;
  secondary_email?: string;
  phone: string;
  additional_phones?: string[];
  is_subcontractor_contact?: boolean;
  is_accounts_receivable_contact?: boolean;
  is_approval_recipient?: boolean;
  is_notification_recipient?: boolean;
  is_primary_approval_recipient?: boolean;
  is_primary_notification_recipient?: boolean;
  is_primary_contact?: boolean;
  receives_approval_emails?: boolean;
  receives_notification_emails?: boolean;
  custom_title?: string | null;
  is_new?: boolean;
}

interface SystemContactData {
  name: string;
  email: string;
  secondary_email: string;
  phone: string;
  additional_phones?: string[];
  title?: string;
}

interface PropertyContactsEditorProps {
  systemContacts: {
    community_manager: SystemContactData;
    maintenance_supervisor: SystemContactData;
    primary_contact: SystemContactData;
    ap: SystemContactData;
  };
  systemContactRoles: Record<string, Partial<ContactRoles>>;
  customContacts: PropertyContact[];
  onSystemContactChange: (key: SystemContactKey, field: string, value: any) => void;
  onSystemContactRoleChange: (key: SystemContactKey, role: keyof ContactRoles, value: boolean) => void;
  onCustomContactChange: (id: string, field: keyof PropertyContact, value: any) => void;
  onCustomContactAdd: () => void;
  onCustomContactDelete: (id: string) => void;
}

// ─── Position options ─────────────────────────────────────────────────────────

const POSITION_OPTIONS = [
  'Community Manager',
  'Maintenance Supervisor',
  'Accounts Payable',
  'Accounts Receivable',
  'Property Manager',
  'Regional Manager',
  'Leasing Agent',
  'Administrative Assistant',
  'Other',
] as const;

// ─── Small helpers ────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function PillToggle({
  active,
  color,
  children,
  onClick,
}: {
  active: boolean;
  color: 'blue' | 'purple' | 'green' | 'amber' | 'indigo';
  children: React.ReactNode;
  onClick: () => void;
}) {
  const palette: Record<string, string> = {
    blue: active
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400',
    purple: active
      ? 'bg-purple-600 text-white border-purple-600'
      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-purple-400',
    green: active
      ? 'bg-green-600 text-white border-green-600'
      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-green-400',
    amber: active
      ? 'bg-amber-500 text-white border-amber-500'
      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-amber-400',
    indigo: active
      ? 'bg-indigo-600 text-white border-indigo-600'
      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-indigo-400',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-full border transition-all select-none ${palette[color]}`}
    >
      {children}
    </button>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[color] ?? map.gray}`}>
      {children}
    </span>
  );
}

const inputCls =
  'w-full h-10 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

// ─── Main component ───────────────────────────────────────────────────────────

export function PropertyContactsEditor({
  systemContacts,
  systemContactRoles,
  customContacts,
  onSystemContactChange,
  onSystemContactRoleChange,
  onCustomContactChange,
  onCustomContactAdd,
  onCustomContactDelete,
}: PropertyContactsEditorProps) {
  const { isAdmin } = useUserRole();
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showSecondaryEmail, setShowSecondaryEmail] = useState<Record<string, boolean>>({});

  const toggleCard = (id: string) =>
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSecondary = (id: string) =>
    setShowSecondaryEmail((prev) => ({ ...prev, [id]: !prev[id] }));

  const getSystemContactAssociations = (roles: Partial<ContactRoles>) => {
    const associations: string[] = [];

    if (roles.subcontractor) associations.push('Subcontractor contact');
    if (roles.accountsReceivable) associations.push('AR contact');
    if (roles.approvalRecipient) associations.push('Approval emails');
    if (roles.primaryApproval) associations.push('Primary approval recipient');
    if (roles.notificationRecipient) associations.push('Notification emails');
    if (roles.primaryNotification) associations.push('Primary notification recipient');

    return associations;
  };

  const handleDeleteSystemContact = (
    key: SystemContactKey,
    defaultLabel: string,
    data: SystemContactData,
    roles: Partial<ContactRoles>,
  ) => {
    const label = data.title || defaultLabel;
    const associations = getSystemContactAssociations(roles);
    const hasContent = Boolean(
      data.name ||
      data.email ||
      data.secondary_email ||
      data.phone ||
      (data.additional_phones && data.additional_phones.length > 0),
    );

    if (!hasContent && associations.length === 0) {
      return;
    }

    const warning = associations.length > 0
      ? `Delete ${label}? This contact is currently assigned to ${associations.join(', ')}. This will clear the contact and remove those assignments.`
      : `Delete ${label}? This will clear the contact's name, emails, phone numbers, and role assignments.`;

    if (!window.confirm(warning)) {
      return;
    }

    onSystemContactChange(key, 'name', '');
    onSystemContactChange(key, 'email', '');
    onSystemContactChange(key, 'secondary_email', '');
    onSystemContactChange(key, 'phone', '');
    onSystemContactChange(key, 'additional_phones', []);
    onSystemContactChange(key, 'title', defaultLabel);

    onSystemContactRoleChange(key, 'subcontractor', false);
    onSystemContactRoleChange(key, 'accountsReceivable', false);
    onSystemContactRoleChange(key, 'approvalRecipient', false);
    onSystemContactRoleChange(key, 'primaryApproval', false);
    onSystemContactRoleChange(key, 'notificationRecipient', false);
    onSystemContactRoleChange(key, 'primaryNotification', false);

    setExpandedCards((prev) => ({ ...prev, [key]: false }));
    setShowSecondaryEmail((prev) => ({ ...prev, [key]: false }));
  };

  const renderAdditionalPhones = (
    id: string,
    additionalPhones: string[] | undefined,
    onChange: (phones: string[]) => void
  ) => {
    const phones = additionalPhones || [];

    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onChange([...phones, ''])}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Add another phone
        </button>
        {phones.length > 0 && (
          <div className="space-y-2">
            {phones.map((phone, index) => (
              <div key={`${id}-phone-${index}`} className="flex items-center gap-2">
                <input
                  type="tel"
                  value={phone}
                  placeholder="123-456-7890"
                  className={inputCls}
                  onChange={(e) => {
                    const next = [...phones];
                    next[index] = e.target.value;
                    onChange(next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => onChange(phones.filter((_, currentIndex) => currentIndex !== index))}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Remove phone number"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Email recipient summary lists ───────────────────────────────────────────
  const allApproval = [
    ...Object.entries(systemContactRoles)
      .filter(([, r]) => r.approvalRecipient)
      .map(([key]) => ({
        name: systemContacts[key as SystemContactKey]?.name || key,
        isPrimary: !!systemContactRoles[key]?.primaryApproval,
      })),
    ...customContacts
      .filter((c) => c.is_approval_recipient || c.receives_approval_emails)
      .map((c) => ({ name: c.name || '(unnamed)', isPrimary: !!c.is_primary_approval_recipient })),
  ];

  const allNotification = [
    ...Object.entries(systemContactRoles)
      .filter(([, r]) => r.notificationRecipient)
      .map(([key]) => ({
        name: systemContacts[key as SystemContactKey]?.name || key,
        isPrimary: !!systemContactRoles[key]?.primaryNotification,
      })),
    ...customContacts
      .filter((c) => c.is_notification_recipient || c.receives_notification_emails)
      .map((c) => ({ name: c.name || '(unnamed)', isPrimary: !!c.is_primary_notification_recipient })),
  ];

  // ── System contact card ─────────────────────────────────────────────────────
  const renderSystemCard = (
    key: SystemContactKey,
    defaultLabel: string,
    data: SystemContactData,
    accentCls: string,
    avatarBg: string
  ) => {
    const roles = systemContactRoles[key] || {};
    const label = data.title || defaultLabel;
    const isExpanded = expandedCards[key] ?? false;
    const showSec = showSecondaryEmail[key] || !!data.secondary_email;
    const canDeleteSystemContact = isAdmin && Boolean(
      data.name ||
      data.email ||
      data.secondary_email ||
      data.phone ||
      (data.additional_phones && data.additional_phones.length > 0) ||
      getSystemContactAssociations(roles).length > 0
    );

    const badges = [
      roles.subcontractor && <Badge key="sub" color="blue">Subcontractor</Badge>,
      roles.accountsReceivable && <Badge key="ar" color="purple">AR Contact</Badge>,
      roles.primaryApproval
        ? <Badge key="pa" color="green">Primary Approval</Badge>
        : roles.approvalRecipient && <Badge key="a" color="green">Approval Emails</Badge>,
      roles.primaryNotification
        ? <Badge key="pn" color="amber">Primary Notif.</Badge>
        : roles.notificationRecipient && <Badge key="n" color="amber">Notifications</Badge>,
    ].filter(Boolean);

    return (
      <div key={key} className={`rounded-xl border overflow-hidden ${accentCls}`}>
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => toggleCard(key)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg"
          >
            <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white ${avatarBg}`}>
              {data.name ? initials(data.name) : <User className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {data.name || <span className="italic text-gray-400">No name set</span>}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
              </div>
              {badges.length > 0 && <div className="flex items-center gap-1 mt-1 flex-wrap">{badges}</div>}
            </div>
            <div className="text-gray-400 flex-shrink-0">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          {canDeleteSystemContact && (
            <button
              type="button"
              onClick={() => handleDeleteSystemContact(key, defaultLabel, data, roles)}
              title="Delete system contact"
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="px-4 pb-5 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-4 bg-white dark:bg-[#1E293B]">
            {/* Role pills */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Roles &amp; Email Recipients
              </p>
              <div className="flex flex-wrap gap-2">
                <PillToggle active={!!roles.subcontractor} color="blue"
                  onClick={() => onSystemContactRoleChange(key, 'subcontractor', !roles.subcontractor)}>
                  Subcontractor
                </PillToggle>
                <PillToggle active={!!roles.accountsReceivable} color="purple"
                  onClick={() => onSystemContactRoleChange(key, 'accountsReceivable', !roles.accountsReceivable)}>
                  AR Contact
                </PillToggle>
                <PillToggle active={!!roles.approvalRecipient} color="green"
                  onClick={() => onSystemContactRoleChange(key, 'approvalRecipient', !roles.approvalRecipient)}>
                  Approval Emails
                </PillToggle>
                {roles.approvalRecipient && (
                  <PillToggle active={!!roles.primaryApproval} color="green"
                    onClick={() => onSystemContactRoleChange(key, 'primaryApproval', !roles.primaryApproval)}>
                    ★ Primary Approval
                  </PillToggle>
                )}
                <PillToggle active={!!roles.notificationRecipient} color="amber"
                  onClick={() => onSystemContactRoleChange(key, 'notificationRecipient', !roles.notificationRecipient)}>
                  Notification Emails
                </PillToggle>
                {roles.notificationRecipient && (
                  <PillToggle active={!!roles.primaryNotification} color="amber"
                    onClick={() => onSystemContactRoleChange(key, 'primaryNotification', !roles.primaryNotification)}>
                    ★ Primary Notif.
                  </PillToggle>
                )}
              </div>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Position / Title</label>
                <input type="text" value={data.title || ''} placeholder={defaultLabel} className={inputCls}
                  onChange={(e) => onSystemContactChange(key, 'title', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Name</label>
                <input type="text" value={data.name} placeholder="Full name" className={inputCls}
                  onChange={(e) => onSystemContactChange(key, 'name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Mail className="inline h-3 w-3 mr-1" />Email</label>
                <input type="email" value={data.email} placeholder="email@example.com" className={inputCls}
                  onChange={(e) => onSystemContactChange(key, 'email', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}><Phone className="inline h-3 w-3 mr-1" />Phone</label>
                <input type="tel" value={data.phone} placeholder="123-456-7890" className={inputCls}
                  onChange={(e) => onSystemContactChange(key, 'phone', e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Additional Phone Numbers</label>
              {renderAdditionalPhones(
                key,
                data.additional_phones,
                (phones) => onSystemContactChange(key, 'additional_phones', phones as any),
              )}
            </div>

            {/* Secondary email */}
            <div>
              <button type="button" onClick={() => toggleSecondary(key)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" />
                {showSec ? 'Hide secondary email' : 'Add secondary email'}
              </button>
              {showSec && (
                <div className="mt-2">
                  <label className={labelCls}>Secondary Email</label>
                  <input type="email" value={data.secondary_email} placeholder="secondary@example.com" className={inputCls}
                    onChange={(e) => onSystemContactChange(key, 'secondary_email', e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Additional contact card ─────────────────────────────────────────────────
  const renderCustomCard = (contact: PropertyContact, index: number) => {
    const isExpanded = expandedCards[contact.id] ?? (contact.is_new ?? false);
    const showSec = showSecondaryEmail[contact.id] || !!contact.secondary_email;
    const isOtherPos = contact.position === 'Other';

    const displayTitle = isOtherPos
      ? contact.custom_title || 'Other'
      : contact.position || `Contact ${index + 1}`;

    const nameTrimmed = (contact.name || '').trim().toLowerCase();
    const isDupe = nameTrimmed.length > 0 &&
      customContacts.some((c) => c.id !== contact.id && (c.name || '').trim().toLowerCase() === nameTrimmed);

    const approvalOn = !!(contact.receives_approval_emails ?? contact.is_approval_recipient);
    const notifOn = !!(contact.receives_notification_emails ?? contact.is_notification_recipient);

    const badges = [
      contact.is_primary_contact && <Badge key="pc" color="indigo">Primary</Badge>,
      contact.is_subcontractor_contact && <Badge key="sub" color="blue">Subcontractor</Badge>,
      contact.is_accounts_receivable_contact && <Badge key="ar" color="purple">AR Contact</Badge>,
      contact.is_primary_approval_recipient
        ? <Badge key="pa" color="green">Primary Approval</Badge>
        : approvalOn && <Badge key="a" color="green">Approval Emails</Badge>,
      contact.is_primary_notification_recipient
        ? <Badge key="pn" color="amber">Primary Notif.</Badge>
        : notifOn && <Badge key="n" color="amber">Notifications</Badge>,
    ].filter(Boolean);

    return (
      <div key={contact.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-4 py-3">
          <button type="button" onClick={() => toggleCard(contact.id)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white bg-gray-500 dark:bg-gray-600">
              {contact.name ? initials(contact.name) : <User className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {contact.name || <span className="italic text-gray-400">No name set</span>}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{displayTitle}</span>
              </div>
              {badges.length > 0 && <div className="flex items-center gap-1 mt-1 flex-wrap">{badges}</div>}
            </div>
            <div className="text-gray-400 flex-shrink-0">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              const label = contact.name?.trim() || displayTitle || 'this contact';
              if (window.confirm(`Are you sure you want to delete ${label}? This cannot be undone.`)) {
                onCustomContactDelete(contact.id);
              }
            }}
            title="Remove contact"
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Expanded form */}
        {isExpanded && (
          <div className="px-4 pb-5 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-4 bg-white dark:bg-[#1E293B]">

            {isDupe && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span><strong>{contact.name}</strong> already exists. Consider adding a role to the existing contact instead of duplicating.</span>
              </div>
            )}

            {/* Role pills */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Roles &amp; Email Recipients
              </p>
              <div className="flex flex-wrap gap-2">
                <PillToggle active={!!contact.is_primary_contact} color="indigo"
                  onClick={() => onCustomContactChange(contact.id, 'is_primary_contact', !contact.is_primary_contact)}>
                  Primary Contact
                </PillToggle>
                <PillToggle active={!!contact.is_subcontractor_contact} color="blue"
                  onClick={() => onCustomContactChange(contact.id, 'is_subcontractor_contact', !contact.is_subcontractor_contact)}>
                  Subcontractor
                </PillToggle>
                <PillToggle active={!!contact.is_accounts_receivable_contact} color="purple"
                  onClick={() => onCustomContactChange(contact.id, 'is_accounts_receivable_contact', !contact.is_accounts_receivable_contact)}>
                  AR Contact
                </PillToggle>
                <PillToggle active={approvalOn} color="green"
                  onClick={() => {
                    const next = !approvalOn;
                    onCustomContactChange(contact.id, 'receives_approval_emails', next);
                    onCustomContactChange(contact.id, 'is_approval_recipient', next);
                    if (!next) onCustomContactChange(contact.id, 'is_primary_approval_recipient', false);
                  }}>
                  Approval Emails
                </PillToggle>
                {approvalOn && (
                  <PillToggle active={!!contact.is_primary_approval_recipient} color="green"
                    onClick={() => onCustomContactChange(contact.id, 'is_primary_approval_recipient', !contact.is_primary_approval_recipient)}>
                    ★ Primary Approval
                  </PillToggle>
                )}
                <PillToggle active={notifOn} color="amber"
                  onClick={() => {
                    const next = !notifOn;
                    onCustomContactChange(contact.id, 'receives_notification_emails', next);
                    onCustomContactChange(contact.id, 'is_notification_recipient', next);
                    if (!next) onCustomContactChange(contact.id, 'is_primary_notification_recipient', false);
                  }}>
                  Notification Emails
                </PillToggle>
                {notifOn && (
                  <PillToggle active={!!contact.is_primary_notification_recipient} color="amber"
                    onClick={() => onCustomContactChange(contact.id, 'is_primary_notification_recipient', !contact.is_primary_notification_recipient)}>
                    ★ Primary Notif.
                  </PillToggle>
                )}
              </div>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Role / Position</label>
                <select
                  value={POSITION_OPTIONS.slice(0, -1).includes(contact.position as any) ? contact.position : (contact.position ? 'Other' : '')}
                  onChange={(e) => {
                    onCustomContactChange(contact.id, 'position', e.target.value);
                    if (e.target.value !== 'Other') onCustomContactChange(contact.id, 'custom_title', null);
                  }}
                  className={inputCls}
                >
                  <option value="">— Select a role —</option>
                  {POSITION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {isOtherPos && (
                <div>
                  <label className={labelCls}>Custom Title</label>
                  <input type="text" value={contact.custom_title || ''} placeholder="e.g. Portfolio Director" className={inputCls}
                    onChange={(e) => onCustomContactChange(contact.id, 'custom_title', e.target.value)} />
                </div>
              )}

              <div className={isOtherPos ? '' : ''}>
                <label className={labelCls}>Name</label>
                <input type="text" value={contact.name || ''} placeholder="Full name" className={inputCls}
                  onChange={(e) => onCustomContactChange(contact.id, 'name', e.target.value)} />
              </div>

              <div>
                <label className={labelCls}><Mail className="inline h-3 w-3 mr-1" />Email</label>
                <input type="email" value={contact.email || ''} placeholder="email@example.com" className={inputCls}
                  onChange={(e) => onCustomContactChange(contact.id, 'email', e.target.value)} />
              </div>

              <div>
                <label className={labelCls}><Phone className="inline h-3 w-3 mr-1" />Phone</label>
                <input type="tel" value={contact.phone || ''} placeholder="123-456-7890" className={inputCls}
                  onChange={(e) => onCustomContactChange(contact.id, 'phone', e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Additional Phone Numbers</label>
              {renderAdditionalPhones(
                contact.id,
                contact.additional_phones,
                (phones) => onCustomContactChange(contact.id, 'additional_phones', phones),
              )}
            </div>

            {/* Secondary email */}
            <div>
              <button type="button" onClick={() => toggleSecondary(contact.id)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" />
                {showSec ? 'Hide secondary email' : 'Add secondary email'}
              </button>
              {showSec && (
                <div className="mt-2">
                  <label className={labelCls}>Secondary Email</label>
                  <input type="email" value={contact.secondary_email || ''} placeholder="secondary@example.com" className={inputCls}
                    onChange={(e) => onCustomContactChange(contact.id, 'secondary_email', e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <User className="h-5 w-5" />
          Contact Information
        </h2>
      </div>

      <div className="p-5 space-y-6">

        {/* Email recipients summary banner */}
        {(allApproval.length > 0 || allNotification.length > 0) && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email Recipients Summary
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Approval: </span>
                {allApproval.length === 0
                  ? <span className="italic text-gray-400">None</span>
                  : allApproval.map((r, i) => (
                      <span key={i}>{i > 0 && ', '}{r.isPrimary ? <strong>{r.name}</strong> : r.name}</span>
                    ))}
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Notifications: </span>
                {allNotification.length === 0
                  ? <span className="italic text-gray-400">None</span>
                  : allNotification.map((r, i) => (
                      <span key={i}>{i > 0 && ', '}{r.isPrimary ? <strong>{r.name}</strong> : r.name}</span>
                    ))}
              </div>
            </div>
          </div>
        )}

        {/* System contacts */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            System Contacts
          </p>
          <div className="space-y-2">
            {renderSystemCard('community_manager', 'Community Manager', systemContacts.community_manager,
              'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10', 'bg-blue-600')}
            {renderSystemCard('maintenance_supervisor', 'Maintenance Supervisor', systemContacts.maintenance_supervisor,
              'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10', 'bg-green-600')}
            {renderSystemCard('primary_contact', 'Primary Contact', systemContacts.primary_contact,
              'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10', 'bg-indigo-600')}
            {renderSystemCard('ap', 'Accounts Payable', systemContacts.ap,
              'border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10', 'bg-purple-600')}
          </div>
        </div>

        {/* Additional contacts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
              Additional Contacts
              {customContacts.length > 0 && (
                <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-[10px]">
                  {customContacts.length}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={onCustomContactAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Contact
            </button>
          </div>

          {customContacts.length === 0 ? (
            <div
              onClick={onCustomContactAdd}
              className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Add your first additional contact</p>
              <p className="text-xs text-gray-400 mt-0.5">e.g. Regional Manager, Leasing Agent, etc.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customContacts.map((c, i) => renderCustomCard(c, i))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
