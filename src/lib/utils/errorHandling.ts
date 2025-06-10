/**
 * Handles errors from Supabase and other sources in a consistent way
 * 
 * @param error The error object
 * @returns A user-friendly error message
 */
export function handleError(error: unknown): string {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error;
  }
  
  // If it's an Error object, return the message
  if (error instanceof Error) {
    return error.message;
  }
  
  // If it's a Supabase error object
  if (error && typeof error === 'object') {
    // Check for Supabase error format
    if ('code' in error && 'message' in error) {
      const supabaseError = error as { code: string; message: string; details?: string; hint?: string };
      
      // Return a more user-friendly message based on the error code
      switch (supabaseError.code) {
        case 'PGRST116':
          return 'The requested resource was not found.';
        case '23505':
          return 'A record with this information already exists.';
        case '23503':
          return 'This operation would violate database constraints.';
        case '42P01':
          return 'Database error: Table not found.';
        case '42703':
          return 'Database error: Column not found.';
        case '22P02':
          return 'Invalid input format.';
        case 'P0001':
          // For custom error messages thrown from database functions
          return supabaseError.message;
        default:
          return `Database error: ${supabaseError.message}`;
      }
    }
    
    // For authentication errors
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }
  
  // Default fallback
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Wraps an async function with error handling
 * 
 * @param fn The async function to wrap
 * @param errorHandler Optional custom error handler
 * @returns A wrapped function that handles errors
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler?: (error: unknown) => void
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorMessage = handleError(error);
      
      if (errorHandler) {
        errorHandler(error);
      } else {
        console.error('Error:', errorMessage, error);
      }
      
      throw new Error(errorMessage);
    }
  };
}