/**
 * Email Recipients Builder - Drop-in Adapter
 * 
 * Use this to easily integrate the new contact system into existing email sending code
 * without major refactoring. Simply call getEmailRecipients() before sending.
 */

import { supabase } from '../../utils/supabase';

export interface EmailRecipientsResult {
  to: string[];
  cc: string[];
  bcc: string[];
  primaryRecipientName?: string;
}

/**
 * Get email recipients for a property
 * 
 * @param propertyId - The property ID
 * @param mode - 'approval' or 'notification'
 * @param options - Additional options
 * @returns Email recipients with To, CC, BCC lists
 */
export async function getEmailRecipients(
  propertyId: string,
  mode: 'approval' | 'notification',
  options?: {
    additionalBcc?: string[];
    fallbackToManager?: boolean; // If no recipients, fall back to community manager
  }
): Promise<EmailRecipientsResult> {
  try {
    // Fetch property with system contacts
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select(`
        id,
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
      .single();

    if (propError || !property) {
      console.error('Failed to fetch property:', propError);
      return { to: [], cc: [], bcc: options?.additionalBcc || [] };
    }

    // Fetch custom contacts
    const { data: customContacts, error: contactsError } = await supabase
      .from('property_contacts')
      .select('*')
      .eq('property_id', propertyId);

    if (contactsError) {
      console.error('Failed to fetch custom contacts:', contactsError);
    }

    // Build recipient lists
    const contacts = customContacts || [];

    const allRecipients: Array<{
      name: string;
      email: string | null;
      secondaryEmail: string | null;
      isPrimary: boolean;
    }> = [];

    // System contacts - now using individual boolean columns
    const systemContacts = [
      {
        key: 'community_manager',
        name: property.community_manager_name,
        email: property.community_manager_email,
        secondaryEmail: property.community_manager_secondary_email,
        isApprovalRecipient: property.community_manager_is_approval_recipient,
        isPrimaryApproval: property.community_manager_is_primary_approval,
        isNotificationRecipient: property.community_manager_is_notification_recipient,
        isPrimaryNotification: property.community_manager_is_primary_notification,
      },
      {
        key: 'maintenance_supervisor',
        name: property.maintenance_supervisor_name,
        email: property.maintenance_supervisor_email,
        secondaryEmail: property.maintenance_supervisor_secondary_email,
        isApprovalRecipient: property.maintenance_supervisor_is_approval_recipient,
        isPrimaryApproval: property.maintenance_supervisor_is_primary_approval,
        isNotificationRecipient: property.maintenance_supervisor_is_notification_recipient,
        isPrimaryNotification: property.maintenance_supervisor_is_primary_notification,
      },
      {
        key: 'primary_contact',
        name: property.primary_contact_name,
        email: property.primary_contact_email,
        secondaryEmail: property.primary_contact_secondary_email,
        isApprovalRecipient: property.primary_contact_is_approval_recipient,
        isPrimaryApproval: property.primary_contact_is_primary_approval,
        isNotificationRecipient: property.primary_contact_is_notification_recipient,
        isPrimaryNotification: property.primary_contact_is_primary_notification,
      },
      {
        key: 'ap',
        name: property.ap_name,
        email: property.ap_email,
        secondaryEmail: property.ap_secondary_email,
        isApprovalRecipient: property.ap_is_approval_recipient,
        isPrimaryApproval: property.ap_is_primary_approval,
        isNotificationRecipient: property.ap_is_notification_recipient,
        isPrimaryNotification: property.ap_is_primary_notification,
      },
    ];

    for (const sysContact of systemContacts) {
      const isRecipient = mode === 'approval' ? sysContact.isApprovalRecipient : sysContact.isNotificationRecipient;
      const isPrimary = mode === 'approval' ? sysContact.isPrimaryApproval : sysContact.isPrimaryNotification;

      if (isRecipient && sysContact.email) {
        allRecipients.push({
          name: sysContact.name || sysContact.key,
          email: sysContact.email,
          secondaryEmail: sysContact.secondaryEmail || null,
          isPrimary: isPrimary || false,
        });
      }
    }

    // Custom contacts
    for (const contact of contacts) {
      const isRecipient = mode === 'approval' ? contact.is_approval_recipient : contact.is_notification_recipient;
      const isPrimary = mode === 'approval' ? contact.is_primary_approval_recipient : contact.is_primary_notification_recipient;

      if (isRecipient && contact.email) {
        allRecipients.push({
          name: contact.name || contact.position || 'Contact',
          email: contact.email,
          secondaryEmail: contact.secondary_email || null,
          isPrimary: isPrimary || false,
        });
      }
    }

    // If no recipients configured, apply fallback
    if (allRecipients.length === 0 && options?.fallbackToManager && property.community_manager_email) {
      allRecipients.push({
        name: property.community_manager_name || 'Community Manager',
        email: property.community_manager_email,
        secondaryEmail: property.community_manager_secondary_email || null,
        isPrimary: true,
      });
    }

    // Find primary, or use first recipient if none marked primary
    let primary = allRecipients.find(r => r.isPrimary);
    if (!primary && allRecipients.length > 0) {
      // Fallback: use community manager if present, otherwise first
      primary = allRecipients.find(r => 
        r.email === property.community_manager_email
      ) || allRecipients[0];
    }

    // Separate primary and others
    const others = allRecipients.filter(r => r !== primary);

    // Build email lists with deduplication
    const normalizeEmail = (email: string | null | undefined): string | null => {
      if (!email) return null;
      return email.toLowerCase().trim();
    };

    const emailSet = new Set<string>();
    const toList: string[] = [];
    const ccList: string[] = [];

    // Add primary emails to "to"
    if (primary) {
      const primaryEmail = normalizeEmail(primary.email);
      const primarySecondary = normalizeEmail(primary.secondaryEmail);
      
      if (primaryEmail && !emailSet.has(primaryEmail)) {
        toList.push(primaryEmail);
        emailSet.add(primaryEmail);
      }
      if (primarySecondary && !emailSet.has(primarySecondary)) {
        toList.push(primarySecondary);
        emailSet.add(primarySecondary);
      }
    }

    // Add other recipients to "cc"
    for (const recipient of others) {
      const email = normalizeEmail(recipient.email);
      const secondaryEmail = normalizeEmail(recipient.secondaryEmail);

      if (email && !emailSet.has(email)) {
        ccList.push(email);
        emailSet.add(email);
      }
      if (secondaryEmail && !emailSet.has(secondaryEmail)) {
        ccList.push(secondaryEmail);
        emailSet.add(secondaryEmail);
      }
    }

    // Build BCC list
    const bccList: string[] = [];
    if (options?.additionalBcc) {
      for (const bccEmail of options.additionalBcc) {
        const normalized = normalizeEmail(bccEmail);
        if (normalized && !emailSet.has(normalized)) {
          bccList.push(normalized);
          emailSet.add(normalized);
        }
      }
    }

    return {
      to: toList,
      cc: ccList,
      bcc: bccList,
      primaryRecipientName: primary?.name,
    };

  } catch (error) {
    console.error('Error building email recipients:', error);
    return { to: [], cc: [], bcc: options?.additionalBcc || [] };
  }
}

/**
 * Legacy adapter: Get single recipient email (for backward compatibility)
 * Returns the primary recipient's email address
 */
export async function getPrimaryRecipientEmail(
  propertyId: string,
  mode: 'approval' | 'notification'
): Promise<string | null> {
  const recipients = await getEmailRecipients(propertyId, mode, { fallbackToManager: true });
  return recipients.to[0] || null;
}

/**
 * Example usage in existing email sending code:
 * 
 * ```typescript
 * import { getEmailRecipients } from '../lib/contacts/emailRecipientsAdapter';
 * 
 * // In your email sending function:
 * const recipients = await getEmailRecipients(
 *   job.property_id,
 *   'approval', // or 'notification'
 *   { 
 *     additionalBcc: emailConfig?.default_bcc_emails,
 *     fallbackToManager: true 
 *   }
 * );
 * 
 * if (recipients.to.length === 0) {
 *   toast.error('No email recipients configured for this property');
 *   return;
 * }
 * 
 * const { error } = await supabase.functions.invoke('send-email', {
 *   body: {
 *     to: recipients.to,
 *     cc: recipients.cc,
 *     bcc: recipients.bcc,
 *     subject: emailSubject,
 *     html: emailHtml,
 *     from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
 *   },
 * });
 * ```
 */
