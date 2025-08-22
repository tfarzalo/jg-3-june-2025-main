import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

export function SubWorkOrderForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const previewUserId = queryParams.get('userId');
  
  // Determine if this is a preview
  const isPreview = !!previewUserId;

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => isPreview ? navigate('/dashboard/users') : navigate('/dashboard')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Submit Work Order</h1>
          </div>
        </div>

        {isPreview && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg">
            <p className="flex items-center font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              You are submitting this work order as an administrator on behalf of a subcontractor
            </p>
            <p className="mt-1 text-sm">
              This is a preview of the subcontractor's work order form. Any actions taken here will affect the actual data.
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg">
          <p className="text-center text-gray-600 dark:text-gray-400">
            This page has been temporarily removed and will be rebuilt.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SubWorkOrderForm;