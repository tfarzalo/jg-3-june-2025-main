# Plan: Unified Extra Charges System with Safety Backups

## 0. Safety & Revert Strategy
- **Goal**: Create immediate restore points for all modified files.
- **Action**: Create a `_backups` directory and copy the following files before any edits:
  - `src/features/jobs/JobDetails/BillingBreakdownV2.tsx`
  - `src/components/JobDetails.tsx`
  - `src/components/EnhancedPropertyNotificationModal.tsx`
  - `src/components/approval/ApprovalDetailsCard.tsx`
  - `src/utils/generateApprovalPDF.ts`
  - `src/pages/ApprovalPage.tsx`
  - `src/components/shared/JobListingPage.tsx`

## 1. UI Unification (`BillingBreakdownV2.tsx`)
- **Goal**: Create a single "Extra Charges" section listing all non-base charges line-by-line.
- **Changes**:
  - Remove separate "Additional Services" and "Extra Charges" cards.
  - Implement a `UnifiedChargesTable` rendering:
    - **Additional Services** (Description, Qty, Unit, Cost).
    - **Hourly Labor** (Description, Hours, Rate, Cost).
  - Update "Grand Total" to show a single "Extra Charges" sum.

## 2. Approval Token Payload (`EnhancedPropertyNotificationModal.tsx`)
- **Goal**: Ensure the approval token contains the full list of charges.
- **Changes**:
  - Add `additionalServices` prop.
  - Update `buildBillingItems` to return a combined array mapping both Additional Services and Extra Charges to a standardized item structure (`{ description, cost, quantity, unit, hours }`).

## 3. Data Passing (`JobDetails.tsx`)
- **Goal**: Feed the modal with the necessary data.
- **Changes**:
  - Pass the calculated `additionalBillingLines` to `<EnhancedPropertyNotificationModal />`.

## 4. Approval View (`ApprovalDetailsCard.tsx` & `ApprovalPage.tsx`)
- **Goal**: Display the unified list with specific details.
- **Changes**:
  - Update `ApprovalDetailsCard` to render `quantity` and `unit` if present (e.g., "5x Ceilings") alongside existing `hours` support.
  - Update TypeScript interfaces to support these optional fields.

## 5. PDF Generation (`generateApprovalPDF.ts`)
- **Goal**: Reflect the unified list in the PDF.
- **Changes**:
  - Update table columns to "Qty/Hrs".
  - Render the combined list of items.

## 6. Export Logic (`JobListingPage.tsx`)
- **Goal**: Ensure exports reflect the total extra charges.
- **Changes**:
  - In `exportToCSV`, sum `additionalServicesBillAmount` into `extraChargesBillToCustomer` columns.
