# Extra Charges Approval/Decline - Quick Reference Guide

## 🚀 Quick Start

### For Developers

```bash
# 1. Apply migrations
cd /path/to/project
supabase db push

# 2. Configure internal notification email
# Via SQL:
UPDATE email_configurations
SET default_bcc_emails = 'office@yourcompany.com'
WHERE id = (SELECT id FROM email_configurations LIMIT 1);

# 3. Deploy frontend
npm run build
# Deploy as usual
```

### For Office Staff

**What's New:**
- You'll now receive an email notification when Extra Charges are approved OR declined
- Job Details page shows a clear banner when Extra Charges are declined

**What Stays the Same:**
- Approval request emails look exactly the same
- Approval process works exactly as before

---

## 📧 Email Flow

### External Email (Property Owner)
```
Subject: Approval Required: Extra Charges for Job #1234

[Job Details]
[Extra Charges: $1,500.00]

[Approve Button] ← Existing behavior, no changes

I decline to approve these charges at this time ← NEW
```

### Internal Email (Office Staff)
```
Subject: Extra Charges Approved: Job #1234

Decision: APPROVED ✓
Job: #1234 - 123 Main St
Extra Charges: $1,500.00
Additional painting work
Decision Time: Dec 11, 2025 at 10:30 AM

[View Job Details]
```

---

## 🎯 Decision Outcomes

| Action | Job Phase | What Happens |
|--------|-----------|--------------|
| **Approve** | Pending Work Order → **Work Order** | ✓ Phase advances<br>✓ Internal email sent<br>✓ Job proceeds |
| **Decline** | Stays at **Pending Work Order** | ✗ Phase unchanged<br>✓ Internal email sent<br>✓ Decline notation shown |
| **Ignore** | Stays at **Pending Work Order** | ⏱️ Token expires in 7 days<br>⚠️ No notification |

---

## 🖥️ Job Details Display

### When Extra Charges Are Declined

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Extra Charges Declined                       │
│                                                 │
│ Extra Charges ($1,500.00) were declined        │
│ Additional painting work                        │
│ Declined on December 11, 2025 at 10:30 AM     │
└─────────────────────────────────────────────────┘
```

**Color**: Yellow/Amber background  
**Location**: Below pending approval banner in Extra Charges section  
**Visibility**: Only shown when status is 'declined'

---

## 🔧 Configuration

### Set Internal Notification Email

**Option 1: Via Database**
```sql
UPDATE email_configurations
SET default_bcc_emails = 'office@company.com'
WHERE id = (SELECT id FROM email_configurations LIMIT 1);
```

**Option 2: Via UI** (if EmailTemplateManager component is accessible)
1. Navigate to Email Settings
2. Find "Default BCC Emails" field
3. Enter: `office@company.com` (or multiple comma-separated)
4. Save

**Multiple Recipients:**
```sql
UPDATE email_configurations
SET default_bcc_emails = 'office@company.com,manager@company.com,accounting@company.com'
WHERE id = (SELECT id FROM email_configurations LIMIT 1);
```

---

## 🐛 Troubleshooting

### Problem: Decline button doesn't work

**Check:**
1. Browser console for errors
2. Token hasn't expired (`expires_at` in database)
3. Token hasn't been used already (`used_at IS NULL`)

**Fix:**
```sql
-- Check token status
SELECT token, used_at, expires_at, decision
FROM approval_tokens
WHERE token = 'YOUR_TOKEN_HERE';
```

### Problem: No internal notification received

**Check:**
1. Email configured in `email_configurations`
2. Email service is working
3. Check spam/junk folder

**Fix:**
```sql
-- Verify configuration
SELECT default_bcc_emails FROM email_configurations;

-- Should return: office@company.com (or your email)
```

### Problem: Declined notation not showing on Job Details

**Check:**
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Verify decision was recorded

**Fix:**
```sql
-- Check if decision was recorded
SELECT at.decision, at.decision_at, at.extra_charges_data
FROM approval_tokens at
WHERE at.job_id = YOUR_JOB_ID
  AND at.approval_type = 'extra_charges'
ORDER BY at.created_at DESC
LIMIT 1;
```

### Problem: Old approval links stopped working

**This should NOT happen** - the system is backward compatible.

**If it does:**
1. Check migration applied correctly
2. Verify RLS policies not broken
3. Review database logs

```sql
-- Check RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'approval_tokens';
```

---

## 📊 Database Queries

### Check Recent Decisions

```sql
SELECT 
  j.work_order_num,
  j.property_address,
  at.decision,
  at.decision_at,
  (at.extra_charges_data->>'amount')::numeric as amount,
  at.extra_charges_data->>'description' as description
FROM approval_tokens at
JOIN jobs j ON j.id = at.job_id
WHERE at.decision IS NOT NULL
  AND at.approval_type = 'extra_charges'
ORDER BY at.decision_at DESC
LIMIT 20;
```

### Check Pending Approvals

```sql
SELECT 
  j.work_order_num,
  j.property_address,
  at.created_at,
  at.expires_at,
  (at.extra_charges_data->>'amount')::numeric as amount
FROM approval_tokens at
JOIN jobs j ON j.id = at.job_id
WHERE at.used_at IS NULL
  AND at.expires_at > NOW()
  AND at.approval_type = 'extra_charges'
ORDER BY at.created_at DESC;
```

### Approval/Decline Statistics

```sql
SELECT 
  at.decision,
  COUNT(*) as count,
  SUM((at.extra_charges_data->>'amount')::numeric) as total_amount,
  AVG((at.extra_charges_data->>'amount')::numeric) as avg_amount
FROM approval_tokens at
WHERE at.approval_type = 'extra_charges'
  AND at.decision IS NOT NULL
GROUP BY at.decision;
```

---

## 🔐 Security Notes

- ✅ Tokens expire after 7 days
- ✅ Tokens can only be used once
- ✅ RLS policies protect token access
- ✅ Database functions use SECURITY DEFINER safely
- ✅ No sensitive data in URLs (only token)

---

## 📱 API Reference

### Process Approval Token

```typescript
const { data, error } = await supabase
  .rpc('process_approval_token', {
    p_token: tokenString
  });

// Response:
{
  success: true,
  message: "Approval processed successfully",
  job_id: 123,
  work_order_num: 1234,
  decision: "approved"
}
```

### Process Decline Token

```typescript
const { data, error } = await supabase
  .rpc('process_decline_token', {
    p_token: tokenString,
    p_decline_reason: "Optional reason" // nullable
  });

// Response:
{
  success: true,
  message: "Extra Charges declined",
  job_id: 123,
  work_order_num: 1234,
  decision: "declined"
}
```

### Fetch Approval Token Decision (for Job Details)

```typescript
const { data } = await supabase
  .from('approval_tokens')
  .select('decision, decision_at, extra_charges_data, decline_reason')
  .eq('job_id', jobId)
  .eq('approval_type', 'extra_charges')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

// Use data.decision to show UI:
if (data?.decision === 'declined') {
  // Show declined banner
}
```

---

## ✅ Testing Checklist

### Before Deploying to Production

- [ ] Migrations applied successfully
- [ ] Internal email configured
- [ ] Test approval (verify phase changes to "Work Order")
- [ ] Test decline (verify phase stays "Pending Work Order")
- [ ] Verify internal notification sent for approval
- [ ] Verify internal notification sent for decline
- [ ] Check Job Details shows declined notation
- [ ] Test expired token handling
- [ ] Test already-used token handling
- [ ] Verify backward compatibility (old approval links work)

### After Deploying to Production

- [ ] Monitor email delivery logs
- [ ] Check for any database errors in Supabase logs
- [ ] Verify first real approval/decline works as expected
- [ ] Confirm office staff receive notifications
- [ ] Check Job Details display on real jobs

---

## 📞 Support Contacts

**Technical Issues:**
- Check: `EXTRA_CHARGES_APPROVAL_DECLINE_IMPLEMENTATION_SUMMARY.md`
- Check: `docs/extra-charges-approval-decline-flow.md`

**Email Delivery Issues:**
- Verify Supabase Edge Function `send-email` is working
- Check `email_configurations` table
- Review email service logs

**Database Issues:**
- Check Supabase logs for errors
- Verify migrations applied: `supabase db migrations list`
- Review RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'approval_tokens'`

---

## 🎯 Key Takeaways

1. **Approval** = Job moves to "Work Order" ✓
2. **Decline** = Job stays at "Pending Work Order" ✗
3. **Both** send internal notification email 📧
4. **Declined** shows yellow banner on Job Details 🟨
5. **Backward Compatible** - old links still work ✅

---

*Quick Reference Guide - Last Updated: December 11, 2025*
