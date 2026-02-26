# 📧 Assignment Email Notification - Updated

## ✅ What Was Added

The assignment notification now includes **prominent deadline information** that emphasizes the 3:30 PM ET deadline requirement.

---

## 📨 Notification Details

### In-App Notification
When a job is assigned, the subcontractor receives an in-app notification:

**Title:**
```
New Job Assignment: WO-000123
```

**Message:**
```
You have been assigned work order #000123 at [Property Name]. 
You must accept or decline this job by Mon DD, YYYY at 3:30 PM ET.
```

---

### Email Notification (If Configured)

**Subject:**
```
Job Assignment: WO-000123 - Response Required by 3:30 PM ET
```

**Email Body (HTML):**
```
New Job Assignment

Hello [Subcontractor Name],

You have been assigned a new job:

• Work Order: WO-000123
• Property: [Property Name]
• Deadline to Respond: Mon DD, YYYY at 3:30 PM ET

⚠️ IMPORTANT: You must accept or decline this job by [Deadline].

If you do not respond by the deadline, the job will be automatically 
declined and may be assigned to another subcontractor.

[View Job Details Button]

Thank you!
```

**Key Features:**
- ✅ Subject line includes "Response Required by 3:30 PM ET"
- ✅ Deadline prominently displayed in red/bold
- ✅ Clear warning about auto-decline
- ✅ Direct link to job details
- ✅ Professional formatting

---

## 🔄 How It Works

1. **Admin assigns job** via UI or function
2. **Function calculates deadline** (always 3:30 PM ET)
3. **In-app notification created** with deadline info
4. **Email queued** (if email system exists)
5. **Subcontractor receives both** in-app and email notifications

---

## 📁 Files Updated

### 1. `add_assignment_email_notification.sql`
- **NEW FILE** - Standalone update for assignment function
- Adds full email notification support
- Includes both HTML and plain text email bodies
- Gracefully handles missing email_notifications table

### 2. `create_assignment_deadline_functions.sql`
- Updated `assign_job_to_subcontractor` function
- Added in-app notification with deadline
- Enhanced return value with formatted deadline
- Backward compatible with existing code

---

## 🚀 Deployment

### Option 1: Quick Update (Recommended)
Run this single file to update just the assignment function:

```sql
-- Run in Supabase SQL Editor
add_assignment_email_notification.sql
```

### Option 2: Full Redeployment
If you want to redeploy all functions from scratch:

```sql
-- Run all in order:
1. add_assignment_deadline_columns.sql
2. create_assignment_deadline_functions.sql  (already includes notifications)
3. create_assignment_indexes.sql
4. grant_assignment_permissions.sql
```

---

## ✅ Testing the Notification

### Test In-App Notification

1. **Assign a job** to a subcontractor:
```sql
SELECT assign_job_to_subcontractor(
  'job_id'::uuid,
  'subcontractor_id'::uuid,
  'admin_id'::uuid
);
```

2. **Check notification was created**:
```sql
SELECT 
  title,
  message,
  type,
  created_at
FROM user_notifications
WHERE user_id = 'subcontractor_id'
ORDER BY created_at DESC
LIMIT 1;
```

3. **Log in as subcontractor** and check notifications icon/bell

---

### Test Email Notification (If Email System Configured)

1. **Check if email was queued**:
```sql
SELECT 
  recipient_email,
  subject,
  body_text,
  created_at
FROM email_notifications
WHERE recipient_email = 'subcontractor@example.com'
ORDER BY created_at DESC
LIMIT 1;
```

2. **Verify email content** includes:
   - ✅ "Response Required by 3:30 PM ET" in subject
   - ✅ Deadline prominently shown in body
   - ✅ Warning about auto-decline
   - ✅ Link to job details

---

## 🎯 Email System Integration

### If You Have Email System

The function automatically inserts into `email_notifications` table if it exists. Your email processing system should:

1. **Poll the table** for new emails
2. **Send via SMTP/service** (Zoho, SendGrid, etc.)
3. **Mark as sent** or delete after sending

### If You Don't Have Email System Yet

The function gracefully handles missing `email_notifications` table:
- In-app notifications still work
- No errors thrown
- Warning logged (doesn't fail assignment)

**To add email later:**
1. Create `email_notifications` table
2. Set up email processing service
3. Emails will automatically start queueing

---

## 📋 Email Notifications Table Schema (If Needed)

If you don't have an `email_notifications` table yet:

```sql
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  template_name TEXT,
  template_data JSONB,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_notifications_status 
ON email_notifications(status, created_at);

CREATE INDEX idx_email_notifications_recipient 
ON email_notifications(recipient_email, created_at);
```

---

## 🔍 Monitoring

### Check Recent Assignment Notifications

```sql
-- View recent assignment notifications
SELECT 
  un.created_at,
  u.full_name as recipient,
  u.email,
  un.title,
  un.message,
  un.type
FROM user_notifications un
JOIN users u ON un.user_id = u.id
WHERE un.type = 'job_assignment'
ORDER BY un.created_at DESC
LIMIT 10;
```

### Check Email Queue (If Configured)

```sql
-- View recent assignment emails
SELECT 
  created_at,
  recipient_email,
  recipient_name,
  subject,
  status,
  sent_at
FROM email_notifications
WHERE template_name = 'job_assignment'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📱 What Subcontractors See

### In Dashboard
1. **Bell icon** shows new notification count
2. **Notification dropdown** shows:
   - "New Job Assignment: WO-000123"
   - "Must respond by [Date] at 3:30 PM ET"
3. **Click notification** → Go to job details

### In Email Inbox
1. **Email subject** clearly states response required
2. **Email body** prominently shows deadline
3. **Click button** → Open job in browser
4. **Clear warning** about auto-decline consequence

---

## ✨ Key Improvements

✅ **Clear Deadline Communication**
- Subject line mentions "Response Required by 3:30 PM ET"
- Deadline prominently displayed in bold/red
- Multiple reminders throughout message

✅ **Consequence Awareness**
- Explains auto-decline will occur
- States job may go to another subcontractor
- Creates urgency without being aggressive

✅ **Easy Action**
- Direct link to job details
- One-click access from email
- Mobile-friendly formatting

✅ **Professional Tone**
- Friendly but firm
- Clear expectations
- Respectful communication

---

## 🎉 Summary

The assignment notification system now:
1. ✅ Sends in-app notification with deadline
2. ✅ Queues email with prominent deadline info
3. ✅ Emphasizes 3:30 PM ET requirement
4. ✅ Warns about auto-decline consequence
5. ✅ Provides easy access to job details
6. ✅ Works with or without email system

**Subcontractors will clearly understand they must respond by 3:30 PM ET!** 🎯
