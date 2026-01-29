# Data Verification Checklist - Modernized Pages

## Overview
This document provides a comprehensive checklist to verify that all data fields are correctly displayed in the modernized Job Details, Property Details, and Property Group pages after the UI refactoring.

## ✅ Job Details Page (`/src/components/JobDetails.tsx`)

### Header & Status Information
- [ ] Job Type badge displayed
- [ ] Current phase label and color
- [ ] Assignment status banners (declined/pending)
  - [ ] Decline reason and date
  - [ ] Pending acceptance status

### Job Information Section
- [ ] Property name (clickable link)
- [ ] Property address (street, city, state, zip)
- [ ] Unit number
- [ ] Unit size
- [ ] Scheduled date
- [ ] Purchase order number
- [ ] Assigned subcontractor name
- [ ] Job description
- [ ] Property map display

### Work Order Details (After Submission)
- [ ] Work order number
- [ ] Submission timestamp
- [ ] Subcontractor name
- [ ] Job category
- [ ] Unit occupancy status
- [ ] Paint requirement
- [ ] Additional comments

### Painted Areas
- [ ] Living/Dining room (sq ft, floors, walls, ceilings)
- [ ] Kitchen (sq ft, floors, walls, ceilings)
- [ ] Bedrooms 1-3 (sq ft, floors, walls, ceilings)
- [ ] Bathrooms 1-3 (sq ft, floors, walls, ceilings)
- [ ] Hallways/Stairs (sq ft, floors, walls, ceilings)
- [ ] Closets (count)
- [ ] Blinds (count)
- [ ] Other areas (description)

### Sprinklers & Accent Wall
- [ ] Sprinkler paint requirement (Yes/No)
- [ ] Sprinkler approval status
- [ ] Accent wall presence (Yes/No)
- [ ] Accent wall color

### Extra Charges
- [ ] Extra charges requirement (Yes/No)
- [ ] Extra charges description
- [ ] Extra hours logged
- [ ] Line item charges (description, amount)
- [ ] Approval status (Pending/Approved/Declined)
- [ ] Approver name and date
- [ ] Decline reason (if applicable)

### Images & Files
- [ ] Before images display
- [ ] Other files display
- [ ] File upload functionality
- [ ] Image lightbox/zoom

### Billing Breakdown
- [ ] Unit size
- [ ] Job category
- [ ] QuickBooks number
- [ ] Base charges (bill, sub pay, profit)
- [ ] Hourly rates (if applicable)
- [ ] Extra charges billing
- [ ] Additional services/supplemental items
- [ ] Total calculations
- [ ] Billing warnings (if any)

### Phase History
- [ ] Phase change timestamps
- [ ] Changed by (user name)
- [ ] Change reasons
- [ ] Chronological order

### Action Buttons
- [ ] Add/Edit Work Order
- [ ] Download Invoice PDF
- [ ] Send Notifications
- [ ] Advance to Next Phase
- [ ] Change Phase
- [ ] Delete Job (admin only)

---

## ✅ Property Details Page (`/src/components/PropertyDetails.tsx`)

### Header & Navigation
- [ ] Property name
- [ ] Edit Property button
- [ ] Billing Setup button
- [ ] Back navigation

### Property Location Section
- [ ] Full address (street, address_2, city, state, zip)
- [ ] Property map display

### Basic Information
- [ ] Property management group name (clickable link)
- [ ] Phone number
- [ ] Region
- [ ] Property grade

### Quick Stats
- [ ] Total jobs count
- [ ] Active jobs count
- [ ] Completed jobs count
- [ ] Callbacks count

### Contact Information
- [ ] Community Manager
  - [ ] Name
  - [ ] Email
  - [ ] Phone
  - [ ] Title
  - [ ] Email notifications checkbox
- [ ] Maintenance Supervisor
  - [ ] Name
  - [ ] Email
  - [ ] Phone
  - [ ] Title
  - [ ] Email notifications checkbox
- [ ] Primary Contact
  - [ ] Name
  - [ ] Phone
  - [ ] Role
  - [ ] Email
- [ ] Subcontractors (A & B)

### Property Unit Map
- [ ] Unit map image display
- [ ] Zoom functionality
- [ ] Upload new map option

### Compliance Status
- [ ] Compliance Required (checkbox + date)
- [ ] Compliance Approved (checkbox + date)
- [ ] Bid Approved (checkbox + date)
- [ ] PO Needed (checkbox + date)
- [ ] W9 Created (checkbox + date)
- [ ] COI Address (checkbox + date)
- [ ] Create Sub Prop Portal (checkbox + date)
- [ ] Notify Team (checkbox + date)
- [ ] Upload Documents (checkbox + date)
- [ ] Invoice Delivery (checkbox + date)

### Paint Colors
- [ ] Paint storage location
- [ ] Paint schemes list
  - [ ] Area names
  - [ ] Wall colors
  - [ ] Trim colors
  - [ ] Ceiling colors

### Billing Information
- [ ] AP Contact (name, email, phone)
- [ ] Email notifications checkbox
- [ ] QuickBooks number
- [ ] Billing notes
- [ ] Extra charges notes
- [ ] Occupied regular paint fees

### Billing Details by Category
- [ ] Standard categories (unit size, bill, sub pay, profit)
- [ ] Extra charge categories
- [ ] Hourly rate indicators

### Callbacks/Notes
- [ ] Callback list with dates
- [ ] Add new callback form
- [ ] Edit/delete callbacks
- [ ] Callback descriptions

### Property Files
- [ ] File list with types
- [ ] Upload new files
- [ ] Download files
- [ ] Delete files

### Job History
- [ ] Job list (all jobs for property)
- [ ] Job number (clickable link)
- [ ] Unit number
- [ ] Job type
- [ ] Current phase
- [ ] Scheduled date
- [ ] Assigned subcontractor

---

## ✅ Property Group Details Page (`/src/components/PropertyGroupDetails.tsx`)

### Header & Navigation
- [ ] Group company name
- [ ] Edit Group button
- [ ] Back to List button

### Group Information
- [ ] Full address (street, address_2, city, state, zip)

### Group Location
- [ ] Property map display

### Contact Information
- [ ] All contact fields from property management group

### Properties List
- [ ] Property names (clickable links)
- [ ] Property addresses
- [ ] City and state

---

## Testing Procedures

### Visual Inspection
1. **Navigate to each page type** and verify all sections are visible
2. **Check responsive behavior** at different screen widths
3. **Verify gradient headers** are displaying correctly
4. **Confirm card layouts** have proper spacing and shadows
5. **Test dark mode** to ensure all elements are readable

### Data Integrity
1. **Compare with database** to ensure all fields match
2. **Check for empty states** (null/undefined values)
3. **Verify conditional rendering** (fields only show when data exists)
4. **Test with various data sets** (jobs with/without work orders, properties with/without contacts, etc.)

### Functional Testing
1. **Click all links** (property links, job links, group links)
2. **Test all buttons** (edit, upload, download, delete)
3. **Submit forms** (callbacks, files, phase changes)
4. **Verify modals** (notifications, approvals, confirmations)
5. **Test image galleries** (lightbox, zoom, upload)

### Cross-Browser Testing
1. Chrome/Edge (Chromium)
2. Firefox
3. Safari (macOS)
4. Mobile browsers (iOS Safari, Chrome Mobile)

---

## Known Changes & Improvements

### Layout Changes
- ✅ Removed max-width constraints for full-width layouts
- ✅ Applied gradient headers to all major sections
- ✅ Standardized card layouts with consistent spacing
- ✅ Improved section hierarchy and visual grouping
- ✅ Added gradient backgrounds to section headers
- ✅ Moved status banners below section headers

### Bug Fixes
- ✅ Fixed TypeScript compilation errors
- ✅ Resolved JSX structure issues (missing closing divs)
- ✅ Fixed CSS class conflicts (`hidden` + `flex`)
- ✅ Corrected property type mismatches

### Data Preservation
- ✅ All database fields remain mapped to UI elements
- ✅ No data fields removed during refactoring
- ✅ Conditional rendering preserved for optional fields
- ✅ All calculations and derived values intact

---

## Sign-Off Checklist

- [ ] All data fields verified present in code
- [ ] Visual inspection completed in browser
- [ ] No compilation errors
- [ ] No runtime errors in console
- [ ] Responsive design tested
- [ ] Dark mode tested
- [ ] All links functional
- [ ] All buttons functional
- [ ] Forms submit correctly
- [ ] Images display properly
- [ ] Maps render correctly
- [ ] Calculations accurate
- [ ] Cross-browser tested

---

## Notes

### Files Modified
- `/src/components/JobDetails.tsx` - Modernized with gradient headers, card layouts
- `/src/components/NewWorkOrder.tsx` - Modernized work order form
- `/src/components/PropertyDetails.tsx` - Modernized with gradient headers, card layouts
- `/src/components/PropertyGroupDetails.tsx` - Modernized with gradient headers, card layouts
- `/src/utils/normalizeJobDetails.ts` - Updated schema normalization

### Files Not Modified (Upstream Dependencies)
- Database schema and migrations
- Supabase functions
- Type definitions (may need updates for full type safety)

### Recommendations
1. Consider updating TypeScript interfaces to better match actual data shapes
2. Add unit tests for data mapping functions
3. Consider adding PropTypes or Zod validation for runtime type checking
4. Document any data transformations in separate files

---

## Contact
For questions or issues with this checklist, please refer to the conversation summary or contact the development team.

**Last Updated:** January 2025
**Status:** Ready for QA Review
