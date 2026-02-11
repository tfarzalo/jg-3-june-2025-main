/**
 * Type definitions for property contact management
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

export interface PropertyContactFormData {
  id: string;
  property_id?: string;
  position: string;
  name: string;
  email: string;
  secondary_email?: string;
  phone: string;
  is_subcontractor_contact?: boolean;
  is_accounts_receivable_contact?: boolean;
  is_approval_recipient?: boolean;
  is_notification_recipient?: boolean;
  is_primary_approval_recipient?: boolean;
  is_primary_notification_recipient?: boolean;
  is_new?: boolean;
}

export interface SystemContactFormData {
  name: string;
  email: string;
  secondary_email: string;
  phone: string;
  title?: string;
  roles: ContactRoles;
}

export interface PropertyContactRoleConfig {
  [key: string]: Partial<ContactRoles>;
}
