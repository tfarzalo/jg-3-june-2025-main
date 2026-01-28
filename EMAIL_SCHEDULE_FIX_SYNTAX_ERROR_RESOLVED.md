# SQL Errors - RESOLVED ✅

## Issue 1: Syntax Error (RESOLVED)

When running `QUICK_FIX_EMAIL_SCHEDULE.sql`, you received:

```
ERROR: 42601: syntax error at or near "SELECT" LINE 43
```

### Root Cause
The issue was with **nested dollar-quoting** in PostgreSQL. The function used `$$` to delimit the function body, and also used `$$` for the embedded SQL command in `cron.schedule()`. This caused a parsing conflict.

### Solution Applied
Changed the inner delimiter from `$$` to `$cmd$` to avoid conflicts.

---

## Issue 2: Trigger WHEN Clause Error (RESOLVED)

After fixing Issue 1, you received:

```
ERROR: 42P17: INSERT trigger's WHEN condition cannot reference OLD values LINE 70
```

### Root Cause
The trigger was defined as `AFTER INSERT OR UPDATE` but the `WHEN` clause referenced `OLD.send_time_utc`, which doesn't exist during INSERT operations (there's no "old" row when inserting a new record).

### The Problem:
```sql
CREATE TRIGGER trigger_update_cron_schedule
  AFTER INSERT OR UPDATE ON daily_email_config  -- ❌ INSERT + UPDATE
  FOR EACH ROW
  WHEN (
    NEW.send_time_utc IS DISTINCT FROM OLD.send_time_utc OR  -- ❌ OLD doesn't exist on INSERT!
    ...
  )
  EXECUTE FUNCTION update_daily_email_cron_schedule();
```

### Solution Applied
Created **two separate triggers** - one for INSERT (no WHEN clause) and one for UPDATE (with WHEN clause):

```sql
-- Trigger for INSERT (always fires, no WHEN clause)
CREATE TRIGGER trigger_update_cron_schedule_insert
  AFTER INSERT ON daily_email_config
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_email_cron_schedule();

-- Trigger for UPDATE (only fires when time fields change)
CREATE TRIGGER trigger_update_cron_schedule_update
  AFTER UPDATE ON daily_email_config
  FOR EACH ROW
  WHEN (
    NEW.send_time_utc IS DISTINCT FROM OLD.send_time_utc OR
    NEW.send_time_timezone IS DISTINCT FROM OLD.send_time_timezone
  )
  EXECUTE FUNCTION update_daily_email_cron_schedule();
```

## Files Updated

1. ✅ `QUICK_FIX_EMAIL_SCHEDULE.sql` - Fixed (both issues)
2. ✅ `FIX_EMAIL_SCHEDULE_TIMEZONE_ISSUE.sql` - Fixed (both issues)

## Next Steps

**You can now run the script successfully!**

1. Open `QUICK_FIX_EMAIL_SCHEDULE.sql` in Supabase SQL Editor
2. Both syntax errors are now resolved
3. Click "Run" to apply the timezone fix
4. You should see success messages and verification output

---

**Status:** ✅ Both Issues Resolved  
**Date:** January 27, 2026  
**Issue 1:** Nested dollar-quote delimiter conflict → Changed to `$cmd$`  
**Issue 2:** INSERT trigger referencing OLD values → Split into two triggers
