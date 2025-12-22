# Subcontractor Availability Implementation Plan

## Overview
This document outlines the implementation plan for adding availability management to subcontractor profiles, allowing admins to set working days and dynamically filter subcontractors in the Sub Scheduler based on their availability.

## What Has Been Implemented

### ✅ **1. SubcontractorEditPage Updates**
- **Working Days Section**: Added to the edit form with checkboxes for each day
- **Availability Interface**: Clean, intuitive checkbox interface for Mon-Sun
- **Form Integration**: Working days are saved with the profile update
- **User Feedback**: Clear explanation of how availability affects scheduling

### ✅ **2. Database Migration**
- **New Column**: `working_days` JSONB column added to profiles table
- **Default Values**: Mon-Fri working days for existing subcontractors
- **Performance**: GIN index for efficient JSON queries
- **RLS Policies**: Proper access control for reading/updating working days

### ✅ **3. Utility Functions**
- **Availability Utils**: Comprehensive functions for checking availability
- **Date Functions**: Check availability on specific dates
- **Working Day Calculations**: Count working days, check weekends, etc.
- **Type Safety**: Full TypeScript interfaces and type checking

## What Still Needs to be Implemented

### 🔄 **4. Users Component Updates**
- **Working Days Display**: Show availability info in user lists
- **Role Column Enhancement**: Display working days count and schedule
- **Visual Indicators**: Clear availability status for subcontractors

### 🔄 **5. Sub Scheduler Integration**
- **Availability Filtering**: Hide/show subcontractors based on selected date
- **Dynamic Scheduling**: Only show available subcontractors for specific days
- **Calendar Integration**: Visual indicators for working days

### 🔄 **6. Testing and Verification**
- **Database Migration**: Run the migration on development database
- **Form Testing**: Verify working days are saved correctly
- **Integration Testing**: Test availability filtering in Sub Scheduler

## Technical Implementation Details

### **Database Schema**
```sql
-- working_days column structure
working_days JSONB DEFAULT '{
  "monday": true,
  "tuesday": true,
  "wednesday": true,
  "thursday": true,
  "friday": true,
  "saturday": false,
  "sunday": false
}'::jsonb
```

### **TypeScript Interfaces**
```typescript
interface WorkingDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

interface SubcontractorData {
  // ... existing fields
  working_days: WorkingDays | null;
}
```

### **Utility Functions**
```typescript
// Check availability on specific date
isAvailableOnDate(workingDays: WorkingDays | null, date: Date): boolean

// Get available working days
getAvailableWorkingDays(workingDays: WorkingDays | null): string[]

// Count working days per week
getWorkingDaysCount(workingDays: WorkingDays | null): number
```

## User Experience Features

### **Edit Page**
- **Visual Checkboxes**: Clear Mon-Sun selection interface
- **Default Values**: Mon-Fri selected by default
- **Real-time Updates**: Immediate visual feedback
- **Help Text**: Clear explanation of functionality

### **Users List**
- **Availability Summary**: Show working days count and schedule
- **Quick Overview**: At-a-glance availability information
- **Consistent Display**: Same format for online/offline users

### **Sub Scheduler**
- **Dynamic Filtering**: Only show available subcontractors
- **Date-based Display**: Filter based on selected calendar date
- **Visual Indicators**: Clear availability status

## Implementation Steps

### **Step 1: Database Migration** ✅
- [x] Create migration file
- [x] Add working_days column
- [x] Set default values
- [x] Add indexes and policies

### **Step 2: Edit Page Updates** ✅
- [x] Add working days interface
- [x] Update form handling
- [x] Add validation and saving

### **Step 3: Utility Functions** ✅
- [x] Create availability utilities
- [x] Add TypeScript interfaces
- [x] Implement core functions

### **Step 4: Users Component Updates** 🔄
- [ ] Update User interface
- [ ] Add working days display
- [ ] Enhance role column

### **Step 5: Sub Scheduler Integration** 🔄
- [ ] Filter subcontractors by availability
- [ ] Add date-based filtering
- [ ] Update UI components

### **Step 6: Testing and Verification** 🔄
- [ ] Test database migration
- [ ] Verify form functionality
- [ ] Test integration points

## Benefits of Implementation

### **For Admins**
- **Better Resource Management**: Know when subcontractors are available
- **Improved Scheduling**: Only assign work on available days
- **Efficient Planning**: Plan projects around availability

### **For Sub Scheduler**
- **Accurate Scheduling**: Only show available subcontractors
- **Reduced Errors**: Prevent scheduling conflicts
- **Better UX**: Clear availability information

### **For System**
- **Data Integrity**: Consistent availability tracking
- **Performance**: Efficient filtering and queries
- **Scalability**: Easy to extend with more availability features

## Future Enhancements

### **Advanced Availability**
1. **Time Slots**: Specific hours within days
2. **Holiday Management**: Mark unavailable dates
3. **Recurring Patterns**: Set availability patterns
4. **Capacity Limits**: Maximum work hours per day

### **Integration Features**
1. **Calendar Sync**: Export availability to external calendars
2. **Notification System**: Alert when availability changes
3. **Reporting**: Availability analytics and reports
4. **Mobile App**: Update availability on mobile devices

## Conclusion

The subcontractor availability system provides:

- ✅ **Comprehensive Management**: Full control over working days
- ✅ **Dynamic Filtering**: Real-time availability-based scheduling
- ✅ **User-Friendly Interface**: Intuitive checkbox selection
- ✅ **Performance Optimized**: Efficient database queries
- ✅ **Type Safe**: Full TypeScript support
- ✅ **Extensible**: Easy to add more availability features

This implementation will significantly improve subcontractor management and scheduling efficiency throughout the system.
