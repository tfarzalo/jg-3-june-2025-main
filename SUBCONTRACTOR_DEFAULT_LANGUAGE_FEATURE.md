# Per-Subcontractor Default Dashboard Language Feature

## Overview
This feature allows admin/jg_management users to set a default dashboard language (Spanish or English) for each subcontractor. The subcontractor's dashboard will automatically load in their preferred language on login and across all pages, while still maintaining the ability to temporarily toggle the language during a session.

## Feature Components

### 1. Database Schema
- **Column**: `profiles.language_preference` (text, default 'en')
- Already exists in the database (added in migration `20250103000003_add_profile_availability_simple.sql`)
- Values: 'en' (English) or 'es' (Spanish)

### 2. Row-Level Security (RLS)
- **Migration**: `20250107000001_add_language_preference_rls.sql`
- **Policy**: Trigger-based validation ensures:
  - Users can update their own `language_preference`
  - Only admin/jg_management can update another user's `language_preference`
  - Attempting to update another user's preference without proper permissions throws an error

### 3. Admin UI - Subcontractor Edit Page
- **File**: `src/components/SubcontractorEditPage.tsx`
- **Changes**:
  - Added `language_preference` field to `SubcontractorData` interface
  - Added `defaultToSpanish` boolean to form state
  - Added checkbox UI in "Language Preference" section
  - Checkbox checked when `language_preference === 'es'`
  - On save, sets `language_preference` to 'es' (checked) or 'en' (unchecked)

### 4. Subcontractor Dashboard Language Bootstrapping
- **Files**: 
  - `src/components/SubcontractorDashboard.tsx`
  - `src/components/SubcontractorDashboardPreview.tsx`

#### Language Initialization Priority:
1. **localStorage override** (`subcontractorDashboardLanguage`) - for current session override
2. **Profile preference** (`profiles.language_preference` from database)
3. **Fallback** - 'en' (English)

#### Implementation Details:
- Added `languageInitialized` state flag to prevent race conditions
- On component mount, `useEffect` runs `initializeLanguage()` async function
- Fetches user profile from database and reads `language_preference`
- Sets initial language state based on priority order above
- Added `handleLanguageChange()` function that:
  - Updates in-memory language state
  - Persists override to localStorage
  - Does NOT update database (keeps admin control)

### 5. Translation Updates
Added missing Spanish translations for:
- `extraCharges`: "Extra Charges -" → "Cargos Adicionales -"
- `perHour`: "/hour" → "/hora"

All existing translations remain intact.

## User Workflows

### Admin/JG Management Setting Default Language:
1. Navigate to "Edit Subcontractor" page for a user
2. Scroll to "Language Preference" section
3. Check "Default Dashboard Language to Spanish" checkbox
4. Click "Save Changes"
5. Database updates `language_preference = 'es'` for that user
6. On next login, subcontractor dashboard loads in Spanish

### Subcontractor Login Experience:
1. User logs in
2. Dashboard component checks localStorage first
3. If no override, fetches profile and reads `language_preference`
4. Dashboard loads in Spanish (if `language_preference = 'es'`) or English (default)
5. User can toggle language using dropdown
6. Toggle persists in localStorage but doesn't change DB
7. On next login, DB default re-applies

### Subcontractor Toggling Language:
1. User clicks language dropdown
2. Selects English or Spanish
3. Language changes immediately
4. Override saved to localStorage
5. Override persists across page navigation in same session
6. On logout/next login, DB default preference re-applies

## Edge Cases Handled

### New Users:
- Default `language_preference = 'en'` from database schema
- Dashboard loads in English until admin changes setting

### Admin Changes Setting:
- Change takes effect on subcontractor's next login or page refresh
- If subcontractor has active localStorage override, it takes precedence until cleared

### No Profile/Error Loading:
- Fallback to 'en' (English) prevents crash
- Error logged to console for debugging

### Preview Mode (Admin/JG Management):
- Respects `previewUserId` query param
- Loads language preference for previewed user, not admin
- Uses separate localStorage key (`subcontractorDashboardPreviewLanguage`)

## Files Modified

### Database:
- `supabase/migrations/20250107000001_add_language_preference_rls.sql` (NEW)

### Frontend:
- `src/components/SubcontractorEditPage.tsx`
- `src/components/SubcontractorDashboard.tsx`
- `src/components/SubcontractorDashboardPreview.tsx`

## Testing Checklist

### Database/RLS:
- [x] Subcontractor can read own `language_preference`
- [x] Subcontractor cannot update another user's `language_preference`
- [x] Admin can update any user's `language_preference`
- [x] JG Management can update any user's `language_preference`

### UI - Admin:
- [x] Checkbox displays correctly in SubcontractorEditPage
- [x] Checkbox checked when `language_preference = 'es'`
- [x] Checkbox unchecked when `language_preference = 'en'`
- [x] Save successfully updates database
- [x] Toast notification on successful save

### UI - Subcontractor Dashboard:
- [x] New user (default 'en') loads English
- [x] User with `language_preference = 'es'` loads Spanish
- [x] User with `language_preference = 'en'` loads English
- [x] Language toggle works and updates UI immediately
- [x] Toggle persists in localStorage
- [x] Logout clears session, next login re-applies DB default
- [x] localStorage override takes precedence over DB preference
- [x] All translated strings display correctly
- [x] No flickering or loading delays

### Translations:
- [x] All existing translations still work
- [x] "Extra Charges -" translates to "Cargos Adicionales -"
- [x] "/hour" translates to "/hora"
- [x] No hardcoded English strings remain in dashboard

## Migration Instructions

### 1. Apply Database Migration:
```bash
# Run the RLS migration
psql -h [your-supabase-host] -U postgres -d postgres -f supabase/migrations/20250107000001_add_language_preference_rls.sql
```

Or use Supabase CLI:
```bash
supabase db push
```

### 2. Deploy Frontend Changes:
```bash
# Build and deploy
npm run build
# Deploy to your hosting platform
```

### 3. Verify:
- Test RLS policies with different user roles
- Test admin editing subcontractor language preference
- Test subcontractor dashboard language initialization
- Test language toggle and persistence

## Future Enhancements (Optional)

1. **Add Language Preference to User's Own Profile**:
   - Allow subcontractors to set their own default language
   - Update RLS to allow self-edit of `language_preference`

2. **Multi-Language Support**:
   - Extend to support more languages (French, Portuguese, etc.)
   - Update translation maps accordingly

3. **Language Preference Across All Routes**:
   - Extend language bootstrapping to other pages (NewWorkOrder, FileManager, etc.)
   - Create global LanguageContext/Provider for app-wide state management

4. **Admin Bulk Update**:
   - Add ability to set language preference for multiple subcontractors at once

## Support

For questions or issues, contact the development team or refer to:
- Supabase RLS documentation: https://supabase.com/docs/guides/auth/row-level-security
- React state management best practices
- Translation/i18n patterns in React applications
