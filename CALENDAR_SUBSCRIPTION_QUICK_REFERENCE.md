# Calendar Feed Subscription - Quick Reference

## 🎯 What Changed
The calendar subscription modal now provides **4 different ways** to subscribe to your calendar feeds, with clear instructions and troubleshooting guidance.

## 📱 Subscription Methods (in order of preference)

### 1. Click-to-Subscribe (Primary)
**For Apple Calendar:**
- 📱 **Open in Apple Calendar** (webcal:// - try this first!)
- 🔒 **Secure Apple Calendar** (webcals:// - if first doesn't work)

**For Google Calendar:**
- 📧 **Add to Google Calendar** (opens Google Calendar with pre-filled URL)

### 2. Manual URL Subscription (If links don't work)
**Apple Calendar:**
1. Open Calendar app
2. Go to: File → New Calendar Subscription
3. Paste the ICS URL from the modal
4. Click Subscribe

**Google Calendar:**
1. Go to Google Calendar (web)
2. Click "+" next to "Other calendars"
3. Select "From URL"
4. Paste the ICS URL
5. Click "Add calendar"

### 3. Download and Import (Last resort)
- 💾 **Download ICS File** button
- Opens the .ics file directly in your calendar app
- ⚠️ Note: This is a one-time import, not a live subscription

### 4. Copy URL Manually
- Click the ICS URL input field to select all text
- Copy and paste into your calendar app's subscription dialog

## 🔍 How to Access
1. Click **"Subscribe to Calendars"** button in the app
2. You'll see 3 main feed types:
   - **Events** - Calendar events only
   - **Events & Job Requests** - Events + scheduled jobs
   - **Completed Jobs** - Completed jobs calendar
3. **Admin users only**: Per-subcontractor feeds at the bottom

## ✅ Visual Improvements
- Clear instructions panel at the top with step-by-step guidance
- Emoji indicators for each subscription method (📱🔒📧💾)
- Monospace font for URLs (easier to read and copy)
- Hover effects on links
- Compact subcontractor feeds with all options

## 🚀 Behind the Scenes
- **CORS enabled** - Calendar apps can now properly request the feed
- **Both protocols supported** - webcal:// and webcals:// for maximum compatibility
- **Inline content** - Changed from download to subscription mode
- **OPTIONS support** - Calendar apps can preflight requests
- **Cached responses** - 5-minute cache for better performance

## 📋 Test These After Deployment
- [ ] Click "📱 Open in Apple Calendar" - does Calendar.app open?
- [ ] If not, try "🔒 Secure Apple Calendar (webcals)"
- [ ] Try "📧 Add to Google Calendar" - does Google Calendar open?
- [ ] Copy the ICS URL and manually subscribe
- [ ] Download the ICS file and verify it opens
- [ ] Check if events appear in your calendar

## 🐛 If Still Having Issues
1. **Check your token** - It should be a valid UUID
2. **Check the URL** - Should start with https://tbwtfimnbmvbgesidbxh.supabase.co
3. **Test the URL directly** - Paste it in your browser, should download/show ICS file
4. **Check calendar app logs** - Look for errors in Console.app (macOS) or calendar app settings
5. **Try a different browser** - Some corporate networks block calendar protocols

## 📚 Documentation
See `CALENDAR_FEED_URL_FIXES_AND_TROUBLESHOOTING_NOV_13.md` for comprehensive troubleshooting guide.
