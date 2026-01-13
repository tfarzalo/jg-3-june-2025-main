# Quick Test Guide - CSV Export Billing Fields

## Quick Test Scenarios

### Scenario 1: Basic Export Test
**Purpose:** Verify export works and includes billing fields

1. Navigate to **Completed Jobs** tab
2. Click **"Export Data"** button
3. Leave default date range (or select desired range)
4. In the **Billing/Invoice Information** section:
   - Check "Base Bill to Customer"
   - Check "Base Pay to Subcontractor"
   - Check "Base Profit"
5. Click **"Export to CSV"**
6. Open CSV and verify:
   - ✅ Columns "Base Bill to Customer", "Base Pay to Subcontractor", "Base Profit" are present
   - ✅ Values are formatted as "$X.XX" or "N/A"

### Scenario 2: Full Billing Export
**Purpose:** Verify all billing fields export correctly

1. Click **"Export Data"** button
2. In the **Billing/Invoice Information** section, check **ALL** checkboxes:
   - Invoice Status (Invoice Sent, Invoice Paid, dates)
   - Base Billing (all 3 fields)
   - Additional Services (all 3 fields)
   - Extra Charges (all 3 fields)
   - Grand Totals (all 3 fields)
3. Click **"Export to CSV"**
4. Open CSV and verify:
   - ✅ All 16 billing columns are present
   - ✅ Values are properly formatted
   - ✅ No missing columns

### Scenario 3: Data Accuracy Check
**Purpose:** Verify export matches job details page

1. From Completed Jobs list, note the Work Order # of a job with billing data (e.g., WO #24-001)
2. Click on that job to view Job Details
3. Scroll to **Billing Breakdown** section
4. Write down these values:
   ```
   Base Bill to Customer: $_____
   Base Pay to Subcontractor: $_____
   Base Profit: $_____
   Additional Services Total Bill: $_____
   Additional Services Total Pay: $_____
   Additional Services Total Profit: $_____
   Extra Charges Bill: $_____
   Extra Charges Pay: $_____
   Extra Charges Profit: $_____
   Total Bill to Customer: $_____
   Total Pay to Subcontractor: $_____
   Total Profit: $_____
   ```
5. Go back to Completed Jobs, click **"Export Data"**
6. Select all billing fields, export
7. Find the row for WO #24-001 in the CSV
8. Verify:
   - ✅ All values match exactly (to the cent)
   - ✅ Totals = Base + Additional + Extra

### Scenario 4: Additional Services Test
**Purpose:** Verify painted ceilings and accent walls are calculated correctly

1. Find a job with painted ceilings or accent walls:
   - Search for jobs with "Painted Ceilings: Yes" or "Accent Wall: Yes"
2. View that job's details
3. In Billing Breakdown > **Additional Services** section, note:
   - Service name (e.g., "Painted Ceilings (1 Bedroom)")
   - Quantity
   - Bill to Customer
   - Pay to Sub
   - Profit
4. Export the job's data
5. Verify in CSV:
   - ✅ "Additional Services Bill to Customer" matches the total shown on job details
   - ✅ "Additional Services Pay to Subcontractor" matches
   - ✅ "Additional Services Profit" matches

### Scenario 5: Edge Cases
**Purpose:** Test missing data, zero values, null values

Find and export jobs with these characteristics:

#### Job with NO billing data
- ✅ All billing fields show "N/A"

#### Job with ONLY base billing (no additional, no extra)
- ✅ Base fields show "$X.XX"
- ✅ Additional Services fields show "N/A"
- ✅ Extra Charges fields show "N/A"
- ✅ Grand Total = Base amount (not N/A)

#### Job with $0.00 values
- ✅ Shows "$0.00", not "N/A"

#### Job with painted ceilings (individual mode)
- ✅ Additional Services calculation uses ceiling count × rate
- ✅ Verify: (count from work order) × (rate from job details) = (additional services total in CSV)

### Scenario 6: Performance Test
**Purpose:** Verify export works with large datasets

1. Select a date range with 50+ completed jobs
2. Select all billing fields
3. Click export
4. Verify:
   - ✅ Export completes without errors
   - ✅ CSV opens successfully
   - ✅ All rows have data
   - ✅ No browser freeze or timeout

### Scenario 7: Selective Field Export
**Purpose:** Verify export fetching optimization

1. Export with NO billing fields selected
   - ✅ Export completes quickly (no billing data fetch)
   
2. Export with ONLY base billing fields
   - ✅ Export completes quickly (uses data already loaded)
   
3. Export with additional services fields
   - ✅ Export may take slightly longer (fetches work order billing details)
   - ✅ Export completes successfully

## Common Issues to Check

### ❌ Issue: Additional Services showing N/A when they should have values
**Check:**
- Does the job have painted_ceilings or has_accent_wall set to true?
- Does the work order have a ceiling_billing_detail_id or accent_wall_billing_detail_id?
- Are the billing_details records present in the database?

### ❌ Issue: Totals don't match job details page
**Check:**
- Are you comparing the same job (Work Order #)?
- Are all three components (Base, Additional, Extra) being added?
- Are null values being treated as 0 in the calculation?

### ❌ Issue: Export shows "$0.00" instead of "N/A"
**Check:**
- Is the billing_amount actually 0, or is it null?
- Zero is valid and should show as "$0.00"
- Only null/undefined should show "N/A"

### ❌ Issue: Export fails or times out
**Check:**
- How many jobs are being exported?
- Are you on a slow connection?
- Try a smaller date range
- Check browser console for errors

## Success Indicators

✅ Export completes without errors
✅ All selected columns appear in CSV
✅ Values match job details page
✅ "N/A" appears for missing data
✅ "$0.00" appears for zero values (not N/A)
✅ Totals = Base + Additional + Extra
✅ Additional Services calculated from actual rates × quantities
✅ No placeholder/hardcoded calculations

## If Something's Wrong

1. Check browser console for errors
2. Verify the job has billing data on the job details page
3. Check if the issue is data-related or calculation-related
4. Compare CSV row with job details page side-by-side
5. Note the Work Order # and any error messages

---
**Quick Reference:**
- Base Billing = from job.billing_details
- Additional Services = painted ceilings + accent walls (from work order billing details)
- Extra Charges = from job.extra_charges_details
- Grand Total = Base + Additional + Extra
