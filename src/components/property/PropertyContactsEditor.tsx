/**
 * Enhanced Property Contacts Editor
 * 
 * Provides organized contact management with role-based selection for:
 * - Subcontractor Contact
 * - Accounts Receivable Contact  
 * - Approval Email Recipients
 * - Notification Email Recipients
 */

import React, { useState } from 'react';
import { Plus, Minus, Trash2, Mail, Phone, User, CheckCircle } from 'lucide-react';
import { ContactRoles, SystemContactKey } from '../../types/contacts';

interface PropertyContact {
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

interface SystemContactData {
  name: string;
  email: string;
  secondary_email: string;
  phone: string;
  title?: string;
}

interface PropertyContactsEditorProps {
  // System contacts
  systemContacts: {
    community_manager: SystemContactData;
    maintenance_supervisor: SystemContactData;
    primary_contact: SystemContactData;
    ap: SystemContactData;
  };
  // Role config for system contacts
  systemContactRoles: Record<string, Partial<ContactRoles>>;
  // Custom contacts
  customContacts: PropertyContact[];
  // Callbacks
  onSystemContactChange: (key: SystemContactKey, field: string, value: string) => void;
  onSystemContactRoleChange: (key: SystemContactKey, role: keyof ContactRoles, value: boolean) => void;
  onCustomContactChange: (id: string, field: keyof PropertyContact, value: any) => void;
  onCustomContactAdd: () => void;
  onCustomContactDelete: (id: string) => void;
}

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
  // Debug log to confirm component renders
  console.log('🎨 PropertyContactsEditor rendered with:', {
    customContactsCount: customContacts.length,
    customContacts: customContacts.map(c => ({
      id: c.id,
      name: c.name,
      is_subcontractor: c.is_subcontractor_contact,
      is_ar: c.is_accounts_receivable_contact,
      is_approval: c.is_approval_recipient,
      is_notification: c.is_notification_recipient
    }))
  });

  const [secondaryEmailVisibility, setSecondaryEmailVisibility] = useState<Record<string, boolean>>({});

  const toggleSecondaryEmail = (id: string) => {
    setSecondaryEmailVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate recipient summary
  const getRecipientSummary = (mode: 'approval' | 'notification') => {
    const systemRecipients = Object.entries(systemContactRoles).filter(([key, roles]) => 
      mode === 'approval' ? roles.approvalRecipient : roles.notificationRecipient
    );
    
    const customRecipients = customContacts.filter(c => 
      mode === 'approval' ? c.is_approval_recipient : c.is_notification_recipient
    );

    const allRecipients = [
      ...systemRecipients.map(([key]) => ({ key, source: 'system' })),
      ...customRecipients.map(c => ({ key: c.id, source: 'custom' }))
    ];

    const primary = allRecipients.find(r => {
      if (r.source === 'system') {
        const roles = systemContactRoles[r.key];
        return mode === 'approval' ? roles?.primaryApproval : roles?.primaryNotification;
      } else {
        const contact = customContacts.find(c => c.id === r.key);
        return mode === 'approval' ? contact?.is_primary_approval_recipient : contact?.is_primary_notification_recipient;
      }
    });

    const ccCount = allRecipients.length - (primary ? 1 : 0);

    return { primary, ccCount, total: allRecipients.length };
  };

  const approvalSummary = getRecipientSummary('approval');
  const notificationSummary = getRecipientSummary('notification');

  const renderSystemContact = (
    key: SystemContactKey,
    label: string,
    data: SystemContactData,
    colorClass: string
  ) => {
    const roles = systemContactRoles[key] || {};
    const showSecondary = secondaryEmailVisibility[key] || !!data.secondary_email;

    return (
      <div className={`space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${colorClass}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
            <User className="h-4 w-4 mr-2" />
            {label}
          </h3>
          {/* Role badges */}
          <div className="flex flex-wrap gap-1">
            {roles.subcontractor && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                Subcontractor
              </span>
            )}
            {roles.accountsReceivable && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                AR
              </span>
            )}
            {roles.primaryApproval && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                Primary Approval
              </span>
            )}
            {roles.approvalRecipient && !roles.primaryApproval && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
                Approval
              </span>
            )}
            {roles.primaryNotification && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                Primary Notif
              </span>
            )}
            {roles.notificationRecipient && !roles.primaryNotification && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded">
                Notif
              </span>
            )}
          </div>
        </div>

        {/* Role Toggles */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="subcontractor_contact"
              checked={roles.subcontractor || false}
              onChange={() => onSystemContactRoleChange(key, 'subcontractor', true)}
              className="h-3.5 w-3.5 text-blue-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">Subcontractor</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="ar_contact"
              checked={roles.accountsReceivable || false}
              onChange={() => onSystemContactRoleChange(key, 'accountsReceivable', true)}
              className="h-3.5 w-3.5 text-purple-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">AR Contact</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={roles.approvalRecipient || false}
              onChange={(e) => onSystemContactRoleChange(key, 'approvalRecipient', e.target.checked)}
              className="h-3.5 w-3.5 text-green-600 rounded"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">Approval Emails</span>
          </label>

          {roles.approvalRecipient && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="primary_approval"
                checked={roles.primaryApproval || false}
                onChange={() => onSystemContactRoleChange(key, 'primaryApproval', true)}
                className="h-3.5 w-3.5 text-green-700"
              />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Primary</span>
            </label>
          )}

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={roles.notificationRecipient || false}
              onChange={(e) => onSystemContactRoleChange(key, 'notificationRecipient', e.target.checked)}
              className="h-3.5 w-3.5 text-amber-600 rounded"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">Notification Emails</span>
          </label>

          {roles.notificationRecipient && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="primary_notification"
                checked={roles.primaryNotification || false}
                onChange={() => onSystemContactRoleChange(key, 'primaryNotification', true)}
                className="h-3.5 w-3.5 text-amber-700"
              />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Primary</span>
            </label>
          )}
        </div>

        {/* Contact Fields */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Position / Job
          </label>
          <input
            type="text"
            value={data.title || ''}
            onChange={(e) => onSystemContactChange(key, 'title', e.target.value)}
            className="w-full h-10 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={label}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Name</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onSystemContactChange(key, 'name', e.target.value)}
            className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
            <button
              type="button"
              onClick={() => toggleSecondaryEmail(key)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
            >
              {showSecondary ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onSystemContactChange(key, 'email', e.target.value)}
            className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {showSecondary && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Secondary Email
            </label>
            <input
              type="email"
              value={data.secondary_email}
              onChange={(e) => onSystemContactChange(key, 'secondary_email', e.target.value)}
              className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Phone</label>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => onSystemContactChange(key, 'phone', e.target.value)}
            className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    );
  };

  const renderCustomContact = (contact: PropertyContact, index: number) => {
    const showSecondary = secondaryEmailVisibility[contact.id] || !!contact.secondary_email;

    return (
      <div key={contact.id} className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 relative">
        <button
          type="button"
          onClick={() => onCustomContactDelete(contact.id)}
          className="absolute top-4 right-4 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Remove contact"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="flex items-center justify-between pr-8">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            {contact.position || `Additional Contact ${index + 1}`}
          </h3>
          {/* Role badges */}
          <div className="flex flex-wrap gap-1">
            {contact.is_subcontractor_contact && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                Subcontractor
              </span>
            )}
            {contact.is_accounts_receivable_contact && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                AR
              </span>
            )}
            {contact.is_primary_approval_recipient && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                Primary Approval
              </span>
            )}
            {contact.is_approval_recipient && !contact.is_primary_approval_recipient && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
                Approval
              </span>
            )}
            {contact.is_primary_notification_recipient && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                Primary Notif
              </span>
            )}
            {contact.is_notification_recipient && !contact.is_primary_notification_recipient && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded">
                Notif
              </span>
            )}
          </div>
        </div>

        {/* Role Toggles */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-white dark:bg-gray-900/50 rounded-lg">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name={`subcontractor_contact_${contact.id}`}
              checked={contact.is_subcontractor_contact || false}
              onChange={() => {
                console.log('🔘 Subcontractor radio clicked for contact:', contact.id);
                onCustomContactChange(contact.id, 'is_subcontractor_contact', true);
              }}
              className="h-3.5 w-3.5 text-blue-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">Subcontractor</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name={`ar_contact_${contact.id}`}
              checked={contact.is_accounts_receivable_contact || false}
              onChange={() => {
                console.log('🔘 AR Contact radio clicked for contact:', contact.id);
                onCustomContactChange(contact.id, 'is_accounts_receivable_contact', true);
              }}
              className="h-3.5 w-3.5 text-purple-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">AR Contact</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={contact.is_approval_recipient || false}
              onChange={(e) => {
                console.log('☑️ Approval Emails checkbox changed for contact:', contact.id, 'to:', e.target.checked);
                onCustomContactChange(contact.id, 'is_approval_recipient', e.target.checked);
              }}
              className="h-3.5 w-3.5 text-green-600 rounded"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">Approval Emails</span>
          </label>

          {contact.is_approval_recipient && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={`primary_approval_${contact.id}`}
                checked={contact.is_primary_approval_recipient || false}
                onChange={() => {
                  console.log('🔘 Primary Approval radio clicked for contact:', contact.id);
                  onCustomContactChange(contact.id, 'is_primary_approval_recipient', true);
                }}
                className="h-3.5 w-3.5 text-green-700"
              />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Primary</span>
            </label>
          )}

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={contact.is_notification_recipient || false}
              onChange={(e) => {
                console.log('☑️ Notification Emails checkbox changed for contact:', contact.id, 'to:', e.target.checked);
                onCustomContactChange(contact.id, 'is_notification_recipient', e.target.checked);
              }}
              className="h-3.5 w-3.5 text-amber-600 rounded"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">Notification Emails</span>
          </label>

          {contact.is_notification_recipient && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={`primary_notification_${contact.id}`}
                checked={contact.is_primary_notification_recipient || false}
                onChange={() => {
                  console.log('🔘 Primary Notification radio clicked for contact:', contact.id);
                  onCustomContactChange(contact.id, 'is_primary_notification_recipient', true);
                }}
                className="h-3.5 w-3.5 text-amber-700"
              />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Primary</span>
            </label>
          )}
        </div>

        {/* Contact Fields */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Position / Job
          </label>
          <input
            type="text"
            value={contact.position || ''}
            onChange={(e) => onCustomContactChange(contact.id, 'position', e.target.value)}
            className="w-full h-10 px-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Position"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Name</label>
          <input
            type="text"
            value={contact.name || ''}
            onChange={(e) => onCustomContactChange(contact.id, 'name', e.target.value)}
            className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Name"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
            <button
              type="button"
              onClick={() => toggleSecondaryEmail(contact.id)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
            >
              {showSecondary ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <input
            type="email"
            value={contact.email || ''}
            onChange={(e) => onCustomContactChange(contact.id, 'email', e.target.value)}
            className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Email"
          />
        </div>

        {showSecondary && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Secondary Email
            </label>
            <input
              type="email"
              value={contact.secondary_email || ''}
              onChange={(e) => onCustomContactChange(contact.id, 'secondary_email', e.target.value)}
              className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Secondary Email"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Phone</label>
          <input
            type="tel"
            value={contact.phone || ''}
            onChange={(e) => onCustomContactChange(contact.id, 'phone', e.target.value)}
            className="w-full h-11 px-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Phone"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Contact Information</h2>
      
      <div className="space-y-6">
        {/* Recipient Summary Panel */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center">
            <Mail className="h-4 w-4 mr-2" />
            Email Recipients Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Approval Emails</div>
              <div className="text-sm text-gray-900 dark:text-white">
                {approvalSummary.total > 0 ? (
                  <>
                    <span className="font-medium">To:</span> {approvalSummary.primary ? '1 Primary' : 'None'}
                    {approvalSummary.ccCount > 0 && (
                      <> • <span className="font-medium">CC:</span> {approvalSummary.ccCount}</>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 italic">No recipients selected</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notification Emails</div>
              <div className="text-sm text-gray-900 dark:text-white">
                {notificationSummary.total > 0 ? (
                  <>
                    <span className="font-medium">To:</span> {notificationSummary.primary ? '1 Primary' : 'None'}
                    {notificationSummary.ccCount > 0 && (
                      <> • <span className="font-medium">CC:</span> {notificationSummary.ccCount}</>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 italic">No recipients selected</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* System Contacts */}
        <div>
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-blue-600" />
            System Contacts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderSystemContact('community_manager', systemContacts.community_manager.title || 'Community Manager', systemContacts.community_manager, 'bg-blue-50/50 dark:bg-blue-900/10')}
            {renderSystemContact('maintenance_supervisor', systemContacts.maintenance_supervisor.title || 'Maintenance Supervisor', systemContacts.maintenance_supervisor, 'bg-green-50/50 dark:bg-green-900/10')}
            {renderSystemContact('primary_contact', 'Primary Contact', systemContacts.primary_contact, 'bg-indigo-50/50 dark:bg-indigo-900/10')}
            {renderSystemContact('ap', 'Accounts Payable', systemContacts.ap, 'bg-purple-50/50 dark:bg-purple-900/10')}
          </div>
        </div>

        {/* Custom Contacts */}
        <div>
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-gray-600" />
            Additional Contacts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {customContacts.map((contact, index) => renderCustomContact(contact, index))}

            {/* Add Contact Button */}
            <div
              className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50/30 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              onClick={onCustomContactAdd}
            >
              <div className="text-center">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Add Contact</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Additional Contact {customContacts.length + 1}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
