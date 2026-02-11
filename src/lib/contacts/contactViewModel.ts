/**
 * Contact View Model & Email Recipients Builder
 * 
 * Provides a unified interface for property contacts by merging:
 * - System contacts from properties table (community_manager, maintenance_supervisor, primary_contact, ap)
 * - Custom contacts from property_contacts table
 * 
 * Also provides utilities for building email recipient lists for approvals and notifications.
 */

export type SystemContactKey = 'community_manager' | 'maintenance_supervisor' | 'primary_contact' | 'ap';

export interface ContactRoles {
  subcontractor: boolean;
  accountsReceivable: boolean;
  approvalRecipient: boolean;
  notificationRecipient: boolean;
  primaryApproval: boolean;
  primaryNotification: boolean;
}

export interface ContactViewModel {
  source: 'system' | 'custom';
  systemKey?: SystemContactKey;
  id?: string; // UUID for custom contacts
  label: string; // Display label (e.g., "Community Manager", "Property Contact 3")
  name: string;
  email: string | null;
  secondaryEmail: string | null;
  phone: string | null;
  position?: string; // Job position/title
  roles: ContactRoles;
}

export interface PropertyContact {
  id: string;
  property_id: string;
  position?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  secondary_email?: string | null;
  is_subcontractor_contact?: boolean;
  is_accounts_receivable_contact?: boolean;
  is_approval_recipient?: boolean;
  is_notification_recipient?: boolean;
  is_primary_approval_recipient?: boolean;
  is_primary_notification_recipient?: boolean;
}

export interface PropertyWithContacts {
  id: string;
  // System contact fields
  community_manager_name?: string | null;
  community_manager_email?: string | null;
  community_manager_phone?: string | null;
  community_manager_secondary_email?: string | null;
  community_manager_title?: string | null;
  maintenance_supervisor_name?: string | null;
  maintenance_supervisor_email?: string | null;
  maintenance_supervisor_phone?: string | null;
  maintenance_supervisor_secondary_email?: string | null;
  maintenance_supervisor_title?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  primary_contact_secondary_email?: string | null;
  primary_contact_role?: string | null;
  ap_name?: string | null;
  ap_email?: string | null;
  ap_phone?: string | null;
  ap_secondary_email?: string | null;
  // Role config for system contacts
  contact_role_config?: Record<string, Partial<ContactRoles>> | null;
}

export interface EmailRecipients {
  to: string[];   // Primary recipient(s) - main + secondary email
  cc: string[];   // Other selected recipients - their main + secondary emails
  bcc: string[];  // From config or passed through
}

/**
 * Normalize and deduplicate email addresses
 */
function normalizeEmails(emails: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const email of emails) {
    if (!email) continue;
    const normalized = email.toLowerCase().trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  
  return result;
}

/**
 * Build a unified contact view model from property data and custom contacts
 */
export function buildContactViewModels(
  property: PropertyWithContacts,
  customContacts: PropertyContact[]
): ContactViewModel[] {
  const contacts: ContactViewModel[] = [];
  const roleConfig = property.contact_role_config || {};

  // Helper to get roles for system contacts from config
  const getSystemRoles = (key: SystemContactKey): ContactRoles => {
    const config = roleConfig[key] || {};
    return {
      subcontractor: config.subcontractor || false,
      accountsReceivable: config.accountsReceivable || false,
      approvalRecipient: config.approvalRecipient || false,
      notificationRecipient: config.notificationRecipient || false,
      primaryApproval: config.primaryApproval || false,
      primaryNotification: config.primaryNotification || false,
    };
  };

  // System Contact 1: Primary Contact
  if (property.primary_contact_name || property.primary_contact_email || property.primary_contact_phone) {
    contacts.push({
      source: 'system',
      systemKey: 'primary_contact',
      label: 'Primary Contact',
      name: property.primary_contact_name || '',
      email: property.primary_contact_email || null,
      secondaryEmail: property.primary_contact_secondary_email || null,
      phone: property.primary_contact_phone || null,
      position: property.primary_contact_role || undefined,
      roles: getSystemRoles('primary_contact'),
    });
  }

  // System Contact 2: Community Manager
  if (property.community_manager_name || property.community_manager_email || property.community_manager_phone) {
    contacts.push({
      source: 'system',
      systemKey: 'community_manager',
      label: property.community_manager_title || 'Community Manager',
      name: property.community_manager_name || '',
      email: property.community_manager_email || null,
      secondaryEmail: property.community_manager_secondary_email || null,
      phone: property.community_manager_phone || null,
      position: property.community_manager_title || undefined,
      roles: getSystemRoles('community_manager'),
    });
  }

  // System Contact 3: Maintenance Supervisor
  if (property.maintenance_supervisor_name || property.maintenance_supervisor_email || property.maintenance_supervisor_phone) {
    contacts.push({
      source: 'system',
      systemKey: 'maintenance_supervisor',
      label: property.maintenance_supervisor_title || 'Maintenance Supervisor',
      name: property.maintenance_supervisor_name || '',
      email: property.maintenance_supervisor_email || null,
      secondaryEmail: property.maintenance_supervisor_secondary_email || null,
      phone: property.maintenance_supervisor_phone || null,
      position: property.maintenance_supervisor_title || undefined,
      roles: getSystemRoles('maintenance_supervisor'),
    });
  }

  // System Contact 4: Accounts Payable
  if (property.ap_name || property.ap_email || property.ap_phone) {
    contacts.push({
      source: 'system',
      systemKey: 'ap',
      label: 'Accounts Payable',
      name: property.ap_name || '',
      email: property.ap_email || null,
      secondaryEmail: property.ap_secondary_email || null,
      phone: property.ap_phone || null,
      position: 'Accounts Payable',
      roles: getSystemRoles('ap'),
    });
  }

  // Custom contacts
  customContacts.forEach((contact, index) => {
    contacts.push({
      source: 'custom',
      id: contact.id,
      label: contact.position || `Additional Contact ${index + 1}`,
      name: contact.name || '',
      email: contact.email || null,
      secondaryEmail: contact.secondary_email || null,
      phone: contact.phone || null,
      position: contact.position || undefined,
      roles: {
        subcontractor: contact.is_subcontractor_contact || false,
        accountsReceivable: contact.is_accounts_receivable_contact || false,
        approvalRecipient: contact.is_approval_recipient || false,
        notificationRecipient: contact.is_notification_recipient || false,
        primaryApproval: contact.is_primary_approval_recipient || false,
        primaryNotification: contact.is_primary_notification_recipient || false,
      },
    });
  });

  return contacts;
}

/**
 * Build email recipient lists for outbound emails
 */
export function buildEmailRecipients(
  property: PropertyWithContacts,
  customContacts: PropertyContact[],
  mode: 'approval' | 'notification',
  options?: {
    defaultBcc?: string[];
  }
): EmailRecipients {
  const contacts = buildContactViewModels(property, customContacts);
  
  // Filter to relevant recipients based on mode
  const relevantContacts = contacts.filter(c => 
    mode === 'approval' ? c.roles.approvalRecipient : c.roles.notificationRecipient
  );

  // Find primary recipient
  let primaryContact = relevantContacts.find(c =>
    mode === 'approval' ? c.roles.primaryApproval : c.roles.primaryNotification
  );

  // Fallback logic if no primary is explicitly set
  if (!primaryContact && relevantContacts.length > 0) {
    // Fallback hierarchy:
    // 1. Community Manager (if selected as recipient)
    // 2. Maintenance Supervisor (if selected)
    // 3. Primary Contact (if selected)
    // 4. First recipient in list
    primaryContact = 
      relevantContacts.find(c => c.systemKey === 'community_manager') ||
      relevantContacts.find(c => c.systemKey === 'maintenance_supervisor') ||
      relevantContacts.find(c => c.systemKey === 'primary_contact') ||
      relevantContacts[0];
  }

  // Build "to" list from primary contact
  const toEmails: string[] = [];
  if (primaryContact) {
    toEmails.push(primaryContact.email, primaryContact.secondaryEmail);
  }

  // Build "cc" list from other selected recipients
  const ccEmails: string[] = [];
  relevantContacts.forEach(contact => {
    if (contact === primaryContact) return; // Skip primary
    ccEmails.push(contact.email, contact.secondaryEmail);
  });

  return {
    to: normalizeEmails(toEmails),
    cc: normalizeEmails(ccEmails),
    bcc: normalizeEmails(options?.defaultBcc || []),
  };
}

/**
 * Get a contact by system key or custom ID
 */
export function getContactById(
  contacts: ContactViewModel[],
  idOrKey: string
): ContactViewModel | undefined {
  return contacts.find(c => 
    (c.source === 'system' && c.systemKey === idOrKey) ||
    (c.source === 'custom' && c.id === idOrKey)
  );
}

/**
 * Get the subcontractor contact for a property
 */
export function getSubcontractorContact(
  property: PropertyWithContacts,
  customContacts: PropertyContact[]
): ContactViewModel | null {
  const contacts = buildContactViewModels(property, customContacts);
  return contacts.find(c => c.roles.subcontractor) || null;
}

/**
 * Get the AR contact for a property
 */
export function getAccountsReceivableContact(
  property: PropertyWithContacts,
  customContacts: PropertyContact[]
): ContactViewModel | null {
  const contacts = buildContactViewModels(property, customContacts);
  return contacts.find(c => c.roles.accountsReceivable) || null;
}
