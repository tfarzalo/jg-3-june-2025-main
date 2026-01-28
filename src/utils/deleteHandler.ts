import { toast } from 'sonner';

/**
 * Standardized delete handler configuration
 */
export interface DeleteOptions {
  entityType: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  confirmMessage?: string;
  scope?: 'property' | 'application';
  skipConfirmation?: boolean;
}

/**
 * Centralized delete handler utility for consistent delete operations
 * across the application with proper error handling and user feedback
 */
export class DeleteHandler {
  /**
   * Execute a delete operation with confirmation, loading state, and error handling
   * 
   * @param id - Unique identifier of the item to delete
   * @param deleteApiCall - Async function that performs the actual delete operation
   * @param options - Configuration options for the delete operation
   * @returns Promise<boolean> - true if delete succeeded, false otherwise
   */
  static async handleDelete(
    id: string,
    deleteApiCall: () => Promise<void>,
    options: DeleteOptions
  ): Promise<boolean> {
    const {
      entityType,
      onSuccess,
      onError,
      confirmMessage,
      scope = 'property',
      skipConfirmation = false
    } = options;

    // Confirmation step (unless explicitly skipped)
    if (!skipConfirmation) {
      const defaultMessage = `Are you sure you want to remove this ${entityType}? ${
        scope === 'application' 
          ? 'This action cannot be undone and will remove it from the entire application.' 
          : 'This will remove it from this property.'
      }`;
      
      if (!window.confirm(confirmMessage || defaultMessage)) {
        return false;
      }
    }

    try {
      // Show loading state
      toast.info(`Removing ${entityType}...`, { duration: 1000 });

      // Execute delete operation
      await deleteApiCall();

      // Success feedback
      toast.success(`${entityType} removed successfully`);
      
      // Execute success callback
      onSuccess?.();
      
      return true;
    } catch (error) {
      console.error(`Delete ${entityType} failed:`, error);
      
      // Show error message to user
      toast.error(
        `Failed to remove ${entityType}. Please try again. ${
          error instanceof Error ? error.message : ''
        }`
      );
      
      // Execute error callback
      onError?.(error as Error);
      
      return false;
    }
  }

  /**
   * Batch delete operation for multiple items
   * 
   * @param ids - Array of unique identifiers to delete
   * @param deleteApiCall - Async function that performs the batch delete
   * @param options - Configuration options
   * @returns Promise<boolean> - true if all deletes succeeded
   */
  static async handleBatchDelete(
    ids: string[],
    deleteApiCall: (ids: string[]) => Promise<void>,
    options: Omit<DeleteOptions, 'confirmMessage'> & { 
      confirmMessage?: (count: number) => string 
    }
  ): Promise<boolean> {
    const { entityType, confirmMessage, skipConfirmation = false } = options;

    if (!skipConfirmation) {
      const defaultMessage = `Are you sure you want to remove ${ids.length} ${entityType}${ids.length > 1 ? 's' : ''}?`;
      const message = confirmMessage ? confirmMessage(ids.length) : defaultMessage;
      
      if (!window.confirm(message)) {
        return false;
      }
    }

    try {
      toast.info(`Removing ${ids.length} ${entityType}${ids.length > 1 ? 's' : ''}...`);
      
      await deleteApiCall(ids);
      
      toast.success(`Successfully removed ${ids.length} ${entityType}${ids.length > 1 ? 's' : ''}`);
      options.onSuccess?.();
      
      return true;
    } catch (error) {
      console.error(`Batch delete ${entityType} failed:`, error);
      toast.error(`Failed to remove ${entityType}${ids.length > 1 ? 's' : ''}. Please try again.`);
      options.onError?.(error as Error);
      
      return false;
    }
  }
}
