import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Use native localStorage
  },
  global: {
    fetch: (url, options) => fetch(url, {
      ...(options ?? {})
    }),
  },
});

// Export types
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user' | 'editor' | 'is_super_admin' | 'jg_management' | 'subcontractor';
  created_at: string;
  updated_at: string;
  avatar_url: string | null;
  nickname: string | null;
  mobile_phone: string | null;
  sms_phone: string | null;
  bio: string | null;
  username: string | null;
  theme_preference: string | null;
  work_schedule: string[] | null;
  notification_settings: string | null;
};

export type PropertyManagementGroup = {
  id: string;
  company_name: string;
  address: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  group_status: string | null;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  property_name: string;
  address: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
  property_management_group_id: string;
  created_at: string;
  updated_at: string;
  property_management_group?: {
    company_name: string;
  };
};

export type Job = {
  id: string;
  property_id: string;
  unit_number: string;
  unit_size_id: string;
  job_type_id: string;
  description: string | null;
  scheduled_date: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_phase_id: string | null;
  work_order_num: number;
};

export type WorkOrder = {
  id: string;
  job_id: string;
  prepared_by: string;
  submission_date: string;
  unit_number: string;
  is_occupied: boolean;
  is_full_paint: boolean;
  job_category: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  sprinkler_photo_path: string | null;
  sprinkler_head_photo_path: string | null;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
  painted_patio: boolean;
  painted_garage: boolean;
  painted_cabinets: boolean;
  painted_crown_molding: boolean;
  painted_front_door: boolean;
  has_accent_wall: boolean;
  accent_wall_type: string | null;
  accent_wall_count: number;
  has_extra_charges: boolean;
  extra_charges_description: string | null;
  extra_hours: number;
  extra_charges_unit_size: string | null;
  additional_comments: string | null;
  bill_amount: number | null;
  sub_pay_amount: number | null;
  profit_amount: number | null;
  is_hourly: boolean;
};

export type BillingCategory = {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BillingDetail = {
  id: string;
  property_id: string;
  category_id: string;
  unit_size_id: string;
  bill_amount: number;
  sub_pay_amount: number;
  profit_amount: number | null;
  is_hourly: boolean;
  created_at: string;
  updated_at: string;
};

export type UnitSize = {
  id: string;
  unit_size_label: string;
  created_at: string;
};

export type JobPhase = {
  id: string;
  job_phase_label: string;
  color_light_mode: string;
  color_dark_mode: string;
  sort_order: number;
  order_index: number;
  created_at: string;
};

export type JobType = {
  id: string;
  job_type_label: string;
  created_at: string;
};

export type UserNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
};

export type File = {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  uploaded_by: string;
  property_id: string | null;
  job_id: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
};
