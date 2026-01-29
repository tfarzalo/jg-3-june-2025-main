# Quick Reference - Modernized UI Components

## 🎨 Design System Reference

### Color Gradients Used

```tsx
// Blue - Primary sections (Job Details, Property Info, Group Info)
className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800"

// Purple - Secondary info (Phase History, Timeline)
className="bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800"

// Teal - Content sections (Paint Colors, Special Items)
className="bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-700 dark:to-teal-800"

// Green - Location/Billing sections (Maps, Billing Details)
className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800"

// Amber - Financial sections (Billing Info, Extra Charges)
className="bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-700 dark:to-amber-800"

// Red - Warning sections (Callbacks, Issues)
className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800"

// Indigo - Compliance sections
className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800"

// Pink - Special features
className="bg-gradient-to-r from-pink-600 to-pink-700 dark:from-pink-700 dark:to-pink-800"
```

---

## 📐 Layout Patterns

### Full-Width Section Container
```tsx
<div className="space-y-8">
  {/* Sections go here */}
</div>
```

### Card Layout (Standard Section)
```tsx
<div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
  {/* Header */}
  <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
    <h2 className="text-xl font-semibold text-white flex items-center">
      <Icon className="h-5 w-5 mr-2" />
      Section Title
    </h2>
  </div>
  
  {/* Content */}
  <div className="p-6">
    {/* Content goes here */}
  </div>
</div>
```

### Two-Column Grid
```tsx
<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
  <div>{/* Left column */}</div>
  <div>{/* Right column */}</div>
</div>
```

### Status Banner (Below Header)
```tsx
{/* Section with gradient header */}
<div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
    <h2>Section Title</h2>
  </div>
  
  {/* Status banner right below header */}
  {showStatus && (
    <div className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 px-6 py-3 border-b flex items-center space-x-2">
      <CheckCircle className="h-5 w-5" />
      <span className="font-semibold">Status message here</span>
    </div>
  )}
  
  <div className="p-6">
    {/* Content */}
  </div>
</div>
```

---

## 🔤 Typography Scale

```tsx
// Page Title
className="text-2xl font-bold text-gray-900 dark:text-white"

// Section Header (in gradient)
className="text-xl font-semibold text-white"

// Subsection Header
className="text-lg font-semibold text-gray-900 dark:text-white"

// Label (uppercase)
className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"

// Body Text
className="text-gray-900 dark:text-white"

// Secondary Text
className="text-sm text-gray-600 dark:text-gray-400"

// Muted Text
className="text-xs text-gray-500 dark:text-gray-400"
```

---

## 🎯 Common Spacing

```tsx
// Section spacing (vertical)
className="space-y-8"  // Between major sections
className="space-y-6"  // Between subsections
className="space-y-4"  // Between items
className="space-y-2"  // Between fields

// Grid gaps
className="gap-6"      // Standard grid gap
className="gap-4"      // Smaller grid gap

// Padding
className="p-6"        // Standard card padding
className="p-4"        // Smaller padding
className="px-6 py-4"  // Header padding
```

---

## 🎨 Info Boxes/Alerts

### Success (Green)
```tsx
<div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
  <div className="flex items-center">
    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
    <p className="text-green-800 dark:text-green-200">Success message</p>
  </div>
</div>
```

### Warning (Yellow)
```tsx
<div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
  <div className="flex items-center">
    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mr-2" />
    <p className="text-yellow-800 dark:text-yellow-200">Warning message</p>
  </div>
</div>
```

### Error (Red)
```tsx
<div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
  <div className="flex items-center">
    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
    <p className="text-red-800 dark:text-red-200">Error message</p>
  </div>
</div>
```

### Info (Blue)
```tsx
<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
  <div className="flex items-center">
    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
    <p className="text-blue-800 dark:text-blue-200">Info message</p>
  </div>
</div>
```

---

## 🔘 Buttons

### Primary Button
```tsx
<button className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
  <Icon className="h-4 w-4 mr-2" />
  Button Text
</button>
```

### Secondary Button
```tsx
<button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors">
  Button Text
</button>
```

### Danger Button
```tsx
<button className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
  <Trash2 className="h-4 w-4 mr-2" />
  Delete
</button>
```

---

## 📋 Data Display Patterns

### Key-Value Pair
```tsx
<div className="flex items-start">
  <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-1 mr-3 flex-shrink-0" />
  <div>
    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Label</p>
    <p className="text-gray-900 dark:text-white">Value</p>
  </div>
</div>
```

### Stat Card
```tsx
<div className="p-4 bg-gray-50 dark:bg-[#0F172A] rounded-lg">
  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Label</p>
  <p className="text-2xl font-bold text-gray-900 dark:text-white">123</p>
</div>
```

### Contact Info Block
```tsx
<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-3 uppercase tracking-wide">
    Contact Title
  </h4>
  <div className="space-y-2">
    <div className="flex items-center">
      <User className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
      <span className="text-gray-900 dark:text-white text-sm">Name</span>
    </div>
    <div className="flex items-center">
      <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
      <span className="text-gray-900 dark:text-white text-sm">email@example.com</span>
    </div>
    <div className="flex items-center">
      <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
      <span className="text-gray-900 dark:text-white text-sm">(555) 123-4567</span>
    </div>
  </div>
</div>
```

---

## 🗂️ Navigation Links (Jump to Section)

```tsx
<div className="grid grid-cols-4 gap-4 mb-8">
  <button 
    onClick={() => document.getElementById('section-id')?.scrollIntoView({ behavior: 'smooth' })}
    className="flex flex-col items-center space-y-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
  >
    <Icon className="h-4 w-4" />
    <span className="text-xs">Section Name</span>
  </button>
</div>
```

---

## 🖼️ Image/Map Display

### Map Container
```tsx
<div className="relative z-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
  <PropertyMap 
    address={formattedAddress}
    className="w-full h-[300px]"
  />
</div>
```

### Image with Zoom
```tsx
<div className="relative group">
  <img 
    src={imageUrl} 
    alt="Description"
    className="w-full h-auto rounded-lg cursor-pointer"
    onClick={() => setLightboxImage(imageUrl)}
  />
  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
</div>
```

---

## 🔍 Loading States

### Spinner
```tsx
<div className="flex items-center justify-center h-full">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
</div>
```

### Full Page Loading
```tsx
<div className="flex items-center justify-center min-h-screen">
  <div className="text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
    <p className="text-gray-600">Loading...</p>
  </div>
</div>
```

---

## ✅ Applying the Design System to New Pages

### Step-by-Step Process

1. **Remove old max-width constraints**
   ```tsx
   // Remove: max-w-7xl mx-auto
   // Use: Full width with proper spacing
   ```

2. **Wrap page in proper container**
   ```tsx
   <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
     <div className="space-y-8">
       {/* Sections */}
     </div>
   </div>
   ```

3. **Convert sections to card layout**
   ```tsx
   <div className="bg-white dark:bg-[#1E293B] rounded-xl shadow-lg overflow-hidden">
     {/* Header with gradient */}
     {/* Content */}
   </div>
   ```

4. **Add gradient headers**
   - Choose appropriate color gradient
   - Add icon and title
   - Use white text

5. **Structure content with proper spacing**
   - Use p-6 for card content padding
   - Use space-y-* for vertical spacing
   - Use grid with gap-* for multi-column layouts

6. **Add proper typography**
   - Section headers: text-xl font-semibold
   - Labels: text-xs font-semibold uppercase
   - Body: text-gray-900 dark:text-white

7. **Ensure dark mode support**
   - Add dark: classes for all colors
   - Test in dark mode
   - Ensure proper contrast

---

## 📚 Icon Usage Reference

Common icons from Lucide React:
- `Building2` - Properties, buildings
- `FileText` - Documents, work orders
- `MapPin` - Location, addresses
- `User` - People, contacts
- `Calendar` - Dates, schedules
- `Phone` - Phone numbers
- `Mail` - Email addresses
- `Clipboard` - Lists, checklists
- `ClipboardCheck` - Completed items
- `Paintbrush2` - Paint-related
- `Image` - Images, photos
- `FolderOpen` - Files, folders
- `CheckCircle` - Success, approved
- `XCircle` - Error, declined
- `AlertTriangle` - Warnings
- `Clock` - Time, history
- `DollarSign` - Money, billing
- `Trash2` - Delete
- `Edit` - Edit
- `Plus` - Add new
- `ArrowLeft` - Back navigation
- `ArrowRight` - Forward navigation

---

## 🎯 Best Practices

1. **Always include dark mode classes**
2. **Use semantic color coding** (blue=info, green=success, red=error, etc.)
3. **Maintain consistent spacing** (p-6, gap-6, space-y-8)
4. **Include icons** for better visual communication
5. **Ensure responsive design** (use xl:grid-cols-2 for breakpoints)
6. **Add proper null checks** for conditional rendering
7. **Use proper TypeScript types** (avoid `any` when possible)
8. **Keep accessibility in mind** (proper contrast, keyboard navigation)

---

## 📞 Need Help?

Refer to these files for examples:
- `/src/components/JobDetails.tsx` - Most complex example
- `/src/components/PropertyDetails.tsx` - Property-related patterns
- `/src/components/PropertyGroupDetails.tsx` - Simpler example

Check the comprehensive documentation:
- `DATA_VERIFICATION_CHECKLIST.md` - QA procedures
- `UI_MODERNIZATION_SUMMARY.md` - Project overview

---

**Quick Tip**: Copy an existing section and modify it for consistency!
