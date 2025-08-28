# Dynamic Billing Options Implementation

## Overview

This implementation adds dynamic loading of billing options from the `billing_categories` and `billing_details` tables for the work order forms. The form now dynamically adjusts to each property's specific billing structure while maintaining data integrity between work orders and the billing system.

## Database Changes

### New Migration: `20250615000000_add_painted_ceilings_accent_walls_categories.sql`

This migration adds the required billing categories for all existing properties:
- **"Painted Ceilings"** - for ceiling painting services with different pricing based on service complexity
- **"Accent Walls"** - for accent wall painting services with different pricing based on service complexity

**Important**: These categories are **SERVICE-BASED**, not unit-size dependent. Pricing is determined by:
- Service complexity (e.g., simple ceiling vs. high ceiling, basic accent wall vs. custom design)
- Labor requirements and difficulty
- Material costs and complexity
- **NOT by the unit size of the property**

**Note**: The categories are created for each property individually, maintaining the property-scoped structure of the billing system.

## Implementation Details

### 1. Work Order Form Updates (`NewWorkOrder.tsx`)

#### State Management
- Added `ceilingPaintOptions` and `accentWallOptions` state arrays to store billing options
- Added `selectedCeilingBillingDetailId` and `selectedAccentWallBillingDetailId` to track selected options
- Added `billingOptionsLoading` state for loading indicators

#### Dynamic Billing Options Fetching
- **`fetchPropertyBillingOptions()`** function queries the database for property-specific billing options
- Uses exact category names: "Painted Ceilings" and "Accent Walls"
- **Service-Based Approach**: Fetches billing details based on service complexity, NOT unit size
- Orders results by bill amount for consistent display
- **No Unit Size Filtering**: These categories are independent of the property's unit size

#### Form Field Updates
- **Ceiling Rooms Count**: Now a dropdown populated with billing options from the database
- **Accent Wall Type**: Now a dropdown populated with billing options from the database
- Fields are disabled until corresponding checkboxes are selected
- Options show pricing information (e.g., "1 - $50.00 per ceiling")

#### Form Submission
- Stores selected billing detail IDs with the work order
- Maps ceiling selection to appropriate unit size count
- Ensures proper invoicing and tracking

### 2. Spanish Version Updates (`NewWorkOrderSpanish.tsx`)

- Updated interface to accept billing options as props
- Removed duplicate state management and fetching logic
- Now receives billing options from parent component

### 3. Database Integration Pattern

The implementation follows the specified SQL query pattern:

```sql
-- Get property-specific billing options for Painted Ceilings
SELECT bd.id, bd.unit_size_id, us.unit_size_label, bd.bill_amount, bd.sub_pay_amount
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bd.property_id = :property_id
AND bc.name = 'Painted Ceilings'
ORDER BY bd.bill_amount;
```

## Key Features

### Service-Based Pricing Model
- **Painted Ceilings**: Pricing based on ceiling complexity (height, texture, accessibility)
- **Accent Walls**: Pricing based on design complexity (basic paint vs. custom patterns, textures)
- **Independent of Unit Size**: Same pricing applies regardless of property unit size
- **Flexible Service Options**: Multiple service tiers available per property

### Dynamic Loading
- Billing options are fetched when a property is selected
- **No Unit Size Filtering**: Options are available regardless of the job's unit size
- Real-time updates based on property selection

### User Experience
- Loading indicators while fetching options
- Clear error messages when no billing options are available
- Disabled fields until prerequisites are met
- Pricing information displayed in dropdowns

### Data Integrity
- Selected billing detail IDs are stored with work orders
- Proper validation ensures only available options can be selected
- Maintains relationship between work orders and billing system

## Usage

### For Property Managers
1. Set up billing categories for each property
2. Configure billing details with appropriate pricing for different unit sizes
3. Ensure "Painted Ceilings" and "Accent Walls" categories exist

### For Users
1. Select a property in the work order form
2. Toggle "Painted Ceilings" or "Accent Wall" options
3. Choose from available billing options in the dropdowns
4. Form automatically calculates pricing based on selections

## Testing

Use the provided `test_billing_categories_setup.sql` script to verify:
- Billing categories exist in the database
- Billing details are properly configured
- Properties have the required billing options set up

## Notes

- **Job Category fields and Extra Charges fields are preserved** as requested
- This implementation adds new functionality without removing existing features
- The form gracefully handles cases where no billing options are available
- Performance is optimized with client-side caching of billing details
