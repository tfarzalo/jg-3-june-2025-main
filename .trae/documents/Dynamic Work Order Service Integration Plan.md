# Feature Plan: Dynamic Work Order Service Integration

This plan implements a feature allowing Admin users to flag specific non-default billing categories to appear dynamically on the Work Order form.

## 1. Database Schema Updates

### 1.1 Update `billing_categories` Table
Add a flag to control visibility on the Work Order form.
- **Column**: `include_in_work_order` (boolean, default `false`)
- **Purpose**: Determines if this category should be rendered as an input field on `NewWorkOrder.tsx`.

### 1.2 Update `work_orders` Table
Add a flexible column to store data for these dynamic fields without altering the schema for every new category.
- **Column**: `additional_services` (JSONB, default `'{}'`)
- **Structure**:
  ```json
  {
    "category_id_uuid": {
      "quantity": 5,
      "billing_detail_id": "uuid-of-rate-used",
      "notes": "Optional notes"
    }
  }
  ```

## 2. Admin Interface Updates (Property Billing)

### 2.1 Modify `BillingDetailsForm.tsx`
- **Add Category Modal**:
  - When adding a **new** or **existing** category (that is NOT a System Default like "Regular Paint"), show a checkbox:
    - Label: *"Show on Work Order Form"*
    - Description: *"If checked, subcontractors can select this service and enter quantities when creating a work order."*
- **List View**:
  - Add a visual indicator (e.g., a "Form" icon or badge) to categories that have `include_in_work_order = true`.
- **Logic**:
  - Persist the `include_in_work_order` state to the `billing_categories` table.

## 3. Work Order Form Updates (Subcontractor/Admin View)

### 3.1 Modify `NewWorkOrder.tsx`
- **Fetch Logic**:
  - Fetch all `billing_categories` for the property where `include_in_work_order = true`.
  - Fetch corresponding `billing_details` for these categories to determine valid rates (Unit Size vs. Hourly).
- **Render Logic**:
  - Create a new section **"Additional Services"** (below "Accent Walls" / "Extra Charges").
  - Map through the fetched categories and render:
    - **Checkbox**: To enable the service.
    - **Quantity Input**: (If checked) To enter count (default 1).
    - **Unit Size Dropdown**: (If checked & not hourly) To select which rate applies (defaults to Job's unit size if applicable).
- **Save Logic**:
  - Collect these values and save them into the `work_orders.additional_services` JSONB column.

## 4. Billing & Finance Integration

### 4.1 Update `getAdditionalBillingLines` (Billing Logic)
- **Location**: `src/lib/billing/additional.ts` (or equivalent helper).
- **Logic**:
  - Parse the `additional_services` JSONB from the work order.
  - For each entry:
    - Fetch the rate from `billing_details` using the stored `billing_detail_id`.
    - Calculate `Bill Amount` = `Rate` * `Quantity`.
    - Calculate `Sub Pay` = `Rate` * `Quantity`.
  - **Correction**: Append these as line items specifically to the **"Additional Services"** section of the financial breakdown (not "Other").

### 4.2 Update Job Details View
- Ensure `JobDetails.tsx` renders these dynamic line items in the **"Additional Services"** billing summary so they are visible to Admins.

## 5. Execution Steps
1.  **Migration**: Run SQL to add columns.
2.  **Admin UI**: Update `BillingDetailsForm` to set the flag.
3.  **Work Order UI**: Update `NewWorkOrder` to render dynamic fields.
4.  **Billing Logic**: Update calculation helpers to process the JSONB data.
5.  **Verification**: Test end-to-end from adding category -> creating WO -> viewing billing.
