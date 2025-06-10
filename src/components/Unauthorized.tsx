import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

export function Unauthorized() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-[#1E293B] p-8 rounded-xl shadow-lg text-center">
        <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Access Denied
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>
        <div className="pt-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Home className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Unauthorized;