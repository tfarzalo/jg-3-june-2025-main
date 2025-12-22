# Extra Charges Approval & Decline Flow

## Overview

This document describes the enhanced Extra Charges approval system that supports both **approval** and **decline** actions, along with internal notifications to office staff.

## Table of Contents

1. [Status Values](#status-values)
2. [Workflow](#workflow)
3. [Database Schema](#database-schema)
4. [API Functions](#api-functions)
5. [Frontend Components](#frontend-components)
6. [Internal Notifications](#internal-notifications)
7. [Job Details Notation](#job-details-notation)
8. [Configuration](#configuration)
9. [Backward Compatibility](#backward-compatibility)

---

## Status Values

Extra Charges can have the following decision statuses (stored in `approval_tokens.decision`):

| Status      | Description                                                                 |
|-------------|-----------------------------------------------------------------------------|
| `NULL`      | Pending - No decision has been made yet                                     |
| `approved`  | Approved - Extra Charges were approved, job moves to "Work Order" phase     |
| `declined`  | Declined - Extra Charges were declined, job remains in "Pending Work Order" |

---

## Workflow

### Approval Flow

1. **Office staff** sends an approval email to the property contact via the Job Details page
2. **Property contact** receives email with approval link
3. **Property contact** clicks the approval link and is taken to the Approval Page
4. **Property contact** reviews details and clicks **"Approve Extra Charges"** button
5. System processes approval:
   - Marks `approval_tokens.decision = 'approved'` and sets `decision_at`
   - Changes job phase from **"Pending Work Order"** → **"Work Order"**
   - Creates `job_phase_changes` record
   - **Sends internal notification email** to office staff (configured BCC emails)
6. **Property contact** sees confirmation page
7. **Office staff** receives internal notification email about the approval

### Decline Flow

1. **Office staff** sends an approval email to the property contact via the Job Details page
2. **Property contact** receives email with approval link
3. **Property contact** clicks the approval link and is taken to the Approval Page
4. **Property contact** reviews details and clicks **"I decline to approve these charges at this time"** link
5. Confirmation dialog asks for confirmation
6. System processes decline:
   - Marks `approval_tokens.decision = 'declined'` and sets `decision_at`
   - Job phase **DOES NOT** change - remains at **"Pending Work Order"**
   - Creates `job_phase_changes` record (same phase, for audit trail)
   - **Sends internal notification email** to office staff (configured BCC emails)
7. **Property contact** sees declined confirmation page
8. **Office staff** receives internal notification email about the decline

---

## Database Schema

### `approval_tokens` Table Changes

Three new columns were added:

```sql
ALTER TABLE approval_tokens
  ADD COLUMN decision VARCHAR(20) CHECK (decision IN ('approved', 'declined')),
  ADD COLUMN decision_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN decline_reason TEXT;
```

**Fields:**
- `decision` - The decision made: 'approved' or 'declined' (NULL = pending)
- `decision_at` - Timestamp when the decision was made
- `decline_reason` - Optional reason provided when declining (nullable, reserved for future use)

### Indexes

```sql
CREATE INDEX idx_approval_tokens_decision ON approval_tokens(decision);
```

---

## API Functions

### `process_approval_token(p_token)`

**Purpose:** Processes approval of Extra Charges

**Behavior:**
- Validates the token (must be unused and not expired)
- Marks token as used with `decision='approved'` and `decision_at=NOW()`
- Changes job phase to "Work Order"
- Creates job_phase_changes record
- Returns success JSON with job details

**Returns:**
```json
{
  "success": true,
  "message": "Approval processed successfully",
  "job_id": "...",
  "work_order_num": 123,
  "decision": "approved"
}
```

### `process_decline_token(p_token, p_decline_reason)`

**Purpose:** Processes decline of Extra Charges

**Parameters:**
- `p_token` - The approval token
- `p_decline_reason` - Optional reason for decline (TEXT, nullable)

**Behavior:**
- Validates the token (must be unused and not expired)
- Marks token as used with `decision='declined'` and `decision_at=NOW()`
- **Does NOT change job phase** - stays at current phase
- Creates job_phase_changes record (same phase → same phase, for audit)
- Returns success JSON with job details

**Returns:**
```json
{
  "success": true,
  "message": "Extra charges declined successfully",
  "job_id": "...",
  "work_order_num": 123,
  "decision": "declined"
}
```

---

## Frontend Components

### ApprovalPage.tsx

**Location:** `src/pages/ApprovalPage.tsx`

**Key Features:**
- Displays Extra Charges details with job information and images
- **"Approve Extra Charges"** button (green, prominent)
- **"I decline to approve these charges at this time"** link (subtle, below approve button)
- Success/declined confirmation pages
- Sends internal notification emails after successful approval/decline

**UI States:**
1. **Loading** - Fetching approval data
2. **Error** - Invalid/expired token
3. **Pending** - Awaiting decision (shows approve button and decline link)
4. **Approved** - Confirmation page (green theme)
5. **Declined** - Confirmation page (red theme)

### JobDetails.tsx

**Location:** `src/components/JobDetails.tsx`

**Enhanced Features:**
- Fetches approval token decision status on load
- Displays **declined notification banner** when Extra Charges are declined
- Shows decline information: who declined, when, and optional reason
- Pending approval banner only shows when decision is NULL

**Declined Banner Example:**
```
❌ Extra Charges Declined

The extra charges for this job were declined by John Smith (john@property.com)
on December 11, 2025 at 2:30 PM.

The job remains in "Pending Work Order" status. Please contact the property to
discuss alternative options.
```

---

## Internal Notifications

### Configuration

Internal notifications are sent to email addresses configured in the `email_configurations` table:

**Table:** `email_configurations`
**Field:** `default_bcc_emails` (JSONB array)

**Example:**
```json
{
  "default_bcc_emails": [
    "office@jgpaintingpros.com",
    "manager@jgpaintingpros.com"
  ]
}
```

### Email Content

Internal notification emails include:
- Decision type (APPROVED or DECLINED) - color-coded
- Work Order number
- Property name and address
- Unit number
- Extra Charges amount
- Who made the decision (name and email)
- Decision timestamp
- Optional decline reason (if provided)

### Sending Logic

**Location:** `src/utils/sendInternalApprovalNotification.ts`

**When Sent:**
- Immediately after successful approval (from ApprovalPage)
- Immediately after successful decline (from ApprovalPage)

**Error Handling:**
- Email sending is **best-effort** and **non-blocking**
- If email configuration is missing or empty, logs warning but doesn't fail
- If email sending fails, logs error but doesn't fail the approval/decline
- Approval/decline always succeeds regardless of email status

---

## Job Details Notation

### Display Logic

The declined notation appears on the Job Details page when:
1. The job has a work order with `has_extra_charges = true`
2. There is an approval token for this job with `decision = 'declined'`

### Visual Design

- **Red banner** with decline icon (❌)
- Displays decline details (who, when, optional reason)
- Guidance message about job remaining in "Pending Work Order"
- Positioned at the top of the Work Order Details section

### Code Location

**File:** `src/components/JobDetails.tsx`
**Lines:** Approx. 1637-1665

---

## Configuration

### Setting Up Internal Notifications

1. Navigate to **Email Template Manager** in the application
2. Ensure **Email Configuration** section has:
   - `from_email` - Sender email address
   - `from_name` - Sender name
   - `default_bcc_emails` - Array of internal recipient emails
3. Internal notifications will be sent to all addresses in `default_bcc_emails`

**Example Configuration:**
```
From Email: noreply@jgpaintingpros.com
From Name: JG Painting Pros Inc.
Default BCC Emails:
  - office@jgpaintingpros.com
  - admin@jgpaintingpros.com
```

### No Configuration Required For:

- Approval/decline functionality (works without internal notifications)
- Job Details declined notation (automatically queries database)
- Approval page decline link (always visible)

---

## Backward Compatibility

### ✅ Fully Backward Compatible

1. **Existing Approval Links**
   - Continue to work exactly as before
   - Approval behavior unchanged (phase change to "Work Order")
   - Old tokens without `decision` field still function

2. **Database Changes**
   - New columns are nullable - no data migration needed
   - Existing records continue to work
   - No changes to existing job, work_order, or other core tables

3. **Frontend**
   - Pending approval banner only shows when decision is NULL
   - Declined banner only shows when decision is 'declined'
   - No visual changes to existing functionality

4. **API**
   - `process_approval_token` enhanced but maintains same behavior
   - `process_decline_token` is new, doesn't affect existing flows
   - Both functions have proper error handling

### What's New (Additive Only)

- ✨ Decline option on approval page
- ✨ Declined status tracking in database
- ✨ Declined notation on Job Details page
- ✨ Internal notification emails
- ✨ Enhanced audit trail via job_phase_changes

### Migration Safety

**Migrations:**
- `20251211000001_add_extra_charges_approval_decline.sql` - Database schema
- `20251211000002_add_internal_notification_emails.sql` - Comments only

**Safe to Roll Back:** Yes - simply don't apply the migrations

**Safe to Deploy:** Yes - additive changes only, no destructive operations

---

## Testing Checklist

### Approval Path
- [ ] Send approval email from Job Details page
- [ ] Click approval link
- [ ] Review details on Approval Page
- [ ] Click "Approve Extra Charges" button
- [ ] Verify job phase changes to "Work Order"
- [ ] Verify internal notification email received
- [ ] Verify success page displays correctly

### Decline Path
- [ ] Send approval email from Job Details page
- [ ] Click approval link
- [ ] Review details on Approval Page
- [ ] Click "I decline to approve these charges at this time" link
- [ ] Confirm decline in dialog
- [ ] Verify job phase STAYS at "Pending Work Order"
- [ ] Verify internal notification email received
- [ ] Verify declined confirmation page displays
- [ ] Go to Job Details page
- [ ] Verify declined banner appears with correct information

### Error Cases
- [ ] Expired token shows appropriate error
- [ ] Already-used token shows appropriate error
- [ ] Invalid token shows appropriate error
- [ ] Email configuration missing - approval/decline still works
- [ ] Email sending fails - approval/decline still succeeds

---

## Troubleshooting

### Internal Notifications Not Sending

**Check:**
1. Email configuration exists in `email_configurations` table
2. `is_active = true` on email configuration
3. `default_bcc_emails` is not empty
4. Check browser console for errors
5. Check Supabase Edge Function logs

**Solution:**
- If no configuration exists, internal notifications will be skipped
- Approval/decline functionality continues to work
- Add email configuration via Email Template Manager

### Declined Notation Not Showing

**Check:**
1. Verify `approval_tokens` table has `decision = 'declined'`
2. Verify job has `has_extra_charges = true` on work_order
3. Check browser console for errors fetching approval decision
4. Verify database migration was applied

**SQL Debug Query:**
```sql
SELECT decision, decision_at, approver_name, approver_email
FROM approval_tokens
WHERE job_id = 'YOUR_JOB_ID'
  AND approval_type = 'extra_charges'
  AND decision IS NOT NULL
ORDER BY decision_at DESC
LIMIT 1;
```

### Job Phase Not Changing on Approval

**Check:**
1. Verify "Work Order" phase exists in `job_phases` table
2. Check `process_approval_token` function execution logs
3. Verify no RLS policies blocking update

**SQL Debug Query:**
```sql
SELECT * FROM job_phases WHERE job_phase_label = 'Work Order';
```

---

## Summary

The enhanced Extra Charges approval system provides:

✅ **Dual Action Support** - Approve OR Decline
✅ **Clear Audit Trail** - All decisions tracked with timestamps
✅ **Internal Notifications** - Office staff notified of all decisions
✅ **Proper Phase Management** - Approval advances phase, decline keeps it
✅ **Visual Feedback** - Job Details shows declined status clearly
✅ **100% Backward Compatible** - No breaking changes
✅ **Robust Error Handling** - Email failures don't break core functionality

For support, contact the development team or refer to the codebase documentation.
