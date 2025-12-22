# Approval Workflow Implementation Guide
## November 17, 2025

## 🎯 Overview

This document outlines the complete implementation of the public approval workflow system, enabling non-authenticated users to approve/reject job-related requests via secure email links with image viewing capabilities.

---

## 📦 Files Created/Modified

### Database Migrations:
1. **`supabase/migrations/add_approval_token_system.sql`** - Complete token system
2. **`supabase/migrations/add_storage_policies_for_approval_images.sql`** - Storage policies

### Edge Functions:
3. **`supabase/functions/validate-approval-token/index.ts`** - Token validation
4. **`supabase/functions/process-approval/index.ts`** - Approval processing

### Frontend Components:
5. **`src/pages/PublicApprovalPage.tsx`** - Public approval interface
6. **`src/App.tsx`** - Added `/approve/:token` route

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migrations

```bash
# Navigate to project directory
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"

# Apply the approval token system migration
supabase db push
```

Or apply manually via Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/sql/new
2. Copy contents of `add_approval_token_system.sql`
3. Click "Run"

### Step 2: Configure Storage Bucket Policies

**Option A: Via Dashboard (Recommended)**
1. Navigate to: Storage > Policies
2. Select `job-images` bucket
3. Add policy: "Public can read via signed URLs"
   - Target roles: `public`, `anon`
   - Policy: SELECT
   - Expression: `bucket_id = 'job-images'`

**Option B: Via SQL**
- Run the contents of `add_storage_policies_for_approval_images.sql`

### Step 3: Deploy Edge Functions

```bash
# Deploy token validation function
supabase functions deploy validate-approval-token

# Deploy approval processing function
supabase functions deploy process-approval
```

### Step 4: Update Email Sending Logic

The email sending needs to be updated in these components to generate tokens and signed URLs:

**Components to Update:**
- `src/components/ExtraChargesForm.tsx`
- `src/components/SprinklerForm.tsx`
- `src/components/OtherChargesForm.tsx`

**Changes needed in each:**
1. Generate signed URLs for selected images
2. Use new approval link format: `/approve/{token}`
3. Include clickable image thumbnails in email

---

## 🔧 Key Features Implemented

### 1. **Token-Based Security**
✅ Unique UUID tokens for each approval request  
✅ 30-day expiration (configurable)  
✅ One-time use (prevents replay attacks)  
✅ IP address and user agent logging  

### 2. **Row Level Security (RLS)**
✅ Public can view approvals with valid token  
✅ Public can update approval status with valid token  
✅ Public can view related job data via token  
✅ Public can view job images via token  

### 3. **Storage Access**
✅ Public read access via signed URLs  
✅ 72-hour signed URL expiration  
✅ Authenticated users retain full upload/delete access  

### 4. **Public Approval Page**
✅ No authentication required  
✅ Token validation before showing content  
✅ Job details display  
✅ Image gallery with full-size viewing  
✅ Approve/Reject buttons  
✅ Optional notes field  
✅ Responsive design (mobile-friendly)  

### 5. **Email Notifications**
✅ Requester notified after approval/rejection  
✅ Professional email templates  
✅ Status-specific messaging  

---

## 📋 Testing Checklist

### Database Testing:
- [ ] Verify `approval_token` column exists in `approvals` table
- [ ] Verify tokens auto-generate on new approvals
- [ ] Test `validate_approval_token()` function
- [ ] Test `process_public_approval()` function
- [ ] Verify RLS policies allow public access with valid token
- [ ] Verify RLS policies block access without token

### Storage Testing:
- [ ] Test signed URL generation for images
- [ ] Verify signed URLs work without authentication
- [ ] Test signed URL expiration
- [ ] Verify public cannot upload/delete images

### Edge Function Testing:
- [ ] Test validate-approval-token endpoint
- [ ] Test with valid token
- [ ] Test with invalid token
- [ ] Test with expired token
- [ ] Test process-approval endpoint
- [ ] Test approve action
- [ ] Test reject action
- [ ] Verify notification emails sent

### Frontend Testing:
- [ ] Access `/approve/{valid-token}` - should load
- [ ] Access `/approve/{invalid-token}` - should show error
- [ ] Verify job details display correctly
- [ ] Verify images load and display
- [ ] Click image - should open in new window
- [ ] Click "Approve" - should process successfully
- [ ] Click "Reject" - should process successfully
- [ ] Verify already-processed tokens show correct status
- [ ] Test on mobile devices
- [ ] Test in different browsers

### Email Testing:
- [ ] Update email templates with new approval links
- [ ] Test email sending with images
- [ ] Verify approval link works from email
- [ ] Verify image thumbnails are clickable
- [ ] Verify images load in email client
- [ ] Test on multiple email clients (Gmail, Outlook, Apple Mail)

---

## 🔐 Security Considerations

### Implemented:
✅ Time-limited tokens (30 days)  
✅ One-time use tokens  
✅ Signed URLs for storage (72 hours)  
✅ IP logging for audit trail  
✅ User agent tracking  
✅ No sensitive data in URLs  
✅ CORS protection on Edge Functions  

### Additional Recommendations:
⚠️ Consider rate limiting on approval endpoints  
⚠️ Monitor for token enumeration attempts  
⚠️ Regular audit of used vs unused tokens  
⚠️ Alert on suspicious approval patterns  

---

## 📧 Email Template Integration

### Current Flow:
1. User fills Extra Charges/Sprinkler/Other form
2. Selects images to include
3. Clicks "Send for Approval"

### New Flow (To Implement):
1. User fills form and selects images
2. System creates approval record (token auto-generated)
3. System generates signed URLs for selected images (72hr expiry)
4. System constructs email with:
   - Approval details
   - Clickable image thumbnails
   - "Approve" button → `/approve/{token}`
   - "Reject" button → `/approve/{token}` (pre-filled)
5. Email sent to recipient
6. Recipient clicks link → Public Approval Page
7. Recipient reviews and approves/rejects
8. System processes action and notifies requester

### Email HTML Template Example:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Approval Request: Extra Charges</h2>
  
  <p>Hello,</p>
  <p>A new approval request requires your attention:</p>
  
  <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <strong>Property:</strong> Sunset Village<br>
    <strong>Unit:</strong> 12A<br>
    <strong>Amount:</strong> $350.00<br>
    <strong>Description:</strong> Additional painting required
  </div>
  
  <h3>Images:</h3>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
    <a href="{{signedUrl1}}" target="_blank">
      <img src="{{signedUrl1}}" style="width: 100%; border-radius: 4px;" />
    </a>
    <a href="{{signedUrl2}}" target="_blank">
      <img src="{{signedUrl2}}" style="width: 100%; border-radius: 4px;" />
    </a>
  </div>
  
  <div style="margin-top: 24px;">
    <a href="{{approvalUrl}}" 
       style="display: inline-block; background: #10b981; color: white; 
              padding: 12px 24px; text-decoration: none; border-radius: 6px; 
              font-weight: bold;">
      Review & Approve
    </a>
  </div>
  
  <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
    This link expires in 30 days. Images are available for 72 hours.
  </p>
</div>
```

---

## 🔄 Rollback Procedure

If issues occur, revert to the backup commit:

```bash
git reset --hard 6ae62a1
git push --force origin main

# Revert database changes
# Run in Supabase SQL Editor:
DROP FUNCTION IF EXISTS validate_approval_token;
DROP FUNCTION IF EXISTS process_public_approval;
DROP FUNCTION IF EXISTS generate_approval_token;
DROP TRIGGER IF EXISTS trg_generate_approval_token ON approvals;

ALTER TABLE approvals DROP COLUMN IF EXISTS approval_token;
ALTER TABLE approvals DROP COLUMN IF EXISTS token_expires_at;
ALTER TABLE approvals DROP COLUMN IF EXISTS token_used;
ALTER TABLE approvals DROP COLUMN IF EXISTS approval_ip_address;
ALTER TABLE approvals DROP COLUMN IF EXISTS approval_user_agent;
```

---

## 📊 Monitoring & Maintenance

### Metrics to Track:
- Token generation rate
- Token usage rate  
- Expired vs used tokens
- Average time to approval
- Approval vs rejection rate
- Failed approval attempts

### Recommended Queries:

```sql
-- Check token usage stats
SELECT 
  COUNT(*) as total_tokens,
  SUM(CASE WHEN token_used THEN 1 ELSE 0 END) as used_tokens,
  SUM(CASE WHEN token_expires_at < NOW() THEN 1 ELSE 0 END) as expired_tokens
FROM approvals
WHERE approval_token IS NOT NULL;

-- Recent approvals via token
SELECT 
  approval_type,
  status,
  approved_at,
  approval_ip_address
FROM approvals
WHERE token_used = TRUE
  AND approved_at > NOW() - INTERVAL '7 days'
ORDER BY approved_at DESC;
```

---

## ✅ Success Criteria

The implementation is successful when:

1. ✅ Non-authenticated users can access approval page via email link
2. ✅ Job details display correctly on public approval page
3. ✅ Images load and can be viewed full-size
4. ✅ Approve/Reject actions work correctly
5. ✅ Tokens expire after specified time
6. ✅ Used tokens cannot be reused
7. ✅ Requester receives notification after approval/rejection
8. ✅ System logs IP and user agent for audit trail
9. ✅ Mobile responsive and works across email clients
10. ✅ No authentication required throughout process

---

## 🎓 Next Steps

After deployment and testing:

1. **Update Documentation** - Add to user manual
2. **Train Users** - Show how to send approval requests
3. **Monitor Usage** - Track metrics for first 2 weeks
4. **Gather Feedback** - Get input from approvers and requesters
5. **Optimize** - Adjust token expiration times based on usage
6. **Enhance** - Consider additional approval types

---

## 📞 Support

If you encounter issues during implementation:

1. Check Supabase logs for Edge Function errors
2. Verify RLS policies are active
3. Test storage bucket access
4. Confirm environment variables are set
5. Review browser console for frontend errors

**Created:** November 17, 2025  
**Version:** 1.0  
**Status:** Ready for Deployment
