# Extra Charges Approval/Decline - Deployment Checklist

**Feature:** Extra Charges Approval/Decline Workflow Enhancement  
**Date:** December 11, 2025  
**Status:** Ready for Production Deployment

---

## ✅ Pre-Deployment Checklist

### Code Review
- [x] All files changed are documented
- [x] No destructive database changes
- [x] Backward compatibility verified
- [x] Error handling implemented
- [x] UI/UX matches existing design system
- [x] Code follows project conventions
- [x] Comments and documentation added
- [x] Test files created

### Files Changed (8 files)
- [x] `supabase/migrations/20251211000001_add_extra_charges_approval_decline.sql`
- [x] `supabase/migrations/20251211000002_add_internal_notification_emails.sql`
- [x] `src/pages/ApprovalPage.tsx`
- [x] `src/components/JobDetails.tsx`
- [x] `src/utils/sendInternalApprovalNotification.ts`
- [x] `docs/extra-charges-approval-decline-flow.md`
- [x] `tests/extra-charges-approval-decline.test.ts`
- [x] `EXTRA_CHARGES_APPROVAL_DECLINE_IMPLEMENTATION_SUMMARY.md`

---

## 🗄️ Database Migration Steps

### Step 1: Backup Current Database (CRITICAL)

```bash
# Via Supabase CLI
supabase db dump -f backup_before_approval_decline_$(date +%Y%m%d).sql

# Or via psql
pg_dump [connection-string] > backup_before_approval_decline_$(date +%Y%m%d).sql
```

**Verification:**
```bash
# Check backup file exists and has content
ls -lh backup_before_approval_decline_*.sql
```

### Step 2: Test Migration on Development/Staging

```bash
# Switch to dev/staging environment
supabase link --project-ref [dev-project-ref]

# Apply migrations
supabase db push

# Or manually:
psql [dev-connection-string] -f supabase/migrations/20251211000001_add_extra_charges_approval_decline.sql
psql [dev-connection-string] -f supabase/migrations/20251211000002_add_internal_notification_emails.sql
```

**Verification:**
```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'approval_tokens'
  AND column_name IN ('decision', 'decision_at', 'decline_reason');

-- Should return 3 rows

-- Check new function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'process_decline_token';

-- Should return 1 row

-- Check updated function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'process_approval_token';

-- Should return 1 row
```

### Step 3: Apply Migration to Production

```bash
# Switch to production environment
supabase link --project-ref [prod-project-ref]

# Apply migrations
supabase db push

# Or manually:
psql [prod-connection-string] -f supabase/migrations/20251211000001_add_extra_charges_approval_decline.sql
psql [prod-connection-string] -f supabase/migrations/20251211000002_add_internal_notification_emails.sql
```

**Verification (same as Step 2):**
```sql
-- Verify schema changes
SELECT column_name FROM information_schema.columns
WHERE table_name = 'approval_tokens'
  AND column_name IN ('decision', 'decision_at', 'decline_reason');

-- Verify functions
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('process_approval_token', 'process_decline_token');
```

### Step 4: Configure Internal Notification Email

```sql
-- Set internal notification email
UPDATE email_configurations
SET default_bcc_emails = 'office@yourcompany.com'
WHERE id = (SELECT id FROM email_configurations LIMIT 1);

-- Verify
SELECT default_bcc_emails FROM email_configurations;
```

**Expected Output:**
```
default_bcc_emails
-------------------
office@yourcompany.com
```

---

## 🚀 Frontend Deployment Steps

### Step 1: Build and Test Locally

```bash
# Install dependencies (if needed)
npm install

# Build
npm run build

# Test build
npm run preview # or npm start
```

**Manual Testing:**
1. Navigate to an approval link
2. Verify approve button works
3. Verify decline link appears below approve button
4. Click decline and verify success message
5. Navigate to Job Details
6. Verify declined notation appears (if applicable)

### Step 2: Deploy to Staging/Preview

```bash
# Deploy to staging environment
# (Your deployment command here)
git push staging main

# Or via Vercel/Netlify preview
vercel --prod # or netlify deploy --prod
```

**Verification:**
- [ ] Visit staging URL
- [ ] Test approval flow
- [ ] Test decline flow
- [ ] Check Job Details page
- [ ] Verify internal notification sent

### Step 3: Deploy to Production

```bash
# Deploy to production
git push production main

# Or via hosting platform
vercel --prod # or netlify deploy --prod
```

**Verification:**
- [ ] Visit production URL
- [ ] Smoke test: navigate to a job with Extra Charges
- [ ] Verify no console errors
- [ ] Check that existing approval links still work

---

## 🧪 Post-Deployment Testing

### Immediate Testing (within 1 hour)

#### Test 1: Approval Flow (Existing Behavior)
```
1. Create a test job with Extra Charges
2. Send approval email
3. Open approval link
4. Click "Approve" button
5. Verify success message
6. Check Job Details:
   - ✓ Phase should be "Work Order"
   - ✓ No declined notation
7. Check email:
   - ✓ Internal notification received
   - ✓ Subject: "Extra Charges Approved: Job #[WO#]"
```

**Expected Result:** ✅ Approval works as before + internal notification sent

#### Test 2: Decline Flow (New Behavior)
```
1. Create a test job with Extra Charges
2. Send approval email
3. Open approval link
4. Click "I decline to approve these charges at this time"
5. Verify success message: "Extra Charges Declined Successfully!"
6. Check Job Details:
   - ✓ Phase should still be "Pending Work Order"
   - ✓ Yellow banner: "Extra Charges Declined"
   - ✓ Shows amount and date
7. Check email:
   - ✓ Internal notification received
   - ✓ Subject: "Extra Charges Declined: Job #[WO#]"
```

**Expected Result:** ✅ Decline works, phase unchanged, notification sent

#### Test 3: Backward Compatibility
```
1. Find an old approval link (if available)
2. Click the link
3. Verify approval page loads
4. Click "Approve"
5. Verify it still works
```

**Expected Result:** ✅ Old links still work

#### Test 4: Error Handling
```
1. Use an expired token
2. Verify error message displayed
3. Use an already-used token
4. Verify error message displayed
```

**Expected Result:** ✅ Graceful error messages

### Extended Testing (within 24 hours)

- [ ] Monitor Supabase logs for errors
- [ ] Check email delivery logs
- [ ] Verify no spike in error rates
- [ ] Confirm office staff receive notifications
- [ ] Test with real Extra Charges approvals/declines
- [ ] Verify Job Details displays correctly for all jobs

---

## 📊 Monitoring

### Key Metrics to Monitor

1. **Database Errors**
   - Check Supabase logs for function errors
   - Monitor RLS policy violations

2. **Email Delivery**
   - Track internal notification success rate
   - Monitor bounce/failure rates

3. **User Experience**
   - No increase in support tickets
   - Approval/decline response times

4. **System Performance**
   - Database query times
   - Page load times for Job Details

### Monitoring Commands

```sql
-- Check recent decisions
SELECT decision, COUNT(*) 
FROM approval_tokens 
WHERE decision IS NOT NULL 
GROUP BY decision;

-- Check failed internal notifications (if logged)
SELECT * FROM email_logs
WHERE email_type = 'internal_approval_notification'
  AND status = 'failed'
ORDER BY created_at DESC;

-- Check approval token usage
SELECT 
  COUNT(*) FILTER (WHERE used_at IS NULL AND expires_at > NOW()) as pending,
  COUNT(*) FILTER (WHERE decision = 'approved') as approved,
  COUNT(*) FILTER (WHERE decision = 'declined') as declined,
  COUNT(*) FILTER (WHERE used_at IS NULL AND expires_at < NOW()) as expired
FROM approval_tokens
WHERE approval_type = 'extra_charges';
```

---

## 🔄 Rollback Plan

### If Critical Issues Arise

#### Option 1: Revert Database Changes (Quick)

```sql
-- Revert to previous functions (before enhancement)
-- This keeps new columns but removes new functionality

-- Drop new decline function
DROP FUNCTION IF EXISTS process_decline_token(VARCHAR, TEXT);

-- Revert approval function to previous version
-- (Use backup of previous function definition)
-- NOTE: This is complex - prefer Option 2

-- Remove new columns (last resort)
ALTER TABLE approval_tokens
  DROP COLUMN IF EXISTS decision,
  DROP COLUMN IF EXISTS decision_at,
  DROP COLUMN IF EXISTS decline_reason;
```

#### Option 2: Restore from Backup (Safe)

```bash
# Restore database from backup
psql [connection-string] < backup_before_approval_decline_[date].sql

# Redeploy previous frontend version
git revert HEAD
git push production main
```

#### Option 3: Quick Fix (Preferred)

If issue is with frontend only:
```bash
# Disable decline button via feature flag or quick patch
# Keep database changes (they're non-destructive)
```

If issue is with email notifications:
```sql
-- Temporarily disable internal notifications
UPDATE email_configurations
SET default_bcc_emails = NULL;
-- This will skip email sending but keep core workflow working
```

---

## 📋 Post-Deployment Verification Checklist

### Within 1 Hour of Deployment

- [ ] Database migrations applied successfully
- [ ] No database errors in Supabase logs
- [ ] Frontend deployed and accessible
- [ ] No console errors on approval page
- [ ] No console errors on Job Details page
- [ ] Test approval works (creates "Work Order" phase)
- [ ] Test decline works (keeps "Pending Work Order" phase)
- [ ] Internal notification email sent for approval
- [ ] Internal notification email sent for decline
- [ ] Declined notation shows on Job Details
- [ ] Old approval links still work

### Within 24 Hours of Deployment

- [ ] Monitor email delivery success rate
- [ ] Check for any support tickets related to approvals
- [ ] Verify real Extra Charges approvals work
- [ ] Verify real Extra Charges declines work
- [ ] Confirm office staff receive and understand notifications
- [ ] Check database for any unexpected errors
- [ ] Verify system performance unchanged

### Within 1 Week of Deployment

- [ ] Collect feedback from office staff
- [ ] Review approval/decline statistics
- [ ] Identify any edge cases or issues
- [ ] Update documentation if needed
- [ ] Plan any refinements or enhancements

---

## 🎯 Success Criteria

### Must Have (Blocking Issues)
✅ Approvals work as before (no regression)  
✅ Job phase changes correctly on approval  
✅ Job phase stays correct on decline  
✅ No database errors  
✅ No breaking changes to existing workflows  

### Should Have (High Priority)
✅ Internal notifications delivered  
✅ Declined notation displays on Job Details  
✅ Decline button accessible and clear  
✅ Error handling graceful  

### Nice to Have (Low Priority)
✅ Email templates well-formatted  
✅ UI animations smooth  
✅ Mobile responsive  

---

## 🆘 Emergency Contacts

**Database Issues:**
- Check: Supabase Dashboard → Logs
- Action: Apply rollback if critical

**Frontend Issues:**
- Check: Browser console, Network tab
- Action: Redeploy previous version

**Email Issues:**
- Check: Email service logs
- Action: Temporarily disable via `default_bcc_emails = NULL`

**Unknown Issues:**
- Check: `EXTRA_CHARGES_APPROVAL_DECLINE_IMPLEMENTATION_SUMMARY.md`
- Check: `docs/extra-charges-approval-decline-flow.md`
- Check: `EXTRA_CHARGES_APPROVAL_DECLINE_QUICK_REFERENCE.md`

---

## 📝 Deployment Sign-Off

### Pre-Deployment Sign-Off

- [ ] Code reviewed by: _______________
- [ ] Testing completed by: _______________
- [ ] Documentation reviewed by: _______________
- [ ] Deployment plan approved by: _______________

**Date:** _______________  
**Time:** _______________

### Post-Deployment Sign-Off

- [ ] Migrations applied successfully: _______________
- [ ] Frontend deployed successfully: _______________
- [ ] Testing completed successfully: _______________
- [ ] No critical issues identified: _______________

**Date:** _______________  
**Time:** _______________  
**Deployed by:** _______________

---

## 🎉 Deployment Complete!

Once all checklist items are complete, the Extra Charges Approval/Decline feature is live and ready for use.

**Next Steps:**
1. Monitor for 24 hours
2. Collect user feedback
3. Document any issues or improvements
4. Plan next iteration if needed

---

*Deployment Checklist - Created: December 11, 2025*
