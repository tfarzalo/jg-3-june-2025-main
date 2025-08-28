import React, { useEffect, useState } from 'react';

interface DebugState {
  appLoaded: boolean;
  supabaseConfig: boolean;
  environmentVars: boolean;
  errors: string[];
}

export const DebugInfo: React.FC = () => {
  const [debugState, setDebugState] = useState<DebugState>({
    appLoaded: false,
    supabaseConfig: false,
    environmentVars: false,
    errors: []
  });

  useEffect(() => {
    const checkEnvironment = () => {
      const errors: string[] = [];
      
      try {
        // Check if we're in a browser
        if (typeof window === 'undefined') {
          errors.push('Not in browser environment');
        }

        // Check environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl) {
          errors.push('VITE_SUPABASE_URL is missing');
        }
        if (!supabaseKey) {
          errors.push('VITE_SUPABASE_ANON_KEY is missing');
        }

        // Check if Supabase client can be created
        try {
          const { createClient } = require('@supabase/supabase-js');
          const testClient = createClient(
            supabaseUrl || 'test',
            supabaseKey || 'test'
          );
          console.log('Supabase client created successfully');
        } catch (err) {
          errors.push(`Supabase client creation failed: ${err}`);
        }

        setDebugState({
          appLoaded: true,
          supabaseConfig: !!(supabaseUrl && supabaseKey),
          environmentVars: !!(supabaseUrl && supabaseKey),
          errors
        });

      } catch (error) {
        errors.push(`Environment check failed: ${error}`);
        setDebugState(prev => ({
          ...prev,
          appLoaded: true,
          errors
        }));
      }
    };

    // Run check after a short delay
    const timer = setTimeout(checkEnvironment, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!debugState.appLoaded) {
    return (
      <div className="fixed top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm">
        Loading debug info...
      </div>
    );
  }

  return (
    <div className="fixed top-4 left-4 bg-gray-800 text-white p-4 rounded-md text-sm max-w-md z-50">
      <div className="font-bold mb-2">Debug Information</div>
      
      <div className="space-y-1">
        <div>App Loaded: {debugState.appLoaded ? '✅' : '❌'}</div>
        <div>Environment Vars: {debugState.environmentVars ? '✅' : '❌'}</div>
        <div>Supabase Config: {debugState.supabaseConfig ? '✅' : '❌'}</div>
      </div>

      {debugState.errors.length > 0 && (
        <div className="mt-3">
          <div className="font-bold text-red-400">Errors:</div>
          <div className="text-xs space-y-1 mt-1">
            {debugState.errors.map((error, index) => (
              <div key={index} className="text-red-300">• {error}</div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-300">
        <div>VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING'}</div>
        <div>VITE_SUPABASE_ANON_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'}</div>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="mt-3 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs"
      >
        Reload Page
      </button>
    </div>
  );
};
