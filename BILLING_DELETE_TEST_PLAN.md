# Billing Delete Functionality - Testing Plan

## Test Environment Setup

### Prerequisites
1. Access to a test property with billing details
2. Multiple billing categories configured
3. Multiple line items per category
4. Browser console open (for error monitoring)

---

## Test Suite 1: Line Item Deletion (Critical Path)

### Test 1.1: Single Line Item Delete
**Priority**: P0 (Critical)

**Steps**:
1. Navigate to property billing details page
2. Locate a category with multiple line items
3. Click the "X" button on one line item
4. Click "Save All Changes" button
5. Wait for success toast notification
6. Refresh the browser page (F5 or Cmd+R)

**Expected Results**:
- ✅ Line item disappears from UI immediately after clicking X
- ✅ "Save All Changes" button becomes enabled (hasChanges = true)
- ✅ Success toast appears: "Billing details saved successfully"
- ✅ After refresh, deleted line item does NOT reappear
- ✅ Other line items remain intact
- ✅ No errors in browser console

**Fail Criteria**:
- ❌ Line item reappears after refresh
- ❌ Error appears in console
- ❌ No success toast shown

---

### Test 1.2: Multiple Line Items Delete (Same Category)
**Priority**: P0 (Critical)

**Steps**:
1. Navigate to property billing details
2. Select a category with 4+ line items
3. Click "X" on 3 different line items in the same category
4. Click "Save All Changes"
5. Refresh page

**Expected Results**:
- ✅ All 3 deleted items stay deleted
- ✅ Remaining item(s) display correctly
- ✅ Category still exists
- ✅ Data consistent after refresh

---

### Test 1.3: Delete All Line Items in Category
**Priority**: P1 (High)

**Steps**:
1. Find category with line items
2. Delete all line items (click X on each)
3. Click "Save All Changes"
4. Refresh page

**Expected Results**:
- ✅ Category remains but shows "Add Line Item" button
- ✅ No line items displayed
- ✅ Category can have new line items added
- ✅ No errors

---

### Test 1.4: Multiple Line Items Delete (Different Categories)
**Priority**: P1 (High)

**Steps**:
1. Delete 1 line item from "Labor" category
2. Delete 1 line item from "Materials" category
3. Delete 1 line item from "Trash Removal" category
4. Click "Save All Changes"
5. Refresh page

**Expected Results**:
- ✅ All 3 deletions persist across categories
- ✅ No cross-contamination between categories
- ✅ Remaining items in each category intact

---

## Test Suite 2: Category Deletion

### Test 2.1: Delete Non-Default Category
**Priority**: P0 (Critical)

**Steps**:
1. Navigate to billing details
2. Find a non-default category (not Labor, Materials, Trash Removal)
3. Click trash icon next to category
4. Read confirmation dialog
5. Click "Delete from Property"
6. Refresh page

**Expected Results**:
- ✅ Confirmation dialog appears with category name
- ✅ Dialog mentions "all its line items"
- ✅ Toast shows "Removing billing category..."
- ✅ Success toast: "billing category removed successfully"
- ✅ Category removed from UI
- ✅ All line items in that category also deleted
- ✅ After refresh, category stays deleted

---

### Test 2.2: Cannot Delete Default Category
**Priority**: P1 (High)

**Steps**:
1. Try to delete "Labor" category
2. Try to delete "Materials" category
3. Try to delete "Trash Removal" category

**Expected Results**:
- ✅ Delete button is disabled/grayed out
- ✅ Tooltip shows "Default categories cannot be removed"
- ✅ Blue shield icon visible with "Included" text
- ✅ Clicking does nothing

---

### Test 2.3: Delete Category Confirmation Cancel
**Priority**: P2 (Medium)

**Steps**:
1. Click trash icon on category
2. Read confirmation dialog
3. Click "Cancel"

**Expected Results**:
- ✅ Dialog closes
- ✅ Category NOT deleted
- ✅ No changes to data
- ✅ Can still interact with category

---

## Test Suite 3: Auto-Save Functionality

### Test 3.1: Auto-Save with Deletion
**Priority**: P1 (High)

**Steps**:
1. Delete a line item
2. Wait exactly 2+ seconds (don't click anything)
3. Check for auto-save toast
4. Navigate away from page (click back)
5. Return to billing details page

**Expected Results**:
- ✅ After 2 seconds, see auto-save activity
- ✅ Deleted item NOT restored when returning
- ✅ "hasChanges" flag cleared
- ✅ No unsaved changes warning

---

### Test 3.2: Auto-Save Cancellation
**Priority**: P2 (Medium)

**Steps**:
1. Delete a line item
2. Wait 1 second
3. Immediately click "Save All Changes" (before 2 seconds)

**Expected Results**:
- ✅ Manual save works correctly
- ✅ Auto-save timer cleared
- ✅ No duplicate saves
- ✅ Item deleted successfully

---

## Test Suite 4: Drag & Drop with Deletion

### Test 4.1: Reorder Then Delete
**Priority**: P1 (High)

**Steps**:
1. Drag line item #1 to position #3
2. Drag line item #2 to position #1
3. Delete the original line item #3
4. Click "Save All Changes"
5. Refresh page

**Expected Results**:
- ✅ New order maintained
- ✅ Deleted item gone
- ✅ sort_order values correct in database

---

### Test 4.2: Delete Then Reorder
**Priority**: P2 (Medium)

**Steps**:
1. Delete middle line item
2. Reorder remaining items
3. Save
4. Refresh

**Expected Results**:
- ✅ Deletion persists
- ✅ New order persists
- ✅ No gaps in sort_order

---

## Test Suite 5: Error Handling

### Test 5.1: Network Error During Delete
**Priority**: P1 (High)

**Steps**:
1. Open browser DevTools → Network tab
2. Set network to "Offline"
3. Try to delete a line item
4. Click "Save All Changes"

**Expected Results**:
- ✅ Error toast appears: "Failed to clear existing billing details"
- ✅ Red error message at top of form
- ✅ Data NOT corrupted
- ✅ Can retry after reconnecting

---

### Test 5.2: Database Error During Save
**Priority**: P2 (Medium)

**Steps**:
1. Delete line item
2. Simulate database error (if possible via admin panel)
3. Try to save

**Expected Results**:
- ✅ Error toast with descriptive message
- ✅ Loading state stops
- ✅ User can retry
- ✅ No partial saves (transaction rollback)

---

## Test Suite 6: Concurrent Edits

### Test 6.1: Two Users Editing Same Property
**Priority**: P2 (Medium)

**Steps**:
1. User A opens billing details
2. User B opens same billing details
3. User A deletes line item and saves
4. User B tries to delete different item and save

**Expected Results**:
- ✅ Last save wins (expected behavior)
- ✅ No database corruption
- ✅ Consider adding conflict resolution in future

---

## Test Suite 7: Edge Cases

### Test 7.1: Rapid Multiple Deletes
**Priority**: P2 (Medium)

**Steps**:
1. Quickly click X on 5+ line items rapidly
2. Immediately click "Save All Changes"

**Expected Results**:
- ✅ All deletions processed
- ✅ No race conditions
- ✅ Single save operation
- ✅ All deleted items gone after refresh

---

### Test 7.2: Delete + Navigate Away
**Priority**: P1 (High)

**Steps**:
1. Delete line item
2. Immediately click browser back button

**Expected Results**:
- ✅ Unsaved changes warning appears
- ✅ If confirmed, changes lost
- ✅ If cancelled, stays on page
- ✅ No data corruption

---

### Test 7.3: Delete Last Line Item, Add New, Save
**Priority**: P2 (Medium)

**Steps**:
1. Delete all line items in category
2. Click "Add Line Item"
3. Fill in new line item
4. Save

**Expected Results**:
- ✅ Old items deleted
- ✅ New item saved
- ✅ sort_order = 1 for new item
- ✅ Category displays correctly

---

## Test Suite 8: Data Integrity

### Test 8.1: Verify Database State After Delete
**Priority**: P1 (High)

**Steps**:
1. Note IDs of line items before delete
2. Delete items
3. Save
4. Query database directly:
```sql
SELECT * FROM billing_details 
WHERE property_id = 'test-property-id'
AND id IN ('deleted-id-1', 'deleted-id-2');
```

**Expected Results**:
- ✅ Query returns 0 rows
- ✅ Deleted items completely removed
- ✅ No orphaned records

---

### Test 8.2: Verify Cascade on Category Delete
**Priority**: P1 (High)

**Steps**:
1. Note category ID and associated line item IDs
2. Delete category
3. Query database:
```sql
SELECT * FROM billing_details WHERE category_id = 'deleted-category-id';
SELECT * FROM billing_categories WHERE id = 'deleted-category-id';
```

**Expected Results**:
- ✅ Both queries return 0 rows
- ✅ Complete cascade delete
- ✅ No orphaned line items

---

## Test Suite 9: UI/UX Verification

### Test 9.1: Toast Notifications
**Priority**: P2 (Medium)

**Verify**:
- ✅ "Removing..." toast appears immediately
- ✅ Success toast appears on completion
- ✅ Error toast appears on failure
- ✅ Toasts auto-dismiss after 3-5 seconds
- ✅ Toasts are readable and descriptive

---

### Test 9.2: Loading States
**Priority**: P2 (Medium)

**Verify**:
- ✅ "Save All Changes" button shows "Saving..."
- ✅ Button disabled during save
- ✅ Can't click delete buttons during save
- ✅ Loading completes properly

---

### Test 9.3: Confirmation Dialogs
**Priority**: P2 (Medium)

**Verify**:
- ✅ Dialog is modal (blocks background interaction)
- ✅ Message is clear and includes entity name
- ✅ "Cancel" and "Delete" buttons clearly labeled
- ✅ Delete button is red/warning color
- ✅ Escape key closes dialog (cancels)

---

## Test Suite 10: Accessibility

### Test 10.1: Keyboard Navigation
**Priority**: P2 (Medium)

**Steps**:
1. Tab through page
2. Use Enter/Space to activate delete button
3. Tab through confirmation dialog
4. Use Enter to confirm delete

**Expected Results**:
- ✅ All interactive elements reachable via keyboard
- ✅ Focus visible
- ✅ Delete can be triggered via keyboard
- ✅ Dialog can be navigated with keyboard

---

### Test 10.2: Screen Reader
**Priority**: P3 (Low)

**Verify**:
- ✅ Delete button has aria-label
- ✅ Confirmation dialog has role="dialog"
- ✅ Success/error messages announced
- ✅ Loading states announced

---

## Test Suite 11: Browser Compatibility

### Test 11.1: Cross-Browser Testing
**Priority**: P2 (Medium)

**Test On**:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

**Verify All Core Features**:
- Line item delete
- Category delete
- Save persistence
- Toast notifications

---

## Test Suite 12: Performance

### Test 12.1: Large Dataset
**Priority**: P2 (Medium)

**Steps**:
1. Create property with 10 categories
2. Each category has 10 line items (100 total)
3. Delete 50 line items
4. Save

**Expected Results**:
- ✅ Saves complete in < 3 seconds
- ✅ No UI lag
- ✅ All deletions persist
- ✅ No timeout errors

---

## Test Suite 13: Regression Tests

### Test 13.1: Other Billing Features Still Work
**Priority**: P1 (High)

**Verify**:
- ✅ Can add new line items
- ✅ Can edit line item amounts
- ✅ Can add new categories
- ✅ Can toggle "Show on Work Order"
- ✅ Can edit category descriptions
- ✅ Drag & drop reordering works

---

## Automated Test Coverage

### Unit Tests Needed
```typescript
// deleteHandler.test.ts
describe('DeleteHandler', () => {
  it('should show confirmation dialog');
  it('should call deleteApiCall on confirm');
  it('should not call deleteApiCall on cancel');
  it('should show success toast on success');
  it('should show error toast on error');
  it('should call onSuccess callback');
  it('should call onError callback');
  it('should handle batch deletes');
});

// BillingDetailsForm.test.tsx
describe('BillingDetailsForm', () => {
  it('should delete line item from state on X click');
  it('should delete from database on save');
  it('should refresh data after delete');
  it('should handle category deletion');
  it('should prevent default category deletion');
});
```

---

## Sign-Off Checklist

Before marking as COMPLETE:
- [ ] All P0 tests pass
- [ ] All P1 tests pass
- [ ] At least 80% of P2 tests pass
- [ ] No critical errors in console
- [ ] Database integrity verified
- [ ] Cross-browser tested
- [ ] Performance acceptable
- [ ] Documentation reviewed
- [ ] Stakeholder demo completed

---

## Test Results Template

```markdown
## Test Execution Report

**Date**: [Date]
**Tester**: [Name]
**Environment**: [Dev/Staging/Production]
**Browser**: [Chrome 120, etc.]

### Results Summary
- Total Tests: XX
- Passed: XX
- Failed: XX
- Skipped: XX

### P0 Critical Tests
- [ ] Test 1.1: Single Line Item Delete - PASS/FAIL
- [ ] Test 1.2: Multiple Line Items Delete - PASS/FAIL
- [ ] Test 2.1: Delete Non-Default Category - PASS/FAIL

### Issues Found
1. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce: ...
   - Expected: ...
   - Actual: ...

### Overall Assessment
- [ ] APPROVED FOR PRODUCTION
- [ ] NEEDS FIXES
- [ ] BLOCKED

**Notes**: [Any additional context]
```

---

## Continuous Monitoring (Post-Deployment)

### Week 1 Metrics to Track
- [ ] Delete operation success rate
- [ ] Error rate in logs
- [ ] User support tickets related to billing
- [ ] Average save time
- [ ] Browser console errors reported

### Alert Thresholds
- Error rate > 1%: Investigate immediately
- Support tickets > 2 in 24h: Review logs
- Save time > 5s: Performance investigation

---

**Test Plan Version**: 1.0  
**Created**: January 23, 2026  
**Last Updated**: January 23, 2026  
**Owner**: QA Team  
**Status**: Ready for Execution
