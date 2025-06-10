import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  MapPin, 
  FileText, 
  Clock,
  Filter,
  Check,
  X,
  User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isToday,
  startOfWeek,
  addDays
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

interface Job {
  id: string;
  work_order_num: number;
  property: {
    property_name: string;
  };
  unit_number: string;
  description: string | null;
  scheduled_date: string;
  job_phase: {
    job_phase_label: string;
    color_dark_mode: string;
  };
  job_type: {
    job_type_label: string;
  };
  assigned_to: string | null;
  assigned_to_name: string | null;
}

interface JobPhase {
  id: string;
  job_phase_label: string;
  color_dark_mode: string;
}

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [phases, setPhases] = useState<JobPhase[]>([]);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [showPhaseFilter, setShowPhaseFilter] = useState(false);

  useEffect(() => {
    fetchPhases();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [currentDate, selectedPhases]);

  const fetchPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('job_phases')
        .select('id, job_phase_label, color_dark_mode')
        .order('sort_order');

      if (error) throw error;
      setPhases(data || []);
    } catch (err) {
      console.error('Error fetching job phases:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job phases');
    }
  };

  const fetchJobs = async () => {
    try {
      // Get phase IDs for Job Request, Work Order, and Pending Work Order
      // or use selected phases if any are selected
      let phaseIds: string[] = [];
      
      if (selectedPhases.length > 0) {
        // Filter by selected phases
        const { data: phaseData, error: phaseError } = await supabase
          .from('job_phases')
          .select('id')
          .in('job_phase_label', selectedPhases);

        if (phaseError) throw phaseError;
        phaseIds = phaseData.map(p => p.id);
      } else {
        // Default phases if none selected
        const { data: phaseData, error: phaseError } = await supabase
          .from('job_phases')
          .select('id')
          .in('job_phase_label', ['Job Request', 'Work Order', 'Pending Work Order']);

        if (phaseError) throw phaseError;
        phaseIds = phaseData.map(p => p.id);
      }

      // Get start and end of month in Eastern Time
      const start = formatInTimeZone(
        startOfMonth(currentDate),
        'America/New_York',
        "yyyy-MM-dd'T'00:00:00XXX"
      );
      
      const end = formatInTimeZone(
        endOfMonth(currentDate),
        'America/New_York',
        "yyyy-MM-dd'T'23:59:59XXX"
      );

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          property:properties (
            property_name
          ),
          unit_number,
          description,
          scheduled_date,
          job_phase:current_phase_id (
            job_phase_label,
            color_dark_mode
          ),
          job_type:job_types (
            job_type_label
          ),
          assigned_to,
          profiles:assigned_to (
            full_name
          )
        `)
        .in('current_phase_id', phaseIds)
        .gte('scheduled_date', start)
        .lte('scheduled_date', end);

      if (error) throw error;
      
      // Transform the data to include assigned_to_name
      const transformedJobs = data?.map(job => ({
        ...job,
        assigned_to_name: job.profiles?.full_name || null
      })) || [];
      
      setJobs(transformedJobs);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  // Get the days to display in the calendar grid
  const calendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    
    // Create a 6-week grid (42 days) to ensure we have enough rows
    // This will cover all possible month layouts
    const days = [];
    let day = startDate;
    
    for (let i = 0; i < 42; i++) {
      days.push(day);
      day = addDays(day, 1);
    }
    
    return days;
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const getJobsForDay = (date: Date) => {
    return jobs.filter(job => {
      // Parse the job date and convert to local date for comparison
      const jobDate = parseISO(job.scheduled_date);
      
      // Convert both dates to Eastern Time for comparison
      const jobDateEastern = formatInTimeZone(jobDate, 'America/New_York', 'yyyy-MM-dd');
      const calendarDateEastern = formatInTimeZone(date, 'America/New_York', 'yyyy-MM-dd');
      
      // Compare the dates in Eastern Time
      return jobDateEastern === calendarDateEastern;
    });
  };

  const formatJobDate = (dateString: string) => {
    return formatInTimeZone(
      parseISO(dateString),
      'America/New_York',
      'MMM d, yyyy'
    );
  };

  const togglePhase = (phaseLabel: string) => {
    setSelectedPhases(prev => {
      if (prev.includes(phaseLabel)) {
        return prev.filter(p => p !== phaseLabel);
      } else {
        return [...prev, phaseLabel];
      }
    });
  };

  const clearPhaseFilters = () => {
    setSelectedPhases([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <CalendarIcon className="h-8 w-8 text-gray-500 dark:text-gray-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Calendar</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-medium text-gray-900 dark:text-white">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Phase Filter */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPhaseFilter(!showPhaseFilter)}
              className="flex items-center px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter by Phase
            </button>
            
            {selectedPhases.length > 0 && (
              <button
                onClick={clearPhaseFilters}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Clear Filters
              </button>
            )}
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedPhases.length > 0 
              ? `Showing ${selectedPhases.length} phase${selectedPhases.length !== 1 ? 's' : ''}` 
              : 'Showing all phases'}
          </div>
        </div>
        
        {showPhaseFilter && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 shadow mb-4">
            <div className="flex flex-wrap gap-2">
              {phases.map(phase => (
                <button
                  key={phase.id}
                  onClick={() => togglePhase(phase.job_phase_label)}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedPhases.includes(phase.job_phase_label)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  <span 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: phase.color_dark_mode }}
                  ></span>
                  {phase.job_phase_label}
                  {selectedPhases.includes(phase.job_phase_label) ? (
                    <Check className="h-4 w-4 ml-2" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Active filters display */}
        {selectedPhases.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedPhases.map(phase => {
              const phaseObj = phases.find(p => p.job_phase_label === phase);
              return (
                <div 
                  key={phase}
                  className="flex items-center px-2 py-1 rounded-full text-xs"
                  style={{ 
                    backgroundColor: `${phaseObj?.color_dark_mode}20`,
                    color: phaseObj?.color_dark_mode || '#4B5563'
                  }}
                >
                  <span 
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: phaseObj?.color_dark_mode }}
                  ></span>
                  {phase}
                  <button
                    onClick={() => togglePhase(phase)}
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-[#1E293B] rounded-lg overflow-hidden shadow">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-[#2D3B4E]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-white dark:bg-[#1E293B] px-4 py-3 text-center">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{day}</span>
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-[#2D3B4E]">
          {calendarDays().map((date, i) => {
            const dayJobs = getJobsForDay(date);
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isTodays = isToday(date);

            return (
              <div
                key={i}
                className={`bg-white dark:bg-[#1E293B] min-h-[120px] p-2 ${
                  !isCurrentMonth ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${
                    isTodays 
                      ? 'text-blue-500' 
                      : 'text-gray-700 dark:text-gray-400'
                  }`}>
                    {format(date, 'd')}
                  </span>
                  {dayJobs.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[80px]">
                  {dayJobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="w-full text-left p-1 rounded text-xs hover:bg-gray-100 dark:hover:bg-[#2D3B4E] transition-colors"
                      style={{ backgroundColor: `${job.job_phase.color_dark_mode}20` }}
                    >
                      <div className="font-medium text-gray-900 dark:text-white truncate flex items-center">
                        <span 
                          className="w-2 h-2 rounded-full mr-1 flex-shrink-0"
                          style={{ backgroundColor: job.job_phase.color_dark_mode }}
                        ></span>
                        {formatWorkOrderNumber(job.work_order_num)}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 truncate">
                        {job.property.property_name}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Unit #{job.unit_number}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-lg w-full shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatWorkOrderNumber(selectedJob.work_order_num)}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {selectedJob.property.property_name} • Unit #{selectedJob.unit_number}
                </p>
              </div>
              <span
                className="text-sm px-2 py-1 rounded"
                style={{ 
                  backgroundColor: selectedJob.job_phase.color_dark_mode,
                  color: 'white'
                }}
              >
                {selectedJob.job_phase.job_phase_label}
              </span>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Job Type
                </label>
                <p className="text-gray-900 dark:text-white">{selectedJob.job_type.job_type_label}</p>
              </div>
              
              {selectedJob.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                    Description
                  </label>
                  <p className="text-gray-900 dark:text-white">{selectedJob.description}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Scheduled Date
                </label>
                <p className="text-gray-900 dark:text-white flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-gray-400" />
                  {formatJobDate(selectedJob.scheduled_date)}
                </p>
              </div>
              
              {selectedJob.assigned_to && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                    Assigned To
                  </label>
                  <p className="text-gray-900 dark:text-white flex items-center">
                    <User className="h-4 w-4 mr-2 text-blue-500" />
                    {selectedJob.assigned_to_name || 'Unknown Subcontractor'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Close
              </button>
              <Link
                to={`/dashboard/jobs/${selectedJob.id}`}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                View Job Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}