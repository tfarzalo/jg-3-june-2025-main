# Subcontractor Dashboard: Spanish Translation for Database Content

## Date: February 25, 2026

## Overview
Enhanced the subcontractor dashboard to translate database-driven content (room names, paint types, billing categories, and unit sizes) when viewing in Spanish language mode.

## Problem
Previously, only UI labels were being translated to Spanish. Database content such as:
- **Job Phase labels** (Job Request, Approved, In Progress, etc.)
- **Unit sizes in job cards** (1 Bedroom, 2 Bedroom, etc.)
- Room names (Walls, KBA, Trim/Backsplash, Bathroom's, Bedrooms)
- Paint scheme types (Regular Paint, Painted Ceilings)
- Billing category names (Regular Paint, Painted Ceilings, Cargos Adicionales)
- Unit size labels in billing section (1 Bedroom, 2 Bedroom, etc.)

These were all displaying in English even when the user selected Spanish language.

## Solution
Added translation helper functions that map common English database values to their Spanish equivalents.

## Changes Made

### File: `src/components/SubcontractorDashboard.tsx`

#### 1. Added Translation Helper Functions (after line ~220)

**`translateJobPhase(jobPhase: string): string`**
- Translates job phase labels from English to Spanish
- Mappings include:
  - Job Request → Solicitud de Trabajo
  - Approved → Aprobado
  - In Progress → En Progreso
  - Completed → Completado
  - On Hold → En Espera
  - Cancelled → Cancelado
  - Pending → Pendiente
  - Work Order Created → Orden de Trabajo Creada
  - Ready for Invoice → Listo para Facturar
  - Invoiced → Facturado
  - Paid → Pagado
  - And more...

**`translateRoomName(room: string): string`**
- Translates room names from English to Spanish
- Mappings include:
  - Walls → Paredes
  - KBA → KBA (unchanged)
  - Trim/Backsplash → Moldura/Salpicadero
  - Bathroom's → Baños
  - Bedroom → Dormitorio
  - Kitchen → Cocina
  - Living Room → Sala de Estar
  - And many more...

**`translatePaintType(paintType: string): string`**
- Translates paint scheme types
- Handles "Floorplan X" format (converts to "Plano de Planta X")
- Mappings include:
  - Regular Paint → Pintura Regular
  - Painted Ceilings → Techos Pintados
  - Painted Cabinets → Gabinetes Pintados
  - Accent Wall → Pared de Acento
  - And more...

**`translateCategoryName(categoryName: string): string`**
- Translates billing category names
- Mappings include:
  - Regular Paint → Pintura Regular
  - Painted Ceilings → Techos Pintados
  - Patch/Drywall/Ceiling → Parche/Drywall/Techo
  - Paint One Accent Wall → Pintar Una Pared de Acento
  - Extra Charges → Cargos Adicionales
  - And more...

**`translateUnitSize(unitSize: string): string`**
- Translates unit size labels
- Mappings include:
  - 1 Bedroom → 1 Dormitorio
  - 2 Bedroom → 2 Dormitorios
  - 3 Bedroom → 3 Dormitorios
  - Studio → Estudio
  - Paint One Accent Wall → Pintar Una Pared de Acento
  - Patch/Drywall/Ceiling → Parche/Drywall/Techo
  - Per Hour → Por Hora
  - Other → Otro
  - And more...

#### 2. Applied Translations in Job Cards

**Job Phase Badge - Before:**
```tsx
{job.job_phase?.job_phase_label || text.unknownPhase}
```

**Job Phase Badge - After:**
```tsx
{translateJobPhase(job.job_phase?.job_phase_label || text.unknownPhase)}
```

**Unit Size in Job Card - Before:**
```tsx
{job.unit_size.unit_size_label}
```

**Unit Size in Job Card - After:**
```tsx
{translateUnitSize(job.unit_size.unit_size_label)}
```

#### 3. Applied Translations in Paint Colors Section

**Before:**
```tsx
<h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">{scheme.paint_type}</h5>
...
<span className="text-gray-600 dark:text-gray-400">{room.room}</span>
```

**After:**
```tsx
<h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">{translatePaintType(scheme.paint_type)}</h5>
...
<span className="text-gray-600 dark:text-gray-400">{translateRoomName(room.room)}</span>
```

#### 4. Applied Translations in Billing Information Section

**Category Names - Before:**
```tsx
{labelPrefix ? `${labelPrefix} ${category.name}` : category.name}
```

**Category Names - After:**
```tsx
{labelPrefix ? `${labelPrefix} ${translateCategoryName(category.name)}` : translateCategoryName(category.name)}
```

**Unit Size Labels - Before:**
```tsx
<span className="text-gray-600 dark:text-gray-400">
  {detail.unit_size.unit_size_label}
</span>
```

**Unit Size Labels - After:**
```tsx
<span className="text-gray-600 dark:text-gray-400">
  {translateUnitSize(detail.unit_size.unit_size_label)}
</span>
```

## Translation Coverage

### Job Phases (13 translations)
- Job Request → Solicitud de Trabajo
- Approved → Aprobado
- In Progress → En Progreso
- Completed → Completado
- On Hold → En Espera
- Cancelled → Cancelado
- Pending → Pendiente
- Review → Revisión
- Scheduled → Programado
- Work Order Created → Orden de Trabajo Creada
- Ready for Invoice → Listo para Facturar
- Invoiced → Facturado
- Paid → Pagado

### Room Names (29 translations)
- Walls, KBA, Trim, Backsplash, Bathroom, Bedroom, Living Room, Kitchen, Dining Room, Hallway, Entry, Closet, Ceiling, Door, Window, Baseboard, Crown Molding, Accent Wall, Other, and plural forms

### Paint Types (7+ translations)
- Regular Paint, Painted Ceilings, Painted Cabinets, Accent Wall, Exterior Paint, Trim Paint, Door Paint
- Special handling for "Floorplan X" format

### Billing Categories (15 translations)
- Regular Paint, Painted Ceilings, Painted Cabinets, Accent Wall, Patch/Drywall/Ceiling, Extra Charges, Paint One Accent Wall, Exterior Paint, Trim Paint, Door Paint, Window Paint, Cabinet Paint, Drywall Repair, Ceiling Repair, Other

### Unit Sizes (14 translations)
- 1/2/3/4 Bedroom, Studio, Loft, Paint One Accent Wall, Patch/Drywall/Ceiling, Paint Bedroom, Paint Bathroom, Per Hour, Hourly, Other, Each, Per Room, Per Unit

## How It Works

1. **Language Detection**: The component already detects the user's language preference from their profile
2. **Conditional Translation**: Each translation function checks if the current language is Spanish
3. **Fallback**: If a translation isn't found in the mapping, the original English text is displayed
4. **No Database Changes**: This approach doesn't require any database schema changes

## Benefits

- ✅ Comprehensive Spanish translations for subcontractors
- ✅ No database schema changes required
- ✅ Easy to extend with more translations
- ✅ Graceful fallback for untranslated values
- ✅ Maintains data integrity (database still stores in English)
- ✅ Consistent with existing language toggle functionality

## Limitations & Future Improvements

### Current Approach (Client-Side Translation)
**Pros:**
- Quick to implement
- No database migrations required
- Easy to update translations

**Cons:**
- Translations are hardcoded in the component
- Need to update code to add new translations
- Not suitable for user-customizable content

### Future Enhancement Options

If more dynamic translation is needed:

1. **Database-Driven Translation Tables**
   - Add `translations` table with columns: `entity_type`, `entity_id`, `language`, `field_name`, `translated_value`
   - Store translations for each database entity
   - More flexible but requires significant database changes

2. **i18n Library Integration**
   - Use libraries like `react-i18next` or `react-intl`
   - Centralize all translations in JSON files
   - Better for large-scale applications

3. **API Translation Service**
   - Use Google Translate API or similar for dynamic content
   - Good for user-generated content
   - Requires API costs and internet connection

For now, the client-side translation approach is sufficient for the relatively static database content (room names, paint types, etc.).

## Testing Checklist

### Spanish Translation Tests
- [x] Paint Colors section
  - [x] Paint scheme types translated (Regular Paint → Pintura Regular)
  - [x] Room names translated (Walls → Paredes, Bedroom → Dormitorio)
  - [x] "Floorplan" text translated (Floorplan 1 → Plano de Planta 1)

- [x] Billing Information section
  - [x] Category names translated (Regular Paint → Pintura Regular)
  - [x] Unit size labels translated (1 Bedroom → 1 Dormitorio)
  - [x] Extra charges label translated correctly
  - [x] Billing order maintained after translation

### Language Toggle Tests
- [ ] Switch from English to Spanish - all content updates
- [ ] Switch from Spanish to English - all content reverts
- [ ] Refresh page - language preference persists
- [ ] Admin preview mode - respects subcontractor's language setting

### Fallback Tests
- [ ] Untranslated room name displays in English
- [ ] Untranslated category displays in English
- [ ] New unit sizes without translations display correctly

## Adding New Translations

To add translations for new database values:

1. Identify which helper function to update:
   - Room names → `translateRoomName`
   - Paint types → `translatePaintType`
   - Categories → `translateCategoryName`
   - Unit sizes → `translateUnitSize`

2. Add the mapping to the appropriate function:
   ```typescript
   'New English Value': 'Nueva Valor en Español',
   ```

3. Test in Spanish mode to verify

## Files Modified
1. `src/components/SubcontractorDashboard.tsx` - All changes in this single file

## No Database Migrations Required
All changes are client-side only.
