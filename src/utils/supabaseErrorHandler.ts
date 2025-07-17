import { supabase } from './supabase';
import { toast } from 'sonner';

/**
 * Global error handler for Supabase operations
 * Handles 401 errors by attempting session refresh or redirecting to login
 */
export class SupabaseErrorHandler {
  private static retryAttempts = new Map<string, number>();
  private static maxRetries = 1;

  /**
   * Handle Supabase errors globally, especially 401 unauthorized errors
   */
  static async handleError(error: any, operationId?: string): Promise<boolean> {
    // Check if this is a 401/unauthorized error
    if (this.is401Error(error)) {
      console.log('401 error detected, attempting session recovery...', error);
      
      // Track retry attempts to prevent infinite loops
      const retryKey = operationId || 'default';
      const attempts = this.retryAttempts.get(retryKey) || 0;
      
      if (attempts >= this.maxRetries) {
        console.log('Max retry attempts reached, redirecting to login');
        this.retryAttempts.delete(retryKey);
        this.redirectToLogin('Session expired. Please sign in again.');
        return false;
      }

      // Attempt to refresh the session
      try {
        this.retryAttempts.set(retryKey, attempts + 1);
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !data.session) {
          console.log('Session refresh failed, redirecting to login');
          this.retryAttempts.delete(retryKey);
          this.redirectToLogin('Session expired. Please sign in again.');
          return false;
        }
        
        console.log('Session refreshed successfully, can retry operation');
        // Clear retry count on success
        this.retryAttempts.delete(retryKey);
        return true; // Indicate that retry is possible
        
      } catch (refreshError) {
        console.error('Error during session refresh:', refreshError);
        this.retryAttempts.delete(retryKey);
        this.redirectToLogin('Session expired. Please sign in again.');
        return false;
      }
    }
    
    return false; // Not a 401 error, let the original error handling proceed
  }

  /**
   * Check if an error is a 401 unauthorized error
   */
  private static is401Error(error: any): boolean {
    return (
      error?.code === '401' ||
      error?.status === 401 ||
      error?.message?.includes('401') ||
      error?.message?.includes('JWT expired') ||
      error?.message?.includes('unauthorized') ||
      error?.message?.toLowerCase().includes('permission denied')
    );
  }

  /**
   * Redirect to login page and show error message
   */
  private static redirectToLogin(message: string) {
    toast.error(message);
    
    // Clear any auth-related localStorage
    try {
      const projectRef = import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0];
      if (projectRef) {
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
      }
      localStorage.removeItem('gibson_token');
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
    
    // Use a small delay to ensure state is cleaned up
    setTimeout(() => {
      window.location.href = '/auth';
    }, 100);
  }

  /**
   * Wrapper function for Supabase operations with automatic error handling
   */
  static async executeWithRetry<T>(
    operation: () => Promise<{ data: T; error: any }>,
    operationId?: string
  ): Promise<{ data: T; error: any }> {
    try {
      const result = await operation();
      
      if (result.error) {
        const canRetry = await this.handleError(result.error, operationId);
        
        if (canRetry) {
          console.log('Retrying operation after session refresh...');
          // Retry the operation once
          return await operation();
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error in executeWithRetry:', error);
      await this.handleError(error, operationId);
      throw error;
    }
  }
}

/**
 * Enhanced Supabase query wrapper that handles 401 errors automatically
 */
export function withErrorHandling<T>(
  queryBuilder: any,
  operationId?: string
): Promise<{ data: T; error: any }> {
  return SupabaseErrorHandler.executeWithRetry(
    () => queryBuilder,
    operationId
  );
}
