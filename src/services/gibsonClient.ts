import axios from 'axios';

const API_URL = import.meta.env.VITE_GIBSONAI_API_URL;
const PROJECT_ID = import.meta.env.VITE_GIBSONAI_PROJECT_ID;
const API_KEY = import.meta.env.VITE_GIBSONAI_API_KEY;

const gibsonClient = axios.create({
  baseURL: `${API_URL}/${PROJECT_ID}`,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  }
});

// Add request interceptor for authentication
gibsonClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('gibson_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface Property {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  created_at: string;
  updated_at: string;
}

interface JobRequest {
  id: string;
  property_id: string;
  unit_number: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface WorkOrder {
  id: string;
  job_request_id: string;
  status: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

interface PropertyGroup {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
  };
  token: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface File {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export const gibsonApi = {
  // Properties
  getProperties: (page = 1, perPage = 10) => 
    gibsonClient.get<Property[]>(`/property?page=${page}&per_page=${perPage}`),
  getProperty: (id: string) => 
    gibsonClient.get<Property>(`/property/${id}`),
  createProperty: (data: Omit<Property, 'id' | 'created_at' | 'updated_at'>) => 
    gibsonClient.post<Property>('/property', data),
  updateProperty: (id: string, data: Partial<Omit<Property, 'id' | 'created_at' | 'updated_at'>>) => 
    gibsonClient.put<Property>(`/property/${id}`, data),
  deleteProperty: (id: string) => 
    gibsonClient.delete<void>(`/property/${id}`),

  // Jobs
  getJobs: (page = 1, perPage = 10) => 
    gibsonClient.get<JobRequest[]>(`/job_request?page=${page}&per_page=${perPage}`),
  getJob: (id: string) => 
    gibsonClient.get<JobRequest>(`/job_request/${id}`),
  createJob: (data: Omit<JobRequest, 'id' | 'created_at' | 'updated_at'>) => 
    gibsonClient.post<JobRequest>('/job_request', data),
  updateJob: (id: string, data: Partial<Omit<JobRequest, 'id' | 'created_at' | 'updated_at'>>) => 
    gibsonClient.put<JobRequest>(`/job_request/${id}`, data),
  deleteJob: (id: string) => 
    gibsonClient.delete<void>(`/job_request/${id}`),

  // Auth
  login: (email: string, password: string) =>
    gibsonClient.post<AuthResponse>('/auth/login', { email, password }),
  register: (email: string, password: string, fullName: string) =>
    gibsonClient.post<AuthResponse>('/auth/register', { email, password, full_name: fullName }),
  getCurrentUser: () =>
    gibsonClient.get<AuthResponse['user']>('/auth/user'),
  
  // Work Orders
  getWorkOrders: (page = 1, perPage = 10) =>
    gibsonClient.get<WorkOrder[]>(`/work_order?page=${page}&per_page=${perPage}`),
  getWorkOrder: (id: string) =>
    gibsonClient.get<WorkOrder>(`/work_order/${id}`),
  createWorkOrder: (data: Omit<WorkOrder, 'id' | 'created_at' | 'updated_at'>) =>
    gibsonClient.post<WorkOrder>('/work_order', data),
  updateWorkOrder: (id: string, data: Partial<Omit<WorkOrder, 'id' | 'created_at' | 'updated_at'>>) =>
    gibsonClient.put<WorkOrder>(`/work_order/${id}`, data),
  
  // Property Management Groups
  getPropertyGroups: (page = 1, perPage = 10) =>
    gibsonClient.get<PropertyGroup[]>(`/property_group?page=${page}&per_page=${perPage}`),
  getPropertyGroup: (id: string) =>
    gibsonClient.get<PropertyGroup>(`/property_group/${id}`),
  createPropertyGroup: (data: Omit<PropertyGroup, 'id' | 'created_at' | 'updated_at'>) =>
    gibsonClient.post<PropertyGroup>('/property_group', data),
  updatePropertyGroup: (id: string, data: Partial<Omit<PropertyGroup, 'id' | 'created_at' | 'updated_at'>>) =>
    gibsonClient.put<PropertyGroup>(`/property_group/${id}`, data),
  deletePropertyGroup: (id: string) =>
    gibsonClient.delete<void>(`/property_group/${id}`),
  
  // Users
  getUsers: (page = 1, perPage = 10) =>
    gibsonClient.get<User[]>(`/user?page=${page}&per_page=${perPage}`),
  getUser: (id: string) =>
    gibsonClient.get<User>(`/user/${id}`),
  createUser: (data: Omit<User, 'id' | 'created_at' | 'updated_at'>) =>
    gibsonClient.post<User>('/user', data),
  updateUser: (id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>) =>
    gibsonClient.put<User>(`/user/${id}`, data),
  
  // Files
  getFiles: (page = 1, perPage = 10) =>
    gibsonClient.get<File[]>(`/file?page=${page}&per_page=${perPage}`),
  getFile: (id: string) =>
    gibsonClient.get<File>(`/file/${id}`),
  uploadFile: (formData: FormData) =>
    gibsonClient.post<File>('/file/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }),
  
  // Health check
  health: () =>
    axios.get(`${API_URL}/health`, {
      headers: {
        'X-API-Key': API_KEY
      }
    })
};