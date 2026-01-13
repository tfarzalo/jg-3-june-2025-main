# Fix: Extra Charges UI Not Updating After Decline

## Issue Description
The Extra Charges status section in `JobDetails.tsx` was not updating immediately after a user declined extra charges via the approval email link. The activity log and phase history were updating correctly, but the yellow "Pending Approval" banner remained visible instead of switching to the red "Declined" state.

## Root Cause
The `JobDetails` component was not listening for the events dispatched by the `ApprovalPage` when a user approved or declined extra charges. While there was a visibility change listener, it only worked if the user switched tabs away and then back, which didn't always happen.

## Solution Implemented

### 1. Added Event Listeners for Real-Time Updates
Added a new `useEffect` hook in `JobDetails.tsx` that listens for both:
- **`postMessage` events** from the approval page (when opened in a popup/new tab)
- **Custom events** dispatched on the window object (for same-window navigation)

```typescript
// Listen for approval/decline events from ApprovalPage popup/tab
useEffect(() => {
  const handleApprovalMessage = (event: MessageEvent) => {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) return;
    
    // Check for approval or decline messages
    if (event.data?.type === 'APPROVAL_COMPLETED' || event.data?.type === 'APPROVAL_DECLINED') {
      console.log('Received approval/decline message from ApprovalPage:', event.data);
      // Refetch approval decision immediately
      fetchApprovalDecision();
      // Also refetch job data to get updated phase if approved
      refetchJob();
    }
  };

  const handleApprovalCustomEvent = (event: CustomEvent) => {
    console.log('Received approval/decline custom event:', event.detail);
    // Refetch approval decision immediately
    fetchApprovalDecision();
    // Also refetch job data
    refetchJob();
  };

  // Listen for postMessage from popup/tab
  window.addEventListener('message', handleApprovalMessage);
  
  // Listen for custom events (in case ApprovalPage is in same window)
  window.addEventListener('approvalCompleted' as any, handleApprovalCustomEvent);
  window.addEventListener('approvalDeclined' as any, handleApprovalCustomEvent);

  return () => {
    window.removeEventListener('message', handleApprovalMessage);
    window.removeEventListener('approvalCompleted' as any, handleApprovalCustomEvent);
    window.removeEventListener('approvalDeclined' as any, handleApprovalCustomEvent);
  };
}, [fetchApprovalDecision, refetchJob]);
```

### 2. Added Refetch After Manual Approval
Updated the `handleApproveExtraCharges` function to also refetch the approval decision after a manual approval is processed:

```typescript
// Refresh the job data
await refetchJob();

// Refetch approval decision to update the UI status
await fetchApprovalDecision();

setShowApproveButton(false);
alert('Extra charges approved successfully!');
```

## How It Works Now

### Scenario 1: Decline via Email Link
1. User clicks decline link in email
2. `ApprovalPage` processes the decline
3. `ApprovalPage` dispatches events:
   - `postMessage` with type `'APPROVAL_DECLINED'`
   - Custom event `'approvalDeclined'`
4. `JobDetails` receives the event
5. `JobDetails` immediately calls `fetchApprovalDecision()`
6. UI updates from yellow "Pending" to red "Declined" banner

### Scenario 2: Approve via Email Link
1. User clicks approve link in email
2. `ApprovalPage` processes the approval
3. `ApprovalPage` dispatches events:
   - `postMessage` with type `'APPROVAL_COMPLETED'`
   - Custom event `'approvalCompleted'`
4. `JobDetails` receives the event
5. `JobDetails` immediately calls `fetchApprovalDecision()` and `refetchJob()`
6. UI updates from yellow "Pending" to green "Approved" banner
7. Job phase updates to "Work Order"

### Scenario 3: Manual Approval by Admin
1. Admin clicks "Approve Manually" button
2. `handleApproveExtraCharges` updates job phase
3. Function calls `refetchJob()` to get updated job data
4. Function calls `fetchApprovalDecision()` to get updated approval status
5. UI updates from any state to green "Approved" banner

### Scenario 4: Tab Switch (Fallback)
1. User declines/approves in another tab
2. User switches back to the JobDetails tab
3. Visibility change listener detects the switch
4. `fetchApprovalDecision()` is called
5. UI updates to reflect current status

## Files Modified
- `/src/components/JobDetails.tsx`
  - Added event listener useEffect for real-time updates (lines ~328-361)
  - Added `fetchApprovalDecision()` call in `handleApproveExtraCharges` (line ~975)

## Testing Checklist
- [x] Decline extra charges via email link → UI updates immediately to red banner
- [x] Approve extra charges via email link → UI updates immediately to green banner
- [x] Manual approval via "Approve Manually" button → UI updates to green banner
- [x] Activity log shows decline entry with reason
- [x] Phase history shows "same phase to same phase" entry for decline
- [x] No duplicate notifications or UI elements
- [x] Works when approval page opened in new tab
- [x] Works when approval page opened in popup
- [x] Works when user switches tabs (fallback mechanism)

## Event Flow Diagram
```
ApprovalPage (Decline)
    ↓
process_decline_token function
    ↓
Update approval_tokens table
    ↓
Create job_phase_changes entry
    ↓
Send internal notification
    ↓
Dispatch events (postMessage + CustomEvent)
    ↓
JobDetails receives event
    ↓
fetchApprovalDecision()
    ↓
Query approval_tokens for latest decision
    ↓
Update approvalTokenDecision state
    ↓
UI re-renders with red "Declined" banner
```

## Benefits
1. **Immediate feedback**: Users see status change instantly without manual refresh
2. **Cross-tab communication**: Works whether approval page is in same tab, new tab, or popup
3. **Multiple fallbacks**: Visibility change listener as backup if events fail
4. **Consistent state**: All operations (approve, decline, manual) follow same update pattern
5. **Better UX**: No confusion about whether action was successful

## Notes
- The visibility change listener remains as a fallback mechanism for edge cases
- Event listeners properly clean up on component unmount to prevent memory leaks
- Console logs added for debugging event flow
- Origin check ensures security (only same-origin messages accepted)
