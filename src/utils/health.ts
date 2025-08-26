/**
 * Health check utility for debugging and monitoring
 */
export function health() {
  return {
    ok: true,
    timestamp: Date.now(),
    date: new Date().toISOString(),
    environment: import.meta.env.MODE,
    baseUrl: import.meta.env.BASE_URL,
    version: import.meta.env.VITE_APP_VERSION || 'unknown',
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL ? 'configured' : 'missing',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'configured' : 'missing',
    }
  };
}