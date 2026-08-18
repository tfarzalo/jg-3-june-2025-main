import { supabase } from '../utils/supabase';

export const CONTACT_TEMPLATE_VARIABLES = [
  { variable: '{{recipient_first_name}}', description: 'Email recipient first name' },
  { variable: '{{recipient_last_name}}', description: 'Email recipient last name' },
  { variable: '{{recipient_full_name}}', description: 'Email recipient full name' },
  { variable: '{{recipient_name}}', description: 'Email recipient full name (legacy)' },
  { variable: '{{primary_contact_name}}', description: 'Primary contact name' },
  { variable: '{{primary_contact_email}}', description: 'Primary contact email' },
  { variable: '{{primary_approval_contact_name}}', description: 'Primary approval contact name' },
  { variable: '{{primary_approval_contact_first_name}}', description: 'Primary approval contact first name' },
  { variable: '{{primary_approval_contact_last_name}}', description: 'Primary approval contact last name' },
  { variable: '{{primary_approval_contact_full_name}}', description: 'Primary approval contact full name' },
  { variable: '{{primary_approval_contact_email}}', description: 'Primary approval contact email' },
  { variable: '{{community_manager_name}}', description: 'Community manager name' },
  { variable: '{{community_manager_email}}', description: 'Community manager email' },
  { variable: '{{maintenance_supervisor_name}}', description: 'Maintenance supervisor name' },
  { variable: '{{maintenance_supervisor_email}}', description: 'Maintenance supervisor email' },
  { variable: '{{ap_contact_name}}', description: 'AP contact name' },
  { variable: '{{ap_contact_email}}', description: 'AP contact email' },
  { variable: '{{additional_contact_names}}', description: 'All additional property contact names' },
  { variable: '{{other_contact_names}}', description: 'All additional property contact names' },
];

export type ContactTemplateTokens = Record<string, string>;

const joinNames = (names: Array<string | null | undefined>) =>
  names.map((name) => name?.trim()).filter(Boolean).join(', ');

export function splitFullName(fullName?: string | null) {
  const normalized = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { firstName: '', lastName: '', fullName: '' };
  }

  const parts = normalized.split(' ');
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    fullName: normalized,
  };
}

export function assignRecipientNameTokens(
  replacements: ContactTemplateTokens,
  fullName?: string | null,
  prefix = 'recipient'
) {
  const { firstName, lastName, fullName: normalizedFullName } = splitFullName(fullName);
  replacements[`${prefix}_first_name`] = firstName;
  replacements[`${prefix}.first_name`] = firstName;
  replacements[`${prefix}_last_name`] = lastName;
  replacements[`${prefix}.last_name`] = lastName;
  replacements[`${prefix}_full_name`] = normalizedFullName;
  replacements[`${prefix}.full_name`] = normalizedFullName;

  if (prefix === 'recipient') {
    replacements.recipient_name = normalizedFullName;
    replacements['recipient.name'] = normalizedFullName;
  }
}

type ContactTokenPerson = {
  key?: string;
  name: string;
  email: string;
  secondaryEmail?: string;
  primaryContact?: boolean;
  approvalRecipient?: boolean;
  primaryApproval?: boolean;
  notificationRecipient?: boolean;
  primaryNotification?: boolean;
};

const person = (
  key: string,
  name?: string | null,
  email?: string | null,
  secondaryEmail?: string | null,
  flags: Partial<ContactTokenPerson> = {}
): ContactTokenPerson | null => {
  const normalizedName = name?.trim() || '';
  const normalizedEmail = email?.trim() || '';
  if (!normalizedName && !normalizedEmail) return null;
  return {
    key,
    name: normalizedName,
    email: normalizedEmail,
    secondaryEmail: secondaryEmail?.trim() || '',
    ...flags,
  };
};

const buildContactPeople = (property: any, customContacts: any[] = []): ContactTokenPerson[] => {
  const systemPeople = [
    person('primary_contact', property?.primary_contact_name, property?.primary_contact_email, property?.primary_contact_secondary_email, {
      primaryContact: true,
      approvalRecipient: property?.primary_contact_is_approval_recipient,
      primaryApproval: property?.primary_contact_is_primary_approval,
      notificationRecipient: property?.primary_contact_is_notification_recipient,
      primaryNotification: property?.primary_contact_is_primary_notification,
    }),
    person('community_manager', property?.community_manager_name, property?.community_manager_email, property?.community_manager_secondary_email, {
      approvalRecipient: property?.community_manager_is_approval_recipient,
      primaryApproval: property?.community_manager_is_primary_approval,
      notificationRecipient: property?.community_manager_is_notification_recipient,
      primaryNotification: property?.community_manager_is_primary_notification,
    }),
    person('maintenance_supervisor', property?.maintenance_supervisor_name, property?.maintenance_supervisor_email, property?.maintenance_supervisor_secondary_email, {
      approvalRecipient: property?.maintenance_supervisor_is_approval_recipient,
      primaryApproval: property?.maintenance_supervisor_is_primary_approval,
      notificationRecipient: property?.maintenance_supervisor_is_notification_recipient,
      primaryNotification: property?.maintenance_supervisor_is_primary_notification,
    }),
    person('ap', property?.ap_name, property?.ap_email, property?.ap_secondary_email, {
      approvalRecipient: property?.ap_is_approval_recipient,
      primaryApproval: property?.ap_is_primary_approval,
      notificationRecipient: property?.ap_is_notification_recipient,
      primaryNotification: property?.ap_is_primary_notification,
    }),
  ].filter(Boolean) as ContactTokenPerson[];

  const customPeople = (customContacts || [])
    .map((contact) => person(`custom:${contact.id}`, contact.name || contact.position, contact.email, contact.secondary_email, {
      primaryContact: contact.is_primary_contact,
      approvalRecipient: contact.is_approval_recipient || contact.receives_approval_emails,
      primaryApproval: contact.is_primary_approval_recipient,
      notificationRecipient: contact.is_notification_recipient || contact.receives_notification_emails,
      primaryNotification: contact.is_primary_notification_recipient,
    }))
    .filter(Boolean) as ContactTokenPerson[];

  return [...customPeople, ...systemPeople];
};

const resolvePrimaryContact = (people: ContactTokenPerson[], property: any) =>
  people.find((contact) => contact.primaryContact) ||
  person('primary_contact', property?.primary_contact_name, property?.primary_contact_email, property?.primary_contact_secondary_email);

const resolvePrimaryApprovalContact = (people: ContactTokenPerson[], primaryContact?: ContactTokenPerson | null) =>
  people.find((contact) => contact.primaryApproval) ||
  people.find((contact) => contact.approvalRecipient && contact.key === primaryContact?.key) ||
  people.find((contact) => contact.approvalRecipient && contact.key === 'community_manager') ||
  people.find((contact) => contact.approvalRecipient) ||
  primaryContact ||
  null;

export async function fetchContactTemplateTokens(propertyId?: string | null): Promise<ContactTemplateTokens> {
  if (!propertyId) return {};

  const replacements: ContactTemplateTokens = {};

  const [{ data: property }, { data: customContacts }] = await Promise.all([
    supabase
      .from('properties')
      .select(`
        community_manager_name,
        community_manager_email,
        community_manager_secondary_email,
        community_manager_is_approval_recipient,
        community_manager_is_primary_approval,
        community_manager_is_notification_recipient,
        community_manager_is_primary_notification,
        maintenance_supervisor_name,
        maintenance_supervisor_email,
        maintenance_supervisor_secondary_email,
        maintenance_supervisor_is_approval_recipient,
        maintenance_supervisor_is_primary_approval,
        maintenance_supervisor_is_notification_recipient,
        maintenance_supervisor_is_primary_notification,
        primary_contact_name,
        primary_contact_email,
        primary_contact_secondary_email,
        primary_contact_is_approval_recipient,
        primary_contact_is_primary_approval,
        primary_contact_is_notification_recipient,
        primary_contact_is_primary_notification,
        ap_name,
        ap_email,
        ap_secondary_email,
        ap_is_approval_recipient,
        ap_is_primary_approval,
        ap_is_notification_recipient,
        ap_is_primary_notification
      `)
      .eq('id', propertyId)
      .maybeSingle(),
    supabase
      .from('property_contacts')
      .select(`
        id,
        name,
        position,
        email,
        secondary_email,
        is_primary_contact,
        is_approval_recipient,
        receives_approval_emails,
        is_primary_approval_recipient,
        is_notification_recipient,
        receives_notification_emails,
        is_primary_notification_recipient
      `)
      .eq('property_id', propertyId)
      .order('position', { ascending: true }),
  ]);

  const people = buildContactPeople(property, customContacts || []);
  const primaryContact = resolvePrimaryContact(people, property);
  const primaryApprovalContact = resolvePrimaryApprovalContact(people, primaryContact);

  const primaryContactName = primaryContact?.name || '';
  const primaryContactEmail = primaryContact?.email || '';
  const primaryApprovalName = primaryApprovalContact?.name || '';
  const primaryApprovalEmail = primaryApprovalContact?.email || '';
  const communityManagerName = property?.community_manager_name || '';
  const communityManagerEmail = property?.community_manager_email || '';
  const maintenanceSupervisorName = property?.maintenance_supervisor_name || '';
  const maintenanceSupervisorEmail = property?.maintenance_supervisor_email || '';
  const apContactName = property?.ap_name || '';
  const apContactEmail = property?.ap_email || '';
  const additionalContactNames = joinNames((customContacts || []).map((contact) => contact.name));

  replacements.primary_contact_name = primaryContactName;
  replacements['primary_contact.name'] = primaryContactName;
  replacements.primary_contact_email = primaryContactEmail;
  replacements['primary_contact.email'] = primaryContactEmail;
  replacements.primary_approval_contact_name = primaryApprovalName;
  replacements['primary_approval_contact.name'] = primaryApprovalName;
  assignRecipientNameTokens(replacements, primaryApprovalName, 'primary_approval_contact');
  replacements.primary_approval_contact_name = primaryApprovalName;
  replacements['primary_approval_contact.name'] = primaryApprovalName;
  replacements.primary_approval_contact_email = primaryApprovalEmail;
  replacements['primary_approval_contact.email'] = primaryApprovalEmail;
  replacements.approval_contact_name = primaryApprovalName;
  replacements['approval_contact.name'] = primaryApprovalName;
  replacements.approval_contact_email = primaryApprovalEmail;
  replacements['approval_contact.email'] = primaryApprovalEmail;
  replacements.recipient_name = primaryApprovalName;
  assignRecipientNameTokens(replacements, primaryApprovalName);
  replacements.recipient_email = primaryApprovalEmail;
  replacements.contact_name = primaryApprovalName;
  replacements.contact_email = primaryApprovalEmail;
  replacements.community_manager_name = communityManagerName;
  replacements['community_manager.name'] = communityManagerName;
  replacements.community_manager_email = communityManagerEmail;
  replacements['community_manager.email'] = communityManagerEmail;
  replacements.maintenance_supervisor_name = maintenanceSupervisorName;
  replacements['maintenance_supervisor.name'] = maintenanceSupervisorName;
  replacements.maintenance_supervisor_email = maintenanceSupervisorEmail;
  replacements['maintenance_supervisor.email'] = maintenanceSupervisorEmail;
  replacements.ap_contact_name = apContactName;
  replacements['ap_contact.name'] = apContactName;
  replacements.ap_contact_email = apContactEmail;
  replacements['ap_contact.email'] = apContactEmail;
  replacements.additional_contact_names = additionalContactNames;
  replacements.other_contact_names = additionalContactNames;

  return replacements;
}

export function replaceTemplateTokens(template: string, replacements: ContactTemplateTokens): string {
  let processed = template;
  Object.entries(replacements).forEach(([token, value]) => {
    processed = replaceTemplateTokenValue(processed, token, value);
  });
  return processed;
}

export function replaceTemplateTokenValue(template: string, token: string, value: string): string {
  const escapedToken = escapeRegExp(token);
  const wrappedToken = new RegExp(
    `\\{+\\s*(?:\\{+\\s*)?${escapedToken}\\s*(?:\\}+\\s*)?\\}+`,
    'gi'
  );
  return template.replace(wrappedToken, value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
