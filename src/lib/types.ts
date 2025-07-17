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