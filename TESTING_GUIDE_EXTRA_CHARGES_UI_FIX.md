# Testing Guide: Extra Charges UI Update Fix

## What Was Fixed
The Extra Charges status banner now updates **immediately** when extra charges are declined (or approved) without requiring a manual page refresh.

## How to Test the Fix

### Test 1: Decline Extra Charges via Email
1. **Setup**: Have a job with `has_extra_charges = true` in "Pending Work Order" phase
2. Go to the job details page
3. Click "Send Approval Email" button
4. Check your email for the approval link
5. Click the **"Decline"** button in the email or on the approval page
6. **EXPECTED**: The yellow "Pending Approval" banner should **immediately** change to a red "Declined" banner showing:
   - ❌ Icon
   - "Extra Charges Declined" heading
   - Approver name/email and timestamp
   - Decline reason (if provided)
   - "Resend Approval Email" button
   - "Approve Manually" button (for admins)

### Test 2: Approve Extra Charges via Email
1. **Setup**: Same as Test 1
2. Go to the job details page (should show yellow "Pending" banner)
3. Click "Send Approval Email"
4. Click the **"Approve"** button in the email/approval page
5. **EXPECTED**: The yellow banner should **immediately** change to a green "Approved" banner showing:
   - ✅ Icon
   - "Extra Charges Approved" heading
   - Approver name/email and timestamp
   - Message about phase change to "Work Order"

### Test 3: Manual Approval by Admin
1. **Setup**: Job with extra charges in "Pending Work Order" phase
2. As an admin user, go to job details
3. Click the orange **"Approve Manually"** button
4. **EXPECTED**: 
   - Alert confirms success
   - Banner changes from yellow to green
   - Job phase badge updates to "Work Order"
   - No need to refresh page

### Test 4: Decline After Previous Decline (Resend)
1. **Setup**: Job that was already declined
2. Red "Declined" banner should be visible
3. Click "Resend Approval Email"
4. In email, click "Decline" again (with different reason if desired)
5. **EXPECTED**: Red banner remains but updates with new timestamp/reason

### Test 5: Override Decline with Manual Approval
1. **Setup**: Job with declined extra charges (red banner showing)
2. As admin, click "Approve Manually" button on the red banner
3. **EXPECTED**:
   - Red banner changes to green "Approved" banner
   - Job phase updates to "Work Order"
   - Activity log shows both decline and approval entries

### Test 6: Cross-Tab Communication
1. Open job details in **Tab A**
2. Click "Send Approval Email"
3. Open the approval link in a **new Tab B** (don't close Tab A)
4. In Tab B, click "Decline"
5. Switch back to **Tab A**
6. **EXPECTED**: Tab A shows red "Declined" banner (updated automatically)

## What to Look For

### UI States

#### 🟡 Pending State (No Decision Yet)
```
⚠️ Extra Charges Pending Approval
This work order has extra charges that require approval before proceeding.
[Send Approval Email] [Approve Manually]
```

#### 🔴 Declined State
```
❌ Extra Charges Declined
The extra charges were declined by John Doe (john@example.com) on Dec 11, 2024, 3:45 PM.
Reason: Too expensive
[Resend Approval Email] [Approve Manually]
```

#### 🟢 Approved State
```
✅ Extra Charges Approved
The extra charges were approved by Jane Smith (jane@example.com) on Dec 11, 2024, 4:00 PM.
The job has been moved to Work Order phase.
```

## Activity Log Verification

### For Declines
Check that activity log shows:
- Phase: "Pending Work Order → Pending Work Order"
- Changed by: [Approver name/email]
- Reason: "Extra charges declined: [reason]"
- Timestamp matches the decline time

### For Approvals
Check that activity log shows:
- Phase: "Pending Work Order → Work Order"
- Changed by: [Approver name/email or Admin]
- Reason: "Extra charges approved"
- Timestamp matches the approval time

## Browser Console Verification

Open browser DevTools console and look for:

### When decline happens:
```
Received approval/decline message from ApprovalPage: {type: 'APPROVAL_DECLINED', jobId: '...', timestamp: ...}
```

### When approve happens:
```
Received approval/decline message from ApprovalPage: {type: 'APPROVAL_COMPLETED', jobId: '...', timestamp: ...}
```

These logs confirm the event communication is working.

## Troubleshooting

### Banner doesn't update immediately
- Check browser console for event messages
- Verify ApprovalPage is running the latest code
- Try switching tabs and back (fallback mechanism)
- Check network tab to ensure database queries complete

### Wrong state showing
- Verify `approval_tokens` table has the latest decision
- Check `job_phase_changes` table for phase history
- Ensure no browser caching issues (hard refresh with Cmd+Shift+R)

### Events not received
- Verify both pages are on same origin (same domain/port)
- Check for browser popup blockers
- Check console for CORS or security errors

## Success Criteria
✅ All 6 tests pass without manual page refresh
✅ Activity log shows all approval/decline events
✅ Phase history accurately reflects state changes
✅ UI shows correct buttons for each state
✅ Cross-tab communication works
✅ No duplicate banners or UI glitches
✅ Console shows event communication logs

## Notes
- The old visibility change fallback still works as a backup
- Events are origin-checked for security
- Multiple declines/approvals are all logged correctly
- Manual approvals by admins also trigger UI updates
