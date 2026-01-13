# Profile Availability Implementation Guide

## 🎯 **Overview**
This implementation adds comprehensive availability management and profile enhancement fields to the user profiles system. Users can now set their availability for days of the week, manage communication preferences, and store additional professional information.

## 🏗️ **Database Schema Changes**

### **New Columns Added to `profiles` Table:**

#### **1. Availability Management**
```sql
availability JSONB -- Days of the week availability
```

#### **2. Contact & Address Information**
```sql
preferred_contact_method text DEFAULT 'email'
emergency_contact_name text
emergency_contact_phone text
emergency_contact_relationship text
address_line_1 text
address_line_2 text
city text
state text
zip_code text
country text DEFAULT 'USA'
```

#### **3. Preferences & Settings**
```sql
timezone text DEFAULT 'America/New_York'
language_preference text DEFAULT 'en'
communication_preferences JSONB
professional_info JSONB
social_media JSONB
notes text
last_profile_update timestamptz DEFAULT now()
```

## 📊 **Data Structure**

### **Availability Format (JSONB)**
```json
{
  "monday": true,
  "tuesday": true,
  "wednesday": true,
  "thursday": true,
  "friday": true,
  "saturday": false,
  "sunday": false
}
```

### **Communication Preferences (JSONB)**
```json
{
  "email_notifications": true,
  "sms_notifications": false,
  "push_notifications": true
}
```

### **Professional Info (JSONB)**
```json
{
  "skills": ["Painting", "Drywall", "Caulking"],
  "certifications": ["OSHA Safety", "Lead Paint Certified"],
  "experience_years": 5,
  "specializations": ["Interior", "Exterior", "Commercial"]
}
```

### **Social Media (JSONB)**
```json
{
  "linkedin": "https://linkedin.com/in/username",
  "website": "https://mywebsite.com",
  "other": "https://portfolio.com"
}
```

## 🚀 **Implementation Files**

### **1. Database Migration**
- **File**: `supabase/migrations/20250103000002_add_profile_availability_fields.sql`
- **Purpose**: Adds all new columns and creates necessary indexes and policies

### **2. Utility Functions**
- **File**: `src/lib/profileAvailabilityUtils.ts`
- **Purpose**: Provides helper functions for managing availability and profile data

### **3. Type Definitions**
- **File**: `src/lib/profileAvailabilityUtils.ts` (interfaces)
- **Purpose**: TypeScript interfaces for type safety

## 🛠️ **Utility Functions**

### **Availability Management**
```typescript
// Check availability for specific day
isAvailableOnDay(availability, 'monday') // returns boolean

// Check if available today
isAvailableToday(availability) // returns boolean

// Get next available day
getNextAvailableDay(availability, startDate) // returns Date | null

// Get available days summary
getAvailabilitySummary(availability) // returns human-readable string
```

### **Data Validation & Formatting**
```typescript
// Validate availability data
validateAvailability(data) // returns boolean

// Format for display
formatAvailabilityForDisplay(availability) // returns { available: [], unavailable: [] }

// Merge with defaults
mergeAvailabilityWithDefaults(partialAvailability) // returns complete availability
```

## 🔐 **Security & Access Control**

### **Row Level Security (RLS) Policies**
- **Users can read their own availability**: `auth.uid() = id`
- **Users can update their own availability**: `auth.uid() = id`
- **Admins can read all availability**: Role-based access for scheduling
- **Admins can update availability**: For scheduling and management purposes

### **Data Privacy**
- Personal information is only accessible to the user and authorized admins
- Emergency contact information is protected by RLS
- Communication preferences are user-controlled

## 📱 **Frontend Integration**

### **UserProfile Component Updates**
The `UserProfile` component will need updates to include:

1. **Availability Section**
   - Day of week checkboxes
   - Visual calendar representation
   - Availability summary display

2. **Contact Information Section**
   - Address fields
   - Emergency contact information
   - Preferred contact method

3. **Professional Information Section**
   - Skills and certifications
   - Experience and specializations
   - Social media links

4. **Communication Preferences Section**
   - Notification settings
   - Contact method preferences
   - Language and timezone settings

### **Availability Display Components**
```typescript
// Example availability display component
<AvailabilityCalendar 
  availability={profile.availability}
  onChange={handleAvailabilityChange}
  readOnly={false}
/>

// Example availability summary
<AvailabilitySummary 
  availability={profile.availability}
  showDetails={true}
/>
```

## 🎨 **UI/UX Considerations**

### **Availability Selection**
- **Checkbox Grid**: 7 checkboxes for days of the week
- **Visual Calendar**: Week view with highlighted available days
- **Quick Presets**: "Weekdays Only", "Weekends Only", "Every Day"
- **Custom Selection**: Individual day selection

### **Data Entry Forms**
- **Progressive Disclosure**: Show basic fields first, expand for details
- **Validation**: Real-time validation with helpful error messages
- **Auto-save**: Save changes automatically to prevent data loss
- **Responsive Design**: Mobile-friendly form layouts

## 🔄 **Data Flow**

### **1. Profile Creation**
```typescript
// New user gets default availability
const newProfile = {
  ...basicProfile,
  availability: DEFAULT_AVAILABILITY,
  communication_preferences: DEFAULT_COMMUNICATION_PREFERENCES,
  professional_info: DEFAULT_PROFESSIONAL_INFO
};
```

### **2. Profile Updates**
```typescript
// Update availability
const updatedProfile = {
  ...existingProfile,
  availability: newAvailability,
  last_profile_update: new Date().toISOString()
};
```

### **3. Scheduling Integration**
```typescript
// Check availability for scheduling
const isAvailable = isAvailableOnDay(user.availability, dayOfWeek);
const availableUsers = users.filter(user => isAvailableToday(user.availability));
```

## 📈 **Performance Considerations**

### **Database Indexes**
- **GIN Index on `availability`**: For complex availability queries
- **GIN Index on `communication_preferences`**: For notification filtering
- **GIN Index on `professional_info`**: For skill-based searches
- **GIN Index on `social_media`**: For social media queries

### **Query Optimization**
```sql
-- Efficient availability queries
SELECT * FROM profiles 
WHERE availability->>'monday' = 'true'
AND role = 'subcontractor';

-- Count available users by day
SELECT 
  availability->>'monday' as monday,
  availability->>'tuesday' as tuesday,
  COUNT(*) as user_count
FROM profiles 
GROUP BY availability->>'monday', availability->>'tuesday';
```

## 🧪 **Testing & Validation**

### **Unit Tests**
- Availability validation functions
- Date calculation utilities
- Data formatting functions

### **Integration Tests**
- Profile creation with availability
- Availability updates and persistence
- RLS policy enforcement

### **User Acceptance Tests**
- Availability setting workflow
- Profile completion process
- Data validation and error handling

## 🚀 **Next Steps**

### **Phase 1: Database & Backend**
- ✅ Run the migration
- ✅ Test database functions
- ✅ Verify RLS policies

### **Phase 2: Frontend Components**
- 🔄 Update UserProfile component
- 🔄 Create availability selection UI
- 🔄 Add form validation

### **Phase 3: Integration**
- 🔄 Connect to scheduling system
- 🔄 Update user management
- 🔄 Add availability reporting

### **Phase 4: Advanced Features**
- 🔄 Recurring availability patterns
- 🔄 Holiday and exception handling
- 🔄 Availability analytics

## 📚 **Additional Resources**

### **Related Files**
- `src/components/UserProfile.tsx` - Main profile component
- `src/contexts/UserRoleContext.tsx` - User role management
- `src/lib/availabilityUtils.ts` - Subcontractor availability utilities

### **Database Tables**
- `profiles` - User profile information
- `auth.users` - Authentication data
- `storage.avatars` - Profile pictures

### **API Endpoints**
- Profile CRUD operations
- Availability updates
- File uploads for avatars

---

This implementation provides a solid foundation for comprehensive user profile management with availability tracking, making it easier to schedule work and manage user preferences throughout the system.
