# 🌐 Subcontractor Language Preference Fix

## 🐛 Problem Identified

Subcontractor users were loading **English as default** even when an admin had set **Spanish** in their profile's `language_preference` field.

### Root Cause
The language initialization logic was checking **localStorage FIRST** before checking the profile preference:

```typescript
// ❌ OLD LOGIC (BROKEN)
const localStorageOverride = localStorage.getItem('subcontractorDashboardLanguage');

if (localStorageOverride && (localStorageOverride === 'en' || localStorageOverride === 'es')) {
  setLanguage(localStorageOverride as 'en' | 'es');
  setLanguageInitialized(true);
  return; // ⚠️ This exits early, never checking profile!
}

// This code would never run if localStorage had a value:
const { data: profileData } = await supabase
  .from('profiles')
  .select('language_preference')
  .eq('id', userId)
  .single();
```

**What went wrong:**
1. User logs in → profile says Spanish
2. User toggles to English temporarily
3. English saved to localStorage
4. User logs out and back in
5. localStorage has 'en' → **ignores profile Spanish setting**
6. User always sees English, even though admin set Spanish

---

## ✅ Solution Implemented

### Changed Behavior
**Now:** The system **ALWAYS** loads the language from the user's profile (admin-set value), ignoring any localStorage values.

**Result:**
- ✅ Admin sets Spanish in profile → User always sees Spanish on load
- ✅ User can toggle to English temporarily during session
- ✅ User refreshes page → Back to Spanish (profile default)
- ✅ Admin changes language → Takes effect immediately on next load

### Code Changes

#### 1. SubcontractorDashboard.tsx

**Language Initialization (useEffect):**
```typescript
// ✅ NEW LOGIC (FIXED)
useEffect(() => {
  const initializeLanguage = async () => {
    try {
      // Priority: 1. Profile preference (admin-set), 2. Default 'en'
      // Note: We intentionally ignore localStorage to ensure admin-set language always loads
      // Users can toggle language temporarily, but it resets on page reload
      
      let userId: string | undefined;
      
      if (previewUserId) {
        userId = previewUserId;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        userId = userData.user?.id;
      }

      if (userId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('language_preference')
          .eq('id', userId)
          .single();

        if (profileData?.language_preference === 'es') {
          setLanguage('es');
        } else {
          setLanguage('en');
        }
      } else {
        setLanguage('en'); // Fallback to English if no user
      }
    } catch (error) {
      console.error('Error initializing language:', error);
      setLanguage('en'); // Fallback to English
    } finally {
      setLanguageInitialized(true);
    }
  };

  initializeLanguage();
}, [previewUserId]);
```

**Language Toggle Handler:**
```typescript
// ✅ NEW - Does NOT persist to localStorage
const handleLanguageChange = (newLanguage: 'en' | 'es') => {
  setLanguage(newLanguage);
  // Intentionally NOT saving to localStorage - admin-set language should always be the default
};
```

#### 2. SubcontractorDashboardPreview.tsx
Applied identical changes for consistency.

---

## 🔄 New User Flow

### Scenario 1: Spanish User (Admin-Set)
1. **Admin sets** `language_preference = 'es'` in profile
2. **User logs in** → Dashboard loads in Spanish ✅
3. **User toggles** to English using dropdown
4. **During session:** Dashboard shows English
5. **User refreshes page** → Dashboard loads in Spanish again ✅
6. **User logs out and back in** → Dashboard loads in Spanish ✅

### Scenario 2: English User (Admin-Set or Default)
1. **Admin sets** `language_preference = 'en'` (or null/undefined = default English)
2. **User logs in** → Dashboard loads in English ✅
3. **User toggles** to Spanish using dropdown
4. **During session:** Dashboard shows Spanish
5. **User refreshes page** → Dashboard loads in English again ✅

### Scenario 3: Admin Changes Language
1. **User has** `language_preference = 'en'`
2. **Admin changes** to `language_preference = 'es'` in user profile
3. **User refreshes page** → Dashboard loads in Spanish ✅
4. **Change takes effect immediately**

---

## 🎯 Key Behaviors

### ✅ What Works Now
- **Profile preference is ALWAYS the source of truth** on page load
- Admin-set language preference is respected every time
- Users can toggle language temporarily during a session
- Language resets to profile default on refresh (intentional)
- No localStorage pollution causing incorrect defaults

### 📝 Important Notes
- **Language toggle is session-only:** Users can change language during use, but it resets on refresh
- **This is by design:** Admin-set preference should always be the default
- **No database writes on toggle:** User toggling language doesn't update their profile
- **Only admins should update:** `language_preference` field in profiles table

---

## 🧪 Testing Guide

### Test 1: Spanish Default (Happy Path)
1. As admin, set a subcontractor user's `language_preference = 'es'` in profiles table
2. Log in as that subcontractor
3. ✅ **Verify:** Dashboard loads in Spanish
4. Toggle to English using language dropdown
5. ✅ **Verify:** Dashboard switches to English
6. Refresh the page (F5 or Cmd+R)
7. ✅ **Verify:** Dashboard loads in Spanish again (profile default)

### Test 2: English Default
1. As admin, set a subcontractor user's `language_preference = 'en'` (or null)
2. Log in as that subcontractor
3. ✅ **Verify:** Dashboard loads in English
4. Toggle to Spanish
5. ✅ **Verify:** Dashboard switches to Spanish
6. Refresh the page
7. ✅ **Verify:** Dashboard loads in English again

### Test 3: Admin Changes Language
1. User is logged in with `language_preference = 'en'`
2. Dashboard showing English
3. Admin changes profile to `language_preference = 'es'`
4. User refreshes page
5. ✅ **Verify:** Dashboard now loads in Spanish

### Test 4: Clean Browser (No Old localStorage)
1. Open browser in incognito/private mode
2. Log in as Spanish-preference subcontractor
3. ✅ **Verify:** Dashboard loads in Spanish (no localStorage to interfere)

### Test 5: Old localStorage Cleanup (Edge Case)
1. User had old localStorage value from previous version
2. User refreshes page
3. ✅ **Verify:** Profile preference takes precedence, old localStorage ignored

---

## 📊 Files Modified

### 1. `/src/components/SubcontractorDashboard.tsx`
**Changes:**
- ✅ Removed localStorage check from language initialization
- ✅ Profile preference is now the only source of truth
- ✅ Updated comments to explain behavior
- ✅ Removed localStorage.setItem() from handleLanguageChange

**Lines Modified:** ~215-265 (language initialization useEffect and handler)

### 2. `/src/components/SubcontractorDashboardPreview.tsx`
**Changes:**
- ✅ Applied identical fixes for consistency
- ✅ Preview mode uses same logic as regular dashboard

**Lines Modified:** ~215-265 (language initialization useEffect and handler)

---

## 🔍 Technical Details

### Database Schema
The fix relies on the `profiles` table having a `language_preference` column:

```sql
-- Profiles table (existing)
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  language_preference TEXT, -- 'en' or 'es'
  role TEXT,
  -- ... other columns
);
```

### Priority Order (CHANGED)
**Before (Broken):**
1. localStorage → 2. Profile → 3. Default 'en'

**After (Fixed):**
1. Profile → 2. Default 'en'

### Removed Behavior
- ❌ No longer checks localStorage on mount
- ❌ No longer saves to localStorage on toggle
- ❌ Old localStorage values are ignored (harmless if present)

### Preserved Behavior
- ✅ Users can still toggle language during session
- ✅ Language state persists during session (until refresh)
- ✅ Profile database field is never written by dashboard (admin-only)

---

## 🚨 Known Limitations

### Session-Only Toggle
**Behavior:** User toggles language → lasts until page refresh
**Why:** Intentional - admin-set preference is the source of truth
**Workaround:** If users need persistent toggle, admin should update their profile

### No User Self-Service Language Change
**Current:** Users cannot permanently change their language preference
**Why:** `language_preference` is admin-controlled field
**Future Enhancement:** Could add a "Save my preference" button that updates profile (requires RLS policy)

---

## ✅ Success Criteria

All criteria met:
- [x] Profile language_preference is always respected on load
- [x] Users can toggle language temporarily (session-only)
- [x] Language resets to profile default on refresh
- [x] Admin changes take effect immediately on next load
- [x] No localStorage interference
- [x] Both dashboard components fixed (regular + preview)
- [x] No TypeScript errors
- [x] Backward compatible (old localStorage values harmlessly ignored)

---

## 🎉 Conclusion

**The subcontractor language preference now works as intended:**
- ✅ Always loads admin-set language preference from profile
- ✅ Users can toggle temporarily during session
- ✅ Resets to profile default on refresh (by design)
- ✅ Admin changes take effect immediately

**No more English-only defaults when Spanish is set in profile!**

---

*Last Updated: February 10, 2026*  
*Status: ✅ Fixed and Ready for Testing*
