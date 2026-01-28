# Calendar Feed Deployment Instructions

## ✅ What Was Changed

### 1. Frontend Changes (Already Applied)
**File**: `src/components/calendar/SubscribeCalendarsModal.tsx`

Changes made:
- ✅ Updated to use `VITE_SUPABASE_URL` environment variable
- ✅ Fixed Apple Calendar links (now use `webcal://` protocol)
- ✅ Fixed Google Calendar links (now use proper URL encoding)
- ✅ Updated button styling to be more prominent

### 2. Backend Changes (Need Manual Update)
**File**: `supabase/functions/calendar-feed/index.ts`

This file needs to be COMPLETELY REPLACED with the new version provided below.

---

## 🚀 Deployment Steps

### Step 1: Update the Edge Function

1. **Open** `supabase/functions/calendar-feed/index.ts`
2. **Delete ALL existing content**
3. **Copy the ENTIRE contents** from the code block I provided in my previous message
4. **Paste** into the file
5. **Save** the file

### Step 2: Deploy to Supabase

Run this command in your terminal:

```bash
supabase functions deploy calendar-feed
```

### Step 3: Test the Updated Feeds

1. **Start your dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open the application** in your browser

3. **Click "Subscribe to Calendars"**

4. **Test each feed type**:
   - Events
   - Events & Job Requests
   - Completed Jobs

5. **Click the Apple Calendar button** - should open Calendar app on macOS/iOS

6. **Click the Google Calendar button** - should open Google Calendar in browser

---

## 🧪 Testing Checklist

### Test Apple Calendar Links

- [ ] Click "Apple Calendar" button for Events feed
- [ ] Verify Calendar app opens
- [ ] Verify subscription dialog appears
- [ ] Subscribe and check events appear
- [ ] Repeat for Events & Job Requests
- [ ] Repeat for Completed Jobs

### Test Google Calendar Links

- [ ] Click "Google Calendar" button for Events feed
- [ ] Verify Google Calendar opens in browser
- [ ] Verify "Add calendar" sidebar appears
- [ ] Subscribe and check events appear
- [ ] Repeat for Events & Job Requests
- [ ] Repeat for Completed Jobs

### Test Job Display Format

- [ ] Check job title shows: `WO# • Address Unit X • Job Type • Subcontractor`
- [ ] Check unassigned jobs show: `⚠️ NEEDS ASSIGNMENT`
- [ ] Check declined jobs show: `⚠️ NEEDS ASSIGNMENT`
- [ ] Check job description has all details

### Test Update Sync

- [ ] Update a job in your app
- [ ] Wait 15 minutes or force refresh calendar
- [ ] Verify calendar updates (no duplicate)

---

## 🌐 For Production Deployment

When you deploy to your domain, the app will automatically use the correct URL because we're using `VITE_SUPABASE_URL` environment variable.

### On Netlify/Vercel/Your Host:

1. Set environment variable:
   ```
   VITE_SUPABASE_URL=https://tbwtfimnbmvbgesidbxh.supabase.co
   ```

2. Deploy your app

3. The calendar feed URLs will automatically use the correct domain

### No Additional Changes Needed!

The code is already set up to work for:
- ✅ Local development (`localhost`)
- ✅ Production deployment (your domain)
- ✅ Supabase hosted function

---

## 📊 What Each Feed Shows

### Events Feed (`scope=events`)
- Calendar events created in the app
- "Today's Agenda" summary events

### Events & Job Requests (`scope=events_and_job_requests`)
- All calendar events
- All open/scheduled jobs
- Shows assignment status:
  - ✅ Accepted jobs
  - ⏳ Pending acceptance
  - ⚠️ Needs assignment

### Completed Jobs (`scope=completed_jobs`)
- Jobs marked as completed
- Jobs in completed phases

### Subcontractor Feed (`scope=subcontractor`)
- Jobs assigned to specific subcontractor
- Shows acceptance status
- Auto-filtered to their jobs only

---

## 🔧 Key Improvements Made

### UID Stability ✅
- UIDs now include creation timestamp
- Never change once created
- Ensures calendar apps recognize updates

### SEQUENCE Tracking ✅
- Auto-increments on job updates
- Tells calendar apps it's an update, not new event
- Prevents duplicate events

### All-Day Event Format ✅
- Uses proper `VALUE=DATE` format
- No timezone issues
- Events appear on correct day

### Job Assignment Status ✅
- Unassigned jobs: `⚠️ NEEDS ASSIGNMENT`
- Declined jobs: `⚠️ NEEDS ASSIGNMENT`
- Pending: Shows subcontractor name + TENTATIVE status
- Accepted: Shows subcontractor name + CONFIRMED status

### Event Titles ✅
**Jobs:**
```
WO#2024-0156 • 742 Evergreen Terrace Unit 3B • Paint • Mike Rodriguez
```

**Events:**
```
Team Meeting
```

**Today's Agenda:**
```
Today's Agenda: 5 Paint • 2 Callback • 1 Repair • Total: 11
```

---

## 🐛 Troubleshooting

### Apple Calendar Not Opening
- Make sure you're clicking the link, not copying it
- On iOS, you may need to allow opening Calendar app
- Try copying the ICS URL and manually subscribing

### Google Calendar Not Working
- Try in a different browser
- Make sure you're logged into Google
- Try the manual ICS URL method

### Jobs Not Showing
- Check that jobs have `scheduled_date` set
- Check that job status is "Open", "Scheduled", or "Pending"
- Check Supabase Edge Function logs for errors

### Updates Not Syncing
- Apple Calendar: Wait 15 minutes or force refresh
- Google Calendar: Can take 8-24 hours
- Check that `updated_at` field is being updated on job changes

---

## 📝 Manual Steps Required

1. **Replace Edge Function code** (see Step 1 above)
2. **Deploy to Supabase** (see Step 2 above)
3. **Test locally** (see Step 3 above)
4. That's it! No other manual changes needed.

---

## ✅ Verification

After deployment, verify:

1. **Frontend loads** without errors
2. **"Subscribe to Calendars" button** appears
3. **Modal opens** and shows three feeds
4. **ICS URLs** are visible and copyable
5. **Apple Calendar buttons** have black background
6. **Google Calendar buttons** have blue background
7. **Links work** when clicked

---

## 🎉 You're Done!

Once deployed:
- Calendar feeds will automatically stay in sync
- Job updates will propagate to subscribed calendars
- Unassigned jobs will be clearly marked
- Works on both local and production environments
