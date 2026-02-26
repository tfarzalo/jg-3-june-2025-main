# Subcontractor Dashboard: Unit Size Display & Billing Order Fix

## Date: February 25, 2026

## Overview
Enhanced the subcontractor dashboard to display unit sizes in job listings and ensure billing information is displayed in the same order as configured in the property settings.

## Changes Made

### 1. Unit Size Display

#### Problem
- Unit size was being fetched but not displayed in the job cards
- Mapping logic wasn't handling the `unit_size` nested array from Supabase
- Unit size was missing from both pending/assigned jobs and tomorrow's jobs preview

#### Solution
**File: `src/components/SubcontractorDashboard.tsx`**

1. **Fixed Data Mapping** (Line ~479)
   - Added `unit_size` to the mapping function that flattens nested arrays from Supabase
   - Now properly handles when `unit_size` is returned as an array
   ```typescript
   unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
   ```

2. **Added Unit Size to Main Job Cards** (Line ~909)
   - Added conditional display of unit size next to the unit number
   - Styled as a badge with gray background for visibility
   - Only displays if `unit_size_label` exists
   ```tsx
   {job.unit_size?.unit_size_label && (
     <span className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
       {job.unit_size.unit_size_label}
     </span>
   )}
   ```

3. **Added Unit Size to Tomorrow's Jobs Preview** (Line ~1185)
   - Added unit size display in the compact tomorrow's jobs cards
   - Uses smaller text and padding to fit the compact layout
   - Wrapped in flexbox with gap for proper spacing
   ```tsx
   {job.unit_size?.unit_size_label && (
     <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
       {job.unit_size.unit_size_label}
     </span>
   )}
   ```

### 2. Billing Information Order

#### Problem
- Billing categories were not being fetched with their sort order
- Display order didn't match the property's configured billing order
- Interface didn't include `sort_order` field

#### Solution
**File: `src/components/SubcontractorDashboard.tsx`**

1. **Updated BillingCategory Interface** (Line ~81)
   - Added optional `sort_order` field to match the database schema
   ```typescript
   interface BillingCategory {
     id: string;
     name: string;
     is_extra_charge?: boolean | null;
     sort_order?: number;  // Added
     billing_details: BillingDetail[];
   }
   ```

2. **Updated Database Query** (Line ~578)
   - Added `sort_order` to the SELECT statement
   - Added `.order('sort_order', { ascending: true })` to ensure categories are fetched in the correct order
   ```typescript
   const { data: categoriesData, error: categoriesError } = await supabase
     .from('billing_categories')
     .select(`
       id,
       name,
       is_extra_charge,
       sort_order
     `)
     .eq('property_id', propertyId)
     .order('sort_order', { ascending: true });
   ```

3. **Updated Data Processing** (Line ~641)
   - Added `sort_order` to the processed billing data mapping
   ```typescript
   const processedBillingData: BillingCategory[] = (billingData || []).map(category => ({
     id: category.id,
     name: category.name,
     is_extra_charge: category.is_extra_charge ?? null,
     sort_order: category.sort_order,  // Added
     billing_details: ...
   }));
   ```

4. **Added Explicit Sort During Display** (Line ~1074)
   - Added explicit sorting when filtering categories for display
   - Ensures the order is preserved even after filtering
   - Sorts both standard and extra charge categories by `sort_order`
   ```typescript
   const sortedSubcontractorCategories = [...subcontractorCategories].sort(
     (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
   );
   
   const standardCategories = sortedSubcontractorCategories.filter(
     category => !category.is_extra_charge
   );
   
   const extraChargeCategories = sortedSubcontractorCategories.filter(
     category => category.is_extra_charge && category.name !== 'Extra Charges'
   );
   ```

## Testing Recommendations

### Unit Size Display
1. ✅ Verify unit size appears next to unit number in pending job assignments
2. ✅ Verify unit size appears in accepted/active jobs
3. ✅ Verify unit size appears in tomorrow's jobs preview section
4. ✅ Test with jobs that have no unit size (should gracefully hide the badge)
5. ✅ Test in both light and dark mode
6. ✅ Test on mobile and desktop viewports

### Billing Order
1. ✅ Compare billing category order in subcontractor dashboard with property settings
2. ✅ Verify standard categories appear in correct order
3. ✅ Verify extra charge categories appear in correct order after standard categories
4. ✅ Test with multiple properties that have different billing orders
5. ✅ Verify order is maintained after expanding/collapsing "More Info"

## Database Dependencies

### Tables Used
- `billing_categories` - requires `sort_order` column (already exists)
- `unit_sizes` - provides unit size labels
- `jobs` - links to unit_sizes via foreign key

### Foreign Keys
- `jobs.unit_size_id` → `unit_sizes.id`
- `billing_categories.property_id` → `properties.id`
- `billing_details.category_id` → `billing_categories.id`

## Impact
- **Subcontractors** can now immediately see unit sizes in job listings, helping with planning and resource allocation
- **Billing consistency** ensures subcontractors see categories in the same order as configured in property settings
- **Better user experience** with clear, organized information display
- **No breaking changes** - all changes are additive or enhance existing functionality

## Files Modified
1. `src/components/SubcontractorDashboard.tsx` - All changes in this single file

## No Database Migrations Required
All database schema requirements (sort_order, unit_size relationships) already exist in the database.
