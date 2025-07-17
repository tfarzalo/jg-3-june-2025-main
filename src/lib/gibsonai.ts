import axios from 'axios';

// API configuration
const API_BASE_URL = import.meta.env.VITE_GIBSONAI_API_URL || 'https://api.gibsonai.com';
const API_KEY = import.meta.env.VITE_GIBSONAI_API_KEY || 'gAAAAABoI6EKXQi4c8FRbZTjiEG408I7Va-D-DyXNESxXPApIBxxEqMlKf0xfO6CJnTNwzuyo_LAgKGSpaWWYck8JUvFIvv9MDNgwMRWBsNFhQcs9BQwDCw=';
const PROJECT_ID = import.meta.env.VITE_GIBSONAI_PROJECT_ID || '31723288-34ef-4245-a2c3-bb0b00d8c163';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'X-Gibson-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gibson_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('gibson_token');
    }
    return Promise.reject(error);
  }
);

// API endpoints
const endpoints = {
  auth: {
    signIn: '/v1/auth/login',
    user: '/v1/auth/user'
  },
  jobs: {
    list: `/v1/${PROJECT_ID}/job_request`,
    detail: (id: string) => `/v1/${PROJECT_ID}/job_request/${id}`
  },
  properties: {
    list: `/v1/${PROJECT_ID}/property`,
    detail: (id: string) => `/v1/${PROJECT_ID}/property/${id}`
  },
  email: {
    send: '/v1/email/send'
  }
};

// Type definitions
export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// API methods
export const gibsonai = {
  // Auth methods
  auth: {
    async signIn(email: string, password: string): Promise<AuthResponse> {
      try {
        // Validate inputs before sending request
        if (!email || !email.includes('@')) {
          throw new Error('Please enter a valid email address');
        }
        
        if (!password || password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }
        
        const response = await api.post(endpoints.auth.signIn, { email, password });
        const { token, user } = response.data;
        
        // Store token in localStorage
        localStorage.setItem('gibson_token', token);
        
        return { token, user };
      } catch (error: any) {
        console.error('Sign in error:', error);
        
        // Provide more specific error messages based on status code
        if (error.response?.status === 422) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.response?.status === 429) {
          throw new Error('Too many login attempts. Please try again later.');
        } else if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please check your credentials.');
        }
        
        throw error;
      }
    },
    
    async signOut(): Promise<void> {
      try {
        // Remove token from localStorage
        localStorage.removeItem('gibson_token');
      } catch (error) {
        console.error('Sign out error:', error);
        throw error;
      }
    },
    
    async getUser(): Promise<{ user: User }> {
      try {
        const token = localStorage.getItem('gibson_token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await api.get(endpoints.auth.user);
        return { user: response.data };
      } catch (error) {
        console.error('Get user error:', error);
        throw error;
      }
    },
    
    async getSession(): Promise<{ data: { session: { access_token: string } | null } }> {
      const token = localStorage.getItem('gibson_token');
      return {
        data: {
          session: token ? { access_token: token } : null
        }
      };
    }
  },
  
  // Jobs methods
  jobs: {
    async list(): Promise<any[]> {
      try {
        const response = await api.get(endpoints.jobs.list);
        return response.data.data || [];
      } catch (error) {
        console.error('List jobs error:', error);
        return [];
      }
    },
    
    async get(id: string): Promise<any> {
      try {
        const response = await api.get(endpoints.jobs.detail(id));
        return response.data;
      } catch (error) {
        console.error(`Get job ${id} error:`, error);
        throw error;
      }
    },
    
    async create(data: any): Promise<any> {
      try {
        const response = await api.post(endpoints.jobs.list, data);
        return response.data;
      } catch (error) {
        console.error('Create job error:', error);
        throw error;
      }
    },
    
    async update(id: string, data: any): Promise<any> {
      try {
        const response = await api.patch(endpoints.jobs.detail(id), data);
        return response.data;
      } catch (error) {
        console.error(`Update job ${id} error:`, error);
        throw error;
      }
    },
    
    async delete(id: string): Promise<void> {
      try {
        await api.delete(endpoints.jobs.detail(id));
      } catch (error) {
        console.error(`Delete job ${id} error:`, error);
        throw error;
      }
    }
  },
  
  // Properties methods
  properties: {
    async list(): Promise<any[]> {
      try {
        const response = await api.get(endpoints.properties.list);
        return response.data.data || [];
      } catch (error) {
        console.error('List properties error:', error);
        return [];
      }
    },
    
    async get(id: string): Promise<any> {
      try {
        const response = await api.get(endpoints.properties.detail(id));
        return response.data;
      } catch (error) {
        console.error(`Get property ${id} error:`, error);
        throw error;
      }
    },
    
    async create(data: any): Promise<any> {
      try {
        const response = await api.post(endpoints.properties.list, data);
        return response.data;
      } catch (error) {
        console.error('Create property error:', error);
        throw error;
      }
    },
    
    async update(id: string, data: any): Promise<any> {
      try {
        const response = await api.patch(endpoints.properties.detail(id), data);
        return response.data;
      } catch (error) {
        console.error(`Update property ${id} error:`, error);
        throw error;
      }
    },
    
    async delete(id: string): Promise<void> {
      try {
        await api.delete(endpoints.properties.detail(id));
      } catch (error) {
        console.error(`Delete property ${id} error:`, error);
        throw error;
      }
    }
  },
  
  // Health check
  async health() {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, {
        headers: {
          'X-Gibson-API-Key': API_KEY
        }
      });
      return { status: response.status, ok: response.status === 200 };
    } catch (error) {
      console.error('Health check error:', error);
      return { status: 500, ok: false };
    }
  },
  
  // Channel simulation for compatibility with existing code
  channel: (name: string) => ({
    on: (event: string, config: any, callback: Function) => ({
      subscribe: (statusCallback?: Function) => {
        console.log(`Channel ${name} subscribed (simulation)`);
        if (statusCallback) {
          statusCallback('SUBSCRIBED');
        }
        return {
          unsubscribe: () => {
            console.log(`Channel ${name} unsubscribed (simulation)`);
          }
        };
      }
    })
  })
};

export default gibsonai;