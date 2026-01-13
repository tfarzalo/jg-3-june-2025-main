# Date Flow Visual Reference

## The Date Journey: From User Click to Database

```
┌─────────────────────────────────────────────────────────────────┐
│  USER INTERACTION                                                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ User clicks date picker
                          │ Selects: January 12, 2026
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER DATE INPUT                                              │
│  <input type="date" value="2026-01-12" />                       │
│                                                                   │
│  Provides string: "2026-01-12"                                   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ onChange event
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  HANDLECHANGE FUNCTION                                           │
│  src/components/JobEditForm.tsx                                  │
│                                                                   │
│  setFormData({ ...prev, scheduled_date: "2026-01-12" })        │
│  LOG: "Field changed - scheduled_date: 2026-01-12"             │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ User clicks "Save Changes"
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  HANDLESUBMIT FUNCTION                                           │
│  src/components/JobEditForm.tsx                                  │
│                                                                   │
│  1. Get form value: "2026-01-12"                                │
│  2. Normalize: normalizeDateToEastern("2026-01-12")            │
│  3. LOG: "Sending to database: 2026-01-12"                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  NORMALIZEDATETOEASTERN                                          │
│  src/lib/dateUtils.ts                                            │
│                                                                   │
│  Input:  "2026-01-12"                                           │
│  Check:  ✅ Valid YYYY-MM-DD format                             │
│  Output: "2026-01-12"                                           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE CLIENT                                                 │
│  supabase.from('jobs').update()                                 │
│                                                                   │
│  Payload: { scheduled_date: "2026-01-12" }                      │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  POSTGRESQL DATABASE                                             │
│  Column: scheduled_date (type: DATE)                            │
│                                                                   │
│  Receives: "2026-01-12"                                         │
│  Stores:   2026-01-12 (as DATE, no timezone)                   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ User navigates back to job
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  LOADING JOB DATA                                                │
│  fetchJob() in JobEditForm.tsx                                   │
│                                                                   │
│  Database returns: { scheduled_date: "2026-01-12" }            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  FORMATDATEFORINPUT                                              │
│  src/lib/dateUtils.ts                                            │
│                                                                   │
│  Input:  "2026-01-12"                                           │
│  Check:  ✅ Already YYYY-MM-DD                                  │
│  Output: "2026-01-12"                                           │
│  LOG:    "Already YYYY-MM-DD, returning as-is"                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  FORM STATE                                                      │
│  setFormData({ scheduled_date: "2026-01-12" })                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATE INPUT DISPLAYS                                             │
│  <input type="date" value="2026-01-12" />                       │
│                                                                   │
│  User sees: January 12, 2026 ✅                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Points

### ✅ What Makes This Work

1. **Pure String Format**
   - Always `YYYY-MM-DD`
   - No time component
   - No timezone suffix

2. **PostgreSQL DATE Column**
   - Stores calendar dates
   - No timezone conversion
   - Same date for everyone

3. **No Timezone Math**
   - Don't parse to Date object
   - Don't apply timezone offsets
   - Keep as string throughout

### ❌ What Was Breaking Before

1. **Timezone Conversion**
   ```typescript
   // BAD - causes date shifts
   const date = parseISO("2026-01-12");
   return formatInTimeZone(date, "America/New_York", "yyyy-MM-dd");
   // Might return "2026-01-11" or "2026-01-13" depending on local time
   ```

2. **Mixing Dates and Timestamps**
   ```typescript
   // BAD - adds time component
   scheduled_date: "2026-01-12T00:00:00-05:00"
   // DATE column strips time, might shift date
   ```

### ✅ What We Do Now

```typescript
// GOOD - pure string, no conversion
const scheduled_date = "2026-01-12";
// Send directly to database
await supabase.from('jobs').update({ scheduled_date });
// Database stores exactly: 2026-01-12
```

## Console Output Example

When you test, you should see exactly this flow:

```
# On page load:
formatDateForInput: Input: 2026-01-09
formatDateForInput: Already YYYY-MM-DD, returning as-is: 2026-01-09

# When changing date:
JobEditForm: Field changed - scheduled_date: 2026-01-12
JobEditForm: Updated formData: { scheduled_date: "2026-01-12", ... }

# When saving:
JobEditForm: Form data: { scheduled_date: "2026-01-12", ... }
JobEditForm: Scheduled date from form: 2026-01-12
normalizeDateToEastern: Input: 2026-01-12 -> Output: 2026-01-12
JobEditForm: Normalized to Eastern Time: 2026-01-12
JobEditForm: Sending to database: 2026-01-12
JobEditForm: Job updated successfully

# On next page load:
formatDateForInput: Input: 2026-01-12
formatDateForInput: Already YYYY-MM-DD, returning as-is: 2026-01-12
```

## If You See Different Output

### Problem: "Using fallback parse/format"
**Cause**: Date is not in YYYY-MM-DD format
**Check**: What format is the database returning?

### Problem: Date changes after save
**Cause**: Database might be storing timestamp instead of date
**Check**: Network tab → see what's actually being sent

### Problem: Different date after page refresh
**Cause**: formatDateForInput is doing timezone conversion
**Check**: Console logs - which branch of the function is executing?
