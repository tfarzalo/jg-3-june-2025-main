# ⚡ Quick Answer: Does It Use Existing Tables?

## YES! ✅

The decline function uses the **EXISTING `user_notifications` table** - the same one that approvals use.

### What It Does
- ✅ Uses `user_notifications` (existing table)
- ✅ Same pattern as `process_approval_token` 
- ❌ Does NOT create new tables
- ❌ Does NOT create `activity_logs` or `job_activity`

### Files to Run
1. **Optional:** `CHECK_ACTIVITY_NOTIFICATION_TABLES.sql` - Verify tables
2. **Required:** `ADD_DECLINE_NOTIFICATIONS_TO_FUNCTION.sql` - Add decline notifications

### Safe to Apply?
**YES** - Only inserts into existing `user_notifications` table, no schema changes.

---

**TLDR:** It's safe, uses existing infrastructure, just like approval does. ✅
