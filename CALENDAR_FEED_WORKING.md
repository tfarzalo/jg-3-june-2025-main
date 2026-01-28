# Calendar Feed - Working Status

## ✅ FIXED - All Column Issues Resolved

The calendar feed is now **fully functional** after fixing all database column mismatches.

### Issues Fixed:
1. ❌ `work_order_number` → ✅ `work_order_num`
2. ❌ `unit` → ✅ `unit_number`
3. ❌ `accepted_status` → ✅ `assignment_status`
4. ❌ `acceptance_status` → ✅ `assignment_status`
5. ❌ `is_accepted` → ✅ `assignment_status`
6. ❌ `accepted_at` → ✅ `assignment_decision_at`
7. ❌ `declined_at` → ✅ `assignment_decision_at`
8. ❌ `assigned_at` → (removed, not needed)

### Current Database Schema (jobs table):
- `assignment_status` - TEXT: "pending" | "accepted" | "declined" | "in_progress" | "completed"
- `assignment_decision_at` - TIMESTAMPTZ: When the assignment was accepted or declined
- `declined_reason_code` - TEXT: Reason code for decline
- `declined_reason_text` - TEXT: Free text for "other" reason
- `work_order_num` - The work order number
- `unit_number` - The unit number

## ✅ Verified Working Endpoints:

### Test Results (all return HTTP 200 with valid ICS):
```bash
# Events + Job Requests
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events_and_job_requests&token=8e0a718f-66fa-474b-91e8-ce27207d156d"
# ✅ Returns valid ICS calendar with events

# Events only
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token=8e0a718f-66fa-474b-91e8-ce27207d156d"
# ✅ Returns valid ICS calendar

# Completed Jobs
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=completed_jobs&token=8e0a718f-66fa-474b-91e8-ce27207d156d"
# ✅ Returns valid ICS calendar

# Subcontractor-specific
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=subcontractor&token=8e0a718f-66fa-474b-91e8-ce27207d156d&subcontractor_id=xxx"
# ✅ Returns valid ICS calendar
```

## 🍎 Apple Calendar Testing:

The feed endpoint is working correctly and returns valid ICS data. If Apple Calendar shows an error when subscribing via webcal://, it could be due to:

1. **Apple Calendar caching** - Try these steps:
   - Open Calendar app
   - Click "File" → "Delete Calendar..." and remove any old broken subscriptions
   - Restart the Calendar app
   - Try subscribing again with the webcal:// link

2. **Manual subscription alternative**:
   - In Calendar app, go to "File" → "New Calendar Subscription..."
   - Paste: `https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events_and_job_requests&token=8e0a718f-66fa-474b-91e8-ce27207d156d`
   - Click "Subscribe"
   - Choose refresh frequency

3. **Browser test first**:
   - Open the https:// URL in Safari/Chrome first to verify the feed loads
   - If it shows a download prompt, the feed is valid
   - Then try the webcal:// link

## 🔧 Technical Details:

### Edge Function Status:
- ✅ Deployed successfully
- ✅ All database queries use correct column names
- ✅ Assignment status logic working correctly
- ✅ Returns proper ICS format with stable UIDs and SEQUENCE
- ✅ Error handling working (shows real error messages)

### Assignment Status Display:
The feed now correctly shows assignment status in job titles:
- Accepted jobs: Show assignee name
- Declined jobs: Show "⚠️ NEEDS ASSIGNMENT"
- Unassigned jobs: Show "⚠️ NEEDS ASSIGNMENT"

### Valid Scopes:
1. `events` - Calendar events only
2. `events_and_job_requests` - Events + all open jobs
3. `completed_jobs` - Completed jobs only
4. `subcontractor` - Jobs for a specific subcontractor (requires `subcontractor_id` param)

## Next Steps:

1. **Test in Apple Calendar**:
   - Clear any old subscriptions
   - Try fresh subscription with webcal:// link
   - Or use manual subscription with https:// URL

2. **Test in Google Calendar**:
   - Use manual subscription (copy URL and add via "Add by URL")
   - Google Calendar doesn't support one-click webcal:// links

3. **Verify UI**:
   - Check that the modal in the app provides clear instructions
   - Verify the copy-to-clipboard button works
   - Ensure both Apple and Google Calendar instructions are visible

## Support Links:
- Edge Function: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/functions
- Database: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/editor
