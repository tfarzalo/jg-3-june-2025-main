# Date Handling Quick Reference Guide

## 🚨 CRITICAL RULES

### Date-Only Fields (YYYY-MM-DD)
**Fields**: `scheduled_date`, `callback_date`, `update_date`, `due_date`

✅ **DO:**
```typescript
// Display
import { formatDate, formatDisplayDate } from '@/lib/dateUtils';
const display = formatDate(job.scheduled_date); // "Jan 12, 2026"

// Comparison
if (jobA.scheduled_date > jobB.scheduled_date) { ... }

// Sorting
jobs.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

// Filtering
const todayJobs = jobs.filter(j => j.scheduled_date === '2026-01-12');

// Form submission
const formData = { scheduled_date: '2026-01-12' }; // Raw string
```

❌ **DON'T:**
```typescript
// ❌ NEVER create Date object from YYYY-MM-DD
new Date(job.scheduled_date) // UTC midnight = wrong day!
new Date(job.scheduled_date).toLocaleDateString()
parseISO(job.scheduled_date)
job.scheduled_date.getTime()

// ❌ NEVER add time to date-only fields
new Date(job.scheduled_date).setHours(12, 0, 0)

// ❌ NEVER convert to timestamps
const timestamp = new Date(job.scheduled_date).getTime()
```

### Timestamp Fields (ISO with timezone)
**Fields**: `created_at`, `updated_at`, `completed_date`, `decision_at`

✅ **DO:**
```typescript
// Display
import { formatDateTime } from '@/lib/dateUtils';
const display = formatDateTime(job.completed_date); // "Jan 12, 2026 3:45 PM"

// Comparison
if (new Date(a.created_at) > new Date(b.created_at)) { ... }

// Sorting
jobs.sort((a, b) => 
  new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
);

// Filtering by time
const recent = jobs.filter(j => 
  new Date(j.created_at) > new Date('2026-01-01')
);
```

## 📚 Utility Functions Reference

### Import
```typescript
import { 
  formatDate,           // "Jan 12, 2026"
  formatDisplayDate,    // "January 12, 2026"
  formatDateTime,       // "Jan 12, 2026 3:45 PM"
  formatTime,           // "3:45 PM"
  formatDateForInput,   // "2026-01-12" (for <input type="date">)
} from '@/lib/dateUtils';
```

### Usage Examples

#### Display in Components
```tsx
// Date-only fields
<span>{formatDate(job.scheduled_date)}</span>
<div>{formatDisplayDate(callback.callback_date)}</div>

// Timestamp fields
<span>{formatDateTime(job.completed_date)}</span>
<time>{formatTime(message.sent_at)}</time>
```

#### Form Inputs
```tsx
// Date picker (date-only)
<input 
  type="date" 
  value={formatDateForInput(job.scheduled_date)}
  onChange={(e) => setFormData({ scheduled_date: e.target.value })}
/>

// Datetime picker (timestamp)
<input 
  type="datetime-local" 
  value={formatDateTimeForInput(job.completed_date)}
  onChange={(e) => setFormData({ completed_date: e.target.value })}
/>
```

#### Date Comparison
```typescript
// Date-only: String comparison
const isScheduledToday = job.scheduled_date === '2026-01-12';
const isFuture = job.scheduled_date > '2026-01-12';

// Timestamp: Date object comparison
const isCompletedToday = new Date(job.completed_date).toDateString() === 
                         new Date().toDateString();
```

#### Sorting
```typescript
// Date-only: String sort (YYYY-MM-DD sorts correctly)
jobs.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

// Timestamp: Numeric sort
jobs.sort((a, b) => 
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
);

// Mixed (prefer most recent)
jobs.sort((a, b) => {
  const dateA = a.updated_at || a.scheduled_date;
  const dateB = b.updated_at || b.scheduled_date;
  return dateB.localeCompare(dateA); // Descending
});
```

## 🔍 Common Patterns

### Dashboard Filtering
```typescript
// Today's jobs
const today = new Date().toISOString().split('T')[0]; // "2026-01-12"
const todaysJobs = jobs.filter(j => j.scheduled_date === today);

// This week's jobs
const startOfWeek = '2026-01-10';
const endOfWeek = '2026-01-16';
const weekJobs = jobs.filter(j => 
  j.scheduled_date >= startOfWeek && j.scheduled_date <= endOfWeek
);
```

### Calendar Day Matching
```typescript
// Convert calendar Date to YYYY-MM-DD
import { formatInTimeZone } from 'date-fns-tz';

const calendarDate = new Date(2026, 0, 12); // JavaScript Date
const dateString = formatInTimeZone(
  calendarDate, 
  'America/New_York', 
  'yyyy-MM-dd'
); // "2026-01-12"

// Match jobs
const jobsOnDay = jobs.filter(j => j.scheduled_date === dateString);
```

### Edge Functions (iCal, Emails)
```typescript
// Supabase Edge Function - Calendar Event
const [year, month, day] = job.scheduled_date.split('-').map(Number);

// Manual UTC construction for all-day event
const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

// iCal format
const dtstart = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
```

## ⚠️ Common Mistakes

### 1. Parsing Date-Only as Date Object
```typescript
❌ const date = new Date('2026-01-12'); // Wrong! UTC midnight
✅ const dateStr = '2026-01-12'; // Correct! Keep as string
```

### 2. Using toLocaleDateString on Date-Only
```typescript
❌ new Date(job.scheduled_date).toLocaleDateString()
✅ formatDate(job.scheduled_date)
```

### 3. Adding Time to Date-Only
```typescript
❌ new Date(`${job.scheduled_date}T12:00:00`)
✅ job.scheduled_date // Keep as date-only
```

### 4. Timezone Conversion on Date-Only
```typescript
❌ formatInTimeZone(parseISO(job.scheduled_date), 'America/New_York', ...)
✅ // No conversion needed, already a string
```

### 5. Date Arithmetic on Date-Only
```typescript
❌ const tomorrow = new Date(job.scheduled_date);
   tomorrow.setDate(tomorrow.getDate() + 1);

✅ const [year, month, day] = job.scheduled_date.split('-').map(Number);
   const date = new Date(year, month - 1, day + 1);
   const tomorrow = date.toISOString().split('T')[0];
```

## 🧪 Testing Checklist

When working with dates, test:

- [ ] Display shows correct date (not off-by-one)
- [ ] Sorting works correctly
- [ ] Filtering by date works correctly
- [ ] Form submission preserves exact date
- [ ] Calendar shows job on correct day
- [ ] Works in different browser timezones
- [ ] Works around midnight (11:30 PM - 12:30 AM)
- [ ] Works on DST transition dates

## 📞 Questions?

Refer to:
- `COMPREHENSIVE_DATE_TIMEZONE_FIX_JAN_12_2026.md` - Full technical details
- `FINAL_DATE_FIX_VERIFICATION_JAN_12_2026.md` - Latest fixes verification
- `src/lib/dateUtils.ts` - Source code for utility functions

---

**Remember**: Date-only = String, Timestamp = Date Object
