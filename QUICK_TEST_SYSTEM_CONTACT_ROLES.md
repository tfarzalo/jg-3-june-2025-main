# Quick Test Guide - System Contact Roles

## 🎯 What Was Fixed
System contact role selections (Subcontractor, AR, Approval, Notification) now **save to database** and display correctly.

## ⚡ Quick Test (2 minutes)

### Step 1: Edit Property
1. Go to: `Properties` → Select any property → Click `Edit`
2. Scroll to "Additional Contacts" section
3. For **Community Manager**, check these boxes:
   - ☑️ Approval Emails
   - ☑️ **Primary** (under Approval Emails)
4. For **Maintenance Supervisor**, check:
   - ☑️ Notification Emails

### Step 2: Save
1. Click **"Save Property"** button at bottom
2. Wait for success message
3. Page will redirect to Property Details

### Step 3: Verify on Details Page
1. On Property Details page, scroll to "Contact Information"
2. **Community Manager** should show badges:
   - 🟢 **Primary** (green badge)
   - Small "Appr" badge
3. **Maintenance Supervisor** should show:
   - 🟡 Small "Notif" badge

### Step 4: Verify Persistence
1. Click **"Edit"** button again
2. Scroll to "Additional Contacts"
3. **Verify checkboxes are still checked:**
   - ✅ Community Manager: Approval Emails + Primary
   - ✅ Maintenance Supervisor: Notification Emails

## ✅ Success Criteria
- Checkboxes **stay checked** after save
- Role badges **display on Property Details**
- When you re-edit, selections are **still there**

## 🔍 Console Logs to Look For
Open browser console (F12) and you should see:

**When clicking checkboxes:**
```
🔄 handleSystemContactRoleChange called: { key: "community_manager", role: "approvalRecipient", value: true }
```

**When saving:**
```
💾 Saving system contact roles
✅ Property updated successfully
```

## 🚨 If It Doesn't Work
1. **Hard refresh browser:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Check console for logs** - if you don't see the 🔄 emoji logs, refresh again
3. **Check database migration was applied** - Run: `npx supabase db pull` to verify columns exist

## 📧 Email Integration
When a job triggers approval/notification emails, the system will:
- Send to contacts marked as "Approval Recipients" (for approval emails)
- Send to contacts marked as "Notification Recipients" (for notification emails)
- Put "Primary" recipient in "To:" field
- Put other recipients in "CC:" field

This works for **both system contacts** (CM, MS, AP, Primary) **and custom contacts**.

## 🎉 You're Done!
If the checkboxes stay checked and badges display correctly, everything is working perfectly!
