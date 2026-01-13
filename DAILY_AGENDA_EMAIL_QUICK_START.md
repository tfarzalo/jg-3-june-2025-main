# Daily Agenda Email - Quick Reference

## 🎯 What It Does
Sends automated daily email summaries of scheduled jobs to admin and management users at 5:00 AM ET every day.

## 📍 Where to Find It
**Admin Settings → Daily Agenda Emails**

## ⚡ Quick Start (3 Steps)

### 1. Deploy (One-Time Setup)
```bash
# Run deployment script
./deploy-daily-agenda-email.sh

# Or manually:
supabase functions deploy send-daily-agenda-email
```

### 2. Enable Users
1. Go to **Settings** → Click **Daily Agenda Emails**
2. Toggle on for users who should receive emails
3. Changes save automatically ✅

### 3. Test It
1. Select "Send to single test email"
2. Enter your email
3. Click **Send Test Email Now**
4. Check your inbox!

## 📧 What's in the Email?

**Summary Bar:**
- 🎨 Paint Jobs Count
- 🔄 Callback Jobs Count  
- 🔧 Repair Jobs Count
- 📊 Total Jobs Count

**Job Cards:**
- Work Order Number
- Property Name
- Unit Number
- Assigned Technician
- Job Type

## 🔧 Common Tasks

### Add New User to Email List
1. Settings → Daily Agenda Emails
2. Find user in table
3. Toggle switch to ON (blue)

### Remove User from Email List
1. Settings → Daily Agenda Emails
2. Find user in table
3. Toggle switch to OFF (gray)

### Send Test to All Enabled Users
1. Settings → Daily Agenda Emails
2. Select "Send to all enabled users"
3. Click "Send Test Email Now"

### Test with Different Email
1. Select "Send to single test email"
2. Type any email address
3. Click "Send Test Email Now"

## 🐛 Troubleshooting

**No email received?**
- Check spam folder
- Verify toggle is ON (blue)
- Try sending test email first

**Test email fails?**
- Verify you're logged in as admin
- Check browser console (F12)
- Verify Edge Function is deployed

**Wrong job counts?**
- Emails show TODAY's jobs only
- Cancelled jobs are excluded
- Check calendar view to compare

## 📋 Database Table

**Table:** `daily_email_settings`
- Stores which users get emails
- Auto-created by migration
- Admin-only access

## 🔐 Security

- Only admins can access settings
- Only admins can toggle emails
- Uses existing authentication
- RLS policies enforce access

## ⏰ Schedule

Emails automatically sent:
- **Time:** 5:00 AM Eastern Time (ET)
- **Days:** Monday - Friday (weekdays)
- **Content:** Current day's jobs

## 📱 Features

✅ Dark mode support
✅ Real-time toggle updates
✅ Test before production
✅ Single or bulk sending
✅ Visual feedback
✅ Mobile responsive emails
✅ Professional formatting

## 🎨 Email Preview

```
┌─────────────────────────────────────┐
│  Friday, November 21, 2025          │
├─────────────────────────────────────┤
│  3 Paint │ 1 Callback │ 0 Repair   │
│            4 Total                   │
├─────────────────────────────────────┤
│  WO-000544         [Job Request]    │
│  Affinity at Hudson                 │
│  Unit #345                          │
│  Timmy Testerton                    │
├─────────────────────────────────────┤
│  WO-000542         [Job Request]    │
│  1010 Dilworth                      │
│  Unit #123                          │
│  Omar Turcios                       │
└─────────────────────────────────────┘
```

## 🚀 Next Steps

After deployment:
1. ✅ Enable emails for yourself
2. ✅ Send test email
3. ✅ Verify email received
4. ✅ Enable other users
5. ✅ Wait for 5 AM tomorrow (or test now)

## 💡 Tips

- Test with your own email first
- Enable gradually (start with 2-3 users)
- Check spam folders initially
- Review email client compatibility
- Monitor Edge Function logs

## 📚 Full Documentation

See `DAILY_AGENDA_EMAIL_IMPLEMENTATION.md` for:
- Complete setup instructions
- API documentation
- Cron job configuration
- Advanced troubleshooting
- Future enhancements

---

**Status:** ✅ Ready to Use
**Version:** 1.0.0
**Last Updated:** November 23, 2025
