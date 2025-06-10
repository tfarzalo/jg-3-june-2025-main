import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

const gibsonApiUrl = import.meta.env.VITE_GIBSONAI_API_URL;
const gibsonApiKey = import.meta.env.VITE_GIBSONAI_API_KEY;
const projectId = import.meta.env.VITE_GIBSONAI_PROJECT_ID;

// Create axios instance
const apiClient = axios.create({
  baseURL: gibsonApiUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-Gibson-API-Key': gibsonApiKey,
    'X-Gibson-Project-ID': projectId
  }
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  try {
    // Get token from Auth0
    const { getAccessTokenSilently } = useAuth0();
    const token = await getAccessTokenSilently();
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  } catch (error) {
    return config;
  }
});

// API methods
export const api = {
  // Properties
  getProperties: () => apiClient.get(`/v1/${projectId}/property`),
  getProperty: (id: string) => apiClient.get(`/v1/${projectId}/property/${id}`),
  createProperty: (data: any) => apiClient.post(`/v1/${projectId}/property`, data),
  updateProperty: (id: string, data: any) => apiClient.put(`/v1/${projectId}/property/${id}`, data),
  deleteProperty: (id: string) => apiClient.delete(`/v1/${projectId}/property/${id}`),
  
  // Jobs
  getJobs: () => apiClient.get(`/v1/${projectId}/job_request`),
  getJob: (id: string) => apiClient.get(`/v1/${projectId}/job_request/${id}`),
  createJob: (data: any) => apiClient.post(`/v1/${projectId}/job_request`, data),
  updateJob: (id: string, data: any) => apiClient.put(`/v1/${projectId}/job_request/${id}`, data),
  deleteJob: (id: string) => apiClient.delete(`/v1/${projectId}/job_request/${id}`),
  
  // User methods
  getUserByEmail: (email: string) => apiClient.get(`/v1/${projectId}/user_profile?email=${email}`),
  createUser: (data: any) => apiClient.post(`/v1/${projectId}/user_profile`, data),
  updateUser: (id: string, data: any) => apiClient.put(`/v1/${projectId}/user_profile/${id}`, data),
  
  // Email
  sendEmail: (data: any) => apiClient.post('/v1/email/send', data)
};