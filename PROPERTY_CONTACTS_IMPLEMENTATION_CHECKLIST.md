# Property Contacts Enhancement - Implementation Checklist

## Pre-Implementation

- [ ] Read `PROPERTY_CONTACTS_README.md` overview
- [ ] Review `CONTACTS_QUICK_REFERENCE.md` for quick start
- [ ] Backup production database
- [ ] Identify all email sending locations in codebase
- [ ] Test in development environment first

---

## Phase 1: Database Migration (15 minutes)

### 1.1 Apply Migration
- [ ] Review migration file: `supabase/migrations/20260210000001_add_property_contact_roles.sql`
- [ ] Apply to development database
- [ ] Apply migration:
  ```bash
  supabase db push
  # OR
  psql dev_database < supabase/migrations/20260210000001_add_property_contact_roles.sql
  ```

### 1.2 Verify Migration
- [ ] Run verification script:
  ```bash
  psql dev_database < supabase/migrations/20260210000002_verify_contact_roles_migration.sql
  ```
- [ ] Check that all 7 columns exist
- [ ] Check that trigger was created
- [ ] Check that indexes were created
- [ ] Verify no errors in logs

### 1.3 Test Data Integrity
- [ ] Check existing contacts still load
- [ ] Try creating a test contact with roles
- [ ] Verify trigger prevents multiple subcontractors
- [ ] Verify trigger prevents multiple primary approvals
- [ ] Verify setting primary auto-sets recipient flag

---

## Phase 2: Email Sending Integration (30 minutes)

### 2.1 Locate Email Sending Code
- [ ] Find all files that send approval emails
  - [ ] `EnhancedPropertyNotificationModal.tsx`
  - [ ] Other locations: _______________
- [ ] Find all files that send notification emails
  - [ ] `NotificationEmailModal.tsx`
  - [ ] Other locations: _______________

### 2.2 Update Each Email Sender
For each file:
- [ ] Add import: `import { getEmailRecipients } from '../lib/contacts/emailRecipientsAdapter';`
- [ ] Replace recipient selection logic with:
  ```typescript
  const recipients = await getEmailRecipients(
    propertyId,
    'approval', // or 'notification'
    { 
      additionalBcc: emailConfig?.default_bcc_emails,
      fallbackToManager: true 
    }
  );
  
  if (recipients.to.length === 0) {
    toast.error('No email recipients configured for this property');
    return;
  }
  ```
- [ ] Update email send call to use:
  ```typescript
  to: recipients.to,      // Instead of single string
  cc: recipients.cc,      // Instead of comma-separated string
  bcc: recipients.bcc,    // Merged with defaults
  ```

### 2.3 Test Email Sending
- [ ] Test approval email send
  - [ ] Check To field is correct
  - [ ] Check CC field is correct
  - [ ] Verify secondary emails included
  - [ ] Verify no duplicate emails
- [ ] Test notification email send
  - [ ] Check To field is correct
  - [ ] Check CC field is correct
  - [ ] Verify secondary emails included
  - [ ] Verify no duplicate emails
- [ ] Test with no recipients (fallback should work)
- [ ] Test with one recipient (only To, no CC)
- [ ] Test with multiple recipients (To + CC)

---

## Phase 3: Testing & Validation (30 minutes)

### 3.1 Unit Testing
In browser console:
- [ ] Import test utils: `import { testEmailRecipients } from './src/lib/contacts/testUtils';`
- [ ] Test property 1: `await testEmailRecipients('property-id-1', 'approval');`
- [ ] Test property 2: `await testEmailRecipients('property-id-2', 'notification');`
- [ ] Compare modes: `await compareRecipientModes('property-id-1');`
- [ ] Validate config: `await validateRecipientConfiguration('property-id-1');`
- [ ] Simulate send: `await simulateEmailSend('property-id-1', 'approval', 'Test');`

### 3.2 Integration Testing
- [ ] Create new property in UI
- [ ] Verify all system contacts display correctly
- [ ] Add custom contact
- [ ] Assign roles to contacts (try each role type)
- [ ] Save property
- [ ] Reload property edit form
- [ ] Verify roles persisted correctly
- [ ] View property details page
- [ ] Verify contacts display correctly

### 3.3 Backward Compatibility Testing
- [ ] Load existing property (without roles assigned)
- [ ] Verify contacts display correctly
- [ ] Send email (should use fallback)
- [ ] Edit and save property
- [ ] Verify nothing broke

### 3.4 Edge Case Testing
- [ ] Property with no contacts → Test fallback
- [ ] Property with no emails → Test graceful failure
- [ ] Assign same contact to multiple roles → Verify works
- [ ] Remove primary flag → Verify auto-fallback
- [ ] Set duplicate emails → Verify deduplication
- [ ] Very long contact names → Verify UI handles
- [ ] Special characters in names → Verify escaping
- [ ] Multiple secondary emails → Verify all included

---

## Phase 4: UI Enhancement (Optional, 1-2 hours)

### 4.1 PropertyEditForm
- [ ] Review integration guide: `PROPERTY_CONTACTS_ENHANCEMENT_IMPLEMENTATION.md`
- [ ] Add state for `systemContactRoles`
- [ ] Add role change handlers
- [ ] Import `PropertyContactsEditor` component
- [ ] Replace existing contact section with new component
- [ ] Update `handleSubmit` to save role config
- [ ] Test form submission
- [ ] Verify roles save correctly

### 4.2 PropertyDetails
- [ ] Add imports for contact view models
- [ ] Build contact view models after data load
- [ ] Create contact card components
- [ ] Create recipient list components
- [ ] Replace contact display section
- [ ] Test display with various role configs
- [ ] Verify badges display correctly
- [ ] Test responsive layout

### 4.3 UI Testing
- [ ] Test on desktop (Chrome, Firefox, Safari)
- [ ] Test on tablet
- [ ] Test on mobile
- [ ] Test dark mode
- [ ] Test light mode
- [ ] Verify all badges display correctly
- [ ] Verify recipient summary updates
- [ ] Test role toggle interactions
- [ ] Verify form validation

---

## Phase 5: Documentation (30 minutes)

### 5.1 Update Internal Docs
- [ ] Document new role types in team wiki
- [ ] Add screenshots of new UI
- [ ] Document email recipient logic
- [ ] Create user guide for assigning roles
- [ ] Update property setup checklist

### 5.2 Code Documentation
- [ ] Add JSDoc comments to new functions
- [ ] Update README if needed
- [ ] Document any custom modifications made
- [ ] Add inline comments for complex logic

---

## Phase 6: Production Deployment

### 6.1 Pre-Deployment
- [ ] All tests passing in development
- [ ] Code reviewed by peer
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Database migration tested
- [ ] Rollback plan ready

### 6.2 Deployment Steps
- [ ] Backup production database
- [ ] Deploy code to staging
- [ ] Test in staging environment
- [ ] Apply migration to production database:
  ```bash
  psql production_db < supabase/migrations/20260210000001_add_property_contact_roles.sql
  ```
- [ ] Verify migration in production:
  ```bash
  psql production_db < supabase/migrations/20260210000002_verify_contact_roles_migration.sql
  ```
- [ ] Deploy code to production
- [ ] Monitor logs for errors
- [ ] Test with real property
- [ ] Send test approval email
- [ ] Send test notification email

### 6.3 Post-Deployment Monitoring (24 hours)
- [ ] Monitor error logs
- [ ] Check email delivery rates
- [ ] Verify no increase in failed sends
- [ ] Check for user-reported issues
- [ ] Monitor database performance
- [ ] Review email open rates (should be same or better)

---

## Phase 7: User Training (Optional)

### 7.1 Create Training Materials
- [ ] Video walkthrough of new UI
- [ ] Quick reference guide for roles
- [ ] FAQ document
- [ ] Best practices guide

### 7.2 User Communication
- [ ] Announce new feature to users
- [ ] Provide link to documentation
- [ ] Offer training sessions
- [ ] Set up support channel

---

## Rollback Plan (If Needed)

### If Issues Arise
- [ ] Document the issue clearly
- [ ] Attempt to fix forward if possible
- [ ] If unfixable, prepare for rollback

### Rollback Steps
- [ ] Notify team of rollback
- [ ] Revert code deployment
- [ ] Run rollback script:
  ```bash
  psql production_db < supabase/migrations/ROLLBACK_20260210000001.sql
  ```
- [ ] Verify rollback successful
- [ ] Confirm old functionality working
- [ ] Investigate root cause
- [ ] Fix issues in development
- [ ] Re-test and re-deploy

---

## Success Criteria

### Technical Success
- ✅ Migration applied without errors
- ✅ All tests passing
- ✅ Email sending works correctly
- ✅ To/CC/BCC populated correctly
- ✅ Deduplication working
- ✅ Secondary emails included
- ✅ Fallback logic working
- ✅ No regressions in existing features

### Business Success
- ✅ Email delivery rate maintained or improved
- ✅ Users can easily assign contact roles
- ✅ Email recipients clearly defined
- ✅ Reduced confusion about who receives emails
- ✅ Better organization of contacts
- ✅ Improved property management workflow

### User Feedback Success
- ✅ Positive feedback on new UI
- ✅ Fewer support requests about emails
- ✅ Users understand role system
- ✅ No complaints about broken functionality
- ✅ Increased adoption of secondary emails

---

## Final Sign-Off

- [ ] All checklist items completed
- [ ] Database migration successful
- [ ] Email sending working
- [ ] UI (if implemented) working
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Production deployment successful
- [ ] Monitoring shows no issues
- [ ] Users notified
- [ ] Support team trained

**Deployed By:** _______________  
**Date:** _______________  
**Version:** 1.0.0  
**Status:** ✅ Complete / ⏳ In Progress / ❌ Rolled Back

---

## Notes / Issues Encountered

```
(Add any notes, issues, or lessons learned during implementation)





```

---

## Follow-Up Tasks

- [ ] Monitor email delivery for 1 week
- [ ] Gather user feedback after 2 weeks
- [ ] Review analytics after 1 month
- [ ] Consider additional improvements based on feedback
- [ ] Update this checklist based on experience

---

**Keep this checklist for future reference and post-mortem analysis.**
