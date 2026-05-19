# Admin SMS Notification Requirements

## Problem Statement
The current SMS notification system treats all users the same, but Admin and SuperAdmin users need different notification behaviors than Subcontractors:

### Current Behavior (Incorrect)
- All users receive notifications based on **their personal involvement** in events
- Admins only get notified if they are explicitly assigned to a job or are the recipient of a message

### Required Behavior

#### Admin/SuperAdmin Users Should Receive SMS For:
1. **System-Wide Events** (regardless of personal assignment):
   - ✅ Any subcontractor **accepts** a job
   - ✅ Any subcontractor **submits** a work order
   - ✅ Any job has **extra charges approved**

2. **Direct Personal Messages**:
   - ✅ Chat messages sent **to them specifically**

#### Subcontractor Users Should Receive SMS For:
1. **Their Assigned Jobs**:
   - ✅ Jobs **assigned to them**
   - ✅ Status changes on **their assigned jobs**

2. **Direct Personal Messages**:
   - ✅ Chat messages sent **to them specifically**

## Technical Implementation Plan

### Step 1: Update User SMS Notification Settings Schema

Add role-specific notification columns to `user_sms_notification_settings`:

```sql
-- Admin-only notification settings (system-wide events)
ALTER TABLE user_sms_notification_settings
  ADD COLUMN IF NOT EXISTS notify_admin_job_accepted BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_work_order_submitted BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_charges_approved BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_sms_notification_settings.notify_admin_job_accepted IS
  'Admin/SuperAdmin only: Receive SMS when ANY subcontractor accepts a job';

COMMENT ON COLUMN user_sms_notification_settings.notify_admin_work_order_submitted IS
  'Admin/SuperAdmin only: Receive SMS when ANY subcontractor submits a work order';

COMMENT ON COLUMN user_sms_notification_settings.notify_admin_charges_approved IS
  'Admin/SuperAdmin only: Receive SMS when extra charges are approved on ANY job';
```

### Step 2: Update Recipient Resolution Logic

Modify `dispatch-sms-notification/index.ts` to include role-based logic:

```typescript
async function resolveEligibleRecipients(
  supabase: ReturnType<typeof createClient>,
  eventType: EventType,
  senderUserId: string | null | undefined,
  explicitUserIds?: string[],
  jobContext?: { assigned_to?: string } // Pass job context to determine assignment
): Promise<{ recipients: Recipient[]; skippedNoPhone: Array<{ user_id: string; reason: string }> }> {
  
  // For chat_received, always use explicit recipient IDs (direct message)
  if (eventType === "chat_received") {
    return await resolveDirectMessageRecipients(supabase, explicitUserIds, senderUserId);
  }
  
  // For admin-level system events, find all admins with the setting enabled
  if (eventType === "job_accepted" || eventType === "work_order_submitted" || eventType === "charges_approved") {
    return await resolveAdminNotificationRecipients(supabase, eventType, senderUserId);
  }
  
  // For job_assigned, use explicit recipient (the assigned user)
  if (eventType === "job_assigned") {
    return await resolveDirectMessageRecipients(supabase, explicitUserIds, senderUserId);
  }
  
  // Default behavior for other events
  return await resolveDefaultRecipients(supabase, eventType, senderUserId, explicitUserIds);
}

async function resolveAdminNotificationRecipients(
  supabase: ReturnType<typeof createClient>,
  eventType: "job_accepted" | "work_order_submitted" | "charges_approved",
  senderUserId?: string | null
): Promise<{ recipients: Recipient[]; skippedNoPhone: Array<{ user_id: string; reason: string }> }> {
  
  // Map event to admin setting column
  const adminColumnMap = {
    job_accepted: "notify_admin_job_accepted",
    work_order_submitted: "notify_admin_work_order_submitted",
    charges_approved: "notify_admin_charges_approved",
  };
  
  const settingColumn = adminColumnMap[eventType];
  
  // Query all admin/superadmin users with the setting enabled
  const { data, error } = await supabase
    .from("user_sms_notification_settings")
    .select(`
      user_id, 
      sms_enabled, 
      ${settingColumn}, 
      profiles!inner ( 
        id, 
        full_name, 
        sms_phone, 
        sms_consent_given,
        role 
      )
    `)
    .not("profiles.sms_phone", "is", null)
    .eq("profiles.sms_consent_given", true)
    .eq("sms_enabled", true)
    .eq(settingColumn, true)
    .in("profiles.role", ["admin", "is_super_admin", "jg_management"]);
  
  if (error) {
    console.error("[dispatch-sms] ❌ Admin recipient query failed:", error.message);
    throw new Error(`Failed to query admin SMS recipients: ${error.message}`);
  }
  
  const recipients: Recipient[] = [];
  const skippedNoPhone: Array<{ user_id: string; reason: string }> = [];
  
  for (const row of data ?? []) {
    const profile = row.profiles as { 
      id: string; 
      full_name: string | null; 
      sms_phone: string | null; 
      sms_consent_given: boolean | null;
      role: string;
    } | null;
    
    const phone = profile?.sms_phone ?? null;
    
    if (!phone) {
      skippedNoPhone.push({ user_id: row.user_id, reason: "no sms_phone on profile" });
      continue;
    }
    
    // Don't notify the sender (if sender is an admin)
    if (senderUserId && row.user_id === senderUserId) {
      skippedNoPhone.push({ user_id: row.user_id, reason: "sender_excluded" });
      continue;
    }
    
    recipients.push({
      user_id: row.user_id,
      full_name: profile?.full_name ?? null,
      sms_phone: phone,
    });
  }
  
  return { recipients, skippedNoPhone };
}

async function resolveDirectMessageRecipients(
  supabase: ReturnType<typeof createClient>,
  explicitUserIds?: string[],
  senderUserId?: string | null
): Promise<{ recipients: Recipient[]; skippedNoPhone: Array<{ user_id: string; reason: string }> }> {
  
  if (!explicitUserIds || explicitUserIds.length === 0) {
    return { recipients: [], skippedNoPhone: [] };
  }
  
  // For direct messages (chat), query specific recipients regardless of role
  const { data, error } = await supabase
    .from("user_sms_notification_settings")
    .select(`
      user_id, 
      sms_enabled, 
      notify_chat_received, 
      profiles!inner ( 
        id, 
        full_name, 
        sms_phone, 
        sms_consent_given 
      )
    `)
    .in("user_id", explicitUserIds)
    .not("profiles.sms_phone", "is", null)
    .eq("profiles.sms_consent_given", true);
  
  if (error) {
    console.error("[dispatch-sms] ❌ Direct message recipient query failed:", error.message);
    throw new Error(`Failed to query direct message SMS recipients: ${error.message}`);
  }
  
  const recipients: Recipient[] = [];
  const skippedNoPhone: Array<{ user_id: string; reason: string }> = [];
  
  for (const row of data ?? []) {
    const profile = row.profiles as { 
      id: string; 
      full_name: string | null; 
      sms_phone: string | null; 
      sms_consent_given: boolean | null;
    } | null;
    
    const phone = profile?.sms_phone ?? null;
    
    // Check if user has SMS and chat notifications enabled
    if (!row.sms_enabled) {
      skippedNoPhone.push({ user_id: row.user_id, reason: "sms_enabled=false" });
      continue;
    }
    
    if (!row.notify_chat_received) {
      skippedNoPhone.push({ user_id: row.user_id, reason: "notify_chat_received=false" });
      continue;
    }
    
    if (!phone) {
      skippedNoPhone.push({ user_id: row.user_id, reason: "no sms_phone on profile" });
      continue;
    }
    
    // Don't send chat notification to the sender
    if (senderUserId && row.user_id === senderUserId) {
      skippedNoPhone.push({ user_id: row.user_id, reason: "sender_excluded" });
      continue;
    }
    
    recipients.push({
      user_id: row.user_id,
      full_name: profile?.full_name ?? null,
      sms_phone: phone,
    });
  }
  
  return { recipients, skippedNoPhone };
}
```

### Step 3: Update UI to Show Role-Specific Settings

In `SmsNotificationSettings.tsx`, show different options based on user role:

```tsx
// For Admin/SuperAdmin users
{isAdmin && (
  <div className="space-y-4">
    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
      System-Wide Notifications (Admin Only)
    </h4>
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Receive SMS when these events occur for ANY job or subcontractor
    </p>
    
    <label className="flex items-center justify-between">
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Subcontractor accepts job
      </span>
      <Toggle 
        checked={settings.notify_admin_job_accepted}
        onChange={(val) => handleToggle('notify_admin_job_accepted', val)}
      />
    </label>
    
    <label className="flex items-center justify-between">
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Subcontractor submits work order
      </span>
      <Toggle 
        checked={settings.notify_admin_work_order_submitted}
        onChange={(val) => handleToggle('notify_admin_work_order_submitted', val)}
      />
    </label>
    
    <label className="flex items-center justify-between">
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Extra charges approved
      </span>
      <Toggle 
        checked={settings.notify_admin_charges_approved}
        onChange={(val) => handleToggle('notify_admin_charges_approved', val)}
      />
    </label>
  </div>
)}

// For all users (including admins)
<div className="space-y-4">
  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
    Personal Notifications
  </h4>
  
  <label className="flex items-center justify-between">
    <span className="text-sm text-gray-700 dark:text-gray-300">
      Chat messages to me
    </span>
    <Toggle 
      checked={settings.notify_chat_received}
      onChange={(val) => handleToggle('notify_chat_received', val)}
    />
  </label>
  
  {!isAdmin && (
    <>
      <label className="flex items-center justify-between">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Jobs assigned to me
        </span>
        <Toggle 
          checked={settings.notify_job_assigned}
          onChange={(val) => handleToggle('notify_job_assigned', val)}
        />
      </label>
    </>
  )}
</div>
```

## Migration Files Needed

1. **`20260518000005_add_admin_sms_notification_settings.sql`**
   - Add `notify_admin_*` columns to `user_sms_notification_settings`
   - Set defaults to `true` for existing admin users
   - Set defaults to `false` for non-admin users (they won't see these options anyway)

2. **Update `dispatch-sms-notification/index.ts`**
   - Implement role-based recipient resolution
   - Add admin notification queries
   - Maintain backward compatibility

3. **Update `SmsNotificationSettings.tsx`**
   - Show admin-specific options for admin roles
   - Hide subcontractor-specific options from admins
   - Add clear section headers and descriptions

## Event Type Mapping

| Event Type | Admins Get Notified? | Subcontractors Get Notified? | Logic |
|------------|---------------------|------------------------------|-------|
| `chat_received` | ✅ If recipient | ✅ If recipient | Direct message to specific user |
| `job_accepted` | ✅ System-wide | ❌ No | Admin sees all job acceptances |
| `work_order_submitted` | ✅ System-wide | ❌ No | Admin sees all work order submissions |
| `charges_approved` | ✅ System-wide | ❌ No | Admin sees all charge approvals |
| `job_assigned` | ❌ No | ✅ If assigned to them | Only notify the assigned subcontractor |

## Testing Plan

1. **Admin User Test:**
   - Enable all admin notification settings
   - Have a subcontractor accept a job → Admin receives SMS
   - Have a subcontractor submit a work order → Admin receives SMS
   - Approve charges on a job → Admin receives SMS
   - Send a chat message to admin → Admin receives SMS

2. **Subcontractor User Test:**
   - Assign a job to subcontractor → Subcontractor receives SMS
   - Send a chat message to subcontractor → Subcontractor receives SMS
   - Have another subcontractor accept a job → This subcontractor does NOT receive SMS
   - Have another subcontractor submit a work order → This subcontractor does NOT receive SMS

3. **Mixed Scenario:**
   - Admin and subcontractor both in chat → Both receive SMS for chat messages
   - Job assigned to subcontractor → Only subcontractor receives SMS, admin does not
   - Subcontractor accepts job → Only admin receives SMS, other subcontractors do not

## Database Query Examples

### Find all admins who should be notified of job acceptance:
```sql
SELECT 
  p.id,
  p.full_name,
  p.sms_phone,
  s.notify_admin_job_accepted
FROM profiles p
JOIN user_sms_notification_settings s ON s.user_id = p.id
WHERE p.role IN ('admin', 'is_super_admin', 'jg_management')
  AND p.sms_consent_given = true
  AND p.sms_phone IS NOT NULL
  AND s.sms_enabled = true
  AND s.notify_admin_job_accepted = true;
```

### Find specific user for chat notification:
```sql
SELECT 
  p.id,
  p.full_name,
  p.sms_phone,
  s.notify_chat_received
FROM profiles p
JOIN user_sms_notification_settings s ON s.user_id = p.id
WHERE p.id = '<recipient_user_id>'
  AND p.sms_consent_given = true
  AND p.sms_phone IS NOT NULL
  AND s.sms_enabled = true
  AND s.notify_chat_received = true;
```

## Implementation Checklist

- [ ] Create migration to add `notify_admin_*` columns
- [ ] Apply migration to database
- [ ] Update `dispatch-sms-notification/index.ts` with role-based logic
- [ ] Update `SmsNotificationSettings.tsx` to show role-specific options
- [ ] Test admin notifications for system-wide events
- [ ] Test subcontractor notifications for assigned jobs
- [ ] Test chat notifications for both roles
- [ ] Update documentation
- [ ] Deploy edge function
- [ ] Deploy frontend
- [ ] Monitor logs for errors

---

**Related Documentation:**
- [CLICKSEND_STATUS_REFERENCE.md](./CLICKSEND_STATUS_REFERENCE.md)
- [CLICKSEND_MIGRATION_GUIDE.md](./CLICKSEND_MIGRATION_GUIDE.md)
- [SMS Notification Settings Schema](./supabase/migrations/20260414000001_create_sms_notification_logs.sql)
