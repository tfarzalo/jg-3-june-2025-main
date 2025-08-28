export interface JobType {
  id: string;
  job_type_label: string;
  created_at: string;
}

export interface Property {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  property_id: string;
  unit_number: string;
  unit_size_id: string;
  job_type_id: string;
  job_category_id?: string; // Use job_category_id to match database structure
  description?: string;
  scheduled_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  // ... other fields ...
  job_category?: { // Use job_category to match existing patterns
    id: string;
    name: string;
    description: string | null;
  };
  // ... other fields ...
}

export interface JobRequest {
  id: string;
  property_id: string;
  unit_number: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  job_request_id: string;
  status: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyGroup {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface PaintRoom {
  room: string;
  color: string;
}

export interface PaintScheme {
  paint_type: string;
  rooms: PaintRoom[];
} 