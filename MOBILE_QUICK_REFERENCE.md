# Mobile Responsiveness Quick Reference

## 🚀 Quick Start Guide for Developers

### Common Mobile Patterns

#### 1. Responsive Padding
```tsx
// Mobile-first spacing
className="px-3 sm:px-4 lg:px-6"  // Horizontal padding scales
className="py-2 sm:py-3 lg:py-4"  // Vertical padding scales
className="p-3 sm:p-4 lg:p-6"     // All-around padding scales
```

#### 2. Responsive Grid Layouts
```tsx
// Stack on mobile, grid on larger screens
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"

// Dashboard metrics example
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
```

#### 3. Hide/Show by Breakpoint
```tsx
// Hide on mobile, show on desktop
className="hidden lg:block"
className="hidden lg:flex"

// Show on mobile, hide on desktop  
className="block lg:hidden"
className="flex lg:hidden"
```

#### 4. Touch-Friendly Buttons
```tsx
// Minimum 44x44px touch target
className="min-h-[44px] min-w-[44px] flex items-center justify-center"

// Touch manipulation for better performance
className="touch-manipulation"

// Full button example
<button className="px-4 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg touch-manipulation">
  Click Me
</button>
```

#### 5. Responsive Text Sizing
```tsx
className="text-sm sm:text-base"        // Small mobile, base larger
className="text-base sm:text-lg"        // Base mobile, large larger
className="text-lg sm:text-xl lg:text-2xl"  // Progressive scaling
```

#### 6. Responsive Flex Layouts
```tsx
// Stack on mobile, row on desktop
className="flex flex-col lg:flex-row"

// Stack with responsive gaps
className="flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6"
```

#### 7. Mobile-Friendly Dropdowns
```tsx
// Full width on mobile, auto on desktop
<div className="absolute right-0 mt-2 w-full sm:w-auto sm:min-w-[280px]">
  {/* Dropdown content */}
</div>
```

#### 8. Responsive Containers
```tsx
// Full width with max constraints
className="w-full max-w-md sm:max-w-lg lg:max-w-4xl mx-auto"
```

---

## 📱 Component Checklist

When creating or updating components, ensure:

### Layout
- [ ] Use mobile-first approach (base styles = mobile)
- [ ] Stack elements vertically on mobile
- [ ] Adequate padding/spacing on all breakpoints
- [ ] No horizontal scrolling required
- [ ] Max-width containers for readability

### Interactive Elements
- [ ] All buttons minimum 44x44px
- [ ] Touch-friendly spacing between clickable items
- [ ] Active states for touch feedback
- [ ] No hover-only interactions
- [ ] Add `touch-manipulation` class for performance

### Typography
- [ ] Minimum 16px font size (prevent iOS zoom)
- [ ] Responsive heading sizes
- [ ] Proper text truncation for long content
- [ ] Adequate line height for readability

### Navigation
- [ ] Mobile menu accessible
- [ ] Clear close/back buttons
- [ ] Scrollable if content overflows
- [ ] Backdrop overlay for drawers

### Forms
- [ ] Full-width inputs on mobile
- [ ] Large enough tap targets for checkboxes/radios
- [ ] Appropriate `inputmode` attributes
- [ ] Clear labels and validation messages
- [ ] Submit buttons at bottom

### Images
- [ ] Responsive sizing
- [ ] Proper aspect ratios maintained
- [ ] Alt text for accessibility
- [ ] Loading states

### Tables
- [ ] Convert to cards on mobile OR
- [ ] Enable horizontal scroll with visual indicators OR
- [ ] Show only essential columns

---

## 🎨 Common UI Patterns

### Mobile Navigation Menu
```tsx
import { MobileNav } from '../mobile/MobileNav';

// In your component
<div className="lg:hidden">
  <MobileNav onClose={() => setMenuOpen(false)} />
</div>
```

### Responsive Card Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => (
    <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg">
      {/* Card content */}
    </div>
  ))}
</div>
```

### Mobile-Optimized Stats
```tsx
<div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
  <div className="flex-1 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
    <div className="text-2xl font-bold text-blue-600">{count}</div>
    <div className="text-sm text-gray-600 dark:text-gray-400">Label</div>
  </div>
  {/* More stats */}
</div>
```

### Responsive Action Bar
```tsx
<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
  <h2 className="text-xl font-semibold">Page Title</h2>
  <div className="flex gap-2">
    <button className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg">
      Action
    </button>
  </div>
</div>
```

### Mobile-Friendly Modal
```tsx
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
  {/* Backdrop */}
  <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
  
  {/* Modal */}
  <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
    {/* Content */}
  </div>
</div>
```

---

## 🔍 Testing Tips

### Browser DevTools
```
1. Open Chrome DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select device or enter custom dimensions
4. Test both portrait and landscape
5. Check touch target sizes (Rendering > Paint flashing)
```

### Quick Test Dimensions
- **Mobile**: 375x667 (iPhone SE)
- **Mobile Large**: 414x896 (iPhone 11 Pro Max)
- **Tablet**: 768x1024 (iPad)
- **Desktop**: 1920x1080

### Common Issues to Check
- Text overflow/truncation
- Horizontal scrolling
- Button sizes too small
- Overlapping elements
- Broken layouts on orientation change
- Forms requiring zoom to type
- Dropdowns extending off-screen

---

## 🐛 Common Mistakes to Avoid

### ❌ Don't Do
```tsx
// Fixed widths on mobile
className="w-[500px]"  // Will cause horizontal scroll

// Small touch targets
<button className="p-1">  // Too small (8px)

// Desktop-first hiding
className="block lg:hidden"  // Wrong order

// Hover-only interactions
className="hover:bg-blue-500"  // Without active state
```

### ✅ Do Instead
```tsx
// Responsive widths
className="w-full sm:w-auto sm:max-w-md"

// Touch-friendly sizes
<button className="px-4 py-3 min-h-[44px]">

// Mobile-first hiding
className="hidden lg:block"  // Correct order

// Touch-friendly interactions
className="hover:bg-blue-500 active:bg-blue-600"  // With active state
```

---

## 📦 Useful Tailwind Classes

### Spacing
```
p-3 sm:p-4 lg:p-6       // Responsive padding
space-y-3 sm:space-y-4   // Responsive vertical spacing
gap-3 sm:gap-4 lg:gap-6  // Responsive grid/flex gap
```

### Layout
```
flex flex-col lg:flex-row              // Stack mobile, row desktop
grid grid-cols-1 sm:grid-cols-2        // 1 col mobile, 2 desktop
hidden lg:block                        // Hide mobile, show desktop
block lg:hidden                        // Show mobile, hide desktop
```

### Sizing
```
w-full sm:w-auto                       // Full width mobile, auto desktop
max-w-full sm:max-w-md                 // Constrain width responsively
h-auto sm:h-64                         // Auto height mobile, fixed desktop
min-h-[44px]                          // Minimum touch target size
```

### Text
```
text-sm sm:text-base                   // Responsive font size
truncate                               // Single line with ellipsis
line-clamp-2                           // Multi-line truncate
break-words                            // Prevent overflow
```

### Interactive
```
touch-manipulation                     // Better touch performance
active:scale-95                        // Touch feedback
hover:bg-gray-100 active:bg-gray-200   // Both hover and touch states
```

---

## 🎯 Performance Tips

### 1. Use CSS Classes Over Inline Styles
```tsx
// ✅ Good - Tailwind classes (compiled)
<div className="p-4 bg-blue-500" />

// ❌ Avoid - Inline styles (slower)
<div style={{ padding: '16px', background: '#3B82F6' }} />
```

### 2. Lazy Load Components
```tsx
const MobileMenu = lazy(() => import('./MobileMenu'));

// Use with Suspense
<Suspense fallback={<LoadingSpinner />}>
  {isOpen && <MobileMenu />}
</Suspense>
```

### 3. Debounce Resize Handlers
```tsx
useEffect(() => {
  const handleResize = debounce(() => {
    // Handle resize
  }, 200);
  
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### 4. Use CSS Transitions, Not JS Animations
```tsx
// ✅ Good - CSS transitions
className="transition-all duration-200 ease-in-out"

// ❌ Avoid - JavaScript animations (unless necessary)
```

---

## 📱 Device-Specific Notes

### iOS
- Requires 16px minimum font size to prevent zoom
- Safe area insets for notch/island
- Momentum scrolling: `-webkit-overflow-scrolling: touch`
- Tap highlight color customization needed

### Android
- Different back button behavior
- Various screen densities
- Samsung Internet quirks
- Chrome mobile specifics

### Tablets
- Consider landscape orientation
- Larger tap targets still beneficial
- May use desktop or mobile layout
- Watch for 768px breakpoint

---

## ✅ Pre-Deployment Checklist

- [ ] Test on real devices (iOS & Android)
- [ ] Test in portrait and landscape
- [ ] Verify all touch targets ≥ 44px
- [ ] Check text readability (≥ 16px)
- [ ] Ensure no horizontal scrolling
- [ ] Test forms with mobile keyboards
- [ ] Verify navigation works on all screens
- [ ] Check Spanish language layouts
- [ ] Test with slow 3G network
- [ ] Validate PWA functionality (if applicable)
- [ ] Check performance with Lighthouse
- [ ] Test with VoiceOver/TalkBack (accessibility)

---

## 🆘 Need Help?

### Resources
1. **Tailwind Docs**: https://tailwindcss.com/docs/responsive-design
2. **Mobile Web Best Practices**: https://web.dev/mobile/
3. **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/

### Common Commands
```bash
# Test mobile in dev
npm run dev
# Open in mobile browser: http://[your-ip]:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📝 Quick Reference Card

| Need | Tailwind Class | Example |
|------|---------------|---------|
| Hide on mobile | `hidden lg:block` | Desktop-only sidebar |
| Show on mobile | `block lg:hidden` | Mobile-only menu |
| Stack mobile | `flex flex-col lg:flex-row` | Form layout |
| Responsive padding | `p-3 sm:p-4 lg:p-6` | Container padding |
| Touch target | `min-h-[44px] min-w-[44px]` | Button size |
| Responsive text | `text-sm sm:text-base` | Body text |
| Full width mobile | `w-full sm:w-auto` | Input fields |
| Mobile grid | `grid-cols-1 sm:grid-cols-2` | Card layouts |

---

**Last Updated**: January 27, 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
