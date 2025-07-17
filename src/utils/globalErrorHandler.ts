// Global error handler to prevent external 401 errors from affecting the app
window.addEventListener('unhandledrejection', (event) => {
  // Check if this is a 401 error from external sources (like browser extensions)
  if (event.reason?.message?.includes('Request failed with status code 401') ||
      event.reason?.status === 401) {
    console.log('Caught external 401 error, preventing app interference:', event.reason);
    // Prevent this error from affecting our app
    event.preventDefault();
  }
});

// Also handle general errors
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('Request failed with status code 401')) {
    console.log('Caught external 401 error in error handler:', event.error);
    event.preventDefault();
  }
});

export {};
