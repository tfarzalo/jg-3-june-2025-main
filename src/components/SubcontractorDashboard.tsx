import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  FileText,
  FileEdit,
  ChevronDown,
  ChevronRight,
  Info,
  DollarSign,
  Palette,
  User
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { format, addDays, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useUserRole } from '../contexts/UserRoleContext';
import { LoadingScreen } from './ui/LoadingScreen';
import { Lightbox } from './Lightbox';


interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  scheduled_date: string;
  property: {
    id: string;
    property_name: string;
    address: string;
    city: string;
    state: string;
  } | null;
  job_phase: {
    job_phase_label: string;
    color_dark_mode: string;
    id: string;
  } | null;
  job_type: {
    job_type_label: string;
  } | null;
  work_order?: {
    id: string;
  } | null;
}

interface PropertyDetails {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  paint_location: string;
  unit_map_file_path: string | null;
  maintenance_supervisor_name: string;
  billing_categories: BillingCategory[];
  paint_colors: PaintScheme[];
}

interface BillingCategory {
  id: string;
  name: string;
  billing_details: BillingDetail[];
}

interface BillingDetail {
  id: string;
  bill_amount: number;
  sub_pay_amount: number;
  unit_size: {
    unit_size_label: string;
  };
}

interface PaintScheme {
  paint_type: string;
  rooms: PaintRoom[];
}

interface PaintRoom {
  room: string;
  color: string;
}

interface ExpandedJobs {
  [jobId: string]: boolean;
}

interface PropertyDataCache {
  [propertyId: string]: PropertyDetails;
}

export function SubcontractorDashboard() {
  const [error, setError] = useState<string | null>(null);
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [tomorrowJobs, setTomorrowJobs] = useState<Job[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [displayedJobs, setDisplayedJobs] = useState<Job[]>([]);
  const [expandedJobs, setExpandedJobs] = useState<ExpandedJobs>({});
  const [propertyDataCache, setPropertyDataCache] = useState<PropertyDataCache>({});
  const [loadingProperties, setLoadingProperties] = useState<{[propertyId: string]: boolean}>({});
  const [unitMapModalOpen, setUnitMapModalOpen] = useState<{isOpen: boolean; imageUrl: string; propertyName: string}>({
    isOpen: false,
    imageUrl: '',
    propertyName: ''
  });
  const [userProfile, setUserProfile] = useState<any>(null);
  const { role } = useUserRole();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const previewUserId = searchParams.get('userId');
  const isPreview = previewUserId && (role === 'admin' || role === 'jg_management');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      console.log('useEffect: Initial job fetch triggered.');
      try {
        // Fetch both today's and tomorrow's jobs initially
        const [todayData, tomorrowData] = await Promise.all([
          fetchJobsForDate(new Date()),
          fetchJobsForDate(addDays(new Date(), 1))
        ]);
        console.log('fetchJobs: Today data fetched:', todayData);
        console.log('fetchJobs: Tomorrow data fetched:', tomorrowData);
        setTodayJobs(todayData || []);
        setTomorrowJobs(tomorrowData || []);
      } catch (err) {
        console.error('Error fetching initial jobs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
        setTodayJobs([]);
        setTomorrowJobs([]);
      } finally {
      }
    };

    fetchJobs();
  }, [previewUserId]); // Re-run if preview user changes

  useEffect(() => {
    console.log('useEffect: selectedDate or jobs state changed.');
    console.log('  selectedDate:', selectedDate);
    console.log('  todayJobs count:', todayJobs.length);
    console.log('  tomorrowJobs count:', tomorrowJobs.length);
    
    // Update displayed jobs when selected date changes
    if (isSameDay(selectedDate, new Date())) {
      console.log('  Setting displayedJobs to todayJobs.');
      setDisplayedJobs(todayJobs);
    } else if (isSameDay(selectedDate, addDays(new Date(), 1))) {
      console.log('  Setting displayedJobs to tomorrowJobs.');
      setDisplayedJobs(tomorrowJobs);
    } else {
      console.log('  Fetching jobs for selected date:', selectedDate);
      // For other dates, fetch jobs specifically for that date
      fetchJobsForDate(selectedDate).then(jobs => {
        console.log('  fetchJobsForDate result for selected date:', jobs);
        setDisplayedJobs(jobs || []);
      }).catch(err => {
        console.error('Error setting displayed jobs for date:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs for date');
        setDisplayedJobs([]);
      });
    }
  }, [selectedDate, todayJobs, tomorrowJobs]);

  useEffect(() => {
    // Show loading screen for 4 seconds
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const fetchJobsForDate = async (date: Date): Promise<Job[] | undefined> => {
    console.log('fetchJobsForDate called for date:', date);
    try {
      // Get user ID - either from query param (for preview) or current user
      let userId: string | undefined;
      
      if (previewUserId) {
        // Admin/Management is previewing a subcontractor's dashboard
        userId = previewUserId;
        console.log('fetchJobsForDate: Using preview userId:', userId);
      } else {
        // Regular subcontractor viewing their own dashboard
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('fetchJobsForDate: Supabase getUser error:', userError);
          throw userError;
        }
        if (!userData.user) {
          console.error('fetchJobsForDate: Supabase getUser returned no user.');
          throw new Error('User not found');
        }
        userId = userData.user.id;
        console.log('fetchJobsForDate: Using current userId:', userId);
      }
      
      if (!userId) {
        console.error('fetchJobsForDate: userId is null or undefined.');
        throw new Error('No user ID available');
      }
      
      // Get date range in Eastern Time
      const startOfDate = formatInTimeZone(
        date, 
        'America/New_York', 
        "yyyy-MM-dd'T'00:00:00XXX"
      );
      
      const endOfDate = formatInTimeZone(
        date, 
        'America/New_York', 
        "yyyy-MM-dd'T'23:59:59XXX"
      );
      
      console.log(`fetchJobsForDate: Date range (ET): ${startOfDate} to ${endOfDate}`);

      // Get job phase ID for "Job Request" phase only
      console.log('fetchJobsForDate: Fetching Job Request phase ID.');
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', 'Job Request');
        
      if (phaseError) {
        console.error('fetchJobsForDate: Supabase job_phases fetch error:', phaseError);
        throw phaseError;
      }
      
      if (!phaseData || phaseData.length === 0) {
        console.warn('fetchJobsForDate: "Job Request" phase not found in job_phases table.');
        return []; // No jobs to fetch if phase not found
      }
      
      const jobRequestPhaseId = phaseData[0].id;
      console.log('fetchJobsForDate: Job Request phase ID:', jobRequestPhaseId);
      
      // Get jobs assigned to this subcontractor for the selected date that are in Job Request phase
      console.log(`fetchJobsForDate: Fetching jobs for userId ${userId} in phase ${jobRequestPhaseId} between ${startOfDate} and ${endOfDate}`);
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          property:properties (
            id,
            property_name,
            address,
            city,
            state
          ),
          job_phase:current_phase_id (
            job_phase_label,
            color_dark_mode,
            id
          ),
          job_type:job_types (
            job_type_label
          ),
          work_order:work_orders (
            id
          )
        `)
        .eq('assigned_to', userId)
        .eq('current_phase_id', jobRequestPhaseId)
        .gte('scheduled_date', startOfDate)
        .lte('scheduled_date', endOfDate)
        .order('scheduled_date', { ascending: true });
        
      if (jobsError) {
        console.error('fetchJobsForDate: Supabase jobs fetch error:', jobsError);
        throw jobsError;
      }
      
            console.log('fetchJobsForDate: Raw jobs data received:', jobsData);

      // Map the data to match the Job interface and flatten nested arrays
      const mappedJobs: Job[] = (jobsData || []).map(job => ({
        ...job,
        property: Array.isArray(job.property) ? job.property[0] : job.property,
        job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase,
        job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
        work_order: Array.isArray(job.work_order) ? job.work_order[0] : job.work_order,
      }));

      
      console.log('fetchJobsForDate: Mapped jobs:', mappedJobs);
      return mappedJobs;
      
    } catch (err) {
      console.error('Error fetching jobs for date:', date, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs for date');
      return undefined; // Return undefined on error
    }
  };

  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  const formatAddress = (property: Job['property']) => {
     if (!property) return 'No address available';
    return `${property.address}, ${property.city}, ${property.state}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0] || fullName;
  };

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs(prev => ({
      ...prev,
      [jobId]: !prev[jobId]
    }));
  };

  const fetchPropertyDetails = useCallback(async (propertyId: string) => {
    if (propertyDataCache[propertyId]) {
      return propertyDataCache[propertyId];
    }

    setLoadingProperties(prev => ({ ...prev, [propertyId]: true }));

    try {
      // Fetch property details with all required nested data
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select(`
          id,
          property_name,
          address,
          city,
          state,
          zip,
          paint_location,
          unit_map_file_path,
          maintenance_supervisor_name,
          paint_colors
        `)
        .eq('id', propertyId)
        .single();

      if (propertyError) {
        console.error('Error fetching property details:', propertyError);
        throw propertyError;
      }

      // Fetch billing categories and details
      let billingData: any[] = [];
      let billingError: any = null;
      
      try {
        // Fetch all billing categories first
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('billing_categories')
          .select(`
            id,
            name
          `);

        if (categoriesError) {
          console.error('Error fetching billing categories:', categoriesError);
          billingError = categoriesError;
        } else if (categoriesData) {
          // Fetch billing details for this specific property
          const { data: billingDetailsData, error: detailsError } = await supabase
            .from('billing_details')
            .select(`
              id,
              bill_amount,
              sub_pay_amount,
              category_id,
              unit_size_id,
              unit_sizes!billing_details_unit_size_id_fkey (
                unit_size_label
              )
            `)
            .eq('property_id', propertyId);

          if (detailsError) {
            console.error('Error fetching billing details:', detailsError);
            billingError = detailsError;
          } else if (billingDetailsData) {
            // Group billing details by category
            const detailsByCategory = billingDetailsData.reduce((acc: any, detail: any) => {
              if (!acc[detail.category_id]) {
                acc[detail.category_id] = [];
              }
              acc[detail.category_id].push(detail);
              return acc;
            }, {});

            // Map categories with their billing details
            billingData = categoriesData.map(category => ({
              ...category,
              billing_details: detailsByCategory[category.id] || []
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching billing data:', err);
        billingError = err;
      }

      if (billingError) {
        console.error('Error fetching billing data:', billingError);
        // Don't throw here, just log the error
      }

      // Process billing data to match our interface
      const processedBillingData: BillingCategory[] = (billingData || []).map(category => ({
        id: category.id,
        name: category.name,
        billing_details: (category.billing_details || []).map((detail: any) => ({
          id: detail.id,
          bill_amount: detail.bill_amount,
          sub_pay_amount: detail.sub_pay_amount,
          unit_size: {
            unit_size_label: Array.isArray(detail.unit_sizes) 
              ? detail.unit_sizes[0]?.unit_size_label || 'Unknown'
              : detail.unit_sizes?.unit_size_label || 'Unknown'
          }
        })),
      }));



      // Fetch paint colors from the new schema if available
      let paintColors: PaintScheme[] = [];
      if (propertyData.paint_colors && Array.isArray(propertyData.paint_colors)) {
        paintColors = propertyData.paint_colors;
      } else {
        // Try to fetch from the new paint colors tables
        try {
          const { data: paintData, error: paintError } = await supabase
            .from('property_paint_colors_v')
            .select('*')
            .eq('property_id', propertyId)
            .order('floorplan')
            .order('sort_order');

          if (!paintError && paintData) {
            // Group by floorplan and convert to PaintScheme format
            const groupedByFloorplan = paintData.reduce((acc: any, row) => {
              if (!acc[row.floorplan]) {
                acc[row.floorplan] = {
                  paint_type: `Floorplan ${row.floorplan}`,
                  rooms: []
                };
              }
              if (row.room && row.paint_color) {
                acc[row.floorplan].rooms.push({
                  room: row.room,
                  color: row.paint_color
                });
              }
              return acc;
            }, {});

            paintColors = Object.values(groupedByFloorplan);
          }
        } catch (paintErr) {
          console.log('Paint colors from new schema not available, using legacy data');
        }
      }

      const propertyDetails: PropertyDetails = {
        ...propertyData,
        billing_categories: processedBillingData,
        paint_colors: paintColors
      };

      // Cache the data
      setPropertyDataCache(prev => ({
        ...prev,
        [propertyId]: propertyDetails
      }));

      return propertyDetails;
    } catch (error) {
      console.error('Error fetching property details:', error);
      throw error;
    } finally {
      setLoadingProperties(prev => ({ ...prev, [propertyId]: false }));
    }
  }, [propertyDataCache]);

  const handleMoreInfoClick = async (job: Job) => {
    if (!job.property?.id) return;

    const isExpanded = expandedJobs[job.id];
    
    if (!isExpanded && !propertyDataCache[job.property.id]) {
      try {
        await fetchPropertyDetails(job.property.id);
      } catch (error) {
        console.error('Failed to fetch property details:', error);
        return;
      }
    }

    toggleJobExpansion(job.id);
  };

  const openUnitMapModal = (imageUrl: string, propertyName: string) => {
    setUnitMapModalOpen({
      isOpen: true,
      imageUrl: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/files/${imageUrl}`,
      propertyName
    });
  };

  const closeUnitMapModal = () => {
    setUnitMapModalOpen({
      isOpen: false,
      imageUrl: '',
      propertyName: ''
    });
  };

  // Determine if selected date is today
  const isToday = isSameDay(selectedDate, new Date());
  
  // Determine if selected date is tomorrow
  const isTomorrow = isSameDay(selectedDate, addDays(new Date(), 1));

  if (isLoading) {
    return <LoadingScreen message="Loading your workspace..." />;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      {isPreview && (
        <div className="mb-4 sm:mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-3 py-2 sm:px-4 sm:py-3 rounded-lg">
          <p className="flex items-center font-medium text-sm sm:text-base">
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            You are viewing the subcontractor dashboard as {role === 'admin' ? 'an administrator' : 'JG Management'}
          </p>
          <p className="mt-1 text-xs sm:text-sm">
            This is a preview of what the subcontractor sees. Any actions taken here will affect the actual data.
          </p>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Mobile-optimized header with 2-column layout on larger screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 sm:mb-8">
          <div className="flex items-center space-x-3">
            <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white">My Assigned Jobs</h1>
          </div>
          <div className="flex items-center justify-end space-x-2 sm:space-x-4">
            <button
              onClick={() => setSelectedDate(new Date())}
              className={`px-3 py-2 sm:px-4 text-sm sm:text-base ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} rounded-lg transition-colors`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate(addDays(new Date(), 1))}
              className={`px-3 py-2 sm:px-4 text-sm sm:text-base ${isTomorrow ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} rounded-lg transition-colors`}
            >
              Tomorrow
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Today's Jobs Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-3 sm:p-4 lg:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" />
            <span className="text-sm sm:text-base">Jobs for {format(selectedDate, 'MMMM d, yyyy')}</span>
          </h2>
          
          {displayedJobs.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Jobs Scheduled</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                There are no jobs scheduled for {format(selectedDate, 'MMMM d, yyyy')}.
              </p>

            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {displayedJobs.map(job => (
                <div 
                  key={job.id}
                  className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-3 sm:p-4 border-l-4"
                  style={{ borderLeftColor: job.job_phase?.color_dark_mode || '#6B7280' }}
                >
                  <div className="flex flex-col space-y-3">
                    {/* Work Order Number and Property Name - Mobile optimized */}
                    <div className="flex flex-col space-y-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">
                          {formatWorkOrderNumber(job.work_order_num)}
                        </h3>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 truncate">
                          {job.property?.property_name || 'Unknown Property'}
                        </p>
                      </div>
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium self-start"
                        style={{ 
                          backgroundColor: job.job_phase?.color_dark_mode || '#6B7280',
                          color: 'white'
                        }}
                      >
                        {job.job_phase?.job_phase_label || 'Unknown Phase'}
                      </span>
                    </div>

                    {/* Property Address and Unit Number - Mobile optimized */}
                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                          {job.property ? formatAddress(job.property) : 'No address available'}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-md">
                          Unit #{job.unit_number}
                        </span>
                      </div>
                    </div>

                    {/* Job Type */}
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {job.job_type?.job_type_label || 'Unknown Type'}
                      </span>
                    </div>

                    {/* Action Buttons - Mobile optimized with 2-column layout */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button
                        onClick={() => handleMoreInfoClick(job)}
                        className="inline-flex items-center justify-center px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                        aria-expanded={expandedJobs[job.id]}
                        aria-controls={`job-details-${job.id}`}
                      >
                        <Info className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">More Info</span>
                        <span className="sm:hidden">Info</span>
                        {expandedJobs[job.id] ? (
                          <ChevronDown className="h-4 w-4 ml-1 sm:ml-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 ml-1 sm:ml-2" />
                        )}
                      </button>
                      
                      <Link
                        to={`/dashboard/jobs/${job.id}/new-work-order${isPreview ? `?userId=${previewUserId}` : ''}`}
                        className="inline-flex items-center justify-center px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <FileEdit className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Add Work Order</span>
                        <span className="sm:hidden">Add WO</span>
                      </Link>
                    </div>

                    {/* Property Details Accordion Panel */}
                    {expandedJobs[job.id] && (
                      <div 
                        id={`job-details-${job.id}`}
                        className="mt-4 p-3 sm:p-4 bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        {loadingProperties[job.property?.id || ''] ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading property details...</span>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Maintenance Supervisor */}
                            {propertyDataCache[job.property?.id || '']?.maintenance_supervisor_name && (
                              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                  <User className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                                  Maintenance Supervisor
                                </h4>
                                <p className="text-gray-800 dark:text-gray-200 text-sm">
                                  {getFirstName(propertyDataCache[job.property?.id || '']?.maintenance_supervisor_name || '')}
                                </p>
                              </div>
                            )}

                            {/* Paint Location */}
                             <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                               <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                 <Palette className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                                 Paint Location
                               </h4>
                               {propertyDataCache[job.property?.id || '']?.paint_location ? (
                                 <p className="text-gray-800 dark:text-gray-200 text-sm mb-3">
                                   {propertyDataCache[job.property?.id || '']?.paint_location}
                                 </p>
                               ) : (
                                 <p className="text-gray-500 dark:text-gray-400 text-sm italic mb-3">Not provided</p>
                               )}
                               
                               {/* Property Unit Map Button */}
                               {propertyDataCache[job.property?.id || '']?.unit_map_file_path && (
                                 <div className="mt-3">
                                   <button
                                     onClick={() => openUnitMapModal(
                                       propertyDataCache[job.property?.id || '']?.unit_map_file_path || '',
                                       propertyDataCache[job.property?.id || '']?.property_name || ''
                                     )}
                                     className="inline-flex items-center px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
                                   >
                                     <FileText className="h-4 w-4 mr-2" />
                                     View Unit Map
                                   </button>
                                 </div>
                               )}
                             </div>

                             {/* Paint Colors */}
                             <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                               <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                 <Palette className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                                 Paint Colors
                               </h4>
                               {propertyDataCache[job.property?.id || '']?.paint_colors?.length > 0 ? (
                                 <div className="space-y-3">
                                   {propertyDataCache[job.property?.id || '']?.paint_colors.map((scheme, index) => (
                                     <div key={index} className="pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                       <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">{scheme.paint_type}</h5>
                                       <div className="space-y-2">
                                         {scheme.rooms.map((room, roomIndex) => (
                                           <div key={roomIndex} className="flex justify-between items-center text-sm">
                                             <span className="text-gray-600 dark:text-gray-400">{room.room}</span>
                                             <span className="text-gray-800 dark:text-gray-200 font-medium">{room.color}</span>
                                           </div>
                                         ))}
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               ) : (
                                 <p className="text-gray-500 dark:text-gray-400 text-sm italic">Not provided</p>
                               )}
                             </div>

                            {/* Billing Info */}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#0F172A]">
                              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                                <DollarSign className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                                Billing Info
                              </h4>
                              {(() => {
                                const propertyBillingData = propertyDataCache[job.property?.id || ''];
                                const allCategories = propertyBillingData?.billing_categories || [];
                                
                                // Debug logging
                                console.log('Property billing data:', propertyBillingData);
                                console.log('All billing categories:', allCategories);
                                
                                // Filter to only show categories with subcontractor pay amounts > 0
                                const subcontractorCategories = allCategories.filter(category => {
                                  const hasSubPay = category.billing_details.some(detail => detail.sub_pay_amount > 0);
                                  console.log(`Category ${category.name} has sub pay:`, hasSubPay, category.billing_details);
                                  return hasSubPay;
                                });
                                
                                console.log('Subcontractor categories:', subcontractorCategories);
                                
                                return subcontractorCategories.length > 0 ? (
                                  <div className="space-y-3">
                                    {subcontractorCategories.map((category) => (
                                      <div key={category.id} className="pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                        <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">{category.name}</h5>
                                        
                                        {/* Subcontractor Billing Details */}
                                        {category.billing_details.filter(detail => detail.sub_pay_amount > 0).length > 0 && (
                                          <div className="mb-3">
                                            <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sub Pay Rates:</h6>
                                            <div className="space-y-2">
                                              {category.billing_details
                                                .filter(detail => detail.sub_pay_amount > 0)
                                                .map((detail) => (
                                                <div key={detail.id} className="flex justify-between items-center text-sm">
                                                  <span className="text-gray-600 dark:text-gray-400">
                                                    {category.name === 'Extra Charges' ? 'Hourly Rate' : detail.unit_size.unit_size_label}
                                                  </span>
                                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                                    Sub Pay: {formatCurrency(detail.sub_pay_amount)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm italic">No subcontractor rates available</p>
                                    {allCategories.length > 0 && (
                                      <div className="mt-2 text-xs text-gray-400">
                                        <p>Available categories: {allCategories.map(c => c.name).join(', ')}</p>
                                        {allCategories.map(category => (
                                          <div key={category.id} className="ml-2">
                                            <p>{category.name}: {category.billing_details.length} details</p>
                                            {category.billing_details.map(detail => (
                                              <p key={detail.id} className="ml-4">
                                                {detail.unit_size.unit_size_label}: Bill ${detail.bill_amount}, Sub Pay ${detail.sub_pay_amount}
                                              </p>
                                            ))}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tomorrow's Jobs Section */}
          {isToday && tomorrowJobs.length > 0 && (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-3 sm:p-4 lg:p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
                Tomorrow's Jobs
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {tomorrowJobs.map(job => (
                  <div 
                    key={job.id}
                    className="bg-gray-50 dark:bg-[#0F172A] rounded-lg p-3 border-l-2"
                    style={{ borderLeftColor: job.job_phase?.color_dark_mode || '#6B7280' }}
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {formatWorkOrderNumber(job.work_order_num)}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {job.property?.property_name || 'Unknown Property'}
                          </p>
                        </div>
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2"
                          style={{ 
                            backgroundColor: job.job_phase?.color_dark_mode || '#6B7280',
                            color: 'white'
                          }}
                        >
                          {job.job_phase?.job_phase_label || 'Unknown Phase'}
                        </span>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Unit #{job.unit_number}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {job.job_type?.job_type_label || 'Unknown Type'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unit Map Modal */}
      {unitMapModalOpen.isOpen && (
        <Lightbox
          isOpen={unitMapModalOpen.isOpen}
          onClose={closeUnitMapModal}
          imageUrl={unitMapModalOpen.imageUrl}
          imageAlt={`${unitMapModalOpen.propertyName} Unit Map`}
        />
      )}

      {/* Messaging Icon - Only show for subcontractors (not in preview mode) */}

    </div>
  );
}

export default SubcontractorDashboard;
