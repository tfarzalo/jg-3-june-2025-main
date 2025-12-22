# Calendar Feed URL Fixes and Troubleshooting Guide
**Date:** November 13, 2025  
**Status:** ✅ Deployed

## Issue
- Apple Calendar: Links won't open when clicked (webcals:// protocol not working)
- Google Calendar: "URL error" when trying to subscribe

## Root Causes Identified
1. **Missing CORS Headers**: Calendar apps may preflight requests and need proper CORS support
2. **Protocol Compatibility**: Some macOS versions have issues with `webcals://`, prefer `webcal://`
3. **Content-Disposition**: Using `attachment` may cause download instead of subscription
4. **User Experience**: No clear instructions or alternative methods provided

## Changes Made

### 1. Enhanced Edge Function (calendar-feed/index.ts)
```typescript
// Added CORS headers for all responses
const commonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

// Added OPTIONS handler for CORS preflight
if (req.method === "OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: commonHeaders,
  });
}

// Changed Content-Disposition from 'attachment' to 'inline'
// This allows calendar apps to subscribe instead of downloading
"Content-Disposition": `inline; filename="calendar-${scope}.ics"`
```

### 2. Enhanced Modal (SubscribeCalendarsModal.tsx)

#### Added Multiple URL Formats
```typescript
// Added both webcal:// and webcals:// options
function webcalUrl(icsUrl: string) {
  return icsUrl.replace(/^https:\/\//, "webcal://");
}

function webcalsUrl(icsUrl: string) {
  return icsUrl.replace(/^https:\/\//, "webcals://");
}
```

#### Enhanced UI with Multiple Subscription Methods
For each calendar feed, users now see:
- 📱 **Open in Apple Calendar** (webcal:// - compatible with older macOS)
- 🔒 **Secure Apple Calendar** (webcals:// - secure version)
- 📧 **Add to Google Calendar** (pre-formatted Google Calendar URL)
- 💾 **Download ICS File** (manual import option)

#### Added Clear Instructions
```
📅 How to Subscribe:
- Apple Calendar: Click "Open in Apple Calendar" or manually add via 
  Calendar → File → New Calendar Subscription
- Google Calendar: Click "Add to Google Calendar" or go to 
  Google Calendar → Other calendars (+) → From URL
- Troubleshooting: If links don't work, copy the ICS URL and paste it 
  directly into your calendar app's subscription dialog
```

### 3. Improved URL Display
- Changed input field to use monospace font for better readability
- Added "(copy this if links don't work)" labels
- Made all URLs easily selectable with click-to-select behavior

## How to Use (for End Users)

### Method 1: Click-to-Subscribe (Recommended)
1. Click "Subscribe to Calendars" button
2. Choose your calendar feed (Events, Events & Job Requests, etc.)
3. Click the appropriate link:
   - For Apple Calendar: Try "📱 Open in Apple Calendar" first
   - For Google Calendar: Click "📧 Add to Google Calendar"

### Method 2: Manual URL Subscription
If the click-to-subscribe links don't work:

**For Apple Calendar:**
1. Open Calendar app
2. Go to File → New Calendar Subscription (or Calendar → New Calendar Subscription)
3. Copy the ICS URL from the modal
4. Paste it into the dialog
5. Click Subscribe

**For Google Calendar:**
1. Go to Google Calendar on web
2. Click the "+" next to "Other calendars"
3. Select "From URL"
4. Copy the ICS URL from the modal
5. Paste it and click "Add calendar"

### Method 3: Download and Import
If both methods above fail:
1. Click "💾 Download ICS File"
2. Open the downloaded .ics file
3. Your calendar app should import it automatically

## Technical Details

### URL Formats Generated
```
HTTPS URL (direct):
https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token={token}

Webcal URL (Apple - standard):
webcal://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token={token}

Webcals URL (Apple - secure):
webcals://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token={token}

Google Calendar URL:
https://calendar.google.com/calendar/u/0/r?cid={encoded_ics_url}
```

### Headers Returned by Edge Function
```
HTTP/2 200 OK
Content-Type: text/calendar; charset=utf-8
Content-Disposition: inline; filename="calendar-events.ics"
Cache-Control: public, max-age=300
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
```

## Troubleshooting

### Apple Calendar Issues

**Issue: "webcals://" link doesn't open**
- **Solution**: Try the "webcal://" (non-secure) link instead
- **Reason**: Some macOS versions don't recognize webcals:// protocol

**Issue: Link opens Calendar but nothing happens**
- **Solution**: Use Method 2 (Manual URL Subscription) above
- Check Console.app for errors (search for "Calendar")

**Issue: "Unable to verify account" error**
- **Solution**: Ensure your token is valid
- Try generating a new token by refreshing the modal

### Google Calendar Issues

**Issue: "URL error" when clicking link**
- **Solution**: Use Method 2 (Google Calendar manual subscription)
- Ensure the URL is properly encoded

**Issue: "Couldn't add calendar" error**
- **Solution**: Try downloading the ICS file and importing manually
- Check if the URL is accessible in your browser

### General Issues

**Issue: No events showing up after subscription**
- **Cause**: No events/jobs in the selected scope yet
- **Solution**: Wait for events to be added, or check a different scope

**Issue: Events not updating**
- **Cause**: Calendar app caching
- **Solution**: 
  - Force refresh the calendar subscription
  - Check Cache-Control max-age (5 minutes)
  - Remove and re-add the subscription

**Issue: 403 Forbidden error**
- **Cause**: Invalid or expired token
- **Solution**: Click "Subscribe to Calendars" again to regenerate token

## Files Modified
1. `supabase/functions/calendar-feed/index.ts` - Added CORS, OPTIONS handler, changed Content-Disposition
2. `src/components/calendar/SubscribeCalendarsModal.tsx` - Enhanced UI with multiple methods and instructions

## Testing Checklist
- [x] Edge Function deployed successfully
- [x] CORS headers present in responses
- [x] HEAD requests return 200 OK
- [x] OPTIONS requests return 204 No Content
- [x] Multiple subscription methods available in UI
- [x] Download links work for all feeds
- [ ] Test actual subscription in Apple Calendar
- [ ] Test actual subscription in Google Calendar
- [ ] Verify events appear after subscription

## Next Steps for User Testing
1. Open the application and click "Subscribe to Calendars"
2. Try each subscription method:
   - Click "📱 Open in Apple Calendar" link
   - If that doesn't work, try "🔒 Secure Apple Calendar (webcals)"
   - If neither work, use manual subscription (Method 2)
   - As last resort, download ICS file (Method 3)
3. Verify events appear in calendar app
4. Report which method worked

## Known Limitations
- Calendar apps may cache feeds (5-minute refresh interval)
- Some corporate networks may block webcal:// protocol
- Mobile calendar apps may have different subscription flows
- ICS download method provides one-time import (not live updates)

## Success Criteria
✅ Multiple subscription methods available  
✅ Clear instructions provided  
✅ CORS headers present  
✅ Both webcal:// and webcals:// options  
⏳ Apple Calendar subscription works (pending user test)  
⏳ Google Calendar subscription works (pending user test)
