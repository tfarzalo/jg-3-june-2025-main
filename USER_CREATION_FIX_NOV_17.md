# User Creation Fix - November 17, 2025

## Problem
When an admin user tried to create a new user (including Subcontractor users), the operation failed with the error:
```json
{"code":"not_admin","message":"User not allowed"}
```

## Root Cause
The frontend code in `src/components/Users.tsx` was directly calling `supabase.auth.admin.createUser()` which requires the **service role key** to execute. However, the frontend client only has access to the **anon key** (public key) for security reasons. This is the correct security practice - the service role key should never be exposed to the frontend.

## Solution Implemented

### 1. Updated Frontend (`src/components/Users.tsx`)
Changed the `handleAddUser` function to call the Supabase Edge Function instead of using the admin API directly:

**Before:**
```typescript
const { data, error } = await supabase.auth.admin.createUser({
  email: formData.email,
  password: formData.password,
  email_confirm: true
});
```

**After:**
```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      email: formData.email,
      password: formData.password,
      full_name: formData.full_name,
      role: formData.role,
      working_days: formData.working_days,
      sendWelcomeEmail: true
    })
  }
);
```

### 2. Enhanced Edge Function (`supabase/functions/create-user/index.ts`)

Made the following improvements:

#### a. Added Authorization Check
Now verifies that the requesting user has permission to create users:
- Allowed roles: `admin`, `jg_management`, `is_super_admin`
- Returns the exact error message you saw: `{"code":"not_admin","message":"User not allowed"}` if unauthorized
- Additional check: Only admins can create other admin users

#### b. Added Profile Creation
The Edge Function now:
1. Creates the auth user
2. Creates the corresponding profile record in the `profiles` table
3. Includes the `working_days` field from the frontend
4. Rolls back the auth user if profile creation fails (maintains data consistency)

#### c. Better Error Handling
- Returns proper error messages
- Validates all inputs (email format, password length, role validity)
- Provides specific error codes for different failure scenarios

## Files Modified

1. **Frontend:**
   - `src/components/Users.tsx` - Updated user creation to use Edge Function

2. **Backend:**
   - `supabase/functions/create-user/index.ts` - Enhanced with proper authorization, profile creation, and working_days support

## Testing Required

### 1. Test User Creation (Primary Fix)
- [ ] Login as an admin user
- [ ] Navigate to Users page
- [ ] Click "Add User"
- [ ] Fill in details for a new Subcontractor user
- [ ] Submit the form
- [ ] **Expected:** User should be created successfully
- [ ] Verify the new user appears in the users list
- [ ] Verify the user can login with the provided credentials

### 2. Test Permission Checks
- [ ] Try creating a user as `admin` role ✅ Should work
- [ ] Try creating a user as `jg_management` role ✅ Should work
- [ ] Try creating a user as `subcontractor` role ❌ Should fail with "not_admin" error

### 3. Test Other User Roles
- [ ] Create a `user` role account
- [ ] Create a `subcontractor` role account  
- [ ] Create a `jg_management` role account
- [ ] Create an `admin` role account (admin only)

### 4. Verify Working Days
- [ ] Create a user with custom working days
- [ ] Verify the working days are saved correctly in the profile

## Remaining Issues (To Address if Needed)

The following operations in `Users.tsx` still use `supabase.auth.admin` methods and may fail:

1. **Edit User / Update Password** (line ~252)
   - Uses: `supabase.auth.admin.updateUserById()`
   - May need Edge Function: `update-user`

2. **Delete User** (line ~285)
   - Uses: `supabase.auth.admin.deleteUser()`
   - May need Edge Function: `delete-user`

3. **Change Password** (line ~320)
   - Uses: `supabase.auth.admin.updateUserById()`
   - May need Edge Function: `change-user-password`

**Note:** These operations might work if they're only updating the profile table and not the auth user directly. Test them after the create-user fix is verified.

## Deployment Steps

### Step 1: Deploy the Edge Function
The Edge Function needs to be deployed to Supabase. Run:
```bash
supabase functions deploy create-user
```

### Step 2: Set Environment Variables
Ensure these environment variables are set in your Supabase project:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ZOHO_EMAIL` (optional, for welcome emails)
- `ZOHO_PASSWORD` (optional, for welcome emails)

### Step 3: Test in Browser
The frontend changes are already applied and will take effect when the dev server reloads.

## Why This Architecture?

This separation of concerns follows best practices:

1. **Security:** Service role keys stay on the backend, never exposed to clients
2. **Authorization:** Centralized permission checking in the Edge Function
3. **Data Consistency:** Atomic operations (user + profile creation together)
4. **Auditability:** All user creation goes through a single endpoint
5. **Flexibility:** Easy to add additional logic (email notifications, logging, etc.)

## Next Steps

1. Test the user creation functionality with your admin account
2. If successful, verify other admin operations (edit, delete, password change)
3. If those fail, let me know and I'll create corresponding Edge Functions for them
