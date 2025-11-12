# 🚀 Quick Start: Subcontractor Upload Verification & Fixes

**Created:** November 11, 2025  
**Estimated Time:** 30 minutes  
**Priority:** HIGH

---

## 📋 What This Guide Does

This guide walks you through verifying and fixing subcontractor file upload permissions in 3 simple steps.

---

## ✅ Step 1: Run Verification Script (5 minutes)

### Option A: Using Supabase Dashboard
1. Open Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create new query
4. Copy contents of `verify_subcontractor_permissions.sql`
5. Click **Run**
6. Review output for any `✗` or `⚠` symbols

### Option B: Using Command Line
```bash
# From project root
psql "YOUR_DATABASE_CONNECTION_STRING" -f verify_subcontractor_permissions.sql > permission_check_results.txt

# Review results
cat permission_check_results.txt
```

---

## 🔍 Step 2: Interpret Results (5 minutes)

### ✅ Good Signs (Everything OK)
- `✓ Subcontractor-specific` policies exist for files table
- `✓ Executable by authenticated` for upload functions
- `✓ Public bucket` for 'files' bucket
- `✓ is_subcontractor() function EXISTS`

### 🔴 Red Flags (Need Fixes)
- `✗ NOT executable by authenticated` for any upload function
- `✗ is_subcontractor() function DOES NOT EXIST`
- No policies with "subcontractor" or "authenticated" for INSERT on files table
- Private bucket for 'files' (should be public for easier access)

### 🟡 Warnings (Review Needed)
- `⚠ Many policies - potential conflicts` (more than 3 policies per table/command)
- No `Files insert for subcontractors` policy
- No `Files read for subcontractors` policy

---

## 🛠️ Step 3: Apply Fixes (10-20 minutes)

### If Verification Showed Issues:

#### Fix A: Apply Subcontractor File Permissions
```bash
# In Supabase SQL Editor, run:
\i fix_subcontractor_file_permissions.sql

# OR from command line:
psql "YOUR_DATABASE_CONNECTION_STRING" -f fix_subcontractor_file_permissions.sql
```

**What this does:**
- Creates `Files read for subcontractors` policy
- Creates `Files insert for subcontractors` policy  
- Creates `Files update for subcontractors` policy
- Grants EXECUTE permissions on upload functions

#### Fix B: Apply Storage Policies (if needed)
```bash
# In Supabase SQL Editor, run:
\i manual_storage_policies.sql

# OR from command line:
psql "YOUR_DATABASE_CONNECTION_STRING" -f manual_storage_policies.sql
```

**What this does:**
- Creates storage policies for 'files' bucket
- Allows authenticated users to upload, read, update, delete

---

## ✅ Step 4: Test End-to-End (10 minutes)

### Create Test Subcontractor Account (if needed)
```sql
-- Run in Supabase SQL Editor

-- 1. Find or create a test subcontractor
SELECT id, email, role FROM profiles WHERE role = 'subcontractor' LIMIT 1;

-- If none exists, you'll need to:
-- a) Create user in Supabase Auth
-- b) Set their profile role to 'subcontractor'
```

### Test Upload Flow
1. **Login as subcontractor** (use test account)
2. **Navigate to assigned job** 
3. **Click "Add/Edit Work Order"**
4. **Try uploading "Before Images":**
   - Select 1-2 test images
   - Click upload
   - ✅ Should see progress bar
   - ✅ Should see thumbnail after upload
   - ✅ No errors in browser console

5. **If job has sprinklers, upload "Sprinkler Images":**
   - Same process as above

6. **Fill required fields:**
   - Unit number
   - Job category
   - Any other required fields

7. **Click "Submit Work Order":**
   - ✅ Should see success toast
   - ✅ Should redirect to `/dashboard/subcontractor`
   - ✅ Job should show as submitted

8. **Verify in database:**
```sql
-- Check files were created
SELECT 
  name,
  category,
  path,
  uploaded_by,
  created_at
FROM files
WHERE job_id = 'YOUR_TEST_JOB_ID'
ORDER BY created_at DESC;

-- Check work order was created
SELECT 
  id,
  job_id,
  prepared_by,
  submission_date,
  unit_number
FROM work_orders
WHERE job_id = 'YOUR_TEST_JOB_ID';
```

---

## 🐛 Troubleshooting Common Issues

### Issue: "Permission denied for table files"
**Solution:** Run `fix_subcontractor_file_permissions.sql`

### Issue: "Function is_subcontractor() does not exist"
**Solution:** 
```sql
-- Create the function
CREATE OR REPLACE FUNCTION is_subcontractor()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role = 'subcontractor' 
    FROM profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_subcontractor() TO authenticated;
```

### Issue: "Upload failed - storage error"
**Solution:** 
1. Check storage bucket exists: `SELECT * FROM storage.buckets WHERE id = 'files';`
2. If not exists, create it:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;
```
3. Run `manual_storage_policies.sql`

### Issue: "Cannot read properties of null"
**Cause:** User not authenticated or session expired
**Solution:** 
1. Check auth state in browser console: `console.log(await supabase.auth.getSession())`
2. If null, have user log out and log back in
3. Check for CORS issues in network tab

### Issue: Images upload but don't appear in gallery
**Cause:** Database record created but preview URL generation fails
**Solution:**
1. Check if files exist in storage:
```sql
SELECT * FROM storage.objects WHERE bucket_id = 'files' ORDER BY created_at DESC LIMIT 10;
```
2. Verify public access is enabled on bucket
3. Check browser console for CORS or 403 errors

---

## 📊 Success Criteria Checklist

After completing all steps, verify:

- [ ] Subcontractor can view assigned jobs
- [ ] Subcontractor can access work order form
- [ ] Before images upload successfully
- [ ] Before images appear in gallery
- [ ] Sprinkler images upload successfully (if applicable)
- [ ] Sprinkler images appear in gallery (if applicable)
- [ ] All required fields validate correctly
- [ ] Submit button enables when requirements met
- [ ] Form submission succeeds
- [ ] Success toast appears
- [ ] Redirects to `/dashboard/subcontractor`
- [ ] Work order appears as submitted
- [ ] Files exist in database
- [ ] Files exist in storage bucket
- [ ] No errors in browser console
- [ ] No errors in Supabase logs

---

## 📝 Next Steps After Verification

Once all checks pass:

1. **Document results:**
   - Save output of verification script
   - Note any issues encountered and how resolved
   - Update team on status

2. **Monitor production:**
   - Watch for any errors in Supabase logs
   - Monitor support requests from subcontractors
   - Track upload success rates

3. **Plan enhancements:**
   - Review `SUBCONTRACTOR_WORK_ORDER_ANALYSIS_AND_ROADMAP.md`
   - Prioritize UX improvements
   - Schedule implementation of confirmation modal

---

## 🆘 Need Help?

If issues persist after following this guide:

1. **Check Supabase Logs:**
   - Dashboard → Logs → API Logs
   - Look for 401, 403, or 500 errors
   - Note the exact error message

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for red errors
   - Check Network tab for failed requests

3. **Gather Debug Info:**
   ```javascript
   // Run in browser console while logged in as subcontractor
   const session = await supabase.auth.getSession();
   console.log('User ID:', session.data.session?.user?.id);
   
   const profile = await supabase
     .from('profiles')
     .select('*')
     .eq('id', session.data.session?.user?.id)
     .single();
   console.log('Profile:', profile.data);
   
   // Test files table access
   const filesTest = await supabase
     .from('files')
     .select('count')
     .limit(1);
   console.log('Can read files:', !filesTest.error);
   console.log('Files error:', filesTest.error);
   ```

4. **Contact team with:**
   - Verification script output
   - Browser console errors
   - Supabase log errors
   - Steps to reproduce

---

## 📚 Related Documentation

- **Full Analysis:** `SUBCONTRACTOR_WORK_ORDER_ANALYSIS_AND_ROADMAP.md`
- **File Permissions Fix:** `fix_subcontractor_file_permissions.sql`
- **Storage Policies:** `manual_storage_policies.sql`
- **Work Order Implementation:** `NEWWORKORDER_IMPLEMENTATION_SUMMARY.md`
- **File Management:** `COMPREHENSIVE_FILE_MANAGEMENT_IMPLEMENTATION.md`

---

**Last Updated:** November 11, 2025  
**Version:** 1.0
