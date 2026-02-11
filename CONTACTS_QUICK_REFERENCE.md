# Property Contacts & Email Recipients - Quick Reference

## 🔥 Quick Integration (5 Minutes)

### Step 1: Apply Migration
```bash
# Using Supabase CLI
supabase db push

# Or manually
psql your_db < supabase/migrations/20260210000001_add_property_contact_roles.sql
```

### Step 2: Update Email Sending Code
```typescript
import { getEmailRecipients } from '../lib/contacts/emailRecipientsAdapter';

// Before your email send:
const recipients = await getEmailRecipients(
  propertyId,
  'approval', // or 'notification'
  { 
    additionalBcc: emailConfig?.default_bcc_emails,
    fallbackToManager: true 
  }
);

// Update your email send call:
await supabase.functions.invoke('send-email', {
  body: {
    to: recipients.to,      // Array of emails
    cc: recipients.cc,      // Array of emails
    bcc: recipients.bcc,    // Array of emails
    subject: emailSubject,
    html: emailHtml,
    from: `${fromName} <${fromEmail}>`,
  },
});
```

### Step 3: Test
- Configure contacts in Property Edit form
- Send a test email
- Verify To/CC/BCC are correct

---

## 📚 Core Concepts

### System Contacts (in `properties` table)
- **Community Manager** - property.community_manager_*
- **Maintenance Supervisor** - property.maintenance_supervisor_*
- **Primary Contact** - property.primary_contact_*
- **Accounts Payable** - property.ap_*

Each has: name, email, secondary_email, phone

### Custom Contacts (in `property_contacts` table)
- User-created contacts with position, name, email, secondary_email, phone
- Can have any of the role flags

### Role Types

**Single-Select (only one per property):**
- `is_subcontractor_contact` - The main subcontractor contact
- `is_accounts_receivable_contact` - The AR/billing contact
- `is_primary_approval_recipient` - Primary recipient for approval emails
- `is_primary_notification_recipient` - Primary recipient for notification emails

**Multi-Select (multiple per property):**
- `is_approval_recipient` - Receives approval emails (in To or CC)
- `is_notification_recipient` - Receives notification emails (in To or CC)

### Email Distribution Rules
- **Primary recipient** → emails go to **To** field (main + secondary)
- **Other recipients** → emails go to **CC** field (main + secondary)
- **Deduplication** → no duplicate email addresses sent
- **Fallback** → if no primary, uses community manager or first recipient

---

## 🎯 Common Use Cases

### Use Case 1: Send Approval Email
```typescript
const recipients = await getEmailRecipients(propertyId, 'approval', {
  fallbackToManager: true
});

if (recipients.to.length === 0) {
  toast.error('No approval recipients configured');
  return;
}

await sendEmail({
  to: recipients.to,
  cc: recipients.cc,
  bcc: recipients.bcc,
  subject: 'Approval Required',
  html: emailContent
});
```

### Use Case 2: Send Notification Email
```typescript
const recipients = await getEmailRecipients(propertyId, 'notification', {
  fallbackToManager: true
});

await sendEmail({
  to: recipients.to,
  cc: recipients.cc,
  bcc: recipients.bcc,
  subject: 'Work Order Notification',
  html: emailContent
});
```

### Use Case 3: Get Subcontractor Contact
```typescript
import { getSubcontractorContact } from '../lib/contacts/contactViewModel';

const subcontractor = await getSubcontractorContact(property, customContacts);
if (subcontractor) {
  console.log(`Subcontractor: ${subcontractor.name} - ${subcontractor.email}`);
}
```

### Use Case 4: Get All Contacts with Roles
```typescript
import { buildContactViewModels } from '../lib/contacts/contactViewModel';

const contacts = buildContactViewModels(property, customContacts);

// Filter by role
const approvalRecipients = contacts.filter(c => c.roles.approvalRecipient);
const notificationRecipients = contacts.filter(c => c.roles.notificationRecipient);
```

---

## 🔍 Debugging

### Check What Recipients Are Configured
```typescript
const recipients = await getEmailRecipients(propertyId, 'approval');
console.log('Approval recipients:', {
  to: recipients.to,
  cc: recipients.cc,
  primaryName: recipients.primaryRecipientName
});
```

### Check Database Directly
```sql
-- Check custom contact roles
SELECT 
  pc.name,
  pc.email,
  pc.is_approval_recipient,
  pc.is_notification_recipient,
  pc.is_primary_approval_recipient,
  pc.is_primary_notification_recipient
FROM property_contacts pc
WHERE pc.property_id = 'YOUR_PROPERTY_ID';

-- Check system contact roles
SELECT 
  property_name,
  contact_role_config
FROM properties
WHERE id = 'YOUR_PROPERTY_ID';
```

### Common Issues

**No recipients found:**
- Check that roles are assigned in Property Edit form
- Verify migration was applied successfully
- Check that email addresses are not null

**Duplicate emails:**
- Should be handled automatically by deduplication
- Check console logs for debugging info

**Primary not working:**
- Ensure is_primary_*_recipient is true
- Ensure is_*_recipient is also true (required)
- Check that only one contact has primary flag

---

## 📝 Database Schema Quick Ref

### `property_contacts` table
```sql
-- New columns (all NOT NULL with defaults):
is_subcontractor_contact boolean DEFAULT false
is_accounts_receivable_contact boolean DEFAULT false
is_approval_recipient boolean DEFAULT false
is_notification_recipient boolean DEFAULT false
is_primary_approval_recipient boolean DEFAULT false
is_primary_notification_recipient boolean DEFAULT false
secondary_email text (nullable)
```

### `properties` table
```sql
-- New column:
contact_role_config jsonb DEFAULT '{}'::jsonb

-- Structure:
{
  "community_manager": {
    "subcontractor": false,
    "accountsReceivable": false,
    "approvalRecipient": true,
    "notificationRecipient": true,
    "primaryApproval": true,
    "primaryNotification": false
  },
  "maintenance_supervisor": { ... },
  "primary_contact": { ... },
  "ap": { ... }
}
```

---

## 🧪 Testing Checklist

- [ ] Apply migration successfully
- [ ] Create/edit property contacts with roles
- [ ] Verify single-select enforcement (Subcontractor, AR, Primary)
- [ ] Verify multi-select works (Approval/Notification recipients)
- [ ] Send approval email → verify To/CC correct
- [ ] Send notification email → verify To/CC correct
- [ ] Test with secondary emails → verify included
- [ ] Test with no recipients → verify fallback
- [ ] Test existing properties → verify backward compatibility
- [ ] Check UI displays roles correctly in Property Details

---

## 🚨 Important Notes

1. **Backward Compatible**: Existing properties work without any changes
2. **Database Enforced**: Triggers prevent invalid role assignments
3. **Auto-Fallback**: Falls back to community manager if no recipients configured
4. **Secondary Emails**: Always included for all selected recipients
5. **Deduplication**: Automatic - no duplicate emails sent
6. **Trigger Logic**: Setting primary auto-sets recipient; unsetting recipient auto-unsets primary

---

## 📖 Full Documentation

- **Implementation Guide**: `PROPERTY_CONTACTS_ENHANCEMENT_IMPLEMENTATION.md`
- **Summary**: `PROPERTY_CONTACTS_IMPLEMENTATION_SUMMARY.md`
- **Migration**: `supabase/migrations/20260210000001_add_property_contact_roles.sql`
- **Verification**: `supabase/migrations/20260210000002_verify_contact_roles_migration.sql`

---

## 🎓 Key Files

```
supabase/migrations/
  20260210000001_add_property_contact_roles.sql      # Main migration
  20260210000002_verify_contact_roles_migration.sql  # Verification queries

src/
  types/
    contacts.ts                                        # Type definitions
  
  lib/
    contacts/
      contactViewModel.ts                              # Core utilities
      emailRecipientsAdapter.ts                        # Drop-in adapter ⭐
  
  components/
    property/
      PropertyContactsEditor.tsx                       # New UI component
    PropertyEditForm.tsx                               # Update this
    PropertyDetails.tsx                                # Update this
    EnhancedPropertyNotificationModal.tsx             # Update this
```

---

## 💡 Pro Tips

1. **Start Small**: Use `emailRecipientsAdapter.ts` first, then add UI later
2. **Test Edge Cases**: No recipients, no primary, all duplicates
3. **Use Fallback**: Set `fallbackToManager: true` for safety
4. **Check Logs**: Functions log detailed info for debugging
5. **Verify Migration**: Run verification script after migration

---

## 🎉 Success Criteria

✅ Migration applied without errors  
✅ Email sending uses new recipient logic  
✅ To/CC/BCC populated correctly  
✅ Secondary emails included  
✅ Deduplication works  
✅ Existing properties unaffected  
✅ No console errors  

---

That's it! You're ready to go. Start with the email adapter for quick wins, then enhance the UI when ready.
