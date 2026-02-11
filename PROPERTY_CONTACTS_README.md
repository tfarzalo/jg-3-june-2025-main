# 📧 Property Contacts & Email Recipients System

## Overview

A comprehensive enhancement to property contact management that provides:
- **Organized Contact Management** - Clear grouping of system vs. additional contacts
- **Flexible Role Assignment** - Assign multiple roles to any contact
- **Smart Email Recipients** - Automatic To/CC/BCC list building with deduplication
- **Backward Compatible** - Existing properties continue to work without changes

## 🚀 Quick Start (5 Minutes)

### 1. Apply Database Migration
```bash
# Using Supabase CLI
supabase db push

# Or manually
psql your_database < supabase/migrations/20260210000001_add_property_contact_roles.sql
```

### 2. Verify Migration
```bash
psql your_database < supabase/migrations/20260210000002_verify_contact_roles_migration.sql
```

### 3. Update Email Sending Code
```typescript
import { getEmailRecipients } from './src/lib/contacts/emailRecipientsAdapter';

// In your email sending function:
const recipients = await getEmailRecipients(
  propertyId,
  'approval', // or 'notification'
  { fallbackToManager: true }
);

if (recipients.to.length === 0) {
  toast.error('No recipients configured');
  return;
}

await supabase.functions.invoke('send-email', {
  body: {
    to: recipients.to,
    cc: recipients.cc,
    bcc: recipients.bcc,
    subject: 'Your Subject',
    html: emailContent,
  },
});
```

### 4. Test
```typescript
import { testEmailRecipients } from './src/lib/contacts/testUtils';

// In browser console or test file:
await testEmailRecipients('your-property-id', 'approval');
```

**That's it!** Your email sending now uses the new recipient system.

---

## 📁 File Structure

```
📂 supabase/migrations/
├── 20260210000001_add_property_contact_roles.sql       # Main migration
├── 20260210000002_verify_contact_roles_migration.sql   # Verification queries
└── ROLLBACK_20260210000001.sql                         # Rollback if needed

📂 src/
├── types/
│   └── contacts.ts                                     # Type definitions
│
├── lib/
│   └── contacts/
│       ├── contactViewModel.ts                         # Core utilities
│       ├── emailRecipientsAdapter.ts                   # Drop-in adapter ⭐
│       └── testUtils.ts                                # Testing utilities
│
└── components/
    └── property/
        └── PropertyContactsEditor.tsx                  # New UI component

📂 docs/ (documentation)
├── PROPERTY_CONTACTS_IMPLEMENTATION_SUMMARY.md         # Complete summary
├── PROPERTY_CONTACTS_ENHANCEMENT_IMPLEMENTATION.md     # Detailed guide
└── CONTACTS_QUICK_REFERENCE.md                         # Quick reference
```

---

## 🎯 What's New

### Database Schema
- **`property_contacts` table**: 6 new boolean role columns
- **`properties` table**: 1 new JSONB column for system contact roles
- **Trigger**: Enforces single-select constraints automatically
- **Indexes**: Performance optimization for role queries

### Contact Roles
**Single-Select (one per property):**
- ✅ Subcontractor Contact
- ✅ Accounts Receivable Contact
- ✅ Primary Approval Recipient
- ✅ Primary Notification Recipient

**Multi-Select (multiple per property):**
- ✅ Approval Email Recipients
- ✅ Notification Email Recipients

### Email Distribution
- **Primary recipient** → To field (main + secondary email)
- **Other recipients** → CC field (main + secondary email)
- **Automatic deduplication** → No duplicate addresses
- **Smart fallback** → Uses community manager if no recipients configured

---

## 📚 Documentation

### For Quick Integration
- **[CONTACTS_QUICK_REFERENCE.md](./CONTACTS_QUICK_REFERENCE.md)** - 5-minute quick start guide

### For Full Understanding
- **[PROPERTY_CONTACTS_IMPLEMENTATION_SUMMARY.md](./PROPERTY_CONTACTS_IMPLEMENTATION_SUMMARY.md)** - Complete overview of what was built

### For Detailed Implementation
- **[PROPERTY_CONTACTS_ENHANCEMENT_IMPLEMENTATION.md](./PROPERTY_CONTACTS_ENHANCEMENT_IMPLEMENTATION.md)** - Step-by-step integration guide for UI components

---

## 🛠 API Reference

### `getEmailRecipients(propertyId, mode, options?)`
Get email recipients for a property. Returns `{ to: string[], cc: string[], bcc: string[] }`.

**Parameters:**
- `propertyId` (string) - Property UUID
- `mode` ('approval' | 'notification') - Email type
- `options.additionalBcc` (string[]) - Additional BCC addresses
- `options.fallbackToManager` (boolean) - Fall back to community manager if no recipients

**Returns:** `EmailRecipientsResult`

**Example:**
```typescript
const recipients = await getEmailRecipients(propertyId, 'approval', {
  additionalBcc: ['admin@company.com'],
  fallbackToManager: true
});
```

### `buildContactViewModels(property, customContacts)`
Merge system and custom contacts into unified view models.

**Returns:** `ContactViewModel[]`

### `buildEmailRecipients(property, customContacts, mode, options?)`
Lower-level function to build recipients (if you have property data already loaded).

**Returns:** `EmailRecipients`

---

## 🧪 Testing

### Manual Testing
```typescript
import { testEmailRecipients } from './src/lib/contacts/testUtils';

// Test approval recipients
await testEmailRecipients('property-id', 'approval');

// Test notification recipients  
await testEmailRecipients('property-id', 'notification');

// Compare both modes
import { compareRecipientModes } from './src/lib/contacts/testUtils';
await compareRecipientModes('property-id');

// Validate configuration
import { validateRecipientConfiguration } from './src/lib/contacts/testUtils';
const issues = await validateRecipientConfiguration('property-id');

// Simulate email send (dry run)
import { simulateEmailSend } from './src/lib/contacts/testUtils';
await simulateEmailSend('property-id', 'approval', 'Test Subject');
```

### Database Verification
```sql
-- Check role assignments
SELECT * FROM property_contacts WHERE property_id = 'your-property-id';

-- Check system contact roles
SELECT contact_role_config FROM properties WHERE id = 'your-property-id';

-- Verify constraints (should return 0 rows)
SELECT property_id, COUNT(*) 
FROM property_contacts 
WHERE is_subcontractor_contact = true 
GROUP BY property_id 
HAVING COUNT(*) > 1;
```

---

## 🎨 UI Components (Optional)

### PropertyContactsEditor
A complete contacts editor UI with role toggles, recipient summary, and badge display.

**Usage:**
```tsx
<PropertyContactsEditor
  systemContacts={systemContactsData}
  systemContactRoles={roleConfig}
  customContacts={customContactsArray}
  onSystemContactChange={handleSystemContactChange}
  onSystemContactRoleChange={handleSystemRoleChange}
  onCustomContactChange={handleCustomContactChange}
  onCustomContactAdd={handleAddContact}
  onCustomContactDelete={handleDeleteContact}
/>
```

See [PROPERTY_CONTACTS_ENHANCEMENT_IMPLEMENTATION.md](./PROPERTY_CONTACTS_ENHANCEMENT_IMPLEMENTATION.md) for full integration guide.

---

## 🔍 Troubleshooting

### No Recipients Found
1. Check that contacts have roles assigned in Property Edit form
2. Verify migration was applied: `SELECT * FROM property_contacts LIMIT 1;`
3. Check for null emails: `SELECT * FROM property_contacts WHERE email IS NULL;`

### Primary Not Working
1. Ensure `is_primary_*_recipient` is true
2. Ensure `is_*_recipient` is also true (required by trigger)
3. Check only one contact has primary flag per property

### Duplicate Emails
Should be handled automatically. If you see duplicates:
1. Check console logs for debugging info
2. Verify deduplication logic in `emailRecipientsAdapter.ts`
3. Report as a bug with example data

### Migration Failed
1. Check error message carefully
2. Ensure no syntax errors in migration file
3. Try verification script: `20260210000002_verify_contact_roles_migration.sql`
4. If needed, use rollback: `ROLLBACK_20260210000001.sql`

---

## 🔄 Rollback Procedure

If you need to reverse the migration:

```bash
psql your_database < supabase/migrations/ROLLBACK_20260210000001.sql
```

**Warning:** This will remove all contact role assignments. Backup your data first!

---

## 📊 Migration Statistics

- **New Columns**: 7 (6 in property_contacts, 1 in properties)
- **New Indexes**: 5
- **New Triggers**: 1
- **New Functions**: 1 (trigger function)
- **Breaking Changes**: 0 (fully backward compatible)

---

## 🎓 Learn More

### Key Concepts
- **System Contacts**: Community Manager, Maintenance Supervisor, Primary Contact, AP
- **Custom Contacts**: User-created contacts with flexible roles
- **Role Types**: Single-select (exclusive) vs. Multi-select (inclusive)
- **Email Distribution**: To (primary) vs. CC (others) vs. BCC (admin)

### Design Decisions
- **Why JSONB for system contacts?** Avoids adding 24+ columns to properties table
- **Why triggers?** Enforce data integrity at database level (can't be bypassed)
- **Why deduplication?** Prevents sending same email multiple times
- **Why fallback?** Ensures emails never fail silently

---

## 🤝 Contributing

When modifying this system:
1. Update type definitions in `src/types/contacts.ts`
2. Add tests to `src/lib/contacts/testUtils.ts`
3. Update documentation in this README
4. Run verification script after database changes
5. Test with existing and new properties

---

## 📝 License

Part of the internal property management system.

---

## 🆘 Support

- **Documentation**: See files in project root
- **Testing**: Use functions in `src/lib/contacts/testUtils.ts`
- **Debugging**: Check browser console logs
- **Issues**: Review troubleshooting section above

---

## ✅ Checklist for Deployment

- [ ] Backup database
- [ ] Apply migration (`20260210000001_add_property_contact_roles.sql`)
- [ ] Run verification (`20260210000002_verify_contact_roles_migration.sql`)
- [ ] Update email sending code to use `getEmailRecipients()`
- [ ] Test with multiple properties
- [ ] Verify existing properties still work
- [ ] Test approval emails send correctly
- [ ] Test notification emails send correctly
- [ ] Verify secondary emails are included
- [ ] Check deduplication works
- [ ] Test fallback behavior
- [ ] Review logs for errors
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Update user documentation

---

**Version:** 1.0.0  
**Date:** February 10, 2026  
**Status:** Production Ready ✅
