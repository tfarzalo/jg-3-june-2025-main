// Environment configuration with validation
export const config = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  },
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
  isBrowser: typeof window !== 'undefined',
};

// Validate required environment variables
export const validateEnvironment = () => {
  const missingVars: string[] = [];
  
  if (!config.supabase.url) missingVars.push('VITE_SUPABASE_URL');
  if (!config.supabase.anonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  
  if (missingVars.length > 0) {
    const message = `Missing required environment variables: ${missingVars.join(', ')}`;
    
    if (config.isProduction) {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }
  
  return missingVars.length === 0;
};

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(config.supabase.url && config.supabase.anonKey);
};
