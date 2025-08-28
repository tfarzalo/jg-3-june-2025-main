import React from 'react';

export const FallbackApp: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <div className="text-blue-500 text-6xl mb-4">🎨</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Paint Manager Pro
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Professional painting business management system
        </p>
        
        <div className="space-y-3 text-left">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">App Status:</span>
            <span className="text-sm text-red-500">⚠️ Loading Issues</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Environment:</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {import.meta.env.VITE_SUPABASE_URL ? '✅ Configured' : '❌ Missing Variables'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Supabase:</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Key Set' : '❌ Key Missing'}
            </span>
          </div>
        </div>
        
        <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Troubleshooting:</strong> Check that environment variables are set in Netlify:
            <br />
            <code className="text-xs bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
              VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
            </code>
          </p>
        </div>
        
        <button
          onClick={() => window.location.reload()}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          Retry Loading
        </button>
      </div>
    </div>
  );
};
