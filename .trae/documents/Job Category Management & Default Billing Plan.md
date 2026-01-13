# Job Category Management & Default Billing Categories Plan

## 1. Database Schema Updates

### 1.1 Update `job_categories` Table
We need to distinguish between "Default" categories (automatically added to properties) and "System" categories (cannot be deleted from Admin).

- **Add columns to `job_categories`**:
  - `is_default` (boolean, default `false`): Categories that are automatically added to every property's billing configuration.
  - `is_system` (boolean, default `false`): Core categories that cannot be deleted from the system (e.g., "Regular Paint", "Extra Charges").

### 1.2 Migration Script
Create a migration to:
1.  Add the new columns.
2.  Update existing core categories ("Regular Paint", "Ceiling Paint", "Extra Charges") to be `is_default = true` and `is_system = true`.

## 2. Admin Settings: Job Category Manager

### 2.1 New Component: `JobCategoryManager.tsx`
Create a new component in `src/components/admin/` to manage the global list of job categories.

- **Features**:
  - **List View**: Display all job categories with columns for Name, Description, Default Status, and Actions.
  - **Add Category**: Form to create a new global job category (Name, Description, Is Default toggle).
  - **Edit Category**: Allow updating name/description and toggling "Is Default".
    - *Note*: Toggling "Is Default" on should trigger an update to add this category to all existing properties (or we handle it lazily). Lazy handling (on property load) is safer and more performant.
  - **Delete Category**: Allow deleting categories that are NOT `is_system`.

### 2.2 Update `AppSettings.tsx`
- Add a new tab **"Job Categories"**.
- Render the `JobCategoryManager` component within this tab.

## 3. Property Billing Configuration Updates

### 3.1 Update `BillingDetailsForm.tsx`
Modify the component that manages billing rates for a specific property (`src/components/BillingDetailsForm.tsx`).

- **Auto-Initialization**:
  - When the component loads, fetch the list of global `is_default` job categories.
  - Compare with the property's existing `billing_categories`.
  - If any default category is missing, automatically insert it into `billing_categories` for this property (with empty details).
  - *Refinement*: Alternatively, just display them as "Ghost" categories if we don't want to clutter the DB until used, but the requirement says "pre-included... in the billing information breakdown", which implies they should exist. Inserting them ensures they are there.

- **UI Constraints**:
  - **Lock Removal**: For categories that match a global `is_default` category, disable the "Delete/Remove" button in the Property Billing form.
  - **Visual Indicator**: Add a badge or icon (e.g., "Default") to show these are system-mandated categories.

## 4. Implementation Steps

1.  **Database Migration**: Run SQL to alter `job_categories` and set initial data.
2.  **Backend/API**: Ensure RLS policies allow Admins to manage these categories.
3.  **Frontend - Admin**: Build `JobCategoryManager` and integrate into `AppSettings`.
4.  **Frontend - Property**: Update `BillingDetailsForm` to enforce default categories.
5.  **Verification**: Test adding a new default category and verifying it appears on a property's billing page without the ability to remove it.

## 5. Timeline & Priorities
- **Priority 1**: Database changes and Admin Interface (allows management).
- **Priority 2**: Property Billing integration (enforces the business rule).
