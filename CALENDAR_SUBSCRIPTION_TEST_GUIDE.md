# Calendar Subscription Test Guide

## ✅ Ready to Test!

The calendar feed is fully functional and ready to test with both Apple Calendar and Google Calendar.

## 🍎 Testing with Apple Calendar

### Method 1: One-Click Subscribe (Recommended)
1. Open your application at https://portal.jgpaintingpros.com
2. Navigate to the Calendar page
3. Click the **"Subscribe to Calendars"** button
4. Choose which feed you want (usually **"Events & Job Requests"**)
5. Click the **"🍎 Subscribe in Apple Calendar"** button
6. Apple Calendar should open automatically and prompt you to subscribe
7. Click **"Subscribe"** in the dialog that appears
8. Set refresh frequency (recommend: Every hour or Every day)

### Method 2: Manual Subscription
1. Copy the calendar URL from the modal
2. Open **Calendar** app on your Mac
3. Go to **File → New Calendar Subscription...**
4. Paste the URL (use the `https://` version, NOT `webcal://`)
5. Click **Subscribe**
6. Configure options:
   - **Location:** Choose "iCloud" or "On My Mac"
   - **Auto-refresh:** Choose frequency (Every hour, Every day, etc.)
   - **Remove:** Choose when to remove old events
7. Click **OK**

### What You Should See in Apple Calendar:
- Calendar name: "JG Painting Pros" (or similar)
- Job events showing as:
  - **Title:** `WO#000544 • Affinity at Hudson • Unit 345 • Paint • Timmy Testerton`
  - **Date:** The scheduled date
  - **Time:** All-day event
  - **Location:** Property name
  - **Notes:** Full job details with work order, property, unit, job type, assignee, status, and portal link

## 📅 Testing with Google Calendar

### Steps:
1. Open your application at https://portal.jgpaintingpros.com
2. Navigate to the Calendar page
3. Click the **"Subscribe to Calendars"** button
4. Choose which feed you want (usually **"Events & Job Requests"**)
5. Click the **"Copy"** button next to the URL
6. Open [Google Calendar](https://calendar.google.com) in a new tab
7. On the left sidebar, click the **+** button next to "Other calendars"
8. Select **"From URL"**
9. Paste the copied URL (should start with `https://`)
10. Click **"Add calendar"**
11. Wait a moment for Google to fetch the calendar

### What You Should See in Google Calendar:
- New calendar appears in your calendar list (left sidebar)
- Job events showing as:
  - **Title:** `WO#000544 • Affinity at Hudson • Unit 345 • Paint • Timmy Testerton`
  - **Date:** The scheduled date
  - **Time:** All-day event
  - **Description:** Full job details with work order, property, unit, job type, assignee, status, and portal link

## 🔍 Verification Checklist

After subscribing to the calendar, verify:

- ✅ **Work Order Numbers** are formatted as `WO#000544` (6 digits with leading zeros)
- ✅ **Property Names** appear correctly (e.g., "Affinity at Hudson")
- ✅ **Unit Numbers** are shown (e.g., "Unit 345")
- ✅ **Job Types** are displayed (e.g., "Paint", "Callback", "Repair")
- ✅ **Assigned Subcontractors** show their full names
- ✅ **Assignment Status** is indicated:
  - Jobs with "⚠️ NEEDS ASSIGNMENT" are unassigned
  - Jobs with subcontractor names are assigned
  - Event description shows "✓ Accepted" or "⏳ Pending Acceptance"
- ✅ **Dates** match the scheduled dates from the portal
- ✅ **Event descriptions** include all job details
- ✅ **Portal links** work when clicked

## 📝 Available Feeds

### 1. Events
- **Scope:** `events`
- **Contains:** Only calendar events (meetings, time off, etc.)
- **Use case:** If you only want to see non-job events

### 2. Events & Job Requests (Recommended)
- **Scope:** `events_and_job_requests`
- **Contains:** Calendar events + all scheduled jobs
- **Use case:** See everything on your calendar
- **Most commonly used feed**

### 3. Completed Jobs
- **Scope:** `completed_jobs`
- **Contains:** Only completed jobs
- **Use case:** Historical view of completed work

## 🔄 Calendar Refresh Frequency

### Apple Calendar:
- Can be set per-subscription
- Options: Every 5 minutes, 15 minutes, hour, day, week
- Recommended: **Every hour** or **Every day**

### Google Calendar:
- Automatically refreshes (Google controls frequency)
- Typically updates every few hours
- No user control over refresh rate

## ⚠️ Troubleshooting

### Apple Calendar shows error:
1. Try the manual subscription method instead
2. Make sure you're using the `https://` URL (not `webcal://`)
3. Check that you're logged into the portal
4. Delete any old/broken calendar subscriptions first
5. Restart Calendar app and try again

### Google Calendar doesn't show events:
1. Wait a few minutes - Google can take time to fetch
2. Make sure you used the `https://` URL
3. Check that the calendar is enabled (checkbox in sidebar)
4. Try removing and re-adding the subscription

### Events are outdated:
1. Force refresh in Apple Calendar: View → Refresh Calendars (⌘R)
2. For Google Calendar: Wait or remove/re-add subscription
3. Check that jobs are actually scheduled in the portal

### "Preparing your feed links…" message won't go away:
1. Check browser console for errors (F12)
2. Make sure you're signed in to the portal
3. Check that calendar_tokens table exists in database
4. Try logging out and back in

## 🎉 Success Indicators

You know it's working correctly when:
- ✅ Calendar subscription adds without errors
- ✅ Events appear on the correct dates
- ✅ Event titles show work order, property, unit, and job type
- ✅ Event descriptions show full job details
- ✅ Assignment status is clearly indicated
- ✅ Portal links in descriptions work correctly
- ✅ Calendar refreshes and updates automatically

## 📞 Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify the calendar feed URL returns valid ICS data (test in browser)
3. Check Supabase Edge Function logs for errors
4. Ensure database columns match expected schema

---

**Last Updated:** January 27, 2026  
**Status:** ✅ Production Ready  
**Tested On:** Apple Calendar (macOS), Google Calendar (Web)
