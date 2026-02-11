# Subcontractor Default Language - Testing Guide

## Prerequisites
- Access to admin/jg_management account
- Access to subcontractor account
- Database migration applied
- Frontend code deployed

## Test Scenarios

### 1. Admin Setting Language Preference

#### Test 1.1: Set Spanish as Default
**Steps:**
1. Log in as admin/jg_management
2. Navigate to Users → Select a subcontractor
3. Click "Edit" to open SubcontractorEditPage
4. Scroll to "Language Preference" section
5. Check "Default Dashboard Language to Spanish"
6. Click "Save Changes"

**Expected:**
- ✅ Checkbox can be checked
- ✅ Save succeeds with toast notification
- ✅ Database `profiles.language_preference` = 'es' for that user

#### Test 1.2: Verify Checkbox State Persists
**Steps:**
1. After Test 1.1, refresh the edit page
2. Observe checkbox state

**Expected:**
- ✅ Checkbox remains checked
- ✅ Form data loads correctly from database

#### Test 1.3: Uncheck (Set English)
**Steps:**
1. Uncheck "Default Dashboard Language to Spanish"
2. Click "Save Changes"

**Expected:**
- ✅ Save succeeds
- ✅ Database `profiles.language_preference` = 'en'

---

### 2. Subcontractor Dashboard Language Loading

#### Test 2.1: New User (Default English)
**Steps:**
1. Create new subcontractor or use existing with `language_preference = 'en'`
2. Log in as that subcontractor
3. Navigate to dashboard

**Expected:**
- ✅ Dashboard loads in English immediately
- ✅ All text displays in English
- ✅ No flickering or delay

#### Test 2.2: User with Spanish Preference
**Steps:**
1. Admin sets subcontractor's language preference to Spanish (Test 1.1)
2. Log in as that subcontractor
3. Navigate to dashboard

**Expected:**
- ✅ Dashboard loads in Spanish immediately
- ✅ All text displays in Spanish
- ✅ Language dropdown shows "Español" selected
- ✅ No flickering or delay

---

### 3. Language Toggle Behavior

#### Test 3.1: Toggle from Spanish to English
**Steps:**
1. Start with dashboard in Spanish (Test 2.2)
2. Click language dropdown
3. Select "English"

**Expected:**
- ✅ UI switches to English immediately
- ✅ All text updates to English
- ✅ localStorage saved with override
- ✅ Database NOT updated (remains 'es')

#### Test 3.2: Toggle Persists Across Pages
**Steps:**
1. After Test 3.1 (dashboard now in English)
2. Navigate to different pages (jobs, work orders, etc.)
3. Return to dashboard

**Expected:**
- ✅ Dashboard remains in English
- ✅ localStorage override still active

#### Test 3.3: Next Login Reapplies Default
**Steps:**
1. After Test 3.2 (localStorage has English override, DB has Spanish)
2. Log out
3. Log in again as same subcontractor

**Expected:**
- ✅ Dashboard loads in Spanish (DB default)
- ✅ localStorage override cleared on logout
- ✅ DB preference takes precedence again

---

### 4. RLS Policy Testing

#### Test 4.1: Subcontractor Cannot Edit Another User's Preference
**Steps:**
1. Log in as subcontractor A
2. Attempt to update `language_preference` for subcontractor B via API/direct DB access

**Expected:**
- ✅ Update fails with permission error
- ✅ Trigger blocks the update

#### Test 4.2: Subcontractor Can Edit Own Preference
**Steps:**
1. Log in as subcontractor
2. Update own `language_preference` via profile edit (if UI allows)

**Expected:**
- ✅ Update succeeds
- ✅ Own preference can be changed

#### Test 4.3: Admin Can Edit Any User's Preference
**Steps:**
1. Log in as admin
2. Edit multiple subcontractors' language preferences

**Expected:**
- ✅ All updates succeed
- ✅ No permission errors

---

### 5. Translation Completeness

#### Test 5.1: Verify All Spanish Translations
**Steps:**
1. Set language preference to Spanish
2. Navigate through entire dashboard
3. Check all labels, buttons, and text

**Expected:**
- ✅ "Extra Charges -" displays as "Cargos Adicionales -"
- ✅ "/hour" displays as "/hora"
- ✅ All previously translated text still works
- ✅ No English text visible (except proper nouns)

#### Test 5.2: Verify English Still Works
**Steps:**
1. Set language preference to English
2. Navigate through entire dashboard

**Expected:**
- ✅ All text displays in English correctly
- ✅ No missing translations
- ✅ No Spanish text bleeding through

---

### 6. Edge Cases

#### Test 6.1: Preview Mode (Admin Viewing Subcontractor Dashboard)
**Steps:**
1. Log in as admin/jg_management
2. Navigate to subcontractor dashboard with `?userId=<subcontractor_id>`
3. Observe language

**Expected:**
- ✅ Dashboard loads in subcontractor's preferred language (not admin's)
- ✅ Language toggle works
- ✅ Uses separate localStorage key

#### Test 6.2: Profile Load Error
**Steps:**
1. Simulate network error or database unavailable
2. Log in as subcontractor

**Expected:**
- ✅ Dashboard falls back to English
- ✅ No crash or infinite loading
- ✅ Error logged to console

#### Test 6.3: Missing language_preference (NULL)
**Steps:**
1. Manually set `language_preference = NULL` for a user
2. Log in as that user

**Expected:**
- ✅ Dashboard defaults to English
- ✅ No errors

---

## Automated Test Script (Optional)

```javascript
// Cypress or Jest test example
describe('Subcontractor Language Preference', () => {
  it('should load Spanish when preference is set to es', async () => {
    // Set language_preference to 'es' in DB
    await supabase.from('profiles').update({ language_preference: 'es' }).eq('id', testUserId);
    
    // Log in and navigate to dashboard
    cy.login(testUser);
    cy.visit('/dashboard');
    
    // Verify Spanish text is displayed
    cy.contains('Mis Trabajos Asignados').should('be.visible');
    cy.contains('Hoy').should('be.visible');
  });
  
  it('should persist language toggle in localStorage', () => {
    cy.visit('/dashboard');
    cy.get('select[value="es"]').select('en');
    cy.window().its('localStorage.subcontractorDashboardLanguage').should('eq', 'en');
  });
});
```

---

## Sign-Off Checklist

- [ ] All admin UI tests pass
- [ ] All subcontractor dashboard tests pass
- [ ] All language toggle tests pass
- [ ] All RLS policy tests pass
- [ ] All translation tests pass
- [ ] All edge case tests pass
- [ ] No console errors
- [ ] Performance is acceptable (no noticeable delays)
- [ ] Documentation is complete and accurate

**Tested by:** _________________  
**Date:** _________________  
**Sign-off:** _________________
