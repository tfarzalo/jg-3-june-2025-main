# Frontend Integration Guide - Activity Logging & Notifications
**Date:** November 24, 2025  
**Status:** Ready for Integration

## ✅ Database Setup Complete

Your database now has:
- ✅ `activity_log` table with automatic triggers
- ✅ Extended `notifications` table with new fields
- ✅ `notifications_view` for easy querying
- ✅ Automatic notification generation
- ✅ Real-time subscription support

## Frontend Integration Steps

### Step 1: Update Topbar to Use New Notifications System

Replace the current notification fetching in `src/components/ui/Topbar.tsx`:

```typescript
// OLD: Current implementation uses job_phase_changes directly
// NEW: Use the useNotifications hook

import { useNotifications } from '../../hooks/useNotifications';

// Inside your component:
const {
  notifications,
  loading,
  unreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification
} = useNotifications();

// The hook automatically:
// - Fetches notifications for current user
// - Subscribes to real-time updates
// - Tracks unread count
// - Provides functions to mark as read
```

### Step 2: Update Notification Rendering

The notifications now have different types. Update your notification icon/color logic:

```typescript
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'job':
    case 'job_phase_change':
      return <Briefcase className="h-5 w-5" />;
    case 'property':
      return <Building2 className="h-5 w-5" />;
    case 'property_group':
      return <Layers className="h-5 w-5" />;
    case 'work_order':
      return <FileText className="h-5 w-5" />;
    case 'callback':
      return <Phone className="h-5 w-5" />;
    case 'note':
      return <MessageSquare className="h-5 w-5" />;
    case 'contact':
      return <User className="h-5 w-5" />;
    default:
      return <Bell className="h-5 w-5" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'job':
      return 'text-blue-500';
    case 'property':
      return 'text-green-500';
    case 'callback':
      return 'text-orange-500';
    case 'note':
      return 'text-purple-500';
    default:
      return 'text-gray-500';
  }
};
```

### Step 3: Update Activity Page

Update `src/components/Activity.tsx` to show all activities:

```typescript
// OLD: Only queries job_phase_changes
// NEW: Query activity_log_view for all activities

const fetchActivities = async () => {
  const { data, error } = await supabase
    .from('activity_log_view')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching activities:', error);
    return;
  }

  setActivities(data);
};
```

### Step 4: Handle Column Name Change

Update any code that references `notification.read` to use `notification.is_read`:

```typescript
// OLD:
const unreadNotifications = notifications.filter(n => !n.read);

// NEW:
const unreadNotifications = notifications.filter(n => !n.is_read);
```

### Step 5: Optional - Add Manual Activity Logging

For actions not covered by automatic triggers, you can log manually:

```typescript
import { supabase } from '../utils/supabase';

async function logCustomActivity(
  entityType: string,
  entityId: string,
  action: string,
  description: string,
  metadata?: Record<string, any>
) {
  const { data, error } = await supabase.rpc('log_activity', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_action: action,
    p_description: description,
    p_metadata: metadata || {}
  });

  if (error) {
    console.error('Error logging activity:', error);
  }
  
  return data; // Returns the activity log ID
}

// Example usage:
await logCustomActivity(
  'invoice',
  invoiceId,
  'completed',
  'Invoice #12345 marked as paid',
  { invoice_num: 12345, amount: 1500 }
);
```

## What Happens Automatically

### Automatic Activity Logging

These actions are now automatically logged via database triggers:

✅ **Job Creation**
```sql
-- When a job is created, automatically logs:
INSERT INTO jobs (...) VALUES (...);
-- Triggers: log_job_creation_trigger
-- Creates: activity_log entry + notifications for admins
```

✅ **Property Creation**
```sql
-- When a property is created:
INSERT INTO properties (...) VALUES (...);
-- Triggers: log_property_creation_trigger
```

✅ **Property Group Creation**
```sql
INSERT INTO property_management_groups (...) VALUES (...);
-- Triggers: log_property_group_creation_trigger
```

✅ **Work Order Creation**
```sql
INSERT INTO work_orders (...) VALUES (...);
-- Triggers: log_work_order_creation_trigger
```

✅ **Job Phase Changes**
```sql
INSERT INTO job_phase_changes (...) VALUES (...);
-- Triggers: log_job_phase_change_trigger
```

✅ **Contact Creation** (if contacts table exists)
```sql
INSERT INTO contacts (...) VALUES (...);
-- Triggers: log_contact_creation_trigger
```

### Automatic Notification Generation

When an activity is logged:
1. Activity appears in `activity_log` table
2. Trigger fires: `create_notifications_from_activity_trigger`
3. Notifications created for all admin/jg_management users
4. **EXCEPT** the user who created the activity (no self-notifications)
5. Frontend receives real-time update via Supabase subscription

## Testing Checklist

### Backend Testing (SQL)
- [ ] Run `test_activity_notifications.sql` in Supabase SQL Editor
- [ ] Verify activity_log entries are created
- [ ] Verify notifications are created
- [ ] Verify notifications_view shows correct data
- [ ] Test mark_notification_read() function
- [ ] Test mark_all_notifications_read() function

### Frontend Testing
- [ ] Update Topbar to use useNotifications hook
- [ ] Create a new job → Check if notification appears
- [ ] Create a new property → Check if notification appears
- [ ] Change job phase → Check if notification appears
- [ ] Click notification → Verify it marks as read
- [ ] Click "Mark All Read" → Verify all mark as read
- [ ] Open two browser windows → Verify real-time updates
- [ ] Check Activity page shows all entity types
- [ ] Verify creator doesn't see their own notifications

## Real-Time Updates

The `useNotifications` hook automatically subscribes to:

```typescript
// Listens for new notifications
supabase
  .channel('user-notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications'
  }, (payload) => {
    // Automatically adds new notification to state
  })
  .subscribe();
```

**Result**: Notifications appear instantly without page refresh!

## Notification Object Structure

```typescript
interface Notification {
  id: string;
  user_id: string;
  activity_log_id: string;
  title: string;              // e.g., "New Job Created"
  message: string;            // e.g., "Job #123456 created for unit 2BR-204"
  type: string;               // e.g., "job", "property", "callback"
  entity_id: string;          // UUID of the entity
  job_id: string | null;      // UUID if it's job-related, otherwise null
  is_read: boolean;           // Read status
  metadata: Record<string, any>; // Additional data (work_order_num, property_name, etc.)
  created_at: string;
  updated_at: string;
  // From notifications_view:
  creator_name?: string;      // Full name of person who created it
  creator_email?: string;     // Email of creator
  activity_action?: string;   // "created", "updated", etc.
}
```

## Metadata Examples

Each notification includes rich metadata:

```typescript
// Job notification:
{
  work_order_num: 123456,
  unit_number: "2BR-204",
  property_id: "uuid"
}

// Property notification:
{
  name: "Sunset Apartments",
  city: "Phoenix",
  state: "AZ"
}

// Callback notification:
{
  scheduled_date: "2025-11-30",
  reason: "Follow-up inspection"
}

// Job phase change:
{
  job_id: "uuid",
  from_phase_name: "Work Orders",
  to_phase_name: "Invoicing",
  change_reason: "Phase advanced by user@example.com"
}
```

## Benefits of New System

### For Users
- 🔔 Notified of ALL system activities, not just phase changes
- 📊 Complete audit trail in Activity page
- 🎯 No self-notifications (won't see your own actions)
- ⚡ Real-time updates

### For Developers
- 🤖 Automatic logging via database triggers
- 🔧 Easy to extend to new entity types
- 📝 Rich metadata for context
- 🚀 Performant with proper indexes

### For Business
- 📈 Full visibility into system usage
- 🔍 Easy auditing and compliance
- 📊 Analytics-ready data structure

## Next Steps

1. ✅ Run `test_activity_notifications.sql` to verify backend
2. ⬜ Update `Topbar.tsx` to use `useNotifications`
3. ⬜ Update column references: `read` → `is_read`
4. ⬜ Update `Activity.tsx` to query `activity_log_view`
5. ⬜ Test creating entities and checking notifications
6. ⬜ Deploy and monitor performance

## Support

If you encounter any issues:

1. Check Supabase logs for errors
2. Verify RLS policies are working
3. Check browser console for subscription errors
4. Review `MIGRATION_SAFETY_NOTIFICATIONS_SYSTEM.md` for troubleshooting

**Status**: ✅ Backend complete, ready for frontend integration!
