import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { isSupabaseConfigured } from '../config/environment';

interface HealthStatus {
  environment: boolean;
  supabase: boolean;
  loading: boolean;
}

export const HealthCheck: React.FC = () => {
  const [status, setStatus] = useState<HealthStatus>({
    environment: false,
    supabase: false,
    loading: true
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Check environment variables
        const envOk = isSupabaseConfigured();
        
        // Check Supabase connection
        let supabaseOk = false;
        if (envOk) {
          try {
            const { data, error } = await supabase.from('profiles').select('count').limit(1);
            supabaseOk = !error;
          } catch (err) {
            console.warn('Supabase health check failed:', err);
          }
        }

        setStatus({
          environment: envOk,
          supabase: supabaseOk,
          loading: false
        });
      } catch (error) {
        console.error('Health check failed:', error);
        setStatus({
          environment: false,
          supabase: false,
          loading: false
        });
      }
    };

    checkHealth();
  }, []);

  if (status.loading) {
    return (
      <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm">
        Checking health...
      </div>
    );
  }

  if (!status.environment || !status.supabase) {
    return (
      <div className="fixed top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-md text-sm max-w-xs">
        <div className="font-semibold">Configuration Issues:</div>
        <div>Environment: {status.environment ? '✅' : '❌'}</div>
        <div>Supabase: {status.supabase ? '✅' : '❌'}</div>
        {!status.environment && (
          <div className="text-xs mt-1">
            Check environment variables in Netlify
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-md text-sm">
      All systems operational ✅
    </div>
  );
};
