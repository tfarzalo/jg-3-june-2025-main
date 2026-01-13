# Approval Workflow Deployment Guide
**Date:** November 17, 2025  
**Purpose:** Deploy the complete public approval workflow system

---

## 🎯 Pre-Deployment Checklist

Before starting, ensure you have:
- [ ] Supabase database password
- [ ] Access to Supabase Dashboard
- [ ] Zoho email credentials (admin@jgpaintingprosinc.com)
- [ ] This workspace open in VS Code
- [ ] Development server running (for testing)

---

## 📋 Deployment Steps

### Step 1: Apply Database Migration

**Option A: Using Supabase CLI (Recommended)**
```bash
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"
supabase db push
```

**Option B: Manual SQL in Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Copy the entire contents of `supabase/migrations/add_approval_token_system.sql`
5. Paste and run the SQL
6. Verify no errors

**Verification:**
```sql
-- Run this in Supabase SQL Editor to verify
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'approvals' 
  AND column_name IN ('approval_token', 'token_expires_at', 'token_used');
```

You should see 3 rows returned.

---

### Step 2: Deploy Edge Functions

```bash
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"

# Deploy the email sending function
supabase functions deploy send-email

# Deploy the token validation function
supabase functions deploy validate-approval-token

# Verify deployment
supabase functions list
```

**Expected output:**
```
send-email (deployed)
validate-approval-token (deployed)
create-user (deployed)
```

---

### Step 3: Configure Email Secrets

1. Go to Supabase Dashboard → Your Project
2. Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
3. Add these secrets:

```
ZOHO_EMAIL=admin@jgpaintingprosinc.com
ZOHO_PASSWORD=<your-zoho-app-password>
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=587
```

**To get Zoho app password:**
1. Log in to Zoho Mail
2. Go to Settings → Security → App Passwords
3. Generate new app password for "Supabase Email Service"
4. Copy the password (you won't see it again!)

---

### Step 4: Configure Storage Bucket for Public Access

Run this SQL in Supabase SQL Editor:

```sql
-- Enable public access for job-images bucket (via signed URLs only)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'job-images';

-- Verify
SELECT id, name, public FROM storage.buckets WHERE id = 'job-images';
```

Expected result: `public = true`

---

### Step 5: Test the System

#### Test 1: Verify Migration
```sql
-- Get an existing approval token
SELECT 
  id,
  job_id,
  approval_type,
  status,
  approval_token,
  token_expires_at,
  token_used
FROM approvals
LIMIT 5;
```

You should see `approval_token` values (UUIDs).

#### Test 2: Test Public Approval Page
1. Copy any `approval_token` from the query above
2. Open in your browser:
   ```
   http://localhost:5173/approve/{paste-token-here}
   ```
3. Page should load WITHOUT requiring login
4. You should see job details and images

#### Test 3: Test Email Function
Run this in your terminal:

```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/send-email' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-test-email@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1><p>This is a test email.</p>"
  }'
```

Check if email arrives in your inbox.

---

### Step 6: Update Frontend to Use New System

The code updates have already been prepared. This step integrates the approval token system into the existing email modals.

**Files that need NO changes:**
- ✅ `src/pages/PublicApprovalPage.tsx` (already created)
- ✅ `src/App.tsx` (route already added)
- ✅ Database migration (already created)
- ✅ Edge functions (already created)

**Files that ARE ALREADY USING the old system:**
- ⚠️ `src/components/EnhancedPropertyNotificationModal.tsx` (uses `approval_tokens` table)
- ⚠️ `src/pages/ApprovalPage.tsx` (uses `approval_tokens` table)

**Decision needed:**
Do you want to:
1. **Option A:** Keep both systems (old `approval_tokens` + new `approvals` with tokens)
2. **Option B:** Migrate everything to use the new `approvals` table system
3. **Option C:** Just add token support to existing `approvals` table and update modals

**I recommend Option C** - it's the safest and requires minimal changes.

---

### Step 7: Verify End-to-End Flow

1. **Create a job** that requires approval
2. **Send approval email** via EnhancedPropertyNotificationModal
3. **Check database** for approval token:
   ```sql
   SELECT * FROM approvals WHERE job_id = 'your-job-id' ORDER BY created_at DESC LIMIT 1;
   ```
4. **Check email** - should receive approval request
5. **Click approval link** in email - should open `/approve/{token}`
6. **View job and images** - should load without login
7. **Approve or Reject** - should update database
8. **Verify token marked as used**:
   ```sql
   SELECT token_used, status FROM approvals WHERE approval_token = 'your-token';
   ```

---

## 🔧 Troubleshooting

### Migration Fails
**Error:** "column already exists"
**Solution:** Migration was already applied, skip to next step

### Email Not Sending
**Check:**
1. Secrets are set correctly in Supabase Dashboard
2. Zoho password is an "App Password", not your regular password
3. Check Edge Function logs in Supabase Dashboard

### Images Not Loading
**Check:**
1. Storage bucket is set to `public = true`
2. RLS policies allow public read via valid tokens
3. Images exist in `job-images` bucket

### Token Validation Failing
**Check:**
1. Token hasn't expired (30 days default)
2. Token hasn't been used already (`token_used = false`)
3. RLS policies are correctly set

---

## 🚨 Rollback Plan

If something goes wrong, you can revert:

### Rollback Step 1: Remove Token Columns
```sql
-- Run in Supabase SQL Editor
ALTER TABLE approvals DROP COLUMN IF EXISTS approval_token;
ALTER TABLE approvals DROP COLUMN IF EXISTS token_expires_at;
ALTER TABLE approvals DROP COLUMN IF EXISTS token_used;
ALTER TABLE approvals DROP COLUMN IF EXISTS approval_ip_address;
ALTER TABLE approvals DROP COLUMN IF EXISTS approval_user_agent;

DROP FUNCTION IF EXISTS validate_approval_token;
DROP FUNCTION IF EXISTS process_public_approval;
DROP FUNCTION IF EXISTS generate_approval_token;
```

### Rollback Step 2: Remove RLS Policies
```sql
DROP POLICY IF EXISTS "Public can view approvals with valid token" ON approvals;
DROP POLICY IF EXISTS "Public can update approvals with valid token" ON approvals;
DROP POLICY IF EXISTS "Public can view jobs via approval token" ON jobs;
DROP POLICY IF EXISTS "Public can view job images via approval token" ON job_images;
```

### Rollback Step 3: Restore Storage Bucket
```sql
UPDATE storage.buckets 
SET public = false 
WHERE id = 'job-images';
```

### Rollback Step 4: Git Restore (if code was changed)
```bash
git log --oneline -10  # Find the commit before changes
git reset --hard <commit-hash>
```

---

## ✅ Success Criteria

Deployment is successful when:
- [ ] Migration applied without errors
- [ ] Token columns exist in `approvals` table
- [ ] Edge functions are deployed
- [ ] Email secrets are configured
- [ ] Test email sends successfully
- [ ] Public approval page loads without login
- [ ] Images display correctly
- [ ] Approval/rejection works
- [ ] Token marked as used after action
- [ ] No console errors

---

## 📊 Current vs. Desired State

### Before Deployment
- ❌ Approval tokens not in database
- ❌ Public can't access approval pages
- ❌ Images not accessible publicly
- ❌ Emails may not have working links

### After Deployment
- ✅ Approval tokens auto-generated
- ✅ Public can approve via unique links
- ✅ Images visible in approval page
- ✅ Emails contain working approval links
- ✅ Secure, time-limited access
- ✅ Single-use tokens prevent replay attacks

---

## 📞 Support

If you encounter issues:
1. Check Supabase Dashboard → Logs
2. Check browser console for errors
3. Verify all secrets are set
4. Test with simple curl requests first
5. Review this checklist again

---

## Next Steps After Deployment

1. **Monitor** approval workflow for 24-48 hours
2. **Gather feedback** from users
3. **Optimize** email templates if needed
4. **Add analytics** (optional)
5. **Document** for team members

**Estimated deployment time:** 30-60 minutes
