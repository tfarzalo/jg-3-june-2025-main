# Quick Test Validation - WO-000534

## Compare These Values Exactly

### From Job Details Page (Screenshot)
```
Base Billing:
├── Bill to Customer:        $600.00
├── Pay to Subcontractor:    $300.00
└── Profit:                  $300.00

Additional Services:
├── Painted Ceilings (Individual) × 3
│   ├── Bill to Customer:    $225.00
│   ├── Pay to Sub:          $120.00
│   └── Profit:              $105.00
├── Accent Wall (Custom) × 2
│   ├── Bill to Customer:    $200.00
│   ├── Pay to Sub:          $120.00
│   └── Profit:              $80.00
└── TOTAL Additional Services:
    ├── Bill to Customer:    $425.00
    ├── Pay to Sub:          $240.00
    └── Profit:              $185.00

Extra Charges:
├── Bill to Customer:        $160.00
├── Pay to Subcontractor:    $80.00
└── Profit:                  $80.00

Grand Total:
├── Bill to Customer:        $1,185.00
├── Pay to Subcontractor:    $620.00
└── Profit:                  $565.00
```

### From CSV Export (Should Match Exactly)

**Look for these column values in WO-000534 row:**

| Column Name | Expected Value | Status |
|------------|----------------|--------|
| Base Bill to Customer | $600.00 | ⬜ |
| Base Pay to Subcontractor | $300.00 | ⬜ |
| Base Profit | $300.00 | ⬜ |
| Additional Services Bill to Customer | $425.00 | ⬜ |
| Additional Services Pay to Subcontractor | $240.00 | ⬜ |
| Additional Services Profit | $185.00 | ⬜ |
| Extra Charges Bill to Customer | $160.00 | ⬜ |
| Extra Charges Pay to Subcontractor | $80.00 | ⬜ |
| Extra Charges Profit | $80.00 | ⬜ |
| Total Bill to Customer | $1,185.00 | ⬜ |
| Total Pay to Subcontractor | $620.00 | ⬜ |
| Total Profit | $565.00 | ⬜ |

### Verification Math
```
Base:        $600.00 + $300.00 = $300.00 profit ✓
Additional:  $425.00 - $240.00 = $185.00 profit ✓
Extra:       $160.00 - $80.00  = $80.00 profit  ✓

Total Bill:  $600.00 + $425.00 + $160.00 = $1,185.00 ✓
Total Pay:   $300.00 + $240.00 + $80.00  = $620.00  ✓
Total Profit: $1,185.00 - $620.00 = $565.00 ✓
```

### Additional Services Breakdown Check
```
Painted Ceilings (Individual mode):
  Qty: 3 ceilings
  Rate Bill: $75.00 per ceiling ($225.00 ÷ 3)
  Rate Sub: $40.00 per ceiling ($120.00 ÷ 3)
  Total Bill: $225.00
  Total Sub: $120.00
  Total Profit: $105.00

Accent Wall (Custom):
  Qty: 2 walls
  Rate Bill: $100.00 per wall ($200.00 ÷ 2)
  Rate Sub: $60.00 per wall ($120.00 ÷ 2)
  Total Bill: $200.00
  Total Sub: $120.00
  Total Profit: $80.00

Combined Additional Services:
  Total Bill: $225.00 + $200.00 = $425.00 ✓
  Total Sub: $120.00 + $120.00 = $240.00 ✓
  Total Profit: $105.00 + $80.00 = $185.00 ✓
```

---

## Quick Test Steps

1. **Export the data:**
   ```
   1. Go to Completed Jobs
   2. Click "Export Data"
   3. Select all billing fields
   4. Export to CSV
   ```

2. **Open CSV and find WO-000534:**
   ```
   - Should be first row (after headers)
   - Work Order # column should show "WO-000534"
   ```

3. **Check each billing column:**
   ```
   - Copy value from CSV
   - Compare with "Expected Value" above
   - Mark ✓ if matches, ✗ if doesn't match
   ```

4. **Verify totals:**
   ```
   - Total should equal Base + Additional + Extra
   - If ANY value is wrong, the fix is incomplete
   ```

---

## If Test Fails

### Check console for errors:
```javascript
// Should see in browser console:
"Fetching billing data for X jobs..."
"Successfully fetched billing data for X jobs"
```

### Common issues:
- ❌ Still shows "N/A" → get_job_details RPC not working
- ❌ Wrong amounts → Data extraction logic error
- ❌ Missing columns → Export config issue
- ❌ Totals don't add up → Calculation logic error

### Debug steps:
1. Open browser developer tools (F12)
2. Go to Console tab
3. Export again
4. Check for error messages
5. Take screenshot of any errors

---

## Success Indicators

✅ All 12 billing values match exactly
✅ Totals = Base + Additional + Extra
✅ Console shows successful fetch
✅ No error messages
✅ CSV has all billing columns
✅ Additional services = $425.00 (breakdown of ceilings + walls)

## Test Result Template

```
TEST: WO-000534 Billing Export

Base Billing:
  Bill to Customer: [ACTUAL] vs $600.00 (Expected) → [PASS/FAIL]
  Pay to Sub: [ACTUAL] vs $300.00 (Expected) → [PASS/FAIL]
  Profit: [ACTUAL] vs $300.00 (Expected) → [PASS/FAIL]

Additional Services:
  Bill to Customer: [ACTUAL] vs $425.00 (Expected) → [PASS/FAIL]
  Pay to Sub: [ACTUAL] vs $240.00 (Expected) → [PASS/FAIL]
  Profit: [ACTUAL] vs $185.00 (Expected) → [PASS/FAIL]

Extra Charges:
  Bill to Customer: [ACTUAL] vs $160.00 (Expected) → [PASS/FAIL]
  Pay to Sub: [ACTUAL] vs $80.00 (Expected) → [PASS/FAIL]
  Profit: [ACTUAL] vs $80.00 (Expected) → [PASS/FAIL]

Grand Total:
  Bill to Customer: [ACTUAL] vs $1,185.00 (Expected) → [PASS/FAIL]
  Pay to Sub: [ACTUAL] vs $620.00 (Expected) → [PASS/FAIL]
  Profit: [ACTUAL] vs $565.00 (Expected) → [PASS/FAIL]

OVERALL: [PASS/FAIL]
Console Errors: [YES/NO]
```
