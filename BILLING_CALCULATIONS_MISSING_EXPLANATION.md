# What's Missing: Billing Calculations in get_job_details

## The Problem

The current `get_job_details` function (from Feb 25, 2026 migration) **does NOT include any billing calculations**. It's a simplified version that only returns basic job information.

## What the February 25, 2026 Version Returns

```sql
-- 20260225000002_update_get_job_details_with_is_full_paint.sql
SELECT json_build_object(
    'id', j.id,
    'work_order_num', j.work_order_num,
    'unit_number', j.unit_number,
    'purchase_order', j.purchase_order,
    'is_full_paint', j.is_full_paint,
    'description', j.description,
    'scheduled_date', j.scheduled_date,
    'assigned_to', j.assigned_to,
    'property', {...},
    'unit_size', {...},
    'job_type', {...},
    'job_phase', {...},
    'work_order', {...}
    -- ❌ NO billing_details
    -- ❌ NO hourly_billing_details
    -- ❌ NO extra_charges_details
) INTO result
```

**Missing**: `billing_details`, `hourly_billing_details`, `extra_charges_details`

This is why you see **$0.00 for everything** - the frontend receives `null` for all billing fields.

## What the June 2025 Version Had (That Got Overwritten)

```sql
-- 20250616000001_update_get_job_details_additional_services.sql
-- This version included:

DECLARE
    v_billing_details JSON;
    v_hourly_billing_details JSON;
    v_extra_charges_details JSON;
    -- ... many more variables

-- Step 1: Get billing category for the property + job category
SELECT bc.id, bc.name
INTO v_billing_category_id, v_billing_category_name
FROM billing_categories bc
WHERE bc.property_id = v_property_id
AND bc.name = v_job_category_name;

-- Step 2: Query billing_details table for rates
SELECT json_build_object(
    'bill_amount', bd.bill_amount,
    'sub_pay_amount', bd.sub_pay_amount,
    'profit_amount', bd.bill_amount - bd.sub_pay_amount,
    'is_hourly', bd.is_hourly,
    ...
)
INTO v_regular_billing_record
FROM billing_details bd
WHERE bd.category_id = v_billing_category_id
AND bd.unit_size_id = v_unit_size_id
AND bd.is_hourly = false;

-- Step 3: Build billing_details object
v_billing_details := CASE 
    WHEN v_regular_billing_record IS NOT NULL THEN
        json_build_object(
            'bill_amount', v_regular_bill_amount,
            'sub_pay_amount', v_regular_sub_pay_amount,
            'profit_amount', v_regular_bill_amount - v_regular_sub_pay_amount,
            ...
        )
    ELSE
        NULL
END;

-- Step 4: Return it in the final result
RETURN json_build_object(
    ...
    'billing_details', v_billing_details,  -- ✅ Included
    'hourly_billing_details', v_hourly_billing_details,  -- ✅ Included
    'extra_charges_details', v_extra_charges_details,  -- ✅ Included
    ...
);
```

## What the New Migration Does

The migration I just created (`20260303000001_restore_billing_calculations_to_get_job_details.sql`) **restores all the missing billing logic**:

### 1. Declares Variables for Billing Data
```sql
v_property_id UUID;
v_unit_size_id UUID;
v_job_category_name TEXT;
v_billing_category_id UUID;
v_billing_details JSON;
v_hourly_billing_details JSON;
v_extra_charges_details JSON;
-- ... etc
```

### 2. Fetches Property and Job Information
```sql
-- Get property, unit size, job category from the job
SELECT 
    j.property_id,
    j.unit_size_id,
    jc.name
INTO 
    v_property_id,
    v_unit_size_id,
    v_job_category_name
FROM jobs j
LEFT JOIN job_categories jc ON jc.id = j.job_category_id
WHERE j.id = p_job_id;
```

### 3. Finds the Billing Category
```sql
-- Find the billing category for this property + job category combination
SELECT bc.id, bc.name
INTO v_billing_category_id, v_billing_category_name
FROM billing_categories bc
WHERE bc.property_id = v_property_id
AND bc.name = v_job_category_name;
```

**This is the key step** - it looks up the billing category in the `billing_categories` table that matches:
- The property (e.g., "Cambridge Apartments")
- The job category name (e.g., "Regular Paint")

### 4. Queries the billing_details Table
```sql
-- Get the actual billing rates from billing_details
SELECT 
    json_build_object(
        'bill_amount', bd.bill_amount,
        'sub_pay_amount', bd.sub_pay_amount,
        'profit_amount', bd.bill_amount - bd.sub_pay_amount,
        'is_hourly', bd.is_hourly
    )
INTO v_regular_billing_record
FROM billing_details bd
WHERE bd.category_id = v_billing_category_id
AND bd.unit_size_id = v_unit_size_id
AND bd.is_hourly = false;
```

**This queries the `billing_details` table** which contains the actual rates you configured:
- `category_id` = the billing category ID (Regular Paint for this property)
- `unit_size_id` = the unit size (e.g., Studio)
- `is_hourly` = false (for regular billing)

**Returns**: `bill_amount` (what customer pays), `sub_pay_amount` (what sub gets paid)

### 5. Extracts the Amounts
```sql
v_regular_bill_amount := COALESCE((v_regular_billing_record->>'bill_amount')::NUMERIC, 0);
v_regular_sub_pay_amount := COALESCE((v_regular_billing_record->>'sub_pay_amount')::NUMERIC, 0);
```

### 6. Builds the billing_details Object
```sql
v_billing_details := CASE 
    WHEN v_regular_billing_record IS NOT NULL THEN
        json_build_object(
            'bill_amount', v_regular_bill_amount,
            'sub_pay_amount', v_regular_sub_pay_amount,
            'profit_amount', v_regular_bill_amount - v_regular_sub_pay_amount,
            'is_hourly', false,
            'section_name', 'Regular Billing'
        )
    ELSE
        NULL
END;
```

### 7. Returns It in the Final JSON
```sql
RETURN json_build_object(
    'id', j.id,
    'work_order_num', j.work_order_num,
    ...
    'billing_details', v_billing_details,  -- ✅ NOW INCLUDED
    'hourly_billing_details', v_hourly_billing_details,  -- ✅ NOW INCLUDED
    'extra_charges_details', v_extra_charges_details,  -- ✅ NOW INCLUDED
    ...
);
```

## The Data Flow

```
Job created with:
├─ Property: "Cambridge Apartments" (property_id)
├─ Unit Size: "Studio" (unit_size_id)
└─ Job Category: "Regular Paint" (job_category_id)

↓ get_job_details function runs

Step 1: Get job's property_id, unit_size_id, job_category.name
Step 2: Look up billing_categories WHERE property_id AND name = "Regular Paint"
        → Returns billing_category_id

Step 3: Query billing_details WHERE:
        - category_id = billing_category_id
        - unit_size_id = unit_size_id  
        - is_hourly = false
        
        → Returns: { bill_amount: 450.00, sub_pay_amount: 300.00 }

Step 4: Build billing_details object with these amounts
Step 5: Return to frontend

↓ Frontend receives

job.billing_details = {
    bill_amount: 450.00,
    sub_pay_amount: 300.00,
    profit_amount: 150.00,
    is_hourly: false,
    section_name: "Regular Billing"
}

↓ BillingBreakdownV2 component displays

Base Billing:
- Bill to Customer: $450.00
- Pay to Subcontractor: $300.00
- Profit: $150.00
```

## What Was Missing (Causing $0.00)

**Without the billing calculation logic:**
1. ❌ No lookup of billing_categories
2. ❌ No query to billing_details table
3. ❌ No extraction of bill_amount and sub_pay_amount
4. ❌ Returns `billing_details: undefined` to frontend
5. ❌ Frontend defaults to `?? 0` showing $0.00

**With the billing calculation logic restored:**
1. ✅ Looks up the correct billing category for the property
2. ✅ Queries the billing_details table for configured rates
3. ✅ Extracts bill_amount (e.g., $450) and sub_pay_amount (e.g., $300)
4. ✅ Calculates profit (e.g., $150)
5. ✅ Returns proper billing_details object to frontend
6. ✅ Frontend displays actual amounts: $450, $300, $150

## Why This Happened

The February 25, 2026 migrations (`20260225000002` and `20260225000005`) used `CREATE OR REPLACE FUNCTION` which **completely replaced** the comprehensive June 2025 version. They added `is_full_paint` and `is_occupied` fields but **removed all the billing logic** in the process.

This is a classic case of:
1. Developer adds new field (is_full_paint)
2. Uses simple version of function as base
3. Accidentally overwrites all the complex billing logic
4. Billing section shows $0.00 because no data is returned

## The Fix

The new migration restores **all the billing calculation logic** while **keeping** the recent additions:
- ✅ Billing calculations restored (queries billing_details table)
- ✅ Keeps is_full_paint field
- ✅ Keeps is_occupied field  
- ✅ Keeps all work_order fields
- ✅ Keeps additional_services
- ✅ Calculates extra charges
- ✅ Calculates hourly billing

Now when you view a job, the function will:
1. Look up the property's billing category (Regular Paint under Studio)
2. Query the billing_details table for that category + unit size
3. Return the actual bill_amount and sub_pay_amount you configured
4. Display $450 (or whatever you configured) instead of $0.00
