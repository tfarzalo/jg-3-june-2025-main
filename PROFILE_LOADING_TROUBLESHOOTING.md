# Profile Loading Issue - Troubleshooting Guide

## 🚨 **Problem: Profile Not Loading**
The `/dashboard/profile` route is not displaying user profile data.

## 🔍 **Step-by-Step Troubleshooting**

### **Step 1: Check Browser Console**
1. Open browser developer tools (F12)
2. Go to Console tab
3. Navigate to `/dashboard/profile`
4. Look for these messages:
   - ✅ `"Fetching user profile..."`
   - ✅ `"User authenticated: [user-id]"`
   - ✅ `"Profile query result: { data, error }"`
   - ❌ Any error messages

### **Step 2: Run Database Tests**
Use the SQL scripts I created:

#### **Basic Connection Test:**
```sql
-- Run: test_database_connection.sql
SELECT version();
SELECT COUNT(*) as profile_count FROM profiles;
```

#### **Profile Debug:**
```sql
-- Run: debug_profile_loading.sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'profiles';
SELECT COUNT(*) as total_profiles FROM profiles;
```

### **Step 3: Check Migration Status**
The issue might be that the new availability columns don't exist yet.

#### **Option A: Run the Simple Migration**
```sql
-- Use this file: supabase/migrations/20250103000003_add_profile_availability_simple.sql
```

#### **Option B: Check Current Schema**
```sql
-- See what columns currently exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';
```

## 🎯 **Most Likely Causes**

### **1. Migration Not Run**
- New availability columns don't exist
- Database schema mismatch
- **Solution**: Run the migration

### **2. RLS Policy Issues**
- Row Level Security blocking access
- Policy conflicts with new fields
- **Solution**: Check RLS policies

### **3. Data Type Conflicts**
- JSONB fields causing validation errors
- Constraint violations
- **Solution**: Check data types and constraints

### **4. Authentication Issues**
- User not properly authenticated
- Session expired
- **Solution**: Check auth state

## 🚀 **Quick Fix Options**

### **Option 1: Run Migration (Recommended)**
```bash
# In your Supabase dashboard or CLI
# Run the simple migration file
supabase/migrations/20250103000003_add_profile_availability_simple.sql
```

### **Option 2: Check Existing Data**
```sql
-- See if there are any profiles
SELECT * FROM profiles LIMIT 1;

-- Check current user
SELECT current_user;
```

### **Option 3: Test Basic Query**
```sql
-- Simple test query
SELECT id, email, full_name FROM profiles WHERE id = 'your-user-id';
```

## 📋 **What to Do Now**

1. **Check browser console** for error messages
2. **Run the database test scripts** to see what's working
3. **Check if you've run any migrations** recently
4. **Let me know what errors you see** in the console

## 🔧 **Enhanced Debugging Added**

I've updated the `UserProfile` component with:
- ✅ Console logging throughout the process
- ✅ Better error handling
- ✅ Updated interface for new fields
- ✅ More detailed error information

## 📱 **Next Steps**

1. **Debug**: Use the console logs to identify the issue
2. **Test**: Run the database scripts to verify connectivity
3. **Fix**: Apply the appropriate solution based on findings
4. **Verify**: Test the profile loading again

---

**Please check the browser console and let me know what error messages you see when trying to load the profile!**
