import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export function WorkingOrdersBilling() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(jobId ? `/dashboard/jobs/${jobId}` : '/dashboard/jobs')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Billing Details
            </h1>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
          <p className="text-center text-gray-600 dark:text-gray-400">
            This page has been temporarily removed and will be rebuilt.
          </p>
        </div>
      </div>
    </div>
  );
}