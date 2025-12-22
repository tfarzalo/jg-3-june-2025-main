// Profile Availability and Management Utilities
// This file provides functions for managing user profile availability and related data

export interface ProfileAvailability {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface CommunicationPreferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
}

export interface ProfessionalInfo {
  skills: string[];
  certifications: string[];
  experience_years: number;
  specializations: string[];
}

export interface SocialMedia {
  linkedin?: string | null;
  website?: string | null;
  other?: string | null;
}

export interface EnhancedProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  nickname: string | null;
  mobile_phone: string | null;
  sms_phone: string | null;
  bio: string | null;
  username: string | null;
  theme_preference: string | null;
  work_schedule: string[] | null;
  notification_settings: string | null;
  // New fields
  availability: ProfileAvailability | null;
  preferred_contact_method: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  timezone: string | null;
  language_preference: string | null;
  communication_preferences: CommunicationPreferences | null;
  professional_info: ProfessionalInfo | null;
  social_media: SocialMedia | null;
  notes: string | null;
  last_profile_update: string | null;
}

// Default availability (Mon-Fri)
export const DEFAULT_AVAILABILITY: ProfileAvailability = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false
};

// Default communication preferences
export const DEFAULT_COMMUNICATION_PREFERENCES: CommunicationPreferences = {
  email_notifications: true,
  sms_notifications: false,
  push_notifications: true
};

// Default professional info
export const DEFAULT_PROFESSIONAL_INFO: ProfessionalInfo = {
  skills: [],
  certifications: [],
  experience_years: 0,
  specializations: []
};

// Default social media
export const DEFAULT_SOCIAL_MEDIA: SocialMedia = {
  linkedin: null,
  website: null,
  other: null
};

/**
 * Check if a user is available on a specific day of the week
 */
export function isAvailableOnDay(availability: ProfileAvailability | null, day: keyof ProfileAvailability): boolean {
  if (!availability) return false;
  return availability[day] || false;
}

/**
 * Check if a user is available today
 */
export function isAvailableToday(availability: ProfileAvailability | null): boolean {
  if (!availability) return false;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' }) as keyof ProfileAvailability;
  return availability[today] || false;
}

/**
 * Get the next available day starting from a given date
 */
export function getNextAvailableDay(availability: ProfileAvailability | null, startDate: Date = new Date()): Date | null {
  if (!availability) return null;
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let currentDate = new Date(startDate);
  
  // Check next 7 days
  for (let i = 0; i < 7; i++) {
    const dayName = days[currentDate.getDay()] as keyof ProfileAvailability;
    if (availability[dayName]) {
      return currentDate;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return null;
}

/**
 * Get all available days as an array of day names
 */
export function getAvailableDays(availability: ProfileAvailability | null): string[] {
  if (!availability) return [];
  
  return Object.entries(availability)
    .filter(([_, isAvailable]) => isAvailable)
    .map(([day, _]) => day.charAt(0).toUpperCase() + day.slice(1));
}

/**
 * Get unavailable days as an array of day names
 */
export function getUnavailableDays(availability: ProfileAvailability | null): string[] {
  if (!availability) return [];
  
  return Object.entries(availability)
    .filter(([_, isAvailable]) => !isAvailable)
    .map(([day, _]) => day.charAt(0).toUpperCase() + day.slice(1));
}

/**
 * Count total available days
 */
export function getAvailableDaysCount(availability: ProfileAvailability | null): number {
  if (!availability) return 0;
  return Object.values(availability).filter(Boolean).length;
}

/**
 * Check if user works on weekends
 */
export function worksOnWeekends(availability: ProfileAvailability | null): boolean {
  if (!availability) return false;
  return availability.saturday || availability.sunday;
}

/**
 * Check if user works weekdays only
 */
export function worksOnWeekdaysOnly(availability: ProfileAvailability | null): boolean {
  if (!availability) return false;
  return availability.monday && availability.tuesday && availability.wednesday && 
         availability.thursday && availability.friday && !availability.saturday && !availability.sunday;
}

/**
 * Get a human-readable availability summary
 */
export function getAvailabilitySummary(availability: ProfileAvailability | null): string {
  if (!availability) return 'No availability set';
  
  const availableDays = getAvailableDays(availability);
  const unavailableDays = getUnavailableDays(availability);
  
  if (availableDays.length === 7) return 'Available every day';
  if (availableDays.length === 0) return 'Not available any day';
  if (worksOnWeekdaysOnly(availability)) return 'Weekdays only (Mon-Fri)';
  if (worksOnWeekends(availability) && !worksOnWeekdaysOnly(availability)) return 'Weekends only';
  
  return `Available: ${availableDays.join(', ')}`;
}

/**
 * Format availability for display in UI
 */
export function formatAvailabilityForDisplay(availability: ProfileAvailability | null): { available: string[], unavailable: string[] } {
  return {
    available: getAvailableDays(availability),
    unavailable: getUnavailableDays(availability)
  };
}

/**
 * Validate availability data
 */
export function validateAvailability(availability: any): availability is ProfileAvailability {
  if (!availability || typeof availability !== 'object') return false;
  
  const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  return requiredDays.every(day => 
    day in availability && typeof availability[day] === 'boolean'
  );
}

/**
 * Merge availability with defaults
 */
export function mergeAvailabilityWithDefaults(availability: Partial<ProfileAvailability> | null): ProfileAvailability {
  if (!availability) return DEFAULT_AVAILABILITY;
  
  return {
    ...DEFAULT_AVAILABILITY,
    ...availability
  };
}

/**
 * Get day abbreviation for compact display
 */
export function getDayAbbreviation(day: keyof ProfileAvailability): string {
  const abbreviations: Record<keyof ProfileAvailability, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun'
  };
  
  return abbreviations[day] || day;
}

/**
 * Get full day name for display
 */
export function getDayFullName(day: keyof ProfileAvailability): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}
