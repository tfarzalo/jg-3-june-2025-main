# Property Contacts Enhancement - Implementation Guide

## Overview
This document provides complete implementation details for enhancing property contact management with role-based email recipient selection.

## Files Created

### 1. Database Migration
**File:** `supabase/migrations/20260210000001_add_property_contact_roles.sql`
- Adds role columns to `property_contacts` table
- Adds `contact_role_config` JSONB column to `properties` table  
- Creates triggers to enforce single-select constraints
- Creates indexes for performance

### 2. Type Definitions
**File:** `src/types/contacts.ts`
- Defines `ContactRoles` interface
- Defines `SystemContactKey` type
- Defines form data interfaces

### 3. Contact View Model & Utilities
**File:** `src/lib/contacts/contactViewModel.ts`
- `buildContactViewModels()` - Merges system + custom contacts into unified view
- `buildEmailRecipients()` - Builds To/CC/BCC lists for outbound emails
- `getSubcontractorContact()` - Helper to get subcontractor contact
- `getAccountsReceivableContact()` - Helper to get AR contact
- Email normalization and deduplication logic

### 4. Property Contacts Editor Component
**File:** `src/components/property/PropertyContactsEditor.tsx`
- Organized system + custom contacts UI
- Role toggle checkboxes and radios
- Recipient summary panel
- Badge display for assigned roles
- Secondary email management

## PropertyEditForm Integration Steps

### Step 1: Add Imports
```typescript
import { PropertyContactsEditor } from './property/PropertyContactsEditor';
import { ContactRoles, SystemContactKey, PropertyContactRoleConfig } from '../types/contacts';
```

### Step 2: Add State for Role Config
```typescript
const [systemContactRoles, setSystemContactRoles] = useState<PropertyContactRoleConfig>({});
```

### Step 3: Load Role Config in fetchProperty
In the `fetchProperty` function, after loading property data:
```typescript
// Load contact role config
setSystemContactRoles(data.contact_role_config || {});
```

### Step 4: Add Role Change Handlers
```typescript
const handleSystemContactRoleChange = (
  key: SystemContactKey,
  role: keyof ContactRoles,
  value: boolean
) => {
  setSystemContactRoles(prev => {
    const current = prev[key] || {};
    const updated = { ...current, [role]: value };

    // Handle single-select roles (clear others)
    if (value) {
      if (role === 'subcontractor') {
        // Clear subcontractor from all other contacts
        const cleared = Object.keys(prev).reduce((acc, k) => {
          if (k !== key) {
            acc[k] = { ...prev[k], subcontractor: false };
          } else {
            acc[k] = updated;
          }
          return acc;
        }, {} as PropertyContactRoleConfig);
        return cleared;
      }

      if (role === 'accountsReceivable') {
        // Clear AR from all other contacts
        const cleared = Object.keys(prev).reduce((acc, k) => {
          if (k !== key) {
            acc[k] = { ...prev[k], accountsReceivable: false };
          } else {
            acc[k] = updated;
          }
          return acc;
        }, {} as PropertyContactRoleConfig);
        return cleared;
      }

      if (role === 'primaryApproval') {
        // Clear primary approval from all other system contacts
        // Also auto-set approvalRecipient
        updated.approvalRecipient = true;
        const cleared = Object.keys(prev).reduce((acc, k) => {
          if (k !== key) {
            acc[k] = { ...prev[k], primaryApproval: false };
          } else {
            acc[k] = updated;
          }
          return acc;
        }, {} as PropertyContactRoleConfig);
        return cleared;
      }

      if (role === 'primaryNotification') {
        // Clear primary notification from all other system contacts
        // Also auto-set notificationRecipient
        updated.notificationRecipient = true;
        const cleared = Object.keys(prev).reduce((acc, k) => {
          if (k !== key) {
            acc[k] = { ...prev[k], primaryNotification: false };
          } else {
            acc[k] = updated;
          }
          return acc;
        }, {} as PropertyContactRoleConfig);
        return cleared;
      }
    }

    // Handle auto-unsetting primary when unchecking recipient
    if (!value) {
      if (role === 'approvalRecipient') {
        updated.primaryApproval = false;
      }
      if (role === 'notificationRecipient') {
        updated.primaryNotification = false;
      }
    }

    return { ...prev, [key]: updated };
  });

  toast.success('Contact role updated');
};

const handleSystemContactChange = (
  key: SystemContactKey,
  field: string,
  value: string
) => {
  const fieldMap: Record<string, string> = {
    community_manager: 'community_manager_',
    maintenance_supervisor: 'maintenance_supervisor_',
    primary_contact: 'primary_contact_',
    ap: 'ap_'
  };

  const prefix = fieldMap[key];
  const formField = prefix + field;
  
  setFormData(prev => ({ ...prev, [formField]: value }));
};

const handleCustomContactRoleChange = (
  id: string,
  role: keyof ContactRoles,
  value: boolean
) => {
  setContacts(prev => prev.map(contact => {
    if (contact.id === id) {
      const updated = { ...contact };
      
      // Handle single-select roles
      if (value) {
        if (role === 'subcontractor') {
          // Will be handled by database trigger, but clear locally for immediate UI feedback
          return prev.map(c => ({
            ...c,
            is_subcontractor_contact: c.id === id
          }));
        }
        if (role === 'accountsReceivable') {
          return prev.map(c => ({
            ...c,
            is_accounts_receivable_contact: c.id === id
          }));
        }
        if (role === 'primaryApproval') {
          updated.is_primary_approval_recipient = true;
          updated.is_approval_recipient = true;
          // Clear others
          return prev.map(c => ({
            ...c,
            is_primary_approval_recipient: c.id === id ? true : false,
            is_approval_recipient: c.id === id ? true : c.is_approval_recipient
          }));
        }
        if (role === 'primaryNotification') {
          updated.is_primary_notification_recipient = true;
          updated.is_notification_recipient = true;
          return prev.map(c => ({
            ...c,
            is_primary_notification_recipient: c.id === id ? true : false,
            is_notification_recipient: c.id === id ? true : c.is_notification_recipient
          }));
        }
      }

      // Handle unchecking
      if (!value) {
        if (role === 'approvalRecipient') {
          updated.is_approval_recipient = false;
          updated.is_primary_approval_recipient = false;
        }
        if (role === 'notificationRecipient') {
          updated.is_notification_recipient = false;
          updated.is_primary_notification_recipient = false;
        }
      }

      // Map ContactRoles keys to PropertyContact keys
      const roleFieldMap: Record<keyof ContactRoles, keyof PropertyContact> = {
        subcontractor: 'is_subcontractor_contact',
        accountsReceivable: 'is_accounts_receivable_contact',
        approvalRecipient: 'is_approval_recipient',
        notificationRecipient: 'is_notification_recipient',
        primaryApproval: 'is_primary_approval_recipient',
        primaryNotification: 'is_primary_notification_recipient',
      };

      const field = roleFieldMap[role];
      updated[field] = value as any;

      return updated;
    }
    return contact;
  }));

  toast.success('Contact role updated');
};
```

### Step 5: Update handleSubmit to Save Roles
In the `handleSubmit` function, add role config save:

```typescript
// After updating property fields, save contact role config
updateData.contact_role_config = systemContactRoles;

// When saving custom contacts, include role fields:
if (contacts.length > 0) {
  const contactsToInsert = contacts.map(c => ({
    property_id: propertyId,
    position: c.position || null,
    name: c.name || null,
    email: c.email || null,
    phone: c.phone || null,
    secondary_email: c.secondary_email || null,
    is_subcontractor_contact: c.is_subcontractor_contact || false,
    is_accounts_receivable_contact: c.is_accounts_receivable_contact || false,
    is_approval_recipient: c.is_approval_recipient || false,
    is_notification_recipient: c.is_notification_recipient || false,
    is_primary_approval_recipient: c.is_primary_approval_recipient || false,
    is_primary_notification_recipient: c.is_primary_notification_recipient || false,
  }));

  const { error: insertError } = await supabase
    .from('property_contacts')
    .insert(contactsToInsert);

  if (insertError) throw insertError;
}
```

### Step 6: Replace Contact Information Section in JSX
Replace the entire "Contact Information" section (currently lines ~770-1113) with:

```tsx
{/* Contact Information */}
<div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
    Contact Information & Email Recipients
  </h2>
  
  <PropertyContactsEditor
    systemContacts={{
      community_manager: {
        name: formData.community_manager_name,
        email: formData.community_manager_email,
        secondary_email: formData.community_manager_secondary_email,
        phone: formData.community_manager_phone,
        title: formData.community_manager_title,
      },
      maintenance_supervisor: {
        name: formData.maintenance_supervisor_name,
        email: formData.maintenance_supervisor_email,
        secondary_email: formData.maintenance_supervisor_secondary_email,
        phone: formData.maintenance_supervisor_phone,
        title: formData.maintenance_supervisor_title,
      },
      primary_contact: {
        name: formData.primary_contact_name,
        email: formData.primary_contact_email || '',
        secondary_email: formData.primary_contact_secondary_email,
        phone: formData.primary_contact_phone,
      },
      ap: {
        name: formData.ap_name,
        email: formData.ap_email,
        secondary_email: formData.ap_secondary_email,
        phone: formData.ap_phone,
      },
    }}
    systemContactRoles={systemContactRoles}
    customContacts={contacts}
    onSystemContactChange={handleSystemContactChange}
    onSystemContactRoleChange={handleSystemContactRoleChange}
    onCustomContactChange={(id, field, value) => {
      if (field.startsWith('is_')) {
        handleCustomContactRoleChange(id, field as any, value);
      } else {
        handleContactChange(id, field, value);
      }
    }}
    onCustomContactAdd={handleAddContact}
    onCustomContactDelete={handleDeleteContact}
  />
</div>
```

### Step 7: Remove Legacy Fields (Optional)
You can now remove the old `subcontractorContactSource` and `notificationContactSource` state and related handlers, as roles are managed through the new system.

## PropertyDetails Integration

### Step 1: Add Imports
```typescript
import { buildContactViewModels, ContactViewModel } from '../lib/contacts/contactViewModel';
```

### Step 2: Add State
```typescript
const [contactViewModels, setContactViewModels] = useState<ContactViewModel[]>([]);
```

### Step 3: Build View Models After Loading
In `fetchProperty`, after loading property and contacts:
```typescript
const viewModels = buildContactViewModels(propertyData, contactsData || []);
setContactViewModels(viewModels);
```

### Step 4: Replace Contact Information Section
Replace the contact display section (around lines 1245-1600) with organized panels:

```tsx
{/* Contact Information */}
<div id="contacts" className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
  {/* Header */}
  <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 px-6 py-4">
    <h3 className="text-lg font-semibold text-white flex items-center">
      <User className="h-5 w-5 mr-2" />
      Contact Information
    </h3>
  </div>
  
  <div className="p-6 space-y-6">
    {/* Key Contacts Panel */}
    <div>
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
        Key Contacts
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subcontractor Contact */}
        {contactViewModels.find(c => c.roles.subcontractor) && (
          <ContactCard
            contact={contactViewModels.find(c => c.roles.subcontractor)!}
            badge="Subcontractor"
            badgeColor="blue"
          />
        )}
        
        {/* AR Contact */}
        {contactViewModels.find(c => c.roles.accountsReceivable) && (
          <ContactCard
            contact={contactViewModels.find(c => c.roles.accountsReceivable)!}
            badge="Accounts Receivable"
            badgeColor="purple"
          />
        )}

        {/* Show system contacts that aren't in special roles */}
        {contactViewModels
          .filter(c => c.source === 'system' && !c.roles.subcontractor && !c.roles.accountsReceivable)
          .map(contact => (
            <ContactCard key={contact.systemKey} contact={contact} />
          ))}
      </div>
    </div>

    {/* Email Recipients Panel */}
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide flex items-center">
        <Mail className="h-4 w-4 mr-2" />
        Email Recipients
      </h4>
      
      {/* Approval Recipients */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Approval Emails</div>
        <EmailRecipientsList
          contacts={contactViewModels}
          mode="approval"
        />
      </div>

      {/* Notification Recipients */}
      <div>
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notification Emails</div>
        <EmailRecipientsList
          contacts={contactViewModels}
          mode="notification"
        />
      </div>
    </div>

    {/* Additional Contacts Panel */}
    {contactViewModels.filter(c => c.source === 'custom').length > 0 && (
      <div>
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          Additional Contacts
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contactViewModels
            .filter(c => c.source === 'custom')
            .map(contact => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
        </div>
      </div>
    )}
  </div>
</div>
```

Create helper components:

```tsx
// Add these components within PropertyDetails or extract to separate file

interface ContactCardProps {
  contact: ContactViewModel;
  badge?: string;
  badgeColor?: 'blue' | 'purple' | 'green' | 'amber';
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, badge, badgeColor = 'gray' }) => {
  const badgeColors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  };

  const colorClass = badgeColors[badgeColor];

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-2">
        <h5 className="text-sm font-bold text-gray-900 dark:text-white">{contact.label}</h5>
        {badge && (
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${colorClass}`}>
            {badge}
          </span>
        )}
      </div>
      
      <div className="space-y-1.5">
        {contact.name && (
          <div className="flex items-center text-sm">
            <User className="h-3.5 w-3.5 text-gray-500 mr-2 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">{contact.name}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center text-sm">
            <Mail className="h-3.5 w-3.5 text-gray-500 mr-2 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">{contact.email}</span>
          </div>
        )}
        {contact.secondaryEmail && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 ml-6">
            <span className="text-xs mr-1">↳</span>
            <span>{contact.secondaryEmail}</span>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center text-sm">
            <Phone className="h-3.5 w-3.5 text-gray-500 mr-2 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">{contact.phone}</span>
          </div>
        )}
      </div>

      {/* Role Badges */}
      <div className="flex flex-wrap gap-1 mt-2">
        {contact.roles.primaryApproval && (
          <span className="px-1.5 py-0.5 text-[9px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
            Primary Approval
          </span>
        )}
        {contact.roles.approvalRecipient && !contact.roles.primaryApproval && (
          <span className="px-1.5 py-0.5 text-[9px] font-medium bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
            Approval
          </span>
        )}
        {contact.roles.primaryNotification && (
          <span className="px-1.5 py-0.5 text-[9px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
            Primary Notif
          </span>
        )}
        {contact.roles.notificationRecipient && !contact.roles.primaryNotification && (
          <span className="px-1.5 py-0.5 text-[9px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded">
            Notif
          </span>
        )}
      </div>
    </div>
  );
};

interface EmailRecipientsListProps {
  contacts: ContactViewModel[];
  mode: 'approval' | 'notification';
}

const EmailRecipientsList: React.FC<EmailRecipientsListProps> = ({ contacts, mode }) => {
  const recipients = contacts.filter(c => 
    mode === 'approval' ? c.roles.approvalRecipient : c.roles.notificationRecipient
  );

  const primary = recipients.find(c => 
    mode === 'approval' ? c.roles.primaryApproval : c.roles.primaryNotification
  );

  const others = recipients.filter(c => c !== primary);

  if (recipients.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        No recipients configured
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {primary && (
        <div className="text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">To:</span>{' '}
          <span className="text-gray-900 dark:text-white">
            {primary.name || primary.label} ({primary.email})
          </span>
          {primary.secondaryEmail && (
            <span className="text-gray-600 dark:text-gray-400 text-xs ml-1">
              + {primary.secondaryEmail}
            </span>
          )}
        </div>
      )}
      {others.length > 0 && (
        <div className="text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">CC:</span>{' '}
          {others.map((contact, idx) => (
            <span key={contact.id || contact.systemKey} className="text-gray-900 dark:text-white">
              {contact.name || contact.label}
              {idx < others.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Email Sending Integration

### Update EnhancedPropertyNotificationModal
In the email sending modal, replace recipient selection logic:

```typescript
import { buildEmailRecipients } from '../lib/contacts/contactViewModel';

// In handleSendEmail:
const emailRecipients = buildEmailRecipients(
  property,
  propertyContacts,
  notificationType === 'extra_charges' ? 'approval' : 'notification',
  { defaultBcc: emailConfig?.default_bcc_emails }
);

// Use in supabase.functions.invoke:
const { error } = await supabase.functions.invoke('send-email', {
  body: {
    to: emailRecipients.to,
    subject: emailSubject,
    html: finalHtml,
    cc: emailRecipients.cc,
    bcc: emailRecipients.bcc,
    from: emailConfig ? `${emailConfig.from_name} <${emailConfig.from_email}>` : undefined,
  },
});
```

## Testing Checklist

- [ ] Run migration successfully
- [ ] Test adding/editing system contacts
- [ ] Test adding/editing custom contacts
- [ ] Test role toggle behavior (single-select vs multi-select)
- [ ] Test primary recipient selection within each category
- [ ] Verify secondary emails are included in To/CC lists
- [ ] Test email deduplication
- [ ] Verify Property Details displays contacts correctly
- [ ] Test approval email sending with new recipient logic
- [ ] Test notification email sending with new recipient logic
- [ ] Verify no regressions in existing property functionality
- [ ] Test on both light and dark mode

## Migration Steps

1. **Backup database** before running migration
2. Apply SQL migration: `20260210000001_add_property_contact_roles.sql`
3. Deploy new TypeScript files
4. Update PropertyEditForm component
5. Update PropertyDetails component
6. Update email sending modals
7. Test thoroughly in staging environment
8. Deploy to production

## Notes

- Backward compatible: Existing properties without role config will continue to work
- System contacts remain in properties table (not moved)
- Custom contacts gain role flags via property_contacts table
- Email deduplication prevents sending duplicate addresses
- Triggers enforce single-select constraints at database level
- UI provides immediate feedback before database save
