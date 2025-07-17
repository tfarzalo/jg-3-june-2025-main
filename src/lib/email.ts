import { gibsonai } from './gibsonai';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Send an email using the GibsonAI Email API with retry mechanism
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      // Validate required fields
      if (!options.to || !options.subject || (!options.text && !options.html)) {
        throw new Error('Missing required email fields');
      }

      // Get the current session for authentication
      const { data: sessionData, error: sessionError } = await gibsonai.auth.getSession();
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`);
      }
      if (!sessionData.session) {
        throw new Error('Authentication required');
      }

      // Construct the API URL
      const baseUrl = import.meta.env.VITE_GIBSONAI_API_URL || 'https://api.gibsonai.com/v1';
      const emailUrl = `${baseUrl}/email/send`;
      
      // Call the Email API with timeout and proper CORS handling
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(emailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'X-GibsonAI-Key': import.meta.env.VITE_GIBSONAI_API_KEY,
            'X-GibsonAI-Project': import.meta.env.VITE_GIBSONAI_PROJECT_ID
          },
          body: JSON.stringify({
            ...options,
            replyTo: options.replyTo || 'info@gibsonai.com'
          }),
          signal: controller.signal,
          mode: 'cors',
          credentials: 'same-origin'
        });

        clearTimeout(timeout);

        // Check for network errors
        if (!response) {
          throw new Error('Network response was not received');
        }

        // Handle non-OK responses
        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // If we can't parse the JSON, just use the HTTP status
            console.error('Failed to parse error response:', e);
          }
          throw new Error(errorMessage);
        }

        // Parse the response
        const result = await response.json();
        return result;
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out after 30 seconds');
        }
        throw fetchError;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      retries++;
      console.error(`Error sending email (attempt ${retries}/${MAX_RETRIES}):`, error);
      
      // Check if we should retry
      if (retries === MAX_RETRIES) {
        return {
          success: false,
          error: error instanceof Error 
            ? `Failed to send email after ${MAX_RETRIES} attempts: ${error.message}`
            : 'Failed to send email after multiple attempts',
        };
      }
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, INITIAL_RETRY_DELAY * Math.pow(2, retries - 1)));
    }
  }

  return {
    success: false,
    error: 'Maximum retry attempts reached',
  };
}