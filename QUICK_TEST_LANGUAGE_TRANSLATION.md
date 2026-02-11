# Quick Test: Subcontractor Language & Translation

## 🎯 What Was Fixed
1. **Language priority fixed:** Profile preference (admin-set) always loads, not localStorage
2. **Loading screen translated:** Initial "Loading your workspace..." and "PAINTING DASHBOARD" now in Spanish/English
3. **Accept/Decline actions translated:** All buttons, loading modals, and toasts now bilingual

## ⚡ Quick Test (3 minutes)

### Test 1: Spanish Profile User - Full Experience
**Setup:** Ensure test user's profile has `language_preference = 'es'`

1. **Open dashboard**
   - ✅ Initial loading screen shows "PANEL DE PINTURA"
   - ✅ Shows "Cargando su espacio de trabajo..."

2. **Dashboard loads**
   - ✅ All UI text in Spanish
   - ✅ Language toggle shows "Español" selected

3. **Accept assignment**
   - Find a pending assignment
   - Click **"Aceptar"** button
   - ✅ Button changes to "Aceptando..."
   - ✅ Loading modal appears with:
     - Title: "Aceptando Asignación..."
     - Message: "Por favor espere mientras confirmamos su aceptación."
   - ✅ Modal closes, toast shows: "Asignación aceptada"

4. **Decline assignment**
   - Click **"Rechazar"** button on another assignment
   - ✅ Dropdown shows Spanish reasons:
     - "Seleccione razón"
     - "Conflicto de horario"
     - "Muy lejos / distancia de viaje"
     - etc.
   - Select a reason (e.g., "Conflicto de horario")
   - Click **"Confirmar Rechazo"**
   - ✅ Loading modal appears with:
     - Title: "Rechazando Asignación..."
     - Message: "Por favor espere mientras procesamos su rechazo."
   - ✅ Modal closes, toast shows: "Asignación rechazada"

5. **Validation messages**
   - Click **"Rechazar"** on another assignment
   - Click **"Confirmar Rechazo"** WITHOUT selecting a reason
   - ✅ Error toast: "Por favor elija una razón para rechazar."
   - Select "Otro" (Other)
   - Click **"Confirmar Rechazo"** WITHOUT typing details
   - ✅ Error toast: "Por favor proporcione una razón para Otro."

### Test 2: English Profile User - Full Experience
**Setup:** Ensure test user's profile has `language_preference = 'en'` (or NULL)

1. **Open dashboard**
   - ✅ Loading screen shows "PAINTING DASHBOARD"
   - ✅ Shows "Loading your workspace..."

2. **Dashboard loads**
   - ✅ All UI text in English
   - ✅ Language toggle shows "English" selected

3. **Accept assignment**
   - Click **"Accept"**
   - ✅ Button changes to "Accepting..."
   - ✅ Modal: "Accepting Assignment..."
   - ✅ Toast: "Assignment accepted"

4. **Decline assignment**
   - Click **"Decline"**
   - ✅ Dropdown shows English reasons
   - Select reason
   - Click **"Confirm Decline"**
   - ✅ Modal: "Declining Assignment..."
   - ✅ Toast: "Assignment declined"

### Test 3: Language Priority (Critical)
**Setup:** Spanish profile user who previously used English

1. **Simulate localStorage conflict:**
   - Open browser console (F12)
   - Run: `localStorage.setItem('subcontractor_language', 'en')`
   
2. **Refresh page**
   - ✅ Dashboard STILL loads in Spanish (ignores localStorage)
   - ✅ Profile preference takes priority

3. **Toggle to English**
   - Click language toggle → switch to English
   - ✅ All UI immediately switches to English
   - Accept/Decline actions work in English

4. **Refresh page again**
   - ✅ Dashboard reverts to Spanish (profile preference)
   - ✅ User's temporary toggle was session-only

### Test 4: Language Toggle During Actions
**Setup:** Spanish profile user

1. **Start dashboard in Spanish**
   - All UI in Spanish
   
2. **Toggle to English**
   - Click language toggle
   - ✅ All UI switches to English
   
3. **Test Accept in English**
   - Click "Accept"
   - ✅ Modal: "Accepting Assignment..."
   - ✅ Toast: "Assignment accepted"
   
4. **Toggle back to Spanish**
   - Click language toggle
   - ✅ All UI switches to Spanish
   
5. **Test Decline in Spanish**
   - Click "Rechazar"
   - ✅ Modal: "Rechazando Asignación..."
   - ✅ Toast: "Asignación rechazada"

## 🔍 Visual Checklist

### Spanish User Should See:
- [ ] "PANEL DE PINTURA" (loading screen title)
- [ ] "Cargando su espacio de trabajo..." (loading screen message)
- [ ] "Aceptar" / "Aceptando..." (accept button)
- [ ] "Rechazar" / "Rechazando..." (decline button)
- [ ] "Aceptando Asignación..." (accept modal title)
- [ ] "Rechazando Asignación..." (decline modal title)
- [ ] "Por favor espere mientras..." (modal messages)
- [ ] "Razón" (dropdown label)
- [ ] Spanish decline reasons (all 5 options)
- [ ] "Cancelar" (cancel button)
- [ ] "Confirmar Rechazo" (confirm button)
- [ ] Spanish error messages (validation)
- [ ] Spanish success toasts

### English User Should See:
- [ ] "PAINTING DASHBOARD" (loading screen title)
- [ ] "Loading your workspace..." (loading screen message)
- [ ] "Accept" / "Accepting..." (accept button)
- [ ] "Decline" / "Declining..." (decline button)
- [ ] "Accepting Assignment..." (accept modal title)
- [ ] "Declining Assignment..." (decline modal title)
- [ ] "Please wait while..." (modal messages)
- [ ] "Reason" (dropdown label)
- [ ] English decline reasons (all 5 options)
- [ ] "Cancel" (cancel button)
- [ ] "Confirm Decline" (confirm button)
- [ ] English error messages (validation)
- [ ] English success toasts

## 🚨 Common Issues & Fixes

### Issue: Dashboard loads in English for Spanish user
**Fix:**
1. Check database: `SELECT language_preference FROM profiles WHERE id = 'user_id';`
2. Should be 'es', if NULL, update: `UPDATE profiles SET language_preference = 'es' WHERE id = 'user_id';`
3. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Issue: Loading screen flashes English before Spanish
**Cause:** Language not initialized before loading screen starts
**Fix:** Code now waits for language initialization before showing loading screen

### Issue: Some text still in English
**Check:**
1. Which component/text is not translated?
2. Verify translation exists in the `t` object
3. Verify component uses `text.key` not hardcoded string

## ✅ Success Criteria
- ✅ Spanish users see Spanish from first frame (loading screen)
- ✅ English users see English throughout
- ✅ Loading modals during actions are properly translated
- ✅ All validation errors are translated
- ✅ All toasts are translated
- ✅ Profile language always loads (localStorage doesn't interfere)
- ✅ Language toggle works temporarily
- ✅ Page refresh reverts to profile language

## 🎉 Expected Result
**For Spanish users:** Complete Spanish experience with zero English "leaks" from initial load through all assignment actions.

**For English users:** Complete English experience throughout.

**Language toggle:** Works temporarily for current session, reverts to admin-set preference on page reload.

---

**Quick Test Time:** ~3 minutes per language
**Total Coverage:** Loading screen, dashboard UI, assignment actions, validation, toasts
