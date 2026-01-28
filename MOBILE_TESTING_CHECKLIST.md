# Mobile Testing Checklist

## 📱 Visual Testing Guide

Use this checklist when testing the mobile responsiveness implementation.

---

## Device Testing Matrix

### iPhone
- [ ] iPhone SE (375x667) - Portrait
- [ ] iPhone SE (667x375) - Landscape
- [ ] iPhone 12/13/14 (390x844) - Portrait
- [ ] iPhone 12/13/14 (844x390) - Landscape
- [ ] iPhone 14 Pro Max (428x926) - Portrait
- [ ] iPhone 14 Pro Max (926x428) - Landscape

### Android
- [ ] Samsung Galaxy S21 (360x800) - Portrait
- [ ] Samsung Galaxy S21 (800x360) - Landscape
- [ ] Google Pixel 5 (393x851) - Portrait
- [ ] Google Pixel 5 (851x393) - Landscape
- [ ] OnePlus 9 (412x915) - Portrait

### Tablet
- [ ] iPad Mini (768x1024) - Portrait
- [ ] iPad Mini (1024x768) - Landscape
- [ ] iPad Pro 11" (834x1194) - Portrait
- [ ] iPad Pro 11" (1194x834) - Landscape

### Browsers
- [ ] Safari (iOS)
- [ ] Chrome (iOS)
- [ ] Chrome (Android)
- [ ] Firefox (Android)
- [ ] Samsung Internet (Android)

---

## Feature Testing

### Navigation
- [ ] Hamburger menu button visible on mobile
- [ ] Hamburger menu button hidden on desktop (lg+)
- [ ] Menu opens when hamburger clicked
- [ ] Menu closes when X button clicked
- [ ] Menu closes when backdrop clicked
- [ ] Menu closes when navigation link clicked
- [ ] All menu items visible and reachable
- [ ] Menu scrolls if content overflows
- [ ] Icons display correctly with proper colors
- [ ] Unread message badges show correct count
- [ ] Quick actions section displays and works
- [ ] Section headers are readable
- [ ] No overlapping text or icons

### Header / Topbar
- [ ] Logo visible on mobile
- [ ] Logo proper size and positioning
- [ ] Theme toggle button accessible (44x44px)
- [ ] Theme toggle works (dark/light mode)
- [ ] Chat menu button accessible
- [ ] Chat menu opens correctly
- [ ] Notification bell visible (non-subcontractors)
- [ ] Notification count badge visible
- [ ] Notification dropdown opens correctly
- [ ] Notification dropdown full-width on mobile
- [ ] User avatar displays correctly
- [ ] User dropdown opens correctly
- [ ] User dropdown menu items accessible
- [ ] All buttons minimum 44x44px
- [ ] No elements overlap or get cut off
- [ ] Adequate spacing between elements

### Dashboard (Admin/Management)
- [ ] Metrics hidden on mobile (hidden lg:grid)
- [ ] Today's Agenda displays first on mobile
- [ ] Job cards stack vertically
- [ ] Action buttons are touch-friendly
- [ ] Card layouts responsive
- [ ] "View All" links work correctly
- [ ] Quick create buttons accessible
- [ ] Charts/graphs display properly (if any)
- [ ] No horizontal scrolling required
- [ ] Text readable at all sizes

### Subcontractor Dashboard
- [ ] Language toggle accessible
- [ ] Language toggle switches correctly (EN/ES)
- [ ] Date selector buttons touch-friendly
- [ ] Today/Tomorrow buttons work correctly
- [ ] Job cards display properly
- [ ] Accept/Decline buttons accessible
- [ ] More Info button expands correctly
- [ ] Property details readable
- [ ] Unit map button works
- [ ] Contact information displays properly
- [ ] Billing details readable
- [ ] Paint colors section formatted correctly
- [ ] No text overflow or truncation issues

### Work Order Form
- [ ] Form fields full-width on mobile
- [ ] Labels clearly visible
- [ ] Input fields easy to tap
- [ ] Checkboxes/radio buttons large enough (44x44px)
- [ ] Dropdowns work correctly
- [ ] Number inputs have proper mobile keyboard
- [ ] Text areas resize appropriately
- [ ] File upload button accessible
- [ ] Image previews display correctly
- [ ] Submit button always visible
- [ ] Cancel button accessible
- [ ] Validation messages readable
- [ ] Error messages don't overlap
- [ ] Form scrolls smoothly

### Tables & Lists
- [ ] Job lists display as cards on mobile
- [ ] Work order lists formatted correctly
- [ ] Property lists readable
- [ ] User lists accessible
- [ ] Action buttons in lists touch-friendly
- [ ] Sorting/filtering works on mobile
- [ ] Search functionality accessible
- [ ] Pagination controls visible
- [ ] Status badges readable
- [ ] Date/time formatting appropriate

### Modals & Overlays
- [ ] Modals display correctly
- [ ] Modal close buttons accessible (44x44px)
- [ ] Modal content scrollable
- [ ] Backdrop prevents interaction with page
- [ ] Confirmation dialogs readable
- [ ] Alert messages display correctly
- [ ] Toast notifications visible
- [ ] Loading spinners centered
- [ ] Progress indicators visible

### Forms & Inputs
- [ ] All input fields have proper spacing
- [ ] Labels positioned correctly
- [ ] Required field indicators visible
- [ ] Validation messages clear
- [ ] Submit buttons always accessible
- [ ] Cancel buttons easy to find
- [ ] Multi-step forms show progress
- [ ] File uploads work correctly
- [ ] Date pickers mobile-friendly
- [ ] Autocomplete fields work
- [ ] Keyboard shows correct type (numeric, email, etc.)

---

## Interaction Testing

### Touch Gestures
- [ ] Tap opens menus/dropdowns
- [ ] Tap closes overlays
- [ ] Scroll works smoothly
- [ ] Pinch zoom disabled (where appropriate)
- [ ] Long press doesn't cause issues
- [ ] Double tap doesn't cause zoom
- [ ] Swipe doesn't navigate accidentally

### Active States
- [ ] Buttons show press state
- [ ] Links show press state
- [ ] Cards show press state (if clickable)
- [ ] Menu items highlight on press
- [ ] Toggle buttons show state change
- [ ] Radio buttons/checkboxes show selection
- [ ] Active states visible in dark mode

### Keyboard Interactions
- [ ] Forms show correct mobile keyboard
- [ ] Email fields show @ key
- [ ] Number fields show numeric keyboard
- [ ] Tel fields show phone keyboard
- [ ] Search fields show search button
- [ ] Keyboard doesn't cover inputs
- [ ] Done button dismisses keyboard
- [ ] Next/Previous buttons work between fields

---

## Layout Testing

### Spacing & Padding
- [ ] Adequate margins around content
- [ ] Consistent spacing between sections
- [ ] No cramped layouts
- [ ] White space used effectively
- [ ] Content doesn't touch screen edges
- [ ] Buttons have adequate padding
- [ ] Cards have proper internal spacing

### Typography
- [ ] All text minimum 16px
- [ ] Headings properly sized
- [ ] Line height adequate for readability
- [ ] No text truncation where full text needed
- [ ] Proper truncation where appropriate
- [ ] Font weight variations work
- [ ] Text contrast sufficient (WCAG AA)
- [ ] Text readable in dark mode

### Images & Media
- [ ] Images scale correctly
- [ ] Aspect ratios maintained
- [ ] No distorted images
- [ ] Alt text present for accessibility
- [ ] Loading states shown
- [ ] Lazy loading works
- [ ] Image galleries work on mobile
- [ ] Video players work (if any)

### Colors & Contrast
- [ ] All text readable (contrast ratio ≥ 4.5:1)
- [ ] Interactive elements distinguishable
- [ ] Focus indicators visible
- [ ] Selection states clear
- [ ] Error states obvious
- [ ] Success states clear
- [ ] Dark mode works correctly
- [ ] Theme toggle preserves preference

---

## Performance Testing

### Load Time
- [ ] Initial page load < 3 seconds
- [ ] Navigation transitions smooth
- [ ] No janky animations
- [ ] Images load progressively
- [ ] Lazy loading works
- [ ] No layout shifts during load

### Scrolling
- [ ] Smooth 60fps scrolling
- [ ] No scroll jank
- [ ] Momentum scrolling works (iOS)
- [ ] Scroll position preserved on navigation
- [ ] Pull-to-refresh doesn't interfere (if implemented)

### Responsiveness
- [ ] Buttons respond immediately
- [ ] Inputs focus without delay
- [ ] Menus open quickly
- [ ] Transitions are smooth
- [ ] No lag when typing
- [ ] Touch events register accurately

---

## Accessibility Testing

### Screen Reader (VoiceOver/TalkBack)
- [ ] Navigation announced correctly
- [ ] Buttons have proper labels
- [ ] Images have alt text
- [ ] Form labels associated correctly
- [ ] Error messages announced
- [ ] Status changes announced
- [ ] Headings structured properly

### Keyboard Navigation
- [ ] Tab order logical
- [ ] All interactive elements reachable
- [ ] Focus indicators visible
- [ ] Skip links work (if present)
- [ ] Modal traps focus correctly
- [ ] Escape closes dialogs
- [ ] Enter activates buttons

### Visual Accessibility
- [ ] Sufficient color contrast
- [ ] No color-only indicators
- [ ] Text resizable to 200%
- [ ] Focus indicators visible
- [ ] Error states not color-only
- [ ] Icons have text labels

---

## Spanish Language Testing

### Text Display
- [ ] All Spanish text displays correctly
- [ ] No truncated Spanish words
- [ ] Accented characters render properly (á, é, í, ó, ú, ñ)
- [ ] Spanish text doesn't overflow containers
- [ ] Button text fits (Spanish typically 20-30% longer)
- [ ] Navigation items readable
- [ ] Form labels complete
- [ ] Error messages display fully
- [ ] Success messages readable
- [ ] Help text visible

### Layout with Spanish
- [ ] No broken layouts with Spanish text
- [ ] Buttons accommodate longer text
- [ ] Cards resize appropriately
- [ ] Tables/lists format correctly
- [ ] Modals size correctly
- [ ] Navigation menu items don't wrap awkwardly
- [ ] Tooltips display completely

---

## Edge Cases

### Extreme Content
- [ ] Very long property names
- [ ] Many job listings (100+)
- [ ] Long user names
- [ ] Long addresses
- [ ] Many notification items
- [ ] Long comments/descriptions

### Network Conditions
- [ ] Works on slow 3G
- [ ] Shows loading states
- [ ] Handles failed requests gracefully
- [ ] Retry mechanisms work
- [ ] Offline detection (if implemented)
- [ ] Cache works correctly

### User States
- [ ] Empty states display correctly
- [ ] Loading states shown
- [ ] Error states clear
- [ ] Success confirmations visible
- [ ] No-data states helpful
- [ ] Permission denied states clear

---

## Browser-Specific Issues

### iOS Safari
- [ ] Input zoom disabled (16px font)
- [ ] Safe area respected (notch/island)
- [ ] Momentum scrolling works
- [ ] Fixed positioning works
- [ ] Input focus doesn't cause zoom
- [ ] Date pickers work
- [ ] File uploads work

### Chrome Mobile
- [ ] Inputs work correctly
- [ ] Autofill works
- [ ] Back button works
- [ ] Address bar hiding doesn't break layout
- [ ] DevTools mobile view accurate

### Samsung Internet
- [ ] All features work
- [ ] No layout issues
- [ ] Styles render correctly
- [ ] JavaScript works

---

## Final Checks

### Before Deployment
- [ ] All features tested on at least 2 devices
- [ ] Tested in portrait and landscape
- [ ] Tested with Spanish language
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] All critical paths work
- [ ] Performance acceptable
- [ ] Accessibility verified
- [ ] Documentation updated

### Post-Deployment
- [ ] Monitor analytics for mobile usage
- [ ] Track error reports
- [ ] Monitor performance metrics
- [ ] Collect user feedback
- [ ] Address issues promptly

---

## Issue Tracking Template

When you find an issue, document it like this:

```
**Issue**: [Brief description]
**Device**: [iPhone 12, Samsung Galaxy S21, etc.]
**Browser**: [Safari, Chrome, etc.]
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected**: [What should happen]
**Actual**: [What actually happens]
**Screenshot**: [If applicable]
**Severity**: [Low/Medium/High/Critical]
**Priority**: [P1/P2/P3/P4]
```

---

## Testing Tools

### Browser DevTools
- Chrome DevTools (Device Mode)
- Firefox Responsive Design Mode
- Safari Web Inspector

### Online Tools
- [BrowserStack](https://www.browserstack.com/) - Real device testing
- [LambdaTest](https://www.lambdatest.com/) - Cross-browser testing
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

### Performance
- Lighthouse (Chrome DevTools)
- WebPageTest
- PageSpeed Insights

### Accessibility
- WAVE (Web Accessibility Evaluation Tool)
- axe DevTools
- Lighthouse Accessibility Audit

---

## Sign-Off

**Tester Name**: ___________________________  
**Date**: ___________________________  
**Devices Tested**: ___________________________  
**Issues Found**: _____ (Critical: ___, High: ___, Medium: ___, Low: ___)  
**Status**: ☐ Pass ☐ Pass with Minor Issues ☐ Fail  
**Notes**: 

___________________________
___________________________
___________________________

---

**Version**: 1.0.0  
**Last Updated**: January 27, 2026  
**Status**: Ready for Testing
