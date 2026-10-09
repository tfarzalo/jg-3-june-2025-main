import React, { useEffect } from 'react';

export const FallbackApp: React.FC = () => {
  useEffect(() => {
    // Keep technical details in the console for support without exposing them to users.
    console.error('FallbackApp activated', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      mode: import.meta.env.MODE,
      supabaseUrlConfigured: Boolean(import.meta.env.VITE_SUPABASE_URL),
      supabaseKeyConfigured: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <img
          src="/jg-logo-icon.png"
          alt="Paint Manager Pro logo"
          className="w-24 h-24 object-contain mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Paint Manager Pro
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Professional painting business management system
        </p>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <h2 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-2">
            A new version is available
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Refresh this browser or application window to load the latest version.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md transition-colors"
        >
          Refresh Application
        </button>
      </div>
    </div>
  );
};
