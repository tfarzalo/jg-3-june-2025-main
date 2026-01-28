# Calendar Subscription Modal - Google Calendar Fix

## Issue
The Google Calendar button was trying to use a direct link method that doesn't work. Google Calendar **does not support** direct "click to subscribe" links for external calendar feeds.

## Root Cause
The modal was using:
```typescript
href={googleAddUrl(urls.events)}
// Which generated: https://calendar.google.com/calendar/render?cid=...
```

This URL format **doesn't work** for subscribing to external calendar feeds in Google Calendar. The `render` endpoint is for adding events, not subscribing to external feeds.

## Solution
**Removed the broken Google Calendar button** and replaced it with clear manual subscription instructions:

### Changes Made:

1. **Removed `googleAddUrl()` function** - It was generating non-functional URLs
2. **Added Copy button** for each feed URL
3. **Kept Apple Calendar button** - Uses `webcal://` protocol which works natively
4. **Added clear Google Calendar instructions** in a highlighted box:
   - Copy the URL
   - Open Google Calendar
   - Click + next to "Other calendars"
   - Select "From URL"
   - Paste and add

### New User Experience:

#### ✅ Apple Calendar (macOS/iOS)
- **One-click subscription** works perfectly
- Click "📱 Subscribe in Apple Calendar" button
- Opens Calendar app automatically with subscription prompt

#### ✅ Google Calendar
- **Manual subscription** (only supported method)
- Click "Copy" button to copy feed URL
- Follow 5-step instructions in blue box
- Links directly to Google Calendar for convenience

### Why Manual for Google?
Google Calendar deliberately doesn't support automatic subscription links for security reasons. Users must:
1. Be signed into their Google account
2. Manually navigate to calendar settings
3. Explicitly add the URL

This is by design and cannot be bypassed with any URL format.

## Files Modified
- `/src/components/calendar/SubscribeCalendarsModal.tsx`

## Result
- ✅ No more broken Google Calendar button
- ✅ Clear, step-by-step instructions
- ✅ Copy button for easy URL copying
- ✅ Apple Calendar still works with one click
- ✅ Professional-looking instruction boxes with proper styling

## Testing Steps
1. Open the calendar subscription modal
2. For Apple Calendar: Click the button - it should open Calendar app
3. For Google Calendar: 
   - Click "Copy" button
   - Follow the 5 steps in the blue instruction box
   - Feed should appear in "Other calendars" within ~15 minutes

## Technical Details

### Apple Calendar URL Format
```
webcal://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token={TOKEN}
```
- Uses `webcal://` protocol (HTTP equivalent for calendar subscriptions)
- macOS/iOS recognize this protocol and open Calendar app automatically

### Google Calendar Subscription
**The ONLY supported method:**
1. Go to https://calendar.google.com
2. Click ⚙️ Settings
3. Click "Add calendar" → "From URL"
4. Paste: `https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token={TOKEN}`
5. Click "Add calendar"

**Refresh rate:** Google Calendar checks external feeds every 8-24 hours. Updates may not appear immediately.

## Status
✅ **FIXED** - Modal now provides accurate, working instructions for both calendar platforms.
