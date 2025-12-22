# Quick Testing Guide - Approval Email System

## 🚀 Quick Start Testing (5 Minutes)

### Prerequisites:
- Application running locally or on staging
- Access to Email Template Manager
- Test job with extra charges in database
- Access to a test email account

---

## Test Flow (Step by Step)

### Step 1: Verify Old Modal is Gone ✅
```bash
# This should return "File does not exist"
ls src/components/ApprovalEmailModal.tsx
```
**Expected:** File not found ✅ (Already verified)

---

### Step 2: Check Template Variables

1. Navigate to **Email Template Manager** in your app
2. Look for the "Template Variables" section
3. **Verify these variables exist:**
   - `{{approval_button}}`
   - `{{job_images}}`
   - `{{extra_charges_table}}`
   - `{{job_details_table}}`

**Screenshot:** Save a screenshot showing all variables listed

---

### Step 3: Create Test Template

1. In Email Template Manager, click **"Create New Template"**
2. Fill in:
   - **Name:** "Test Approval Email"
   - **Type:** "Approval Request"
   - **Trigger Phase:** "Extra Charges Only"
   - **Subject:** 
     ```
     Action Required: Approve Extra Charges for {{property_name}} Unit {{unit_number}}
     ```
   - **Body:**
     ```html
     <h2>Hello {{ap_contact_name}},</h2>
     
     <p>We have completed additional work that requires your approval.</p>
     
     {{job_details_table}}
     
     {{extra_charges_table}}
     
     {{job_images}}
     
     {{approval_button}}
     
     <p>Thank you,<br>JG Painting Pros Inc.</p>
     ```
3. Enable **"Auto Include Photos"**
4. Select photo types: **Before, After**
5. Click **"Save Template"**

---

### Step 4: Send Test Approval Email

1. Find a job with extra charges
2. Click **"Send Approval Email"** (or equivalent button)
3. Select the template you just created
4. Select 2-3 job images (before/after photos)
5. Enter your test email address
6. Click **"Preview"** first:
   - ✅ Green button visible?
   - ✅ Button text is white?
   - ✅ Images appear as thumbnails?
   - ✅ Tables formatted correctly?
7. If preview looks good, click **"Send"**

---

### Step 5: Check Email

1. Open your test email inbox
2. Find the approval email
3. **Verify:**
   - ✅ Subject line correct with property/unit info
   - ✅ Green approval button stands out
   - ✅ Button text: "✅ APPROVE CHARGES" in white
   - ✅ Images appear and are clickable
   - ✅ Extra charges table shows hours and cost
   - ✅ Job details table shows all info
4. **Take screenshots** in different views:
   - Desktop view
   - Mobile view (if possible)

---

### Step 6: Test Approval Flow

1. In the email, click the green **"APPROVE CHARGES"** button
2. **Verify you're redirected** to an approval page
3. **Verify the page shows:**
   - Job details
   - Extra charges breakdown
   - Property information
   - Final approval button
4. Click the final **"Approve"** button
5. **Verify:**
   - ✅ Success message appears
   - ✅ Page shows "Approved" status

---

### Step 7: Verify Job Status Changed

1. Go back to the main app
2. Find the job you just approved
3. **Verify:**
   - ✅ Job phase changed to **"Work Order"**
   - ✅ Job shows as approved in UI

---

### Step 8: Verify Notifications

1. Check the notification bell in top bar
2. **Verify notifications appear:**
   - "Extra Charges Approved" notification
   - "Job Phase Changed" notification
3. Click notification
4. **Verify:** It navigates to the correct job

---

## 🧪 Advanced Testing (Optional)

### Test Edge Cases:

#### Test A: Email with No Images
1. Send approval email but **don't select any images**
2. Verify email still looks good without images section
3. Verify no broken layout or "undefined" text

#### Test B: Expired Token
1. Find an old approval email (or manually expire token in DB)
2. Click approval button
3. Verify error message: "Invalid or expired approval token"

#### Test C: Already Used Token
1. Complete an approval (Steps 6-7)
2. Try to click the same approval link again
3. Verify error message: "This approval link has already been used"

---

## ✅ Success Criteria

All of these should be TRUE:

- [ ] ApprovalEmailModal.tsx file is deleted
- [ ] Template Manager shows all new shortcodes
- [ ] Created template saves successfully
- [ ] Email sends successfully
- [ ] Email received with correct formatting
- [ ] Green button is visible and styled correctly
- [ ] Button text is white and readable
- [ ] Images are clickable and open full-size
- [ ] Tables are formatted and show correct data
- [ ] Clicking approve button redirects to approval page
- [ ] Approval page shows job details correctly
- [ ] Completing approval updates job to "Work Order" phase
- [ ] Notifications appear for admin/management users
- [ ] Edge cases handled gracefully (no crashes)

---

## 🐛 If Something Goes Wrong

### Issue: Template variables not showing
**Check:** 
- Refresh the Email Template Manager page
- Check browser console for errors
- Verify code changes were saved and app restarted

### Issue: Email not sending
**Check:**
- Email configuration in database (email_configurations table)
- Check browser console for errors
- Verify Supabase connection

### Issue: Images not appearing
**Check:**
- Images exist in Supabase storage
- Bucket is publicly accessible
- File paths are correct
- Check browser network tab for 404 errors

### Issue: Approval button not working
**Check:**
- Token was created in database (approval_tokens table)
- Token hasn't expired
- Token hasn't been used
- Database function `process_approval_token` exists

### Issue: Job status not changing
**Check:**
- Database function executed successfully
- User has permission to update jobs
- Check Supabase logs for errors

---

## 📊 Test Results Template

Copy this and fill in your results:

```
## Test Results - [Date]

### Email Template Creation:
- Template created: ✅/❌
- Variables visible: ✅/❌
- Template saved: ✅/❌

### Email Sending:
- Email sent: ✅/❌
- Email received: ✅/❌
- Formatting correct: ✅/❌

### Visual Elements:
- Green button: ✅/❌
- White button text: ✅/❌
- Clickable images: ✅/❌
- Tables formatted: ✅/❌

### Approval Flow:
- Button redirects: ✅/❌
- Approval page loads: ✅/❌
- Approval completes: ✅/❌
- Job status updates: ✅/❌
- Notifications created: ✅/❌

### Edge Cases:
- No images handled: ✅/❌
- Expired token handled: ✅/❌
- Used token handled: ✅/❌

### Browser Testing:
- Chrome: ✅/❌
- Firefox: ✅/❌
- Safari: ✅/❌
- Mobile: ✅/❌

### Email Client Testing:
- Gmail Web: ✅/❌
- Gmail Mobile: ✅/❌
- Outlook Web: ✅/❌
- Apple Mail: ✅/❌

### Notes:
[Add any observations, issues, or feedback here]

### Screenshots:
- [ ] Email Template Manager with variables
- [ ] Email preview
- [ ] Received email (desktop)
- [ ] Received email (mobile)
- [ ] Approval page
- [ ] Updated job status
- [ ] Notifications

### Overall Result: PASS ✅ / FAIL ❌
```

---

## 🎯 Expected Timeline

- **Basic Testing (Steps 1-8):** 10-15 minutes
- **Advanced Testing:** 5-10 minutes
- **Browser Testing:** 10-15 minutes
- **Email Client Testing:** 15-20 minutes
- **Total:** ~45-60 minutes for comprehensive testing

---

## 📞 Need Help?

If you encounter any issues during testing:

1. Check the browser console for errors
2. Check Supabase logs
3. Review APPROVAL_EMAIL_SYSTEM_STATUS.md troubleshooting section
4. Check database for:
   - approval_tokens table
   - email_configurations table
   - job_images table

---

**Good luck with testing! 🚀**
