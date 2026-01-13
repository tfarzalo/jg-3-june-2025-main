# 📧 Configuring Internal Notification Emails for Extra Charges Approval/Decline

## Where to Add the Internal Notification Email Address

When property owners **approve** or **decline** Extra Charges, your team needs to be notified immediately. Here's how to configure who receives these notifications:

---

## 📍 Location: Email Settings (Email Template Manager)

### Step-by-Step Instructions:

1. **Navigate to Email Settings**
   - Go to the **Admin Settings** area
   - Click on **Email Templates** or **Email Settings**
   - You'll see the Email Template Manager page

2. **Find the Email Configuration Section**
   - At the **top** of the page, you'll see a section titled **"Email Configuration"**
   - Look for the blue info banner that says: *"Extra Charges Approval/Decline Notifications"*

3. **Locate "Internal Notification Emails (Default BCC)"**
   - This is the field where you configure who receives the approval/decline notifications
   - You'll see a description: 
     > "📧 **Extra Charges Approval/Decline Notifications:** These email addresses will receive internal notifications when Extra Charges are approved or declined by property owners."

4. **Add Email Address(es)**
   - Enter an email address in the input field (e.g., `office@company.com`)
   - Click the **"Add"** button
   - Repeat for multiple recipients (office staff, management, accounting, etc.)

5. **Save Configuration**
   - Click the **"Save Configuration"** button at the bottom of the section
   - You'll see a success message confirming the settings were saved

---

## 🎨 Visual Guide

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚙️ Email Configuration                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ 📧 Extra Charges Approval/Decline Notifications                 ││
│ │                                                                  ││
│ │ Configure the Internal Notification Emails below to receive     ││
│ │ automatic notifications when property owners approve or         ││
│ │ decline Extra Charges. This keeps your team informed in         ││
│ │ real-time without having to check the system manually.          ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ From Email Address            From Name                             │
│ ┌──────────────────────┐     ┌──────────────────────┐             │
│ │ no-reply@company.com │     │ JG Painting Pros Inc │             │
│ └──────────────────────┘     └──────────────────────┘             │
│                                                                      │
│ Internal Notification Emails (Default BCC)                          │
│ 📧 Extra Charges Approval/Decline Notifications: These email        │
│ addresses will receive internal notifications when Extra Charges    │
│ are approved or declined by property owners. Add office staff,      │
│ management, or accounting emails who need to be notified...         │
│                                                                      │
│ ┌────────────────────────────────────────────────────┐  [Add]      │
│ │ office@company.com                                  │             │
│ └────────────────────────────────────────────────────┘             │
│                                                                      │
│ Current Recipients:                                                  │
│ ┌──────────────────────────┐ ┌──────────────────────────┐         │
│ │ ✓ office@company.com   X │ │ ✓ manager@company.com  X │         │
│ └──────────────────────────┘ └──────────────────────────┘         │
│                                                                      │
│ ✅ 2 emails will receive approval/decline notifications             │
│                                                                      │
│                                               [Save Configuration]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Important Notes

### If No Email is Configured:
- You'll see a **yellow warning banner** that says:
  > "⚠️ No internal notification emails configured. Add at least one email address to receive approval/decline notifications."

### Multiple Recipients:
- You can add **multiple email addresses**
- Each one will receive a copy of every approval/decline notification
- Common recipients:
  - Office manager
  - Project manager
  - Accounting department
  - Operations manager

### When Notifications Are Sent:
- ✅ **Approved**: When property owner clicks "Approve" button
- ❌ **Declined**: When property owner clicks "I decline to approve these charges at this time"

### What the Notification Contains:
- Decision type (Approved or Declined)
- Job information (WO#, property address, unit)
- Extra Charges details (amount, description)
- Decision timestamp
- Link to view Job Details

---

## 🔍 Finding Email Settings from Different Pages

### From the Job Details Page:
1. When sending an approval email, you'll see a blue banner on the **Review** step
2. Click the link: **"Configure notification emails in Email Settings →"**
3. This opens the Email Settings page in a new tab

### From the Main Navigation:
1. Click **Settings** in the sidebar
2. Scroll to the **Email Configuration** section at the top
3. Find the **"Internal Notification Emails (Default BCC)"** field

### Direct URL:
- Navigate to: `/dashboard/settings`

---

## ✅ Verification

### How to Test if Configuration is Working:

1. **Check Configuration:**
   ```sql
   SELECT default_bcc_emails FROM email_configurations WHERE is_active = true;
   ```
   Should return: `["office@company.com", "manager@company.com"]`

2. **Send Test Approval Email:**
   - Create a test job with Extra Charges
   - Send approval email to yourself
   - Approve the charges
   - Check if internal notification email is received

3. **Check Notification Banner:**
   - When sending approval email
   - On the "Review & Send" step
   - You should see the blue banner confirming internal notifications are enabled

---

## 🎯 Best Practices

### Who Should Receive Notifications:
✅ **Recommended Recipients:**
- Office manager (processes billing)
- Project manager (tracks job progress)
- Accounting (invoicing)
- Operations manager (resource planning)

❌ **Not Recommended:**
- Field technicians (they create the approval request)
- Property owners (they receive the approval email)
- External vendors

### Email Management:
- Keep the list updated when staff changes
- Use department emails (office@, accounting@) for continuity
- Test notifications after adding new recipients
- Remove old/inactive email addresses

---

## 🐛 Troubleshooting

### Problem: Not receiving internal notifications

**Check:**
1. Email configured in Email Settings? (see steps above)
2. Check spam/junk folder
3. Verify email address spelling is correct
4. Confirm email service is working (check other emails)

**Solution:**
```sql
-- Verify configuration in database
SELECT default_bcc_emails FROM email_configurations WHERE is_active = true;

-- If empty or NULL, add via UI or SQL:
UPDATE email_configurations
SET default_bcc_emails = ARRAY['office@company.com']::text[]
WHERE is_active = true;
```

### Problem: Old email address still receiving notifications

**Check:**
1. Go to Email Settings
2. Find the old email in the recipient list
3. Click the **X** to remove it
4. Click **Save Configuration**

### Problem: Multiple duplicate notifications

**Check:**
- Make sure email isn't listed multiple times in the configuration
- Each unique email should only appear once

---

## 📚 Related Documentation

- **Full Implementation Guide**: `EXTRA_CHARGES_APPROVAL_DECLINE_IMPLEMENTATION_SUMMARY.md`
- **Quick Reference**: `EXTRA_CHARGES_APPROVAL_DECLINE_QUICK_REFERENCE.md`
- **Technical Details**: `docs/extra-charges-approval-decline-flow.md`

---

## 🎉 Summary

**To configure internal notification emails:**

1. Go to **Email Settings** (Admin → Email Templates)
2. Find **"Internal Notification Emails (Default BCC)"** section
3. Add email address(es) - e.g., `office@company.com`
4. Click **Save Configuration**
5. Done! ✅

**You'll now receive automatic notifications when property owners approve or decline Extra Charges!**

---

*Last Updated: December 11, 2025*
