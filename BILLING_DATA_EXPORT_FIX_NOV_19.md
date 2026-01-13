# Billing Data Export Fix - November 19, 2025

## Issue Identified
Billing breakdown fields (Base Bill to Customer, Pay to Subcontractor, Profit, etc.) were showing "N/A" in exports even when billing data existed in the database.

## Root Causes

### 1. Missing Fields in Data Fetch
**Problem:** The `useJobFetch` hook was not fetching billing-related fields from the database.

**Files Affected:**
- `src/components/shared/useJobFetch.ts`

**Missing Fields:**
- `invoice_sent`
- `invoice_paid`
- `invoice_sent_date`
- `invoice_paid_date`
- `billing_details` (relationship to billing_details table)
- `extra_charges_details` (relationship to billing_details table for extra charges)

### 2. Incorrect Null/Zero Handling
**Problem:** The export function was treating `0` (zero) as falsy and showing "N/A" instead of "$0.00".

**Example:**
```typescript
// BEFORE (incorrect)
if (baseBillAmount) row['Base Bill to Customer'] = `$${baseBillAmount.toFixed(2)}`;
// If baseBillAmount = 0, this evaluates to false and row never gets set

// AFTER (correct)
if (baseBillAmount !== null) row['Base Bill to Customer'] = `$${baseBillAmount.toFixed(2)}`;
// Now properly distinguishes between 0 (valid) and null (missing)
```

## Fixes Applied

### Fix 1: Updated useJobFetch Query
**File:** `src/components/shared/useJobFetch.ts`

Added billing fields to the main query:
```typescript
.select(`
  id,
  work_order_num,
  unit_number,
  scheduled_date,
  total_billing_amount,
  invoice_sent,              // ← NEW
  invoice_paid,              // ← NEW
  invoice_sent_date,         // ← NEW
  invoice_paid_date,         // ← NEW
  // ...other fields...
  billing_details:billing_detail_id (          // ← NEW
    bill_amount,
    sub_pay_amount,
    profit_amount
  ),
  extra_charges_details:extra_charges_billing_detail_id (  // ← NEW
    bill_amount,
    sub_pay_amount,
    profit_amount
  )
`)
```

### Fix 2: Updated Data Transformation
**File:** `src/components/shared/useJobFetch.ts`

Added billing fields to the transformed job object:
```typescript
const transformedJobs: Job[] = (data || []).map(job => ({
  id: job.id,
  // ...existing fields...
  invoice_sent: job.invoice_sent,
  invoice_paid: job.invoice_paid,
  invoice_sent_date: job.invoice_sent_date,
  invoice_paid_date: job.invoice_paid_date,
  billing_details: Array.isArray(job.billing_details) 
    ? job.billing_details[0] 
    : job.billing_details,
  extra_charges_details: Array.isArray(job.extra_charges_details) 
    ? job.extra_charges_details[0] 
    : job.extra_charges_details
}));
```

### Fix 3: Updated Realtime Subscription
**File:** `src/components/shared/useJobFetch.ts`

Updated the INSERT event handler to fetch billing fields for newly added jobs:
- Added billing fields to the realtime subscription query
- Updated the transformed job object to include billing data

### Fix 4: Fixed Null vs Zero Handling
**File:** `src/components/shared/JobListingPage.tsx` - `exportToCSV()` function

Changed from using `?? 0` (defaults to 0) to `?? null` (defaults to null):

```typescript
// BEFORE
const baseBillAmount = job.billing_details?.bill_amount ?? 0;
if (baseBillAmount) row['Base Bill to Customer'] = `$${baseBillAmount.toFixed(2)}` : 'N/A';
// Problem: 0 is falsy, shows N/A instead of $0.00

// AFTER
const baseBillAmount = job.billing_details?.bill_amount ?? null;
if (baseBillAmount !== null) row['Base Bill to Customer'] = `$${baseBillAmount.toFixed(2)}` : 'N/A';
// Solution: Explicitly check for null, allows 0 to be displayed as $0.00
```

Applied this fix to ALL billing calculations:
- Base Billing (bill_amount, sub_pay_amount, profit)
- Additional Services (calculated amounts)
- Extra Charges (bill_amount, sub_pay_amount, profit)
- Grand Totals (sum of all categories)

## Data Flow

### Before Fix:
```
Database → useJobFetch (missing billing fields) → JobListingPage → Export (shows N/A)
```

### After Fix:
```
Database → useJobFetch (includes billing fields) → JobListingPage → Export (shows actual values)
```

## Testing Performed

### Test Case 1: Job with Complete Billing Data
**Expected:**
- Base Bill to Customer: $600.00 ✓
- Base Pay to Subcontractor: $300.00 ✓
- Base Profit: $300.00 ✓

### Test Case 2: Job with Zero Values
**Expected:**
- If sub_pay_amount = 0 → Shows "$0.00" (not "N/A") ✓

### Test Case 3: Job with No Billing Data
**Expected:**
- All billing fields show "N/A" ✓

### Test Case 4: Job with Extra Charges Only
**Expected:**
- Base fields: N/A (if no base billing)
- Extra Charges fields: Shows actual values ✓
- Totals: Shows extra charges totals ✓

## Database Relationships

The fix properly queries these relationships:

```sql
jobs table:
├── billing_detail_id → billing_details table
│   ├── bill_amount
│   ├── sub_pay_amount
│   └── profit_amount
│
├── extra_charges_billing_detail_id → billing_details table
│   ├── bill_amount
│   ├── sub_pay_amount
│   └── profit_amount
│
├── invoice_sent (boolean)
├── invoice_paid (boolean)
├── invoice_sent_date (date)
└── invoice_paid_date (date)
```

## Files Modified

1. **`src/components/shared/useJobFetch.ts`**
   - Updated main query to include billing fields (+10 lines)
   - Updated data transformation (+6 lines)
   - Updated realtime subscription INSERT handler (+10 lines)

2. **`src/components/shared/JobListingPage.tsx`**
   - Fixed null vs zero handling in billing calculations (~40 lines modified)
   - Changed all `?? 0` to `?? null`
   - Changed all `if (amount)` to `if (amount !== null)`

## Impact

✅ **Jobs with billing data now show correct values in exports**
✅ **Jobs with $0 amounts show "$0.00" instead of "N/A"**
✅ **Jobs without billing data still show "N/A" appropriately**
✅ **Invoice status fields (sent/paid/dates) now populated**
✅ **Realtime updates include billing data**
✅ **No breaking changes to existing functionality**

## Example Export Output

### Before Fix:
```csv
Work Order #,Base Bill to Customer,Base Pay to Subcontractor,Base Profit
WO-000123,N/A,N/A,N/A
```

### After Fix:
```csv
Work Order #,Base Bill to Customer,Base Pay to Subcontractor,Base Profit
WO-000123,$600.00,$300.00,$300.00
```

## Additional Notes

### Additional Services Calculation
The additional services amounts are calculated as:
```typescript
additionalServicesBillAmount = total_billing_amount - base_billing - extra_charges
```

This is an approximation. For 100% accuracy, you would need to fetch the actual `additionalBillingLines` from the work order (like JobDetails.tsx does), but this requires an additional query and processing. The current calculation is accurate when:
- The job has complete billing data
- No manual adjustments have been made
- All charges are accounted for in the three categories

### Zero vs Null Distinction
- **null/undefined**: Field doesn't exist or wasn't set → Show "N/A"
- **0**: Field exists with a value of zero → Show "$0.00"
- **positive number**: Field has a value → Show "$X.XX"

This distinction is important for financial reporting accuracy.

## Status

✅ **COMPLETE** - All billing data fields now properly fetch and export with correct values.

## Next Steps

Users should now see accurate billing breakdown in CSV exports:
1. Navigate to Completed Jobs page
2. Click Export → Configure & Export
3. Select billing breakdown fields
4. Export to CSV
5. Verify all billing amounts show actual values (not N/A)

If additional services amounts need to be more precise, consider fetching the actual additional billing lines data (from painted ceilings, accent walls, etc.) instead of using the calculated approach.
