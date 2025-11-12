# Testing Dynamic Billing Options Loading

## Overview
This guide helps verify that the frontend forms are properly loading billing options dynamically based on billing details and categories, without unit size restrictions.

## Test Steps

### 1. Database Setup Verification
First, ensure the billing categories and details exist:

```sql
-- Check if billing categories exist
SELECT id, name, property_id FROM billing_categories 
WHERE name IN ('Painted Ceilings', 'Accent Walls')
ORDER BY property_id, name;

-- Check if billing details exist for these categories
SELECT 
  bd.id,
  bd.property_id,
  bc.name as category_name,
  us.unit_size_label,
  bd.bill_amount,
  bd.sub_pay_amount
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bc.name IN ('Painted Ceilings', 'Accent Walls')
ORDER BY bd.property_id, bc.name, bd.bill_amount;
```

### 2. Frontend Loading Test
1. **Open a work order form** for a property that has billing details set up
2. **Check browser console** for these log messages:
   ```
   Property loaded, fetching billing options...
   Available billing categories: [...]
   Ceiling category found: {...}
   Accent category found: {...}
   Ceiling paint options found: [...]
   Accent wall options found: [...]
   ```

3. **Verify billing options are loaded** when you check the "Painted Ceilings" checkbox
4. **Verify billing options are loaded** when you check the "Accent Wall" checkbox

### 3. Expected Behavior

#### ✅ **Correct Behavior**
- Billing options load when property is selected
- Options show regardless of job's unit size
- Dropdowns display meaningful information (e.g., "1 Bedroom 1 - $75.00 per ceiling")
- No "unit size" restrictions in error messages

#### ❌ **Incorrect Behavior**
- Billing options don't load
- Options are filtered by unit size
- Error messages mention "unit size"
- Dropdowns show generic "Option 1" without context

### 4. Debug Information
The console should show detailed information about loaded options:

```javascript
ceilingPaintOptions details: [
  {
    id: "uuid-1",
    bill_amount: 75.00,
    unit_size_label: "1 Bedroom"
  },
  {
    id: "uuid-2", 
    bill_amount: 125.00,
    unit_size_label: "2 Bedroom"
  }
]
```

### 5. Common Issues & Solutions

#### **Issue: No billing options loaded**
- **Check**: Do billing categories exist for the property?
- **Solution**: Run the migration or manually insert categories

#### **Issue: Options filtered by unit size**
- **Check**: Is the fetchPropertyBillingOptions function filtering by unit_size_id?
- **Solution**: Ensure no unit size filtering in the query

#### **Issue: Generic option labels**
- **Check**: Are unit_sizes being joined in the query?
- **Solution**: Verify the SELECT includes `unit_sizes!inner(unit_size_label)`

## Key Points
- **Billing options are property-specific**, not unit-size specific
- **Unit size information is for display purposes only**, not for filtering
- **Service complexity determines pricing**, not property size
- **Multiple options can exist** for the same property with different service levels
