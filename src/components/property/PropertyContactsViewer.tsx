import React from 'react';
import { Users, Mail, Phone, Star, CheckCircle, Bell, Plus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemContact {
  name: string;
  email: string;
  secondary_email?: string | null;
  phone: string;
  title: string;
}

interface CustomContact {
  id: string;
  position: string;
  name: string;
  email: string;
  secondary_email?: string | null;
  phone: string;
  is_subcontractor_contact?: boolean;
  is_accounts_receivable_contact?: boolean;
  is_approval_recipient?: boolean;
  is_notification_recipient?: boolean;
  is_primary_approval_recipient?: boolean;
  is_primary_notification_recipient?: boolean;
  // New display-only fields
  is_primary_contact?: boolean;
  receives_approval_emails?: boolean;
  receives_notification_emails?: boolean;
  custom_title?: string | null;
}

interface ContactRoles {
  subcontractor?: boolean;
  accountsReceivable?: boolean;
  approvalRecipient?: boolean;
  notificationRecipient?: boolean;
  primaryApproval?: boolean;
  primaryNotification?: boolean;
}

interface PropertyContactsViewerProps {
  systemContacts: {
    community_manager: SystemContact;
    maintenance_supervisor: SystemContact;
    primary_contact: SystemContact;
    ap: SystemContact;
  };
  systemContactRoles: Record<string, Partial<ContactRoles>>;
  customContacts: CustomContact[];
  // Optional edit callback so the header Add Contact button can work
  onAddContact?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return 1–2 uppercase initials from a name string */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Pick a stable background color from a small palette based on a string */
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Normalised card shape ────────────────────────────────────────────────────

interface PersonCard {
  key: string;
  name: string;
  email: string;
  phone: string;
  roles: string[];            // display labels e.g. "Community Manager", "Accounts Payable"
  isPrimary: boolean;
  receivesApproval: boolean;
  receivesNotifications: boolean;
}

function buildCards(
  systemContacts: PropertyContactsViewerProps['systemContacts'],
  customContacts: CustomContact[],
): PersonCard[] {
  const map = new Map<string, PersonCard>();

  const addPerson = (
    name: string,
    email: string,
    phone: string,
    role: string,
    isPrimary: boolean,
    receivesApproval: boolean,
    receivesNotifications: boolean,
  ) => {
    if (!name && !email) return;
    // Key: normalise name + email so duplicates collapse
    const key = `${(name || '').toLowerCase().trim()}|${(email || '').toLowerCase().trim()}`;
    if (map.has(key)) {
      const card = map.get(key)!;
      if (role && !card.roles.includes(role)) card.roles.push(role);
      card.isPrimary = card.isPrimary || isPrimary;
      card.receivesApproval = card.receivesApproval || receivesApproval;
      card.receivesNotifications = card.receivesNotifications || receivesNotifications;
    } else {
      map.set(key, {
        key,
        name: name || '',
        email: email || '',
        phone: phone || '',
        roles: role ? [role] : [],
        isPrimary,
        receivesApproval,
        receivesNotifications,
      });
    }
  };

  // System contacts
  const sys = systemContacts;
  addPerson(
    sys.community_manager.name, sys.community_manager.email, sys.community_manager.phone,
    sys.community_manager.title || 'Community Manager', false, false, false,
  );
  addPerson(
    sys.maintenance_supervisor.name, sys.maintenance_supervisor.email, sys.maintenance_supervisor.phone,
    sys.maintenance_supervisor.title || 'Maintenance Supervisor', false, false, false,
  );
  // primary_contact might duplicate CM — that's intentional dedup
  addPerson(
    sys.primary_contact.name, sys.primary_contact.email, sys.primary_contact.phone,
    sys.primary_contact.title || 'Primary Contact', false, false, false,
  );
  addPerson(
    sys.ap.name, sys.ap.email, sys.ap.phone,
    'Accounts Payable', false, false, false,
  );

  // Custom contacts
  customContacts.forEach(c => {
    const displayRole = c.custom_title || c.position || '';
    addPerson(
      c.name, c.email, c.phone,
      displayRole,
      c.is_primary_contact || false,
      c.receives_approval_emails ?? c.is_approval_recipient ?? false,
      c.receives_notification_emails ?? c.is_notification_recipient ?? false,
    );
  });

  return Array.from(map.values());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ active: boolean; label: string; activeClass: string; inactiveClass: string }> = ({
  active, label, activeClass, inactiveClass,
}) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide whitespace-nowrap ${active ? activeClass : inactiveClass}`}>
    {label}
  </span>
);

const ContactCard: React.FC<{ card: PersonCard }> = ({ card }) => {
  const color = avatarColor(card.name || card.email);
  const initials = getInitials(card.name || card.email || '?');
  const roleText = card.roles.filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#2D3B4E] rounded-xl p-4 shadow-sm min-w-0">
      {/* Avatar + Name row */}
      <div className="flex items-center gap-3 mb-2">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm select-none ${color}`}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
            {card.name || <span className="text-gray-400 italic">Unnamed</span>}
          </p>
          {roleText && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">
              {roleText}
            </p>
          )}
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-1 flex-1 mb-3">
        {card.email && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <a
              href={`mailto:${card.email}`}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
            >
              {card.email}
            </a>
          </div>
        )}
        {card.phone && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{card.phone}</span>
          </div>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-100 dark:border-[#2D3B4E]">
        <StatusBadge
          active={card.isPrimary}
          label="Primary"
          activeClass="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          inactiveClass="bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
        />
        <StatusBadge
          active={card.receivesApproval}
          label="Approval Emails"
          activeClass="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
          inactiveClass="bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
        />
        <StatusBadge
          active={card.receivesNotifications}
          label="Notification Emails"
          activeClass="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
          inactiveClass="bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
        />
      </div>
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function PropertyContactsViewer({
  systemContacts,
  systemContactRoles,
  customContacts,
  onAddContact,
}: PropertyContactsViewerProps) {
  const cards = buildCards(systemContacts, customContacts);
  const totalCount = cards.length;

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
      {/* Section header — matches the gradient pattern used across the page */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Users className="h-5 w-5 mr-2 flex-shrink-0" />
          Property Contacts
          <span className="ml-2 bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {totalCount}
          </span>
        </h3>
        {onAddContact && (
          <button
            type="button"
            onClick={onAddContact}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Manage Contacts
          </button>
        )}
      </div>

      {/* Card grid */}
      <div className="p-6">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600">
            <Users className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">No contacts have been added yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {cards.map(card => (
              <ContactCard key={card.key} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
