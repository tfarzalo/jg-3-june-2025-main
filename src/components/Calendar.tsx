import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  Filter,
  Check,
  X,
  User
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { 
  startOfMonth, 
  endOfMonth,
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
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';
import { SubcontractorLink } from './shared/SubcontractorLink';
// [CAL_EVENTS] imports
import EventModal from './calendar/EventModal';
import EventDetailsModal from './calendar/EventDetailsModal';
import SubscribeCalendarsModal from './calendar/SubscribeCalendarsModal';

import { listCalendarEvents } from '../services/calendarEvents';
import type { CalendarEvent } from '../types/calendar';
import { useUserRole } from '../contexts/UserRoleContext';
import { getRecurringEventsForDay } from '../utils/recurringEvents';

interface Job {
  id: string;
  work_order_num: number;
  property: {
    id: string;
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

// Default job phases to display on calendar
const DEFAULT_CALENDAR_PHASES = ['Job Request', 'Work Order', 'Pending Work Order'];

export function Calendar() {
  // Initialize with Eastern Time Zone
  const getEasternDate = () => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  };
  
  const [currentDate, setCurrentDate] = useState(getEasternDate());
  const [selectedDate, setSelectedDate] = useState(getEasternDate()); // New state for selected date
  const [showDayPopup, setShowDayPopup] = useState(false); // State for day popup visibility
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]); // All jobs for agenda totals
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [phases, setPhases] = useState<JobPhase[]>([]);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [showPhaseFilter, setShowPhaseFilter] = useState(false);
  // [CAL_EVENTS] local state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const { role } = useUserRole?.() || { role: "user" }; // adjust to your context
  const canCreateEvents = ["admin","jg_management","is_super_admin"].includes(role);

  // Event handlers
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
  };

  const handleEventUpdated = (updatedEvent: CalendarEvent) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    setShowEventDetails(false);
    setSelectedEvent(null);
  };

  const handleEventDeleted = (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setShowEventDetails(false);
    setSelectedEvent(null);
  };

  // Function to calculate job type totals for a specific date (using dashboard logic)
  const getJobTypeTotalsForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    
    // Filter jobs for the specific date (allJobs already excludes Cancelled and Archived)
    const dateJobs = allJobs.filter(job => 
      job.scheduled_date.startsWith(dateString)
    );
    
    // Calculate totals using the same logic as the dashboard
    const paintCount = dateJobs.filter(job => {
      const jobTypeObj = Array.isArray(job.job_type) && job.job_type.length > 0 
        ? job.job_type[0] 
        : (job.job_type as any);
      return jobTypeObj?.job_type_label === 'Paint';
    }).length;
    
    const callbackCount = dateJobs.filter(job => {
      const jobTypeObj = Array.isArray(job.job_type) && job.job_type.length > 0 
        ? job.job_type[0] 
        : (job.job_type as any);
      return jobTypeObj?.job_type_label === 'Callback';
    }).length;
    
    const repairCount = dateJobs.filter(job => {
      const jobTypeObj = Array.isArray(job.job_type) && job.job_type.length > 0 
        ? job.job_type[0] 
        : (job.job_type as any);
      return jobTypeObj?.job_type_label === 'Repair';
    }).length;
    
    const totalCount = paintCount + callbackCount + repairCount;
    
    return { paint: paintCount, callback: callbackCount, repair: repairCount, total: totalCount };
  };

  // Manual refresh function for daily agenda totals
  const refreshDailyAgendaTotals = async () => {
    try {
      // Refresh jobs data to get updated totals
      await fetchJobs();
      console.log('Daily agenda totals refreshed manually');
    } catch (error) {
      console.error('Error refreshing daily agenda totals:', error);
    }
  };

  useEffect(() => {
    fetchPhases();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [currentDate, selectedPhases]);

  // Update daily agenda events when jobs are loaded
  useEffect(() => {
    if (jobs.length > 0) {
      updateDailyAgendaEvents();
    }
  }, [jobs]);

  // Clean up agenda events when switching months
  useEffect(() => {
    // When month changes, ensure we clean up any orphaned agenda events
    const cleanupOrphanedEvents = async () => {
      try {
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

        // Get all agenda summary events for the current month
        const { data: existingEvents, error } = await supabase
          .from('calendar_events')
          .select('id, start_at, title')
          .like('title', '%Paint%Callback%Repair%')
          .gte('start_at', start)
          .lt('start_at', new Date(new Date(end).getTime() + 24*60*60*1000).toISOString());

        if (!error && existingEvents) {
          // Check each event to see if it still has corresponding jobs
          for (const event of existingEvents) {
            const eventDate = event.start_at.split('T')[0];
            
            // Check if there are any jobs on this date
            const hasJobsOnDate = jobs.some(job => 
              job.scheduled_date.startsWith(eventDate)
            );

            if (!hasJobsOnDate) {
              // Remove orphaned agenda event
              await supabase
                .from('calendar_events')
                .delete()
                .eq('id', event.id);
              
              console.log(`Cleaned up orphaned agenda event for ${eventDate}`);
            }
          }
        }
      } catch (error) {
        console.error('Error cleaning up orphaned events:', error);
      }
    };

    // Run cleanup when month changes
    cleanupOrphanedEvents();
  }, [currentDate]);

  // [CAL_EVENTS] Data fetch for calendar events
  useEffect(() => {
    let active = true;
    async function loadEvents() {
      try {
        const startISO = formatInTimeZone(
          startOfMonth(currentDate),
          'America/New_York',
          "yyyy-MM-dd'T'00:00:00XXX"
        );
        const endISO = formatInTimeZone(
          endOfMonth(currentDate),
          'America/New_York',
          "yyyy-MM-dd'T'23:59:59XXX"
        );
        const evts = await listCalendarEvents(startISO, endISO);
        if (active) setEvents(evts);
      } catch (e) {
        console.error("Failed to load calendar events", e);
      }
    }
    loadEvents();
    return () => { active = false; }
  }, [currentDate]);

  // Real-time subscriptions
  useEffect(() => {
    // Subscribe to job changes
    const jobSubscription = supabase
      .channel('calendar_jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, async (payload) => {
        console.log('Calendar: Job change detected, refreshing...');
        await fetchJobs();
        
        // Update daily agenda summary events when jobs change
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          await updateDailyAgendaEvents();
        }
      })
      .subscribe();

    // Subscribe to work order changes
    const workOrderSubscription = supabase
      .channel('calendar_work_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, async (payload) => {
        console.log('Calendar: Work order change detected, refreshing...');
        await fetchJobs();
        
        // Update daily agenda summary events when work orders change
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          await updateDailyAgendaEvents();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(jobSubscription);
      supabase.removeChannel(workOrderSubscription);
    };
  }, [currentDate, selectedPhases]);

  // [CAL_EVENTS] Realtime subscription for calendar events
  useEffect(() => {
    const channel = supabase.channel("calendar_events_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, (payload) => {
        // naive refresh; optimize later
        const startISO = formatInTimeZone(
          startOfMonth(currentDate),
          'America/New_York',
          "yyyy-MM-dd'T'00:00:00XXX"
        );
        const endISO = formatInTimeZone(
          endOfMonth(currentDate),
          'America/New_York',
          "yyyy-MM-dd'T'23:59:59XXX"
        );
        listCalendarEvents(startISO, endISO).then(setEvents).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentDate]);

  const fetchPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('job_phases')
        .select('id, job_phase_label, color_dark_mode')
        .neq('job_phase_label', 'Grading')
        .order('sort_order');

      if (error) throw error;
      
      // Add Events as a virtual phase
      const eventsPhase = {
        id: 'events-virtual',
        job_phase_label: 'Events',
        color_dark_mode: '#3b82f6' // Blue color for events
      };
      
      setPhases([eventsPhase, ...(data || [])]);
      
      // Set default selected phases to Job Request, Work Order, Pending Work Order, and Events
      setSelectedPhases([...DEFAULT_CALENDAR_PHASES, 'Events']);
    } catch (err) {
      console.error('Error fetching job phases:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job phases');
    }
  };

  // Function to update daily agenda summary events based on current job counts
  const updateDailyAgendaEvents = async () => {
    try {
      // Get the current month's date range
      // Use simple YYYY-MM-DD format for DATE column comparison
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      const start = formatInTimeZone(monthStart, 'America/New_York', 'yyyy-MM-dd');
      const end = formatInTimeZone(monthEnd, 'America/New_York', 'yyyy-MM-dd');
      
      console.log('Querying jobs for date range:', { start, end, currentDate: currentDate.toISOString() });

      // Get phase IDs for default filtering (Job Request, Work Order, Pending Work Order)
      let phaseIds: string[] = [];
      
      if (selectedPhases.length > 0) {
        // Filter out 'Events' as it's a virtual phase, not a real job_phase
        const jobPhases = selectedPhases.filter(phase => phase !== 'Events');
        
        if (jobPhases.length > 0) {
          // Filter by selected phases
          const { data: phaseData, error: phaseError } = await supabase
            .from('job_phases')
            .select('id')
            .in('job_phase_label', jobPhases);

          if (phaseError) throw phaseError;
          phaseIds = phaseData.map(p => p.id);
        } else {
          // If only Events is selected, use default phases for agenda
          const { data: phaseData, error: phaseError } = await supabase
            .from('job_phases')
            .select('id')
            .in('job_phase_label', DEFAULT_CALENDAR_PHASES);

          if (phaseError) throw phaseError;
          phaseIds = phaseData.map(p => p.id);
        }
      } else {
        // Default phases if none selected - only Job Request, Work Order, and Pending Work Order
        const { data: phaseData, error: phaseError } = await supabase
          .from('job_phases')
          .select('id')
          .in('job_phase_label', DEFAULT_CALENDAR_PHASES);

        if (phaseError) throw phaseError;
        phaseIds = phaseData.map(p => p.id);
      }

      // Get all jobs for the current month with job type information
      const { data: monthJobs, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          scheduled_date, 
          current_phase_id,
          job_type:job_types (
            job_type_label
          )
        `)
        .gte('scheduled_date', start)
        .lte('scheduled_date', end)
        .in('current_phase_id', phaseIds);

      if (jobsError) throw jobsError;

      console.log('Month jobs found:', monthJobs?.length || 0);
      console.log('Sample jobs with types:', monthJobs?.slice(0, 3));

      // Group jobs by date and count by type
      const jobsByDate = new Map<string, { paint: number; callback: number; repair: number }>();
      
      monthJobs?.forEach(job => {
        const date = job.scheduled_date.split('T')[0]; // Get just the date part
        
        // Get the job type label from the joined data
        const jobTypeLabel = Array.isArray(job.job_type) && job.job_type.length > 0 
          ? job.job_type[0].job_type_label 
          : 'Unknown';
        
        console.log(`Processing job:`, job);
        console.log(`Job scheduled_date: ${job.scheduled_date}`);
        console.log(`Job type data:`, job.job_type);
        console.log(`Extracted job type label: "${jobTypeLabel}"`);
        
        if (!jobsByDate.has(date)) {
          jobsByDate.set(date, { paint: 0, callback: 0, repair: 0 });
        }
        
        const counts = jobsByDate.get(date)!;
        
        // Categorize based on job type (Paint, Callback, Repair)
        const jobType = jobTypeLabel.toLowerCase();
        if (jobType.includes('paint')) {
          counts.paint++;
        } else if (jobType.includes('callback')) {
          counts.callback++;
        } else if (jobType.includes('repair')) {
          counts.repair++;
        } else {
          // Default to paint for any other job types
          counts.paint++;
        }
        
        console.log(`Job on ${date}: job type "${jobTypeLabel}" categorized as paint:${counts.paint}, callback:${counts.callback}, repair:${counts.repair}`);
      });
      
      console.log('Final jobsByDate map:', jobsByDate);

      // Update or create daily agenda summary events for each date
      for (const [date, counts] of jobsByDate) {
        const totalJobs = counts.paint + counts.callback + counts.repair;
        
        // Skip dates with no jobs
        if (totalJobs === 0) continue;

        const startTime = new Date(`${date}T00:00:00`);
        const endTime = new Date(`${date}T23:59:59`);
        
        const title = `${counts.paint} Paint | ${counts.callback} Callback | ${counts.repair} Repair | Total: ${totalJobs}`;
        const details = `Paint: ${counts.paint} | Callback: ${counts.callback} | Repair: ${counts.repair} | Total: ${totalJobs}`;

        // Check if agenda summary event already exists for this date
        const { data: existingEvent } = await supabase
          .from('calendar_events')
          .select('id')
          .like('title', '%Paint%Callback%Repair%')
          .gte('start_at', startTime.toISOString())
          .lt('start_at', new Date(endTime.getTime() + 24*60*60*1000).toISOString())
          .maybeSingle();

        if (existingEvent) {
          // Update existing event
          await supabase
            .from('calendar_events')
            .update({
              title,
              details,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingEvent.id);
        } else {
          // Create new event (using system user)
          await supabase
            .from('calendar_events')
            .insert({
              title,
              details,
              color: '#3b82f6',
              is_all_day: true,
              start_at: startTime.toISOString(),
              end_at: endTime.toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              created_by: '00000000-0000-0000-0000-000000000000' // System user ID
            });
        }
      }

      // Clean up agenda summary events for dates that no longer have jobs
      // Get all existing agenda summary events for the current month
      // Create timestamps in Eastern timezone for calendar_events query
      // Use parseISO with the YYYY-MM-DD string and set time in ET, then format as ISO
      const startDate = parseISO(start); // Parse as date-only
      const endDate = parseISO(end);     // Parse as date-only
      
      // Format with timezone for timestamp comparison
      const startTimestamp = formatInTimeZone(
        new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0),
        'America/New_York',
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      );
      const endTimestamp = formatInTimeZone(
        new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59),
        'America/New_York',
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      );
      
      const { data: existingAgendaEvents, error: cleanupError } = await supabase
        .from('calendar_events')
        .select('id, start_at, title')
        .like('title', '%Paint%Callback%Repair%')
        .gte('start_at', startTimestamp)
        .lte('start_at', endTimestamp);

      if (!cleanupError && existingAgendaEvents) {
        for (const event of existingAgendaEvents) {
          const eventDate = event.start_at.split('T')[0];
          
          // Check if this date still has jobs
          if (!jobsByDate.has(eventDate)) {
            // No jobs on this date, remove the agenda summary event
            await supabase
              .from('calendar_events')
              .delete()
              .eq('id', event.id);
            
            console.log(`Removed agenda summary event for ${eventDate} - no jobs scheduled`);
          }
        }
      }

      // Refresh events to show updated counts
      const startISO = formatInTimeZone(
        startOfMonth(currentDate),
        'America/New_York',
        "yyyy-MM-dd'T'00:00:00XXX"
      );
      const endISO = formatInTimeZone(
        endOfMonth(currentDate),
        'America/New_York',
        "yyyy-MM-dd'T'23:59:59XXX"
      );
      const evts = await listCalendarEvents(startISO, endISO);
      setEvents(evts);

    } catch (error) {
      console.error('Error updating daily agenda events:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      // Get phase IDs for Job Request, Work Order, and Pending Work Order
      // or use selected phases if any are selected
      let phaseIds: string[] = [];
      
      if (selectedPhases.length > 0) {
        // Filter out 'Events' as it's a virtual phase, not a real job_phase
        const jobPhases = selectedPhases.filter(phase => phase !== 'Events');
        
        if (jobPhases.length > 0) {
          // Filter by selected phases
          const { data: phaseData, error: phaseError } = await supabase
            .from('job_phases')
            .select('id')
            .in('job_phase_label', jobPhases);

          if (phaseError) throw phaseError;
          phaseIds = phaseData.map(p => p.id);
        } else {
          // If only 'Events' is selected (no job phases), use default phases
          // This ensures jobs are still displayed on the calendar
          const { data: phaseData, error: phaseError } = await supabase
            .from('job_phases')
            .select('id')
            .in('job_phase_label', DEFAULT_CALENDAR_PHASES);

          if (phaseError) throw phaseError;
          phaseIds = phaseData.map(p => p.id);
        }
      } else {
        // Default phases if none selected - Job Request, Work Order, Pending Work Order, and Events
        const { data: phaseData, error: phaseError } = await supabase
          .from('job_phases')
          .select('id')
          .in('job_phase_label', DEFAULT_CALENDAR_PHASES);

        if (phaseError) throw phaseError;
        phaseIds = phaseData.map(p => p.id);
      }

      // Also fetch ALL jobs for agenda totals (excluding only Cancelled and Archived)
      const { data: allPhaseData, error: allPhaseError } = await supabase
        .from('job_phases')
        .select('id')
        .not('job_phase_label', 'eq', 'Cancelled')
        .not('job_phase_label', 'eq', 'Archived');

      if (allPhaseError) throw allPhaseError;
      const allPhaseIds = allPhaseData.map(p => p.id);

      // Get start and end of month in Eastern Time
      // Use simple YYYY-MM-DD format for DATE column comparison
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      const start = formatInTimeZone(monthStart, 'America/New_York', 'yyyy-MM-dd');
      const end = formatInTimeZone(monthEnd, 'America/New_York', 'yyyy-MM-dd');

      // Fetch filtered jobs for display (only if we have phases to filter by)
      let filteredJobs = null;
      let filteredError = null;
      
      if (phaseIds.length > 0) {
        const result = await supabase
          .from('jobs')
          .select(`
            id,
            work_order_num,
            property:properties (
              id,
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
        
        filteredJobs = result.data;
        filteredError = result.error;
      }

      // Fetch ALL jobs for agenda totals (excluding only Cancelled and Archived)
      const { data: allJobs, error: allJobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          property:properties (
            id,
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
        .in('current_phase_id', allPhaseIds)
        .gte('scheduled_date', start)
        .lte('scheduled_date', end);

      if (filteredError) throw filteredError;
      if (allJobsError) throw allJobsError;
      
      // Transform the filtered jobs for display
      const transformedJobs = filteredJobs?.map(job => {
        const transformedJob = {
          id: job.id,
          work_order_num: job.work_order_num,
          unit_number: job.unit_number,
          description: job.description,
          scheduled_date: job.scheduled_date,
          assigned_to: job.assigned_to,
          property: Array.isArray(job.property) && job.property.length > 0 
            ? job.property[0] 
            : (job.property as unknown as { id: string; property_name: string }) || { id: 'unknown', property_name: 'Unknown Property' },
          job_phase: Array.isArray(job.job_phase) && job.job_phase.length > 0 
            ? job.job_phase[0] 
            : (job.job_phase as unknown as { job_phase_label: string; color_dark_mode: string }) || { job_phase_label: 'Unknown', color_dark_mode: '#6B7280' },
          job_type: Array.isArray(job.job_type) && job.job_type.length > 0 
            ? job.job_type[0] 
            : (job.job_type as unknown as { job_type_label: string }) || { job_type_label: 'Unknown' },
          assigned_to_name: Array.isArray(job.profiles) && job.profiles.length > 0 
            ? job.profiles[0]?.full_name || null
            : (job.profiles as any)?.full_name || null
        };
        return transformedJob;
      }) || [];
      
      // Transform all jobs for agenda totals
      const transformedAllJobs = allJobs?.map(job => {
        const transformedJob = {
          id: job.id,
          work_order_num: job.work_order_num,
          unit_number: job.unit_number,
          description: job.description,
          scheduled_date: job.scheduled_date,
          assigned_to: job.assigned_to,
          property: Array.isArray(job.property) && job.property.length > 0 
            ? job.property[0] 
            : (job.property as unknown as { id: string; property_name: string }) || { id: 'unknown', property_name: 'Unknown Property' },
          job_phase: Array.isArray(job.job_phase) && job.job_phase.length > 0 
            ? job.job_phase[0] 
            : (job.job_phase as unknown as { job_phase_label: string; color_dark_mode: string }) || { job_phase_label: 'Unknown', color_dark_mode: '#6B7280' },
          job_type: Array.isArray(job.job_type) && job.job_type.length > 0 
            ? job.job_type[0] 
            : (job.job_type as unknown as { job_type_label: string }) || { job_type_label: 'Unknown' },
          assigned_to_name: Array.isArray(job.profiles) && job.profiles.length > 0 
            ? job.profiles[0]?.full_name || null
            : (job.profiles as any)?.full_name || null
        };
        return transformedJob;
      }) || [];

      setJobs(transformedJobs);
      setAllJobs(transformedAllJobs);
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
    // If only Events phase is selected, hide jobs
    if (selectedPhases.length === 1 && selectedPhases.includes('Events')) {
      return [];
    }
    
    return jobs.filter(job => {
      // job.scheduled_date is already a YYYY-MM-DD string in the database
      // Convert the calendar Date to YYYY-MM-DD in Eastern Time for comparison
      const calendarDateEastern = formatInTimeZone(date, 'America/New_York', 'yyyy-MM-dd');
      
      // Simple string comparison - no need to parse job.scheduled_date as Date
      return job.scheduled_date === calendarDateEastern;
    });
  };

  // [CAL_EVENTS] Get events for a specific day
  const getEventsForDay = (date: Date) => {
    // If Events phase is not selected and other phases are selected, hide events
    if (selectedPhases.length > 0 && !selectedPhases.includes('Events')) {
      return [];
    }
    
    const calendarDate = formatInTimeZone(date, 'America/New_York', 'yyyy-MM-dd');
    const allEvents: CalendarEvent[] = [];
    
    // Process all events
    events.forEach(event => {
      // Skip recurring instances (they're handled by recurring logic)
      if (event.parent_event_id) {
        return;
      }
      
      const eventStart = parseISO(event.start_at);
      const eventEnd = parseISO(event.end_at);
      const eventStartDate = formatInTimeZone(eventStart, 'America/New_York', 'yyyy-MM-dd');
      const eventEndDate = formatInTimeZone(eventEnd, 'America/New_York', 'yyyy-MM-dd');
      
      // Check if this is a recurring event
      if (event.is_recurring && event.recurrence_type) {
        // For recurring events, check if the current date matches the recurrence pattern
        const recurringEvents = getRecurringEventsForDay([event], date, 'America/New_York');
        allEvents.push(...recurringEvents);
      } else {
        // For regular events, check if the date matches
        let shouldInclude = false;
        
        if (event.is_all_day) {
          shouldInclude = calendarDate >= eventStartDate && calendarDate < eventEndDate;
        } else {
          shouldInclude = eventStartDate === calendarDate;
        }
        
        if (shouldInclude) {
          allEvents.push(event);
        }
      }
    });
    
    return allEvents;
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
    <div className="p-3 lg:p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 lg:mb-8 space-y-4 lg:space-y-0">
        <div className="flex items-center space-x-3">
          <CalendarIcon className="h-6 w-6 lg:h-8 lg:w-8 text-gray-500 dark:text-gray-400" />
          <h1 className="text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white">Calendar</h1>
        </div>
        <div className="flex items-center justify-between lg:justify-center space-x-2 lg:space-x-4">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base lg:text-xl font-medium text-gray-900 dark:text-white">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              const today = getEasternDate();
              setCurrentDate(today);
              setSelectedDate(today);
            }}
            className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            Today
          </button>
        </div>
        {/* [CAL_EVENTS] create button, only for admins/mgmt */}
        <div className="flex items-center space-x-2">
          <EventModal canCreate={canCreateEvents} onCreated={(evt) => setEvents(prev => [evt, ...prev])} />
          <SubscribeCalendarsModal />
        </div>
      </div>

      {/* Phase Filter */}
      <div className="mb-4 lg:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 space-y-2 lg:space-y-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPhaseFilter(!showPhaseFilter)}
              className="flex items-center px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors text-sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Filter by Phase & Events</span>
              <span className="sm:hidden">Filter</span>
            </button>
            
            <button
              onClick={refreshDailyAgendaTotals}
              className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
              title="Refresh daily agenda totals"
            >
              🔄
            </button>
            
            {selectedPhases.length > 0 && (
              <button
                onClick={clearPhaseFilters}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Clear
              </button>
            )}
          </div>
          
          <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">
            {selectedPhases.length > 0 
              ? `${selectedPhases.length} filter${selectedPhases.length !== 1 ? 's' : ''}` 
              : 'Showing default'}
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

      {/* Two-column layout on desktop, single column on mobile */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar Column */}
        <div className="flex-1 lg:flex-[2]">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg overflow-hidden shadow">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-[#2D3B4E]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                <div key={day} className="bg-white dark:bg-[#1E293B] px-1 lg:px-4 py-2 lg:py-3 text-center">
                  <span className="text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-400">
                    {/* Show full day name on desktop, abbreviation on mobile */}
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.charAt(0)}</span>
                  </span>
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-[#2D3B4E]">
              {calendarDays().map((date, i) => {
                const dayJobs = getJobsForDay(date);
                const dayEvents = getEventsForDay(date);
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isTodays = isToday(date);
                const isSelected = isSameDay(date, selectedDate);

                return (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedDate(date);
                      // On mobile, clicking a date should open the day popup
                      if (window.innerWidth < 1024) { // lg breakpoint
                        setShowDayPopup(true);
                      }
                    }}
                    className={`cursor-pointer min-h-[80px] lg:min-h-[120px] p-1 lg:p-2 transition-colors ${
                      !isCurrentMonth 
                        ? 'opacity-50 bg-white dark:bg-[#1E293B]' 
                        : isTodays 
                          ? 'bg-blue-50 dark:bg-blue-900/20' 
                          : isSelected
                            ? 'bg-blue-25 dark:bg-blue-900/10'
                            : 'bg-white dark:bg-[#1E293B] hover:bg-gray-50 dark:hover:bg-[#2D3B4E]'
                    }`}
                  >
                                        <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs lg:text-sm font-medium ${
                        isTodays 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : isSelected
                            ? 'text-blue-500 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-400'
                      }`}>
                        {format(date, 'd')}
                      </span>
                      
                      {/* Daily Agenda Summary Numbers - Only show on desktop if there are jobs scheduled */}
                      <div className="hidden lg:block">
                        {dayJobs.length > 0 && (() => {
                          const totals = getJobTypeTotalsForDate(date);
                          if (totals.total > 0) {
                            return (
                              <div 
                                className="text-xs font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 rounded transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDate(date);
                                  setShowDayPopup(true);
                                }}
                              >
                                <span className="text-blue-600 dark:text-blue-400">{totals.paint}</span>
                                <span className="text-orange-500 dark:text-orange-400"> {totals.callback}</span>
                                <span className="text-red-500 dark:text-red-400"> {totals.repair}</span>
                                <span className="text-purple-700 dark:text-purple-400"> | {totals.total}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                                          <div className="space-y-1 overflow-y-auto max-h-[80px]">
                        {/* Desktop view: Show full event/job cards */}
                        <div className="hidden lg:block space-y-1">
                          {/* Render events first if Event Filter is visible */}
                          {selectedPhases.includes('Events') && dayEvents.slice(0, 4).map(event => (
                            <button
                              key={`event-${event.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event);
                              }}
                              className="w-full text-left p-1 rounded text-xs hover:bg-gray-100 dark:hover:bg-[#2D3B4E] transition-colors"
                              style={{ backgroundColor: `${event.color}20` }}
                            >
                              <div className="font-medium text-gray-900 dark:text-white truncate flex items-center">
                                <span 
                                  className="w-2 h-2 rounded-full mr-1 flex-shrink-0"
                                  style={{ backgroundColor: event.color }}
                                ></span>
                                <span className="truncate">{event.title}</span>
                              </div>
                              <div className="text-gray-600 dark:text-gray-400 truncate text-xs">
                                Event
                              </div>
                            </button>
                          ))}
                          
                          {/* Render jobs */}
                          {dayJobs.slice(0, selectedPhases.includes('Events') ? 4 : 8).map(job => (
                          <button
                            key={job.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJob(job);
                            }}
                            className="w-full text-left p-1 rounded text-xs hover:bg-gray-100 dark:hover:bg-[#2D3B4E] transition-colors"
                            style={{ backgroundColor: `${job.job_phase.color_dark_mode}20` }}
                          >
                            <div className="font-medium text-gray-900 dark:text-white truncate flex items-center">
                              <span 
                                className="w-2 h-2 rounded-full mr-1 flex-shrink-0"
                                style={{ backgroundColor: job.job_phase.color_dark_mode }}
                              ></span>
                              <WorkOrderLink 
                                jobId={job.id}
                                workOrderNum={job.work_order_num}
                              />
                            </div>
                            <div className="text-gray-600 dark:text-gray-400 truncate">
                              <PropertyLink 
                                propertyId={job.property.id}
                                propertyName={job.property.property_name}
                              />
                            </div>
                          </button>
                        ))}
                        
                        {/* Show remaining count */}
                        {(dayJobs.length + dayEvents.length) > 8 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            +{(dayJobs.length + dayEvents.length) - 8} more
                          </div>
                        )}
                        </div>
                        
                        {/* Mobile view: Show colored dots */}
                        <div className="lg:hidden flex flex-wrap gap-1 mt-1">
                          {/* Show dots for events */}
                          {selectedPhases.includes('Events') && dayEvents.map((event, idx) => (
                            <div
                              key={`dot-event-${event.id}-${idx}`}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: event.color }}
                              title={event.title}
                            />
                          ))}
                          
                          {/* Show dots for jobs */}
                          {dayJobs.map((job, idx) => (
                            <div
                              key={`dot-job-${job.id}-${idx}`}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: job.job_phase.color_dark_mode }}
                              title={`WO-${job.work_order_num}`}
                            />
                          ))}
                        </div>
                      </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Day Agenda Column - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:block lg:w-80">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow h-fit">
            <div className="p-4 border-b border-gray-200 dark:border-[#2D3B4E]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
                {isToday(selectedDate) 
                  ? "Today's Agenda" 
                  : format(selectedDate, 'MMM d, yyyy')
                }
              </h3>

            </div>
            
            <div className="p-4">
              {/* Daily Agenda Summary Header - Locked to top */}
              {(() => {
                const totals = getJobTypeTotalsForDate(selectedDate);
                if (totals.total > 0) {
                  return (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4 sticky top-0 z-10">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totals.paint}</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Paint</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-500 dark:text-orange-400">{totals.callback}</div>
                          <div className="text-xs text-orange-500 dark:text-orange-400">Callback</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-500 dark:text-red-400">{totals.repair}</div>
                          <div className="text-xs text-red-500 dark:text-red-400">Repair</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{totals.total}</div>
                          <div className="text-xs text-purple-700 dark:text-purple-400">Total</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
              {getJobsForDay(selectedDate).length === 0 && getEventsForDay(selectedDate).length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">No jobs or events scheduled for this day</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {/* Render jobs first */}
                  {getJobsForDay(selectedDate).map(job => (
                    <div
                      key={job.id}
                      className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                      style={{
                        backgroundColor: `${job.job_phase.color_dark_mode}0A`
                      }}
                      onClick={() => setSelectedJob(job)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            WO-{job.work_order_num}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {job.property.property_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Unit #{job.unit_number}
                          </p>
                        </div>
                        <span
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: job.job_phase.color_dark_mode,
                            color: 'white'
                          }}
                        >
                          {job.job_phase.job_phase_label}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {job.job_type.job_type_label}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          Click to view details
                        </span>
                      </div>
                      
                      {job.assigned_to_name && (
                        <div className="mt-2 flex items-center text-xs text-gray-600 dark:text-gray-400">
                          <User className="h-3 w-3 mr-1" />
                          {job.assigned_to_name}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Scheduled Events Section */}
                  {getEventsForDay(selectedDate).filter(event => 
                    !(event.title.includes('Paint') && event.title.includes('Callback') && event.title.includes('Repair'))
                  ).length > 0 && (
                    <>
                      <div className="border-t border-gray-200 dark:border-[#2D3B4E] my-4"></div>
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          Scheduled Events
                        </h4>
                      </div>
                      {getEventsForDay(selectedDate).filter(event => 
                        !(event.title.includes('Paint') && event.title.includes('Callback') && event.title.includes('Repair'))
                      ).map(event => (
                        <div
                          key={`event-${event.id}`}
                          className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                          style={{
                            backgroundColor: `${event.color}0A`
                          }}
                          onClick={() => handleEventClick(event)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                {event.title}
                              </h4>
                              {event.details && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {event.details}
                                </p>
                              )}
                            </div>
                            <span
                              className="text-xs px-2 py-1 rounded-full"
                              style={{
                                backgroundColor: event.color,
                                color: 'white'
                              }}
                            >
                              Event
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {event.is_all_day ? 'All day' : `${format(parseISO(event.start_at), 'h:mm a')} - ${format(parseISO(event.end_at), 'h:mm a')}`}
                            </span>
                            <span className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                              Click to view details
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Job Details Modal - Mobile friendly */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 lg:p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 lg:p-6 max-w-lg w-full shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  <WorkOrderLink 
                    jobId={selectedJob.id}
                    workOrderNum={selectedJob.work_order_num}
                  />
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  <PropertyLink 
                    propertyId={selectedJob.property.id}
                    propertyName={selectedJob.property.property_name}
                  /> • Unit #{selectedJob.unit_number}
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

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => {
            setShowEventDetails(false);
            setSelectedEvent(null);
          }}
          onEventUpdated={handleEventUpdated}
          onEventDeleted={handleEventDeleted}
          canEdit={canCreateEvents}
        />
      )}

      {/* Day Popup Modal - Mobile friendly */}
      {showDayPopup && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 lg:p-4 z-50">
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 lg:p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">
                {isToday(selectedDate) ? "Today's Agenda" : format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </h2>
              <button
                onClick={() => setShowDayPopup(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
              >
                ✕
              </button>
            </div>
            
            {/* Daily Agenda Summary Header */}
            {(() => {
              const totals = getJobTypeTotalsForDate(selectedDate);
              if (totals.total > 0) {
                return (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totals.paint}</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">Paint</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-500 dark:text-orange-400">{totals.callback}</div>
                        <div className="text-xs text-orange-500 dark:text-orange-400">Callback</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-500 dark:text-red-400">{totals.repair}</div>
                        <div className="text-xs text-red-500 dark:text-red-400">Repair</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{totals.total}</div>
                        <div className="text-xs text-purple-700 dark:text-purple-400">Total</div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
            <div className="space-y-4">
              {/* Jobs */}
              {getJobsForDay(selectedDate).map(job => (
                <div key={job.id} className="border border-gray-200 dark:border-[#2D3B4E] rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white text-lg">
                        <WorkOrderLink 
                          jobId={job.id}
                          workOrderNum={job.work_order_num}
                        />
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        <PropertyLink 
                          propertyId={job.property.id}
                          propertyName={job.property.property_name}
                        />
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Unit #{job.unit_number}
                      </p>
                      {job.assigned_to && job.assigned_to_name && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <SubcontractorLink 
                            subcontractorId={job.assigned_to}
                            subcontractorName={job.assigned_to_name}
                          />
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: job.job_phase.color_dark_mode,
                        color: 'white'
                      }}
                    >
                      {job.job_phase.job_phase_label}
                    </span>
                  </div>
                </div>
              ))}
              
              {getJobsForDay(selectedDate).length === 0 && getEventsForDay(selectedDate).length === 0 && (
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">No jobs or events scheduled for this day</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}