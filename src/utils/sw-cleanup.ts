/**
 * Service Worker Cleanup Utility
 * 
 * Unregisters old service workers to prevent stale chunk 404 errors.
 * This is especially important after build changes where chunk names change.
 * 
 * Call this once at app boot to ensure clean state.
 */
export function unregisterOldServiceWorkers(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve();
  }

  return navigator.serviceWorker.getRegistrations()
    .then(registrations => {
      const unregisterPromises = registrations.map(registration => {
        console.log('Unregistering old service worker:', registration.scope);
        return registration.unregister();
      });
      
      return Promise.all(unregisterPromises);
    })
    .then(() => {
      console.log('All old service workers unregistered');
    })
    .catch(error => {
      console.warn('Error unregistering service workers:', error);
    });
}

/**
 * Clear any cached data that might reference old chunk URLs
 */
export function clearOldCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return Promise.resolve();
  }

  return caches.keys()
    .then(cacheNames => {
      const deletePromises = cacheNames.map(cacheName => {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      });
      
      return Promise.all(deletePromises);
    })
    .then(() => {
      console.log('All old caches cleared');
    })
    .catch(error => {
      console.warn('Error clearing caches:', error);
    });
}