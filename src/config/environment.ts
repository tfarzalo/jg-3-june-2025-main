// Environment configuration with validation
export const config = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  },
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
  isBrowser: typeof window !== 'undefined',
  mode: import.meta.env.MODE,
  baseUrl: import.meta.env.BASE_URL,
};

// Get detailed environment status
export const getEnvironmentStatus = () => {
  const status = {
    supabaseUrl: !!config.supabase.url,
    supabaseKey: !!config.supabase.anonKey,
    isProduction: config.isProduction,
    mode: config.mode,
    baseUrl: config.baseUrl,
    timestamp: new Date().toISOString(),
    userAgent: config.isBrowser ? navigator.userAgent : 'Server',
    url: config.isBrowser ? window.location.href : 'N/A'
  };

  return status;
};

// Enhanced validation with detailed reporting
export const validateEnvironment = () => {
  const missingVars: string[] = [];
  const warnings: string[] = [];
  
  if (!config.supabase.url) {
    missingVars.push('VITE_SUPABASE_URL');
  } else if (!config.supabase.url.includes('supabase.co')) {
    warnings.push('VITE_SUPABASE_URL does not appear to be a valid Supabase URL');
  }
  
  if (!config.supabase.anonKey) {
    missingVars.push('VITE_SUPABASE_ANON_KEY');
  } else if (config.supabase.anonKey.length < 100) {
    warnings.push('VITE_SUPABASE_ANON_KEY appears to be too short');
  }
  
  // Log detailed environment status
  const envStatus = getEnvironmentStatus();
  console.log('🔍 Environment validation:', envStatus);
  
  if (warnings.length > 0) {
    console.warn('⚠️ Environment warnings:', warnings);
  }
  
  if (missingVars.length > 0) {
    const message = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error('❌ Environment validation failed:', message);
    
    // In production, don't throw immediately - let the app try to show fallback UI
    if (config.isProduction) {
      console.error('🚨 Production environment missing critical variables!');
      console.error('This will likely cause the app to show a white screen or fallback UI.');
      // Return false but don't throw - let the app handle this gracefully
      return false;
    } else {
      console.warn('Development environment missing variables:', message);
      return false;
    }
  }
  
  console.log('✅ Environment validation passed');
  return true;
};

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(config.supabase.url && config.supabase.anonKey);
};

// Get safe configuration for logging (no sensitive data)
export const getSafeConfig = () => {
  return {
    supabase: {
      url: config.supabase.url ? `${config.supabase.url.slice(0, 20)}...` : 'MISSING',
      anonKey: config.supabase.anonKey ? `${config.supabase.anonKey.slice(0, 20)}...` : 'MISSING',
    },
    isProduction: config.isProduction,
    isDevelopment: config.isDevelopment,
    mode: config.mode,
    baseUrl: config.baseUrl,
  };
};
