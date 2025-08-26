import React from 'react';
import { health } from '../utils/health';

export default function Health() {
  const healthData = health();
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Application Health Check
        </h1>
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
          <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-auto">
            {JSON.stringify(healthData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}