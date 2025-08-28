import React, { useEffect, useState } from 'react';
import { getEnvironmentStatus, isSupabaseConfigured } from '../config/environment';

interface HealthStatus {
  environment: boolean;
  supabase: boolean;
  database: boolean;
  loading: boolean;
  errors: string[];
  lastCheck: string;
}

export const ProductionHealthCheck: React.FC = () => {
  const [status, setStatus] = useState<HealthStatus>({
    environment: false,
    supabase: false,
    database: false,
    loading: true,
    errors: [],
    lastCheck: new Date().toISOString()
  });

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const performHealthCheck = async () => {
      console.log('🏥 Starting production health check...');
      const errors: string[] = [];
      
      try {
        // Check environment variables
        const envStatus = getEnvironmentStatus();
        const envOk = isSupabaseConfigured();
        
        if (!envOk) {
          if (!envStatus.supabaseUrl) errors.push('VITE_SUPABASE_URL missing');
          if (!envStatus.supabaseKey) errors.push('VITE_SUPABASE_ANON_KEY missing');
        }

        // Check Supabase connection
        let supabaseOk = false;
        let databaseOk = false;
        
        if (envOk) {
          try {
            // Dynamic import to avoid issues if supabase config is broken
            const { supabase } = await import('../utils/supabase');
            
            // Test basic Supabase connection
            const { data, error } = await supabase.from('profiles').select('count').limit(1);
            
            if (error) {
              errors.push(`Supabase error: ${error.message}`);
              console.error('Supabase connection error:', error);
            } else {
              supabaseOk = true;
              databaseOk = true;
              console.log('✅ Supabase connection successful');
            }
          } catch (supabaseError) {
            errors.push(`Supabase initialization error: ${supabaseError instanceof Error ? supabaseError.message : String(supabaseError)}`);
            console.error('Supabase initialization failed:', supabaseError);
          }
        }

        const finalStatus = {
          environment: envOk,
          supabase: supabaseOk,
          database: databaseOk,
          loading: false,
          errors,
          lastCheck: new Date().toISOString()
        };

        setStatus(finalStatus);

        // Log comprehensive health check results
        console.log('🏥 Health check complete:', finalStatus);
        console.log('🔍 Environment details:', envStatus);

        if (errors.length > 0) {
          console.error('❌ Health check found issues:', errors);
        }

      } catch (error) {
        console.error('❌ Health check failed:', error);
        setStatus({
          environment: false,
          supabase: false,
          database: false,
          loading: false,
          errors: [`Health check failed: ${error instanceof Error ? error.message : String(error)}`],
          lastCheck: new Date().toISOString()
        });
      }
    };

    performHealthCheck();
    
    // Periodic health checks in production
    const interval = setInterval(performHealthCheck, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const allGood = status.environment && status.supabase && status.database && status.errors.length === 0;
  const hasIssues = status.errors.length > 0 || !status.environment || !status.supabase;

  if (status.loading) {
    return (
      <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm z-50">
        🏥 Health check...
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div 
        className={`px-3 py-1 rounded-md text-sm cursor-pointer transition-all ${
          allGood 
            ? 'bg-green-500 text-white' 
            : hasIssues
            ? 'bg-red-500 text-white'
            : 'bg-yellow-500 text-white'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {allGood ? '✅ All systems operational' : hasIssues ? '❌ System issues detected' : '⚠️ Partial systems'}
      </div>
      
      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-sm">
          <div className="font-semibold mb-3 text-gray-900 dark:text-white">System Health Report</div>
          
          <div className="space-y-2 mb-3">
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className={status.environment ? 'text-green-600' : 'text-red-600'}>
                {status.environment ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Supabase:</span>
              <span className={status.supabase ? 'text-green-600' : 'text-red-600'}>
                {status.supabase ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Database:</span>
              <span className={status.database ? 'text-green-600' : 'text-red-600'}>
                {status.database ? '✅' : '❌'}
              </span>
            </div>
          </div>

          {status.errors.length > 0 && (
            <div className="border-t pt-3 mb-3">
              <div className="font-semibold text-red-600 mb-2">Issues:</div>
              <div className="space-y-1">
                {status.errors.map((error, index) => (
                  <div key={index} className="text-red-600 text-xs break-words">
                    • {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-3 text-xs text-gray-500">
            <div>Last check: {new Date(status.lastCheck).toLocaleTimeString()}</div>
            <div>Mode: {import.meta.env.MODE} {import.meta.env.PROD ? '(Production)' : '(Development)'}</div>
          </div>

          <div className="flex space-x-2 mt-3">
            <button 
              onClick={() => window.location.reload()}
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
            >
              Reload
            </button>
            <button 
              onClick={() => {
                console.log('🏥 Manual health check requested');
                setStatus(prev => ({ ...prev, loading: true }));
                window.location.reload();
              }}
              className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
            >
              Recheck
            </button>
          </div>
        </div>
      )}
    </div>
  );
};