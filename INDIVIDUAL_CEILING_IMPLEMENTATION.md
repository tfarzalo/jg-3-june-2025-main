# Individual Ceiling Implementation

## Overview

This implementation adds support for "Paint Individual Ceiling" option in the NewWorkOrder form, allowing users to specify the exact number of individual ceilings to be painted when the service-based billing options don't apply.

## Database Changes

### New Migration: `20250615000002_add_individual_ceiling_count.sql`

This migration adds a new column to the `work_orders` table:
- **`individual_ceiling_count`** - INTEGER column to store the number of individual ceilings
- **Check constraint** - Ensures the count is positive when provided
- **Index** - Added for better query performance

```sql
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS individual_ceiling_count INTEGER;

-- Add check constraint to ensure individual_ceiling_count is positive when provided
ALTER TABLE work_orders 
ADD CONSTRAINT IF NOT EXISTS check_individual_ceiling_count 
CHECK (individual_ceiling_count IS NULL OR individual_ceiling_count > 0);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_work_orders_individual_ceiling_count ON work_orders(individual_ceiling_count);
```

## Frontend Changes

### 1. TypeScript Interfaces Updated

#### **WorkOrder Interface**
```typescript
interface WorkOrder {
  // ... existing fields ...
  individual_ceiling_count?: number | null; // New field for individual ceiling count
  // ... existing fields ...
}
```

#### **Job Interface**
```typescript
interface Job {
  // ... existing fields ...
  individual_ceiling_count?: number | null; // New field for individual ceiling count
  // ... existing fields ...
}
```

#### **WorkOrderDBPayload Interface**
```typescript
interface WorkOrderDBPayload {
  // ... existing fields ...
  individual_ceiling_count?: number | null; // New field for individual ceiling count
  // ... existing fields ...
}
```

#### **FormData State**
```typescript
const [formData, setFormData] = useState({
  // ... existing fields ...
  individual_ceiling_count: null as number | null, // New field for individual ceiling count
  // ... existing fields ...
});
```

### 2. Form UI Updates

#### **English Version (`NewWorkOrder.tsx`)**
- Added "Paint Individual Ceiling" option to the ceiling selection dropdown
- Added conditional input field for individual ceiling count when "individual" is selected
- Input field validates range 1-20 with required validation

#### **Spanish Version (`NewWorkOrderSpanish.tsx`)**
- Added "Pintar Techo Individual" option to the ceiling selection dropdown
- Added conditional input field for individual ceiling count when "individual" is selected
- Input field validates range 1-20 with required validation

### 3. Form Logic Updates

#### **Ceiling Option Selection**
```typescript
<select>
  <option value="">Select ceiling option</option>
  {ceilingPaintOptions.map((option) => (
    <option key={option.id} value={option.id}>
      {option.unitSizeLabel}
    </option>
  ))}
  <option value="individual">Paint Individual Ceiling</option>
</select>
```

#### **Conditional Individual Ceiling Count Input**
```typescript
{formData.ceiling_rooms_count === 'individual' && (
  <div className="mt-3">
    <label htmlFor="individual_ceiling_count">
      How many individual ceilings? <span className="text-red-500">*</span>
    </label>
    <input
      type="number"
      id="individual_ceiling_count"
      name="individual_ceiling_count"
      min="1"
      max="20"
      required
      placeholder="Enter number of ceilings"
    />
  </div>
)}
```

## Backend Logic Updates

### 1. Payload Building

#### **Updated `buildWorkOrderPayload` Function**
```typescript
ceiling_rooms_count: (() => {
  if (typeof formData.ceiling_rooms_count === 'string') {
    if (formData.ceiling_rooms_count === 'individual') {
      // For individual ceiling painting, we don't set a billing detail ID
      return 0;
    }
    // For service-based categories, we store the billing detail ID
    return ceilingBillingDetailId ? 1 : 0;
  }
  return formData.ceiling_rooms_count || 0;
})(),
individual_ceiling_count: formData.individual_ceiling_count || null,
```

### 2. Billing Detail ID Handling

#### **Updated Billing Detail Logic**
```typescript
// Extract billing detail IDs from form data
if (formData.painted_ceilings && formData.ceiling_rooms_count && 
    typeof formData.ceiling_rooms_count === 'string' && 
    formData.ceiling_rooms_count !== 'individual') {
  ceilingBillingDetailId = formData.ceiling_rooms_count;
}
```

### 3. Validation Updates

#### **Enhanced Validation Logic**
```typescript
// Validate individual ceiling count when individual option is selected
if (payload.painted_ceilings && payload.ceiling_rooms_count === 0 && !payload.individual_ceiling_count) {
  errors.push('Individual ceiling count is required when "Paint Individual Ceiling" is selected');
}

// Validate individual ceiling count range
if (payload.individual_ceiling_count !== null && payload.individual_ceiling_count !== undefined) {
  if (payload.individual_ceiling_count <= 0) {
    errors.push('Individual ceiling count must be greater than 0');
  }
  if (payload.individual_ceiling_count > 20) {
    errors.push('Individual ceiling count cannot exceed 20');
  }
}
```

## Data Flow

### 1. **Service-Based Ceiling Painting**
```
Form Selection → Billing Detail ID → ceiling_billing_detail_id → Service-based pricing
```

### 2. **Individual Ceiling Painting**
```
Form Selection → "individual" → individual_ceiling_count → Custom ceiling count
```

### 3. **Form Submission Logic**
```typescript
if (formData.ceiling_rooms_count === 'individual') {
  // Set individual_ceiling_count, don't set ceiling_billing_detail_id
  workOrderPayload.ceiling_rooms_count = 0;
  workOrderPayload.individual_ceiling_count = formData.individual_ceiling_count;
} else {
  // Set ceiling_billing_detail_id for service-based pricing
  workOrderPayload.ceiling_billing_detail_id = ceilingBillingDetailId;
  workOrderPayload.individual_ceiling_count = null;
}
```

## Validation Rules

### 1. **Individual Ceiling Count Validation**
- **Required**: When "Paint Individual Ceiling" is selected
- **Range**: 1-20 ceilings
- **Type**: Integer
- **Null**: Allowed when not using individual ceiling option

### 2. **Mutual Exclusivity**
- **Service-based**: `ceiling_billing_detail_id` set, `individual_ceiling_count` null
- **Individual**: `individual_ceiling_count` set, `ceiling_billing_detail_id` null

### 3. **Form Validation**
- **Required fields**: Both ceiling option and individual count when applicable
- **Range validation**: Individual count must be 1-20
- **Error messages**: Clear feedback for validation failures

## Testing

### 1. **Test File Updates**
- Added `testIndividualCeilingCount()` function
- Tests validation rules for individual ceiling counts
- Verifies range validation (1-20)

### 2. **Console Testing**
```javascript
// Run tests in browser console
window.runNewWorkOrderTests()
```

## Usage Examples

### 1. **Service-Based Ceiling Painting**
```typescript
// User selects a billing option
formData.ceiling_rooms_count = "billing-detail-uuid-123"
formData.individual_ceiling_count = null

// Results in:
workOrderPayload.ceiling_billing_detail_id = "billing-detail-uuid-123"
workOrderPayload.individual_ceiling_count = null
workOrderPayload.ceiling_rooms_count = 1
```

### 2. **Individual Ceiling Painting**
```typescript
// User selects individual option
formData.ceiling_rooms_count = "individual"
formData.individual_ceiling_count = 5

// Results in:
workOrderPayload.ceiling_billing_detail_id = null
workOrderPayload.individual_ceiling_count = 5
workOrderPayload.ceiling_rooms_count = 0
```

## Benefits

### 1. **Flexibility**
- Supports both service-based and individual ceiling painting
- Maintains existing billing system integration
- Allows custom ceiling counts for special cases

### 2. **Data Integrity**
- Clear separation between billing methods
- Proper validation prevents invalid data
- Maintains referential integrity

### 3. **User Experience**
- Intuitive form flow
- Clear validation messages
- Supports both English and Spanish interfaces

## Future Enhancements

### 1. **Additional Validation**
- Property-specific ceiling count limits
- Unit size-based ceiling count validation
- Historical ceiling count analysis

### 2. **Enhanced UI**
- Visual ceiling count indicators
- Ceiling type categorization
- Advanced ceiling painting options

### 3. **Reporting**
- Individual ceiling painting analytics
- Cost analysis for individual vs. service-based
- Ceiling painting trends

## Conclusion

The Individual Ceiling implementation provides a robust solution for handling custom ceiling painting requirements while maintaining the existing service-based billing system. The implementation ensures data integrity, provides clear user feedback, and supports both English and Spanish interfaces.

Key features:
- ✅ New database column with proper constraints
- ✅ Enhanced form UI with conditional fields
- ✅ Comprehensive validation logic
- ✅ Bilingual support
- ✅ Backward compatibility
- ✅ Proper error handling
- ✅ Comprehensive testing

The system now supports both billing methods seamlessly, providing users with the flexibility to choose the appropriate pricing model for their specific ceiling painting needs.
