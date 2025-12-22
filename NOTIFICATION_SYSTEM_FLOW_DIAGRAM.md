# Notification System Flow Diagram

## Current System Flow (After Fix)

```
USER ACTIONS
    │
    ├─── User A: Changes Job Phase
    │    └─→ Trigger: notify_job_phase_change()
    │         │
    │         ├─→ Check: Is User A = changed_by? YES → ❌ Skip notification for User A
    │         │
    │         ├─→ Loop through Admins:
    │         │    ├─→ Admin B: Is Admin B = changed_by? NO → ✅ Create notification
    │         │    └─→ Admin C: Is Admin C = changed_by? NO → ✅ Create notification
    │         │
    │         └─→ Loop through JG Management:
    │              ├─→ Manager D: Is Manager D = changed_by? NO → ✅ Create notification
    │              └─→ Manager E: Is Manager E = changed_by? NO → ✅ Create notification
    │
    ├─── User B: Creates Work Order
    │    └─→ Trigger: notify_work_order_creation()
    │         │
    │         ├─→ Get creator: User B = auth.uid()
    │         │
    │         ├─→ Loop through Admins:
    │         │    ├─→ Admin A: Is Admin A = creator? NO → ✅ Create notification
    │         │    └─→ Admin C: Is Admin C = creator? NO → ✅ Create notification
    │         │
    │         └─→ User B: ❌ No notification (is creator)
    │
    └─── User C: Creates Job Request
         └─→ Trigger: notify_new_job_request()
              │
              ├─→ Get creator: User C = auth.uid()
              │
              ├─→ Loop through Admins:
              │    ├─→ Admin A: Is Admin A = creator? NO → ✅ Create notification
              │    └─→ Admin B: Is Admin B = creator? NO → ✅ Create notification
              │
              └─→ User C: ❌ No notification (is creator)
```

## Data Flow

```
┌──────────────────┐
│   USER ACTION    │
│ (UI Component)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Database Write  │
│  (INSERT/UPDATE) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────────┐
│  Database Table  │────→│  Activity Log Table  │
│  (jobs, etc.)    │     │ (job_phase_changes)  │
└────────┬─────────┘     │   ✅ ALL actions     │
         │               └──────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│         TRIGGER FIRES                │
│  - job_phase_change_notification     │
│  - work_order_creation_notification  │
│  - job_request_creation_notification │
└───────────────┬──────────────────────┘
                │
                ▼
┌────────────────────────────────────────────┐
│     NOTIFICATION FUNCTION EXECUTES         │
│                                            │
│  1. Get action details (job, property)    │
│  2. Identify actor (changed_by/creator)   │
│  3. Find recipient users (admins, mgmt)   │
│  4. FOR EACH recipient:                   │
│     IF recipient ≠ actor:                 │
│       ✅ INSERT into user_notifications   │
│     ELSE:                                  │
│       ❌ SKIP (don't notify yourself)     │
└───────────────┬────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│    user_notifications TABLE          │
│                                      │
│  - user_id (recipient, not actor)   │
│  - title (e.g., "Job Phase Changed") │
│  - message (details)                 │
│  - type (job_phase_change, etc.)    │
│  - reference_id (job_id)            │
│  - is_read (false initially)        │
│  - created_at (timestamp)           │
└───────────────┬──────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│    REALTIME SUBSCRIPTION             │
│  (Supabase Realtime Channels)       │
│                                      │
│  Topbar.tsx subscribes to:          │
│  - INSERT events on user_notifications │
│  - Filtered by user_id = current user  │
└───────────────┬──────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│    TOPBAR BELL ICON UPDATE           │
│                                      │
│  - New notification appears          │
│  - Unread count badge updates (+1)  │
│  - Toast notification shows          │
│  - Dropdown list refreshes          │
└──────────────────────────────────────┘
```

## User Perspective

### Scenario 1: User A Changes Job Phase

```
┌─────────────────────────────────────────────────────┐
│ USER A (The Actor)                                  │
├─────────────────────────────────────────────────────┤
│ 1. Opens Job #12345                                 │
│ 2. Changes phase: "Pending" → "In Progress"        │
│ 3. Sees immediate UI update ✅                      │
│ 4. Bell icon: 🔔 (no new notification) ❌          │
│ 5. Activity Log: Shows the change ✅                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ADMIN B (Observer)                                  │
├─────────────────────────────────────────────────────┤
│ 1. Working on something else                        │
│ 2. Bell icon: 🔔¹ (new notification appears) ✅    │
│ 3. Sees toast: "Job Phase Changed" ✅               │
│ 4. Clicks bell → sees notification ✅               │
│ 5. Clicks notification → navigates to Job #12345 ✅ │
│ 6. Activity Log: Shows the change ✅                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ MANAGER C (Observer)                                │
├─────────────────────────────────────────────────────┤
│ 1. Reviewing reports                                │
│ 2. Bell icon: 🔔¹ (new notification appears) ✅    │
│ 3. Sees toast: "Job Phase Changed" ✅               │
│ 4. Activity Log: Shows the change ✅                │
└─────────────────────────────────────────────────────┘
```

### Scenario 2: Multiple Actions by Same User

```
USER A Timeline:
─────────────────────────────────────────────────────
10:00 AM │ Creates Job Request #100
         │ ❌ No notification for User A
         │ ✅ Admins get notified
         │
10:15 AM │ Changes Job #12345 phase
         │ ❌ No notification for User A
         │ ✅ Admins get notified
         │
10:30 AM │ Creates Work Order for Job #12345
         │ ❌ No notification for User A
         │ ✅ Admins get notified

User A Bell Icon: 🔔 (clean, no self-notifications)

ADMIN B Timeline:
─────────────────────────────────────────────────────
10:00 AM │ ✅ Notification: "New Job Request"
10:15 AM │ ✅ Notification: "Job Phase Changed"
10:30 AM │ ✅ Notification: "New Work Order"

Admin B Bell Icon: 🔔³ (3 unread notifications)
```

## Before vs After Comparison

### BEFORE (Old Behavior - Noisy)
```
User A changes job phase:
    ├─→ User A: 🔔¹ "You changed the phase" ❌ (redundant)
    ├─→ Admin B: 🔔¹ "User A changed the phase" ✅
    └─→ Admin C: 🔔¹ "User A changed the phase" ✅

Result: User A gets notified about their own action
```

### AFTER (New Behavior - Clean)
```
User A changes job phase:
    ├─→ User A: 🔔 (no notification) ✅ (clean)
    ├─→ Admin B: 🔔¹ "User A changed the phase" ✅
    └─→ Admin C: 🔔¹ "User A changed the phase" ✅

Result: User A doesn't get notified about their own action
```

## Activity Log vs Notifications

```
┌─────────────────────────────────────────────────────┐
│              ACTIVITY LOG                           │
│  Purpose: Historical audit trail                   │
├─────────────────────────────────────────────────────┤
│  Visibility: ✅ All users (with permissions)       │
│  Content:    ✅ Every action by everyone           │
│  Retention:  ✅ Permanent record                   │
│  Filter:     ✅ By date, user, phase, property     │
│  Use Case:   "What happened in the system?"        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│            NOTIFICATIONS (Bell Icon)                │
│  Purpose: Personal alerts                          │
├─────────────────────────────────────────────────────┤
│  Visibility: ❌ Only recipient                     │
│  Content:    ✅ Actions by OTHERS                  │
│  Retention:  ⏱️  Until read/dismissed              │
│  Filter:     ✅ Unread/All                         │
│  Use Case:   "What do I need to know about?"       │
└─────────────────────────────────────────────────────┘
```

## Database Schema

```sql
-- Activity stored here (ALL actions)
job_phase_changes
├── id (uuid)
├── job_id (uuid)
├── changed_by (uuid) ← Who made the change
├── from_phase_id (uuid)
├── to_phase_id (uuid)
├── change_reason (text)
└── changed_at (timestamp)

-- Notifications stored here (OTHERS' actions only)
user_notifications
├── id (uuid)
├── user_id (uuid) ← Who should be notified (≠ actor)
├── title (text)
├── message (text)
├── type (text)
├── reference_id (uuid)
├── reference_type (text)
├── is_read (boolean)
└── created_at (timestamp)

-- Key Constraint:
-- user_notifications.user_id ≠ job_phase_changes.changed_by
-- (Enforced by database functions)
```

## Implementation Summary

```
┌────────────────────────────────────────────────────┐
│  WHERE THE MAGIC HAPPENS                           │
├────────────────────────────────────────────────────┤
│  File: notify_job_phase_change()                   │
│  Location: supabase/migrations/                    │
│           20251124000003_fix_notification_         │
│           self_trigger.sql                         │
│                                                    │
│  Key Logic:                                        │
│  ┌──────────────────────────────────────────┐    │
│  │ FOR EACH potential_recipient IN admins   │    │
│  │   IF potential_recipient != changed_by:  │    │
│  │     ✅ send_notification()               │    │
│  │   ELSE:                                   │    │
│  │     ❌ SKIP                               │    │
│  │   END IF                                  │    │
│  │ END FOR                                   │    │
│  └──────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

## Benefits Visualization

```
BEFORE: Notification Noise
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│User A│  │User A│  │User A│  │Admin │  │Admin │
│action│→ │gets  │→ │confused│→│gets  │→│acts  │
│      │  │notif │  │"I did  │  │notif │  │on it │
└──────┘  └──────┘  │this?"  │  └──────┘  └──────┘
                     └──────┘
          ❌ Redundant  ❌ Noise

AFTER: Clean Notifications  
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│User A│  │Admin │  │Admin │  │Admin │
│action│→ │gets  │→ │reviews│→│acts  │
│      │  │notif │  │change │  │on it │
└──────┘  └──────┘  └──────┘  └──────┘
          ✅ Relevant  ✅ Clean
```

---

**Legend:**
- ✅ = Works / Included
- ❌ = Doesn't work / Excluded  
- 🔔 = Bell icon (notifications)
- 🔔¹ = Bell icon with 1 unread notification
- → = Data flow / Sequence
