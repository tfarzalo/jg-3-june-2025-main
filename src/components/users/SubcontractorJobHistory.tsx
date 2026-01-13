import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { Search, ArrowUpDown } from 'lucide-react';
import { formatDisplayDate } from '../../lib/dateUtils';
import { Link } from 'react-router-dom';

interface SubcontractorJobHistoryProps {
  userId: string;
  userName: string;
}

interface Job {
  id: string;
  work_order_num: number;
  property: {
    id: string;
    property_name: string;
  } | null;
  unit_number: string | null;
  unit_size: {
    unit_size_label: string;
  } | null;
  job_type: {
    job_type_label: string;
  } | null;
  scheduled_date: string;
  job_phase: {
    job_phase_label: string;
    color_light_mode: string;
    color_dark_mode: string;
  } | null;
  total_billing_amount?: number;
}

type SortField = 'work_order_num' | 'job_phase' | 'property_name' | 'unit_number' | 'unit_size' | 'job_type' | 'scheduled_date';
type SortDirection = 'asc' | 'desc';

export function SubcontractorJobHistory({ userId, userName }: SubcontractorJobHistoryProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'scheduled_date',
    direction: 'desc'
  });

  useEffect(() => {
    if (userId) {
      fetchJobHistory();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchJobHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          total_billing_amount,
          property:properties!inner(id, property_name),
          unit_size:unit_sizes!inner(unit_size_label),
          job_type:job_types!inner(job_type_label),
          job_phase:job_phases(job_phase_label, color_light_mode, color_dark_mode)
        `)
        .eq('assigned_to', userId)
        .order('scheduled_date', { ascending: false });

      if (fetchError) {
        console.error('Error fetching jobs:', fetchError);
        setError(fetchError.message);
        return;
      }

      // Transform the data to match our interface
      const transformedJobs: Job[] = (data || []).map((job: any) => ({
        id: job.id,
        work_order_num: job.work_order_num,
        property: Array.isArray(job.property) ? job.property[0] : job.property,
        unit_number: job.unit_number,
        unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
        job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
        scheduled_date: job.scheduled_date,
        job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase,
        total_billing_amount: job.total_billing_amount
      }));

      setJobs(transformedJobs);
    } catch (err) {
      console.error('Error fetching job history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load job history');
    } finally {
      setLoading(false);
    }
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDisplayDate(dateString);
    } catch (error) {
      return dateString;
    }
  };

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />;
    }
    return (
      <ArrowUpDown 
        className={`ml-1 h-4 w-4 ${sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-blue-600 rotate-180'}`} 
      />
    );
  };

  // Filter and sort jobs
  const filteredJobs = jobs.filter(job => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (job.property?.property_name || '').toLowerCase().includes(searchLower) ||
      (job.unit_number || '').toLowerCase().includes(searchLower) ||
      formatWorkOrderNumber(job.work_order_num).toLowerCase().includes(searchLower)
    );
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortConfig.field) {
      case 'work_order_num':
        aVal = a.work_order_num;
        bVal = b.work_order_num;
        break;
      case 'job_phase':
        aVal = a.job_phase?.job_phase_label || '';
        bVal = b.job_phase?.job_phase_label || '';
        break;
      case 'property_name':
        aVal = a.property?.property_name || '';
        bVal = b.property?.property_name || '';
        break;
      case 'unit_number':
        aVal = a.unit_number || '';
        bVal = b.unit_number || '';
        break;
      case 'unit_size':
        aVal = a.unit_size?.unit_size_label || '';
        bVal = b.unit_size?.unit_size_label || '';
        break;
      case 'job_type':
        aVal = a.job_type?.job_type_label || '';
        bVal = b.job_type?.job_type_label || '';
        break;
      case 'scheduled_date':
        // Use string comparison for YYYY-MM-DD dates - it's safe and timezone-free
        aVal = a.scheduled_date;
        bVal = b.scheduled_date;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading job history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Error loading job history: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Job History for {userName}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {jobs.length} total job{jobs.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by property, work order, or unit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-sm border border-gray-200 dark:border-[#2D3B4E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2D3B4E]">
            <thead className="bg-gray-50 dark:bg-[#0F172A]">
              <tr>
                <th scope="col" className="px-6 py-4 text-left w-24 sm:w-auto">
                  <button
                    onClick={() => handleSort('work_order_num')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Work Order #</span>
                    <SortIcon field="work_order_num" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-32 sm:w-auto">
                  <button
                    onClick={() => handleSort('job_phase')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Job Phase</span>
                    <SortIcon field="job_phase" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('property_name')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Property Name</span>
                    <SortIcon field="property_name" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-16 sm:w-auto">
                  <button
                    onClick={() => handleSort('unit_number')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Unit #</span>
                    <SortIcon field="unit_number" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-20 sm:w-auto">
                  <button
                    onClick={() => handleSort('unit_size')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Unit Size</span>
                    <SortIcon field="unit_size" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-20 sm:w-auto">
                  <button
                    onClick={() => handleSort('job_type')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Job Type</span>
                    <SortIcon field="job_type" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-left w-24 sm:w-auto">
                  <button
                    onClick={() => handleSort('scheduled_date')}
                    className="group inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-white"
                  >
                    <span className="text-xs sm:text-xs">Scheduled Date</span>
                    <SortIcon field="scheduled_date" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#2D3B4E]">
              {sortedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-600 dark:text-gray-400">
                      {searchTerm ? 'No jobs found matching your search' : 'No job history available'}
                    </p>
                  </td>
                </tr>
              ) : (
                sortedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/50 dark:hover:bg-[#2D3B4E]/30 transition-colors">
                    <td className="px-6 py-4 w-24 sm:w-auto">
                      <Link
                        to={`/dashboard/jobs/${job.id}`}
                        className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium text-xs sm:text-sm whitespace-nowrap"
                      >
                        {formatWorkOrderNumber(job.work_order_num)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 w-32 sm:w-auto">
                      {job.job_phase && (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: job.job_phase.color_dark_mode || '#4B5563',
                            color: 'white'
                          }}
                        >
                          {job.job_phase.job_phase_label}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {job.property ? (
                        <Link
                          to={`/dashboard/properties/${job.property.id}`}
                          className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-xs sm:text-sm"
                        >
                          {job.property.property_name}
                        </Link>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 w-16 sm:w-auto">
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                        {job.unit_number || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 w-20 sm:w-auto">
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                        {job.unit_size?.unit_size_label || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 w-20 sm:w-auto">
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                        {job.job_type?.job_type_label || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 w-24 sm:w-auto">
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                        {formatDate(job.scheduled_date)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with count */}
        {sortedJobs.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-[#0F172A] border-t border-gray-200 dark:border-[#2D3B4E]">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {sortedJobs.length} of {jobs.length} job{jobs.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
