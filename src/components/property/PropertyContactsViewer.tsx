import React from 'react';
import { User, Mail, Phone, Shield, DollarSign, CheckCircle, Bell } from 'lucide-react';

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
}

const RoleBadge: React.FC<{ role: string; isPrimary?: boolean }> = ({ role, isPrimary }) => {
  const badges = {
    subcontractor: { icon: Shield, label: 'Subcontractor', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    accountsReceivable: { icon: DollarSign, label: 'Accounts Receivable', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    approvalRecipient: { icon: CheckCircle, label: 'Approval Recipient', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    notificationRecipient: { icon: Bell, label: 'Notification Recipient', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    primaryApproval: { icon: CheckCircle, label: 'Primary Approval', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-2 border-purple-500' },
    primaryNotification: { icon: Bell, label: 'Primary Notification', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-2 border-orange-500' },
  };

  const badge = badges[role as keyof typeof badges];
  if (!badge) return null;

  const Icon = badge.icon;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
      <Icon className="h-3 w-3 mr-1" />
      {badge.label}
      {isPrimary && ' (Primary)'}
    </span>
  );
};

const ContactCard: React.FC<{
  name: string;
  email: string;
  secondaryEmail?: string | null;
  phone: string;
  title: string;
  roles: Partial<ContactRoles>;
  colorScheme: string;
}> = ({ name, email, secondaryEmail, phone, title, roles, colorScheme }) => {
  const hasAnyInfo = name || email || phone;
  if (!hasAnyInfo) return null;

  const activeRoles = Object.entries(roles).filter(([_, value]) => value);

  return (
    <div className={`p-4 rounded-lg ${colorScheme}`}>
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-bold uppercase tracking-wide">
          {title}
        </h4>
      </div>

      {activeRoles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {activeRoles.map(([role]) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {name && (
          <div className="flex items-center">
            <User className="h-4 w-4 mr-2 flex-shrink-0 opacity-70" />
            <span className="text-gray-900 dark:text-white text-sm">{name}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center">
            <Mail className="h-4 w-4 mr-2 flex-shrink-0 opacity-70" />
            <span className="text-gray-900 dark:text-white text-sm">{email}</span>
          </div>
        )}
        {secondaryEmail && (
          <div className="flex items-center">
            <Mail className="h-4 w-4 mr-2 flex-shrink-0 opacity-50" />
            <div className="flex items-center">
              <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-2">Secondary:</span>
              <span className="text-gray-900 dark:text-white text-sm">{secondaryEmail}</span>
            </div>
          </div>
        )}
        {phone && (
          <div className="flex items-center">
            <Phone className="h-4 w-4 mr-2 flex-shrink-0 opacity-70" />
            <span className="text-gray-900 dark:text-white text-sm">{phone}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function PropertyContactsViewer({
  systemContacts,
  systemContactRoles,
  customContacts,
}: PropertyContactsViewerProps) {
  const colorSchemes = [
    'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
    'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200',
    'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200',
    'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200',
  ];

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <User className="h-5 w-5 mr-2" />
          Contact Information
        </h3>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* System Contacts */}
        <div className="space-y-4">
          <ContactCard
            name={systemContacts.community_manager.name}
            email={systemContacts.community_manager.email}
            secondaryEmail={systemContacts.community_manager.secondary_email}
            phone={systemContacts.community_manager.phone}
            title={systemContacts.community_manager.title || 'Community Manager'}
            roles={systemContactRoles.community_manager || {}}
            colorScheme={colorSchemes[0]}
          />

          <ContactCard
            name={systemContacts.maintenance_supervisor.name}
            email={systemContacts.maintenance_supervisor.email}
            secondaryEmail={systemContacts.maintenance_supervisor.secondary_email}
            phone={systemContacts.maintenance_supervisor.phone}
            title={systemContacts.maintenance_supervisor.title || 'Maintenance Supervisor'}
            roles={systemContactRoles.maintenance_supervisor || {}}
            colorScheme={colorSchemes[1]}
          />

          <ContactCard
            name={systemContacts.primary_contact.name}
            email={systemContacts.primary_contact.email}
            secondaryEmail={systemContacts.primary_contact.secondary_email}
            phone={systemContacts.primary_contact.phone}
            title={systemContacts.primary_contact.title || 'Primary Contact'}
            roles={systemContactRoles.primary_contact || {}}
            colorScheme={colorSchemes[2]}
          />

          <ContactCard
            name={systemContacts.ap.name}
            email={systemContacts.ap.email}
            secondaryEmail={systemContacts.ap.secondary_email}
            phone={systemContacts.ap.phone}
            title="Accounts Payable"
            roles={systemContactRoles.ap || {}}
            colorScheme={colorSchemes[3]}
          />
        </div>

        {/* Custom Contacts */}
        {customContacts.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Additional Contacts
            </h4>
            {customContacts.map((contact, index) => {
              // Map contact role fields to ContactRoles format
              const roles: Partial<ContactRoles> = {
                subcontractor: contact.is_subcontractor_contact || false,
                accountsReceivable: contact.is_accounts_receivable_contact || false,
                approvalRecipient: contact.is_approval_recipient || false,
                notificationRecipient: contact.is_notification_recipient || false,
                primaryApproval: contact.is_primary_approval_recipient || false,
                primaryNotification: contact.is_primary_notification_recipient || false,
              };
              
              return (
                <div
                  key={contact.id}
                  className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wide">
                    {contact.position || `Contact ${index + 1}`}
                  </h5>
                  
                  {/* Role badges for custom contacts */}
                  {Object.entries(roles).some(([_, value]) => value) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {Object.entries(roles).filter(([_, value]) => value).map(([role]) => (
                        <RoleBadge key={role} role={role} />
                      ))}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {contact.name && (
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{contact.name}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{contact.email}</span>
                      </div>
                    )}
                    {contact.secondary_email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-gray-500 dark:text-gray-500 mr-2 flex-shrink-0" />
                        <div className="flex items-center">
                          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-2">Secondary:</span>
                          <span className="text-gray-900 dark:text-white text-sm">{contact.secondary_email}</span>
                        </div>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-2 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
