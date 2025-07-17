import React from 'react';
import { X, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserRole } from '../../hooks/useUserRole';

interface TodaysAgendaModalProps {
  open: boolean;
  onClose: () => void;
  jobs: any[];
}

export const TodaysAgendaModal: React.FC<TodaysAgendaModalProps> = ({ open, onClose, jobs }) => {
  const { role } = useUserRole();

  // Directly use jobs without sorting
  const sortedTodaysJobs = jobs;

  // Only show for admin and jg_management users
  if (!open || (role !== 'admin' && role !== 'jg_management')) {
    return null;
  }

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-blue-600 text-white">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6" />
            <div>
              <h2 className="text-xl font-semibold">Today's Agenda</h2>
              <p className="text-blue-100 text-sm">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {sortedTodaysJobs.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Jobs Scheduled for Today
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                There are no jobs scheduled for today. Check back tomorrow or view all jobs.
              </p>
            </div>
          ) : (
            <>
              {/* Job Summary Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 mb-4">
                  <span className="text-lg font-medium text-gray-900 dark:text-white">
                    Today's Jobs: {sortedTodaysJobs.length} Total
                  </span>
                  <div className="flex space-x-6">
                    <span className="text-blue-500 font-medium">
                      Paint: {sortedTodaysJobs.filter(job => {
                        const jobTypeObj = Array.isArray(job.job_type) && job.job_type.length > 0 
                          ? job.job_type[0] 
                          : (job.job_type as any);
                        return jobTypeObj?.job_type_label === 'Paint';
                      }).length}
                    </span>
                    <span className="text-orange-500 font-medium">
                      Callback: {sortedTodaysJobs.filter(job => {
                        const jobTypeObj = Array.isArray(job.job_type) && job.job_type.length > 0 
                          ? job.job_type[0] 
                          : (job.job_type as any);
                        return jobTypeObj?.job_type_label === 'Callback';
                      }).length}
                    </span>
                    <span className="text-red-500 font-medium">
                      Repair: {sortedTodaysJobs.filter(job => {
                        const jobTypeObj = Array.isArray(job.job_type) && job.job_type.length > 0 
                          ? job.job_type[0] 
                          : (job.job_type as any);
                        return jobTypeObj?.job_type_label === 'Repair';
                      }).length}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Here's an overview of all jobs scheduled for today across all phases.
                </p>
              </div>
              
              <div className="space-y-2">
                {sortedTodaysJobs.map((job) => {
                  const jobPhase = Array.isArray(job.job_phase) && job.job_phase.length > 0 
                    ? job.job_phase[0]
                    : (job.job_phase as any);
                  const property = Array.isArray(job.property) && job.property.length > 0 
                    ? job.property[0] 
                    : (job.property as any);
                  const jobType = Array.isArray(job.job_type) && job.job_type.length > 0 
                    ? job.job_type[0] 
                    : (job.job_type as any);

                  return (
                    <Link 
                      key={job.id} 
                      to={`/dashboard/jobs/${job.id}`}
                      className="block"
                    >
                      <div 
                        className="rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
                        style={{
                          backgroundColor: jobPhase?.color_dark_mode 
                            ? `${jobPhase.color_dark_mode}1A` 
                            : 'rgba(128, 128, 128, 0.1)', // Use fetched color with 10% opacity
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-base font-medium text-gray-900 dark:text-white">
                                {property?.property_name || 'Unknown Property'}
                                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2 font-normal">
                                  Unit {job.unit_number}
                                </span>
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  {jobType?.job_type_label || 'Unknown Type'}
                                </span>
                                <span 
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                                  style={{
                                    backgroundColor: jobPhase?.color_dark_mode || '#6B7280'
                                  }}
                                >
                                  {jobPhase?.job_phase_label || 'Unknown'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-4">
                                <span className="text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">WO:</span> {formatWorkOrderNumber(job.work_order_num)}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Assigned:</span>{' '}
                                  {(() => {
                                    if (!job.assigned_to) {
                                      return 'Unassigned';
                                    }
                                    
                                    // Handle array format
                                    if (Array.isArray(job.assigned_to)) {
                                      if (job.assigned_to.length > 0 && job.assigned_to[0]?.full_name) {
                                        return job.assigned_to[0].full_name;
                                      }
                                      return 'Unassigned';
                                    }
                                    
                                    // Handle single object format (like DashboardHome)
                                    if (typeof job.assigned_to === 'object' && 'full_name' in job.assigned_to) {
                                      return job.assigned_to.full_name || 'Unassigned';
                                    }
                                    
                                    return 'Unassigned';
                                  })()}
                                </span>
                              </div>
                              {job.total_billing_amount && job.total_billing_amount > 0 ? (
                                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                  ${job.total_billing_amount.toFixed(2)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0F172A]">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            This modal shows once per day for admin and JG management users
          </div>
          <div className="flex gap-3">
            <Link
              to="/dashboard/calendar"
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              View Calendar
            </Link>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodaysAgendaModal;
