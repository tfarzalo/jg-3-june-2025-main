# Dev Server Restart Instructions

## Problem
The code changes for the approval workflow (preview modal, image links, countdown timer) are present in the codebase but not showing in the running application. This is due to the dev server not picking up the changes through hot module replacement (HMR).

## Solution: Restart the Dev Server

### Step 1: Stop the Current Dev Server
1. Find the terminal where `npm run dev` is running
2. Press `Ctrl+C` (or `Cmd+C` on Mac) to stop the server
3. Wait for the process to fully terminate

### Step 2: Clear Node Modules Cache (Optional but Recommended)
```bash
rm -rf node_modules/.vite
```

### Step 3: Restart the Dev Server
```bash
npm run dev
```

### Step 4: Hard Refresh the Browser
Once the dev server is running:
1. Open your browser to `http://localhost:5173`
2. Do a hard refresh:
   - **Mac**: `Cmd + Shift + R` or `Cmd + Option + R`
   - **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`

## Expected Results After Restart

### ✅ Email Modal Improvements
- **Preview Modal**: Click "Preview HTML" button to see rendered email preview
- **Image Gallery**: Approval emails will include signed image URLs with gallery
- **Navigation Arrows**: Previous/Next use proper chevron icons (left/right)
- **Countdown Timer**: Prominent countdown in approval pending alert

### ✅ Job Details Page
- **Countdown Banner**: When an approval email is sent, you'll see a countdown timer banner similar to the one in the email modal
- The banner shows: "Approval Email Pending" with time remaining

### ✅ Approval from Email
- Clicking approve/deny links in emails will properly update job status
- Public approval pages will work with image access

## Files Modified
- `src/components/EnhancedPropertyNotificationModal.tsx` - Preview modal, image gallery, countdown
- `src/components/JobDetails.tsx` - Countdown timer logic and UI
- Database migrations for approval_tokens system already deployed

## Troubleshooting

### If changes still don't show:
1. Check browser console for errors
2. Clear browser cache completely
3. Try incognito/private browsing mode
4. Verify you're on the correct port (5173)

### If approval links don't work:
1. Check that Edge Functions are deployed:
   ```bash
   supabase functions list
   ```
2. Verify approval_tokens table exists in database
3. Check that RLS policies are enabled for public access

## Next Steps
After confirming the changes are visible:
1. Test sending an approval email from job details
2. Verify countdown timer appears in both email modal and job details page
3. Click Preview HTML to see the email render
4. Check that images are linked in the email preview
5. Test approval links from the email (if you have an AP contact email configured)
