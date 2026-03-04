# Countdown Timer Production Verification Checklist

**Date:** February 26, 2026  
**Status:** Awaiting deployment without cache

---

## 🔍 What to Check After Deployment

### 1. Browser Console Verification
Open browser DevTools (F12) → Console tab and check:

**✅ SHOULD SEE (New Build):**
```
Loading: SubcontractorDashboard-D0zlPcXS.js
Loading: AssignmentCountdownTimer-CcsVtHng.js
```

**❌ SHOULD NOT SEE (Old Build):**
```
Loading: SubcontractorDashboard-DPj7wC_R.js
```

---

### 2. Visual Verification - Subcontractor Dashboard

**Login as Subcontractor** and check:

- [ ] **Countdown timer appears** on pending job assignments
- [ ] Timer shows format like: `Time to Accept: 5h 23m` or `3:45 PM ET`
- [ ] Timer updates every second
- [ ] Timer has colored badge:
  - 🟢 Green: >4 hours remaining
  - 🟡 Yellow: 1-4 hours remaining
  - 🔴 Red: <1 hour remaining (pulsing animation)
  - ⚠️ Red "EXPIRED": Past deadline
- [ ] Timer icon shows clock (⏰) or alert (⚠️) if expired

**If no pending jobs exist:**
Create a test by assigning a job to yourself as admin, then check subcontractor dashboard

---

### 3. Visual Verification - Admin SubScheduler

**Login as Admin** and go to SubScheduler:

- [ ] **Countdown timer appears** in compact format for pending jobs
- [ ] Shows in job cards in subcontractor assignment columns
- [ ] Timer format: `5h 23m` (compact, no label)
- [ ] Color-coded badges visible
- [ ] Timer updates in real-time

---

### 4. Database Verification

Run this in Supabase SQL Editor to confirm jobs have deadlines:

```sql
SELECT 
  id,
  work_order_num,
  assignment_status,
  (assigned_at AT TIME ZONE 'America/New_York')::timestamp as assigned_at_et,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  CASE 
    WHEN assignment_deadline < NOW() THEN '⚠️ EXPIRED'
    WHEN assignment_deadline > NOW() THEN '✅ Active - ' || 
      EXTRACT(EPOCH FROM (assignment_deadline - NOW()))/3600 || ' hours remaining'
  END as status
FROM jobs
WHERE assignment_status = 'pending'
  AND assigned_to IS NOT NULL
ORDER BY assignment_deadline
LIMIT 10;
```

**Expected:** At least one row with `assignment_status = 'pending'` and a valid `deadline_et`

---

### 5. Functional Testing

**Test Accept/Decline Flow:**

1. **Assign a job** (as admin):
   - Go to SubScheduler
   - Drag a job to a subcontractor
   - Click "Confirm Schedule"
   - Verify countdown timer appears

2. **View as subcontractor**:
   - Login as that subcontractor
   - Verify job appears with countdown timer
   - Timer should show time until 3:30 PM ET

3. **Accept the job**:
   - Click "Accept" button
   - Timer should disappear
   - Job should move to "Accepted & Active" tab

4. **Decline a job**:
   - Assign another job
   - Click "Decline" button
   - Select reason
   - Timer should disappear
   - Job should unassign

---

### 6. Edge Cases to Test

- [ ] **After 3:30 PM assignment**: Deadline should be next business day at 3:30 PM
- [ ] **Weekend assignment**: Deadline should skip to Monday at 3:30 PM
- [ ] **Expired timer**: Should show "EXPIRED" in red
- [ ] **Auto-decline**: Wait for hourly cron or manually trigger
- [ ] **Multiple pending jobs**: Each should have its own countdown
- [ ] **Language toggle**: Spanish should show "Tiempo para Aceptar:"

---

## 🐛 Troubleshooting

### If Countdown Timer Still Missing:

1. **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Clear browser cache**: 
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
3. **Check in incognito mode**: New private window
4. **Verify deployment**: Check Netlify dashboard shows latest commit deployed
5. **Check console for errors**: Look for red errors in browser console
6. **Verify build hash**: Console should show `SubcontractorDashboard-D0zlPcXS.js`

### If Timer Appears But Not Updating:

- Check browser console for JavaScript errors
- Verify job actually has `assignment_status = 'pending'` in database
- Check `assignment_deadline` is not null
- Confirm deadline is in the future (not expired)

### If Timer Shows Wrong Time:

- Verify timezone: Should be calculating for America/New_York (ET)
- Check `assignment_deadline` in database
- Run deadline calculation test from verification SQL script

---

## ✅ Success Criteria

**Feature is working correctly when:**

1. ✅ Countdown timer visible on pending job assignments
2. ✅ Timer updates every second
3. ✅ Timer shows correct time until 3:30 PM ET
4. ✅ Timer color changes based on time remaining
5. ✅ Timer disappears when job is accepted/declined
6. ✅ Admin can see timers in SubScheduler
7. ✅ No console errors related to countdown timer
8. ✅ Build hash matches latest: `SubcontractorDashboard-D0zlPcXS.js`

---

## 📊 Deployment Info

**Commit with Countdown Timer:** `a7ea5af` (Feb 25, 2026)  
**Latest Commit:** Check `git log -1 --oneline`  
**Production URL:** https://portal.jgpaintingprosinc.com  
**Netlify:** Deployment triggered without cache (Feb 26, 2026)

---

## 📝 Notes

- Countdown timer was working locally
- Database backend fully configured
- Issue was stale frontend deployment
- Triggered fresh deployment without cache to resolve

---

Once you verify the countdown timer is visible and working, you can mark this checklist complete! 🎉
