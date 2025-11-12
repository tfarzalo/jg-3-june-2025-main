import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Users, 
  Clock, 
  CheckSquare, 
  ArrowRight, 
  X,
  Save,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from 'lucide-react';
import { supabase, getAvatarUrl, setupAvatarRefreshListener } from '../utils/supabase';
import { formatDate, formatDisplayDate, isSameDayInEastern } from '../lib/dateUtils';
import { toast } from 'sonner';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { isAvailableOnDate, WorkingDays } from '../lib/availabilityUtils';

interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  scheduled_date: string;
  property: {
    id: string;
    property_name: string;
  };
  unit_size: {
    id: string;
    unit_size_label: string;
  };
  job_phase: {
    id: string;
    job_phase_label: string;
    color_dark_mode: string;
  };
  job_type: {
    id: string;
    job_type_label: string;
  };
  assigned_to?: string | null;
  created_by: string;
}

interface Subcontractor {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  work_schedule?: string[] | null;
  working_days?: WorkingDays | null;
  assigned_jobs?: Job[];
}

export default function SubScheduler() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [jobsToUnassign, setJobsToUnassign] = useState<string[]>([]);
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Date filtering
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fetch jobs and subcontractors
  useEffect(() => {
    Promise.all([
      fetchJobs(),
      fetchSubcontractors()
    ]).finally(() => {
      setLoading(false);
    });
  }, [refreshKey]);

  // Filter jobs by date
  useEffect(() => {
    if (jobs.length === 0) {
      setFilteredJobs([]);
      return;
    }

    // Filter jobs by selected date
    const jobsForDate = jobs.filter(job => {
      return isSameDayInEastern(job.scheduled_date, selectedDate);
    });

    setFilteredJobs(jobsForDate);
  }, [jobs, selectedDate]);

  // Initialize assignments from existing data
  useEffect(() => {
    const initialAssignments: Record<string, string> = {};
    
    jobs.forEach(job => {
      if (job.assigned_to) {
        initialAssignments[job.id] = job.assigned_to;
      }
    });
    
    setAssignments(initialAssignments);
    setJobsToUnassign([]);
  }, [jobs]);

  // Listen for avatar updates to refresh subcontractor avatars
  useEffect(() => {
    const cleanup = setupAvatarRefreshListener((event) => {
      const { userId, avatarUrl } = event.detail;
      
      // Refresh subcontractors if the updated avatar belongs to one of them
      if (subcontractors.some(sub => sub.id === userId)) {
        console.log('Avatar updated for subcontractor, refreshing data...');
        setRefreshKey(prev => prev + 1);
      }
    });

    return cleanup;
  }, [subcontractors]);

  const fetchJobs = async () => {
    try {
      // Get job phases for Job Request, Work Order, and Pending Work Order
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .in('job_phase_label', ['Job Request', 'Work Order', 'Pending Work Order']);

      if (phaseError) throw phaseError;
      if (!phaseData || phaseData.length === 0) throw new Error('No active job phases found');

      // Fetch jobs in these phases
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          assigned_to,
          created_by,
          property:properties (
            id,
            property_name
          ),
          unit_size:unit_sizes (
            id,
            unit_size_label
          ),
          job_phase:current_phase_id (
            id,
            job_phase_label,
            color_dark_mode
          ),
          job_type:job_types (
            id,
            job_type_label
          )
        `)
        .in('current_phase_id', phaseData.map(p => p.id))
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setJobs((data || []).map(job => ({
        ...job,
        property: Array.isArray(job.property) ? job.property[0] : job.property,
        unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
        job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase,
        job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
      })));
      return data;
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      return [];
    }
  };

  const fetchSubcontractors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, work_schedule, working_days, phone, role')
        .eq('role', 'subcontractor')
        .order('full_name');

      if (error) throw error;
      
      // Initialize subcontractors with empty assigned_jobs arrays
      const subcontractorsWithJobs = (data || []).map(sub => ({
        ...sub,
        assigned_jobs: []
      }));
      
      setSubcontractors(subcontractorsWithJobs);
      return subcontractorsWithJobs;
    } catch (err) {
      console.error('Error fetching subcontractors:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subcontractors');
      return [];
    }
  };

  const handleDragStart = (job: Job) => {
    setDraggedJob(job);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (subcontractorId: string) => {
    if (!draggedJob) return;
    
    // If the job was previously assigned to a different subcontractor
    if (assignments[draggedJob.id] && assignments[draggedJob.id] !== subcontractorId) {
      // Remove from jobsToUnassign if it was there
      setJobsToUnassign(prev => prev.filter(id => id !== draggedJob.id));
    }
    
    // Update assignments
    setAssignments(prev => ({
      ...prev,
      [draggedJob.id]: subcontractorId
    }));
    
    setHasChanges(true);
    setDraggedJob(null);
  };

  const handleRemoveAssignment = (jobId: string) => {
    // Remove from assignments
    setAssignments(prev => {
      const newAssignments = { ...prev };
      delete newAssignments[jobId];
      return newAssignments;
    });
    
    // Add to jobsToUnassign if it was previously assigned in the database
    const job = jobs.find(j => j.id === jobId);
    if (job && job.assigned_to) {
      setJobsToUnassign(prev => [...prev, jobId]);
    }
    
    setHasChanges(true);
  };

  const handleSaveAssignments = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Prepare batch updates for assignments
      const updates = Object.entries(assignments).map(([jobId, subcontractorId]) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);
        
        return {
          id: jobId,
          property_id: job.property.id,
          unit_number: job.unit_number,
          unit_size_id: job.unit_size.id,
          job_type_id: job.job_type.id,
          scheduled_date: job.scheduled_date,
          created_by: job.created_by, // Include the created_by field from the original job
          assigned_to: subcontractorId
        };
      });
      
      // Prepare batch updates for unassignments
      const unassignments = jobsToUnassign.map(jobId => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);
        
        return {
          id: jobId,
          property_id: job.property.id,
          unit_number: job.unit_number,
          unit_size_id: job.unit_size.id,
          job_type_id: job.job_type.id,
          scheduled_date: job.scheduled_date,
          created_by: job.created_by,
          assigned_to: null // Explicitly set to null
        };
      });
      
      // Combine all updates
      const allUpdates = [...updates, ...unassignments];
      
      // Update jobs in batches of 10
      const batchSize = 10;
      for (let i = 0; i < allUpdates.length; i += batchSize) {
        const batch = allUpdates.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('jobs')
          .upsert(batch);
          
        if (error) throw error;
      }
      
      toast.success('Assignments saved successfully');
      setHasChanges(false);
      setJobsToUnassign([]);
      
      // Refresh data
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Error saving assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
      toast.error('Error saving assignments: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  // Get unassigned jobs (not in assignments and not in jobsToUnassign)
  const unassignedJobs = filteredJobs.filter(job => {
    // Include jobs that:
    // 1. Are not in the assignments object (not currently assigned)
    // 2. Are in jobsToUnassign (being explicitly unassigned)
    // 3. Have no assigned_to value in the database and are not being assigned
    return !assignments[job.id] || jobsToUnassign.includes(job.id);
  });

  // Get assigned jobs for each subcontractor
  const getAssignedJobs = (subcontractorId: string) => {
    return filteredJobs.filter(job => 
      // Only include jobs that:
      // 1. Are assigned to this subcontractor in the assignments object
      // 2. AND are not in the jobsToUnassign array
      assignments[job.id] === subcontractorId && !jobsToUnassign.includes(job.id)
    );
  };



  // Date navigation
  const goToNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const goToPreviousDay = () => {
    setSelectedDate(subDays(selectedDate, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const formatSelectedDate = () => {
    return formatInTimeZone(
      selectedDate,
      'America/New_York',
      'EEEE, MMMM d, yyyy'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] h-screen overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Calendar className="h-8 w-8 text-gray-600 dark:text-gray-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Sub Scheduler</h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors hover:bg-gray-300 dark:hover:bg-gray-600"
            disabled={saving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleSaveAssignments}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            disabled={!hasChanges || saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Confirm Schedule'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}



      {filteredJobs.length === 0 ? (
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Jobs Scheduled</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            There are no jobs scheduled for {selectedDate ? formatDisplayDate(selectedDate.toISOString()) : 'this date'}.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Previous Day
            </button>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Next Day
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)]">
          {/* Unassigned Jobs Column - Reduced width */}
          <div className="lg:w-1/3 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-[#2D3B4E] bg-gray-50 dark:bg-[#0F172A]">
              {/* First line: Unassigned Jobs heading and count */}
              <div className="flex items-center justify-center mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-blue-500" />
                  Unassigned Jobs
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full">
                    {unassignedJobs.length}
                  </span>
                </h2>
              </div>
              
              {/* Second line: Date navigation */}
              <div className="flex items-center justify-center space-x-2 w-full">
                <button
                  onClick={goToPreviousDay}
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-md hover:bg-gray-200 dark:hover:bg-[#1E293B]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <div className="relative">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm whitespace-nowrap"
                  >
                    <CalendarDays className="h-4 w-4 mr-1.5" />
                    <span className="font-medium">{formatSelectedDate()}</span>
                    <ChevronRight className="h-3 w-3 ml-1.5" />
                  </button>
                  
                  {showDatePicker && (
                    <div className="absolute mt-2 p-2 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-10 border border-gray-200 dark:border-[#2D3B4E] min-w-[250px] right-0">
                      <div className="p-2">
                        <input
                          type="date"
                          value={format(selectedDate, 'yyyy-MM-dd')}
                          onChange={(e) => {
                            if (e.target.value) {
                              setSelectedDate(parseISO(e.target.value));
                              setShowDatePicker(false);
                            }
                          }}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="mt-2 flex justify-between">
                        <button
                          onClick={() => {
                            goToToday();
                            setShowDatePicker(false);
                          }}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-3 py-1"
                        >
                          Today
                        </button>
                        <button
                          onClick={() => setShowDatePicker(false)}
                          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-3 py-1"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={goToNextDay}
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-md hover:bg-gray-200 dark:hover:bg-[#1E293B]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div 
              className="p-4 h-[calc(100vh-360px)] overflow-y-auto"
              onDragOver={handleDragOver}
            >
              {unassignedJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <CheckSquare className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>All jobs have been assigned</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unassignedJobs.map(job => (
                    <div 
                      key={job.id}
                      className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-3 border-l-4 cursor-grab"
                      style={{ borderLeftColor: job.job_phase?.color_dark_mode || '#4B5563' }}
                      draggable
                      onDragStart={() => handleDragStart(job)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatWorkOrderNumber(job.work_order_num)}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {job.property.property_name} - Unit {job.unit_number}
                          </p>
                          <div className="flex items-center mt-1">
                            <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1" />
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {formatDate(job.scheduled_date)}
                            </p>
                          </div>
                        </div>
                        <span 
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ 
                            backgroundColor: `${job.job_phase?.color_dark_mode || '#4B5563'}20`,
                            color: job.job_phase?.color_dark_mode || '#4B5563'
                          }}
                        >
                          {job.job_type.job_type_label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Subcontractors Grid - Increased width */}
          <div className="lg:w-2/3 overflow-y-auto">
            {subcontractors.length === 0 ? (
              <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Subcontractors Found</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  There are no subcontractors available for assignment. Add subcontractors with the 'subcontractor' role to get started.
                </p>
              </div>
            ) : (
              <div>
                {/* Available Subcontractors */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {subcontractors
                    .filter(subcontractor => isAvailableOnDate(subcontractor.working_days, selectedDate))
                    .map(subcontractor => {
                      const assignedJobs = getAssignedJobs(subcontractor.id);
                      
                      return (
                        <div 
                          key={subcontractor.id}
                          className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow-lg overflow-hidden h-[180px] flex flex-col border border-green-200 dark:border-green-700"
                        >
                          <div className="p-3 border-b border-green-200 dark:border-green-700 bg-green-100 dark:bg-green-800/30">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 mr-2">
                                {subcontractor.avatar_url ? (
                                  <img 
                                    src={getAvatarUrl(subcontractor.avatar_url)} 
                                    alt={subcontractor.full_name}
                                    className="h-8 w-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <span className="text-purple-800 dark:text-purple-300 font-medium">
                                      {subcontractor.full_name.charAt(0)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {subcontractor.full_name}
                                </h2>
                                <p className="text-xs text-green-600 dark:text-green-400 truncate">
                                  {assignedJobs.length} job{assignedJobs.length !== 1 ? 's' : ''} assigned
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Jobs Container - Drop Zone */}
                          <div 
                            className="p-2 flex-1 overflow-y-auto bg-green-50 dark:bg-green-900/10 border-2 border-dashed border-green-300 dark:border-green-600 rounded-lg m-2"
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(subcontractor.id)}
                          >
                            {assignedJobs.length === 0 ? (
                              <div className="text-center py-3">
                                <div className="text-green-500 dark:text-green-400 mb-1">
                                  <ArrowRight className="h-5 w-5 mx-auto" />
                                </div>
                                <p className="text-xs text-green-600 dark:text-green-500 font-medium">Drop jobs here</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {assignedJobs.map(job => (
                                  <div 
                                    key={job.id}
                                    className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-green-200 dark:border-green-600"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                          {formatWorkOrderNumber(job.work_order_num)}
                                        </h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                          {job.property.property_name} - Unit {job.unit_number}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleRemoveAssignment(job.id)}
                                        className="ml-1 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Unavailable Subcontractors */}
                {subcontractors.some(subcontractor => !isAvailableOnDate(subcontractor.working_days, selectedDate)) && (
                  <>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-8">
                      <div className="text-center">
                        <span className="bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 rounded-full">
                          Unavailable Subcontractors
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subcontractors
                        .filter(subcontractor => !isAvailableOnDate(subcontractor.working_days, selectedDate))
                        .map(subcontractor => (
                                                     <div 
                             key={subcontractor.id}
                             className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-lg overflow-hidden h-[100px] flex flex-col border border-red-200 dark:border-red-700 opacity-60"
                           >
                             {/* Subcontractor Header Only */}
                             <div className="p-2 bg-red-100 dark:bg-red-800/30">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 mr-2">
                                  {subcontractor.avatar_url ? (
                                    <img 
                                      src={getAvatarUrl(subcontractor.avatar_url)} 
                                      alt={subcontractor.full_name}
                                      className="h-8 w-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                      <span className="text-purple-800 dark:text-purple-300 font-medium">
                                        {subcontractor.full_name.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {subcontractor.full_name}
                                  </h2>
                                  <p className="text-xs text-red-600 dark:text-red-400 truncate">
                                    Not available
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}