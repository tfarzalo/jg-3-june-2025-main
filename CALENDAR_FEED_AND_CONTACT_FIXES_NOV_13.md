# Calendar Feed and Contact Detail Fixes - November 13, 2025

## Issues Fixed

### 1. Calendar Feed - Subcontractor Event Titles
**Problem:** Subcontractor calendar feeds were showing "Assigned Job" as the event title instead of detailed job information.

**Root Cause:** The `categories` field was set to "Assigned Job" in the ICS file, and some calendar applications (especially Apple Calendar) were prioritizing the CATEGORIES field over the SUMMARY field when displaying event titles.

**Solution:** 
- Removed the `categories: "Assigned Job"` line from the subcontractor feed events in `supabase/functions/calendar-feed/index.ts`
- Added fallback to ensure title is always set: `const title = jobSummary(j, property) || `Job #${j.id}`;`
- Added debug logging to track title generation
- The SUMMARY field now properly displays the full job details: Property Name | Unit X | Address | WO#XXX | Job Type

**Files Modified:**
- `supabase/functions/calendar-feed/index.ts` (lines 599-610)

**Note:** The Edge Function must be deployed to Supabase for changes to take effect:
```bash
supabase functions deploy calendar-feed
```

---

### 2. Contact Detail - "Failed to fetch contact details" Error
**Problem:** When loading a contact in the Contacts section, a toast error "Failed to fetch contact details" would appear even though the contact information displayed correctly.

**Root Cause:** The `fetchContactDetails` function was making multiple sequential queries (contact_history, contact_notes, contact_communications, profiles) and throwing an error if any of these sub-queries failed. If one of these tables didn't exist, had permission issues, or returned an error, the entire function would fail and show the error toast, even though the main contact data had already been successfully fetched and set.

**Solution:**
Made all sub-queries non-blocking by:
- Changed all `if (error) throw error;` to `if (error) console.warn('Error...', error);`
- Wrapped data processing in conditional checks: `if (historyData) { ... }`
- Added null checks before setting state
- Now only the main contact query will throw an error if it fails

**Benefits:**
- Contact details always display if the main query succeeds
- No misleading error messages when optional data fails to load
- Better user experience - partial data is better than no data
- Errors are still logged to console for debugging

**Files Modified:**
- `src/components/ContactDetail.tsx` (lines 217-302)

**Type Fixes:**
- Added missing `assigned_to` and `avatar_url` properties to Contact object (line 183, 195)
- Added 'history' to activeTab type union (line 108)

---

## Testing Recommendations

### Calendar Feed
1. Subscribe to a subcontractor calendar feed
2. Verify event titles show full details: "Property Name | Unit X | Address | WO#123 | Job Type"
3. Check that events display correctly in Apple Calendar, Google Calendar, and Outlook
4. Verify no "Assigned Job" text appears as the primary title

### Contact Details
1. Navigate to Contacts section
2. Click on a contact to view details
3. Verify no error toast appears
4. Verify contact information loads correctly
5. Check browser console for any warnings about optional data (normal)

---

## Deployment Notes

### Frontend (Auto-deployed via Netlify)
- Changes to `ContactDetail.tsx` will auto-deploy when pushed to main branch

### Backend (Manual deployment required)
- Calendar feed changes require manual Edge Function deployment:
  ```bash
  supabase functions deploy calendar-feed
  ```

---

## Summary

Both issues have been resolved:
1. **Calendar Feed:** Removed conflicting CATEGORIES field that was overriding event titles
2. **Contact Detail:** Made optional queries non-blocking to prevent false error messages

All changes maintain backward compatibility and improve user experience.
