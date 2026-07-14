import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  Calendar, 
  Building2, 
  FileText, 
  User, 
  Filter, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  XCircle,
  MapPin,
  Tag,
  Layers,
  Hash
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/utils/supabase';
import { format, parseISO, subDays } from 'date-fns';
import { debounce } from '../lib/utils/debounce';

interface SearchResult {
  id: string;
  type: 'page' | 'job' | 'property' | 'file' | 'user' | 'work_order' | 'job_request' | 'activity' | 'property_group';
  title: string;
  subtitle: string;
  description?: string;
  date?: string;
  tags?: string[];
  url: string;
  icon: React.ReactNode;
  priority?: 'high' | 'medium' | 'low';
}

interface SearchFilters {
  types: {
    jobs: boolean;
    properties: boolean;
    files: boolean;
    users: boolean;
    work_orders: boolean;
    job_requests: boolean;
    activity: boolean;
    property_groups: boolean;
  };
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  customDateRange?: {
    start: string;
    end: string;
  };
  status?: string[];
  tags?: string[];
}

export function SearchOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    types: {
      jobs: true,
      properties: true,
      files: true,
      users: true,
      work_orders: true,
      job_requests: true,
      activity: false,
      property_groups: true
    },
    dateRange: 'all'
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const searchRequestRef = useRef(0);

  // Focus search input when overlay opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle escape key to close overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Handle click outside to close overlay
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce(async (term: string, searchFilters: SearchFilters) => {
      if (!term.trim() || !isMountedRef.current) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const searchResults: SearchResult[] = [];
      const searchRequestId = ++searchRequestRef.current;

      try {
        const normalizedTerm = term.trim();
        const safeTerm = escapePostgrestSearchTerm(normalizedTerm);
        const exactDate = parseSearchDate(normalizedTerm);
        const pageResults = searchPages(normalizedTerm);
        searchResults.push(...pageResults);
        publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
        if (isMountedRef.current && searchRequestId === searchRequestRef.current) {
          setLoading(false);
        }

        // Get date filter
        const getDateFilter = () => {
          switch (searchFilters.dateRange) {
            case 'today':
              return new Date().toISOString().split('T')[0];
            case 'week':
              return subDays(new Date(), 7).toISOString();
            case 'month':
              return subDays(new Date(), 30).toISOString();
            case 'year':
              return subDays(new Date(), 365).toISOString();
            default:
              return null;
          }
        };

        const dateFilter = getDateFilter();

        // Check if search term might be a work order number
        let workOrderSearch = false;
        let workOrderNumber: number | null = null;
        
        // Check for patterns like "WO-123456", "WO123456", "123456"
        const woRegex = /^(?:WO[-\s]?)?(\d+)$/i;
        const woMatch = normalizedTerm.match(woRegex);
        
        if (woMatch && woMatch[1]) {
          workOrderSearch = true;
          workOrderNumber = parseInt(woMatch[1], 10);
        }

        // Search jobs if enabled
        if (searchFilters.types.jobs) {
          let query = supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              description,
              purchase_order,
              scheduled_date,
              created_at,
              property:properties (
                id,
                property_name
              ),
              assigned_to_profile:assigned_to (
                id,
                full_name
              ),
              job_phase:current_phase_id (
                job_phase_label,
                color_dark_mode
              ),
              job_type:job_types (
                job_type_label
              )
            `)
            .limit(25);
            
          // If searching for a work order number specifically
          if (workOrderSearch && workOrderNumber) {
            query = query.eq('work_order_num', workOrderNumber);
          } else if (exactDate) {
            query = query.gte('scheduled_date', `${exactDate}T00:00:00`).lte('scheduled_date', `${exactDate}T23:59:59`);
          } else {
            // Otherwise do a regular search
            query = query.or(`unit_number.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%,purchase_order.ilike.%${safeTerm}%`);
          }

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: jobs, error } = await query;

          if (error) {
            console.error('Error searching jobs:', error);
          } else if (jobs) {
            jobs.forEach(job => {
              const property = normalizeRelation(job.property);
              const assignedTo = normalizeRelation(job.assigned_to_profile);
              const jobPhase = normalizeRelation(job.job_phase);
              const jobType = normalizeRelation(job.job_type);
              searchResults.push({
                id: job.id,
                type: 'job',
                title: `${formatWorkOrderNumber(job.work_order_num)} - Unit ${job.unit_number || 'N/A'}`,
                subtitle: property?.property_name || 'Unknown Property',
                description: job.description || '',
                date: formatDateLabel(job.created_at),
                tags: [
                  jobPhase?.job_phase_label || 'Unknown Phase',
                  jobType?.job_type_label || 'Unknown Type',
                  assignedTo?.full_name ? `Sub: ${assignedTo.full_name}` : 'Unassigned'
                ],
                url: `/dashboard/jobs/${job.id}`,
                icon: <FileText className="h-5 w-5 text-blue-500" />
              });
            });
            publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
          }
        }

        // Search properties if enabled
        if (searchFilters.types.properties) {
          let query = supabase
            .from('properties')
            .select(`
              id,
              property_name,
              address,
              city,
              state,
              zip,
              created_at,
              property_management_group:property_management_groups (
                company_name
              )
            `)
            .or(`property_name.ilike.%${safeTerm}%,address.ilike.%${safeTerm}%,city.ilike.%${safeTerm}%,state.ilike.%${safeTerm}%,zip.ilike.%${safeTerm}%`);
          query = query.limit(25);

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: properties, error } = await query;

          if (error) {
            console.error('Error searching properties:', error);
          } else if (properties) {
            properties.forEach(property => {
              const propertyManagementGroup = normalizeRelation(property.property_management_group);
              const address = [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ');
              searchResults.push({
                id: property.id,
                type: 'property',
                title: property.property_name || 'Unnamed Property',
                subtitle: address,
                description: propertyManagementGroup?.company_name || 'No Management Group',
                date: formatDateLabel(property.created_at),
                url: `/dashboard/properties/${property.id}`,
                icon: <Building2 className="h-5 w-5 text-green-500" />
              });
            });
            publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
          }
        }

        // Search files if enabled
        if (searchFilters.types.files) {
          let query = supabase
            .from('files')
            .select(`
              id,
              name,
              path,
              type,
              size,
              created_at,
              property:properties (
                id,
                property_name
              ),
              job:jobs (
                id,
                work_order_num,
                unit_number
              )
            `)
            .not('type', 'eq', 'folder/directory')
            .ilike('name', `%${safeTerm}%`)
            .limit(25);

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: files, error } = await query;

          if (error) {
            console.error('Error searching files:', error);
          } else if (files) {
            files.forEach(file => {
              const property = normalizeRelation(file.property);
              const job = normalizeRelation(file.job);
              let subtitle = 'General File';
              if (property) {
                subtitle = `Property: ${property.property_name || 'Unknown Property'}`;
              } else if (job) {
                subtitle = `Job: ${formatWorkOrderNumber(job.work_order_num)} - Unit ${job.unit_number || 'N/A'}`;
              }

              searchResults.push({
                id: file.id,
                type: 'file',
                title: file.name,
                subtitle: subtitle,
                description: `${(file.size / 1024).toFixed(2)} KB - ${file.type}`,
                date: formatDateLabel(file.created_at),
                url: `/dashboard/files`,
                icon: <FileText className="h-5 w-5 text-yellow-500" />
              });
            });
            publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
          }
        }

        // Search users if enabled
        if (searchFilters.types.users) {
          let query = supabase
            .from('profiles')
            .select(`
              id,
              email,
              full_name,
              role,
              created_at
            `)
            .or(`email.ilike.%${safeTerm}%,full_name.ilike.%${safeTerm}%`)
            .limit(25);

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: users, error } = await query;

          if (error) {
            console.error('Error searching users:', error);
          } else if (users) {
            users.forEach(user => {
              searchResults.push({
                id: user.id,
                type: 'user',
                title: user.full_name || 'Unnamed User',
                subtitle: user.email,
                description: `Role: ${user.role}`,
                date: formatDateLabel(user.created_at),
                tags: [user.role],
                url: `/dashboard/users`,
                icon: <User className="h-5 w-5 text-purple-500" />
              });
            });

            const matchingSubcontractors = users.filter(user => user.role === 'subcontractor');
            if (matchingSubcontractors.length > 0 && searchFilters.types.jobs) {
              const { data: assignedJobs, error: assignedJobsError } = await supabase
                .from('jobs')
                .select(`
                  id,
                  work_order_num,
                  unit_number,
                  description,
                  scheduled_date,
                  created_at,
                  property:properties (
                    id,
                    property_name
                  ),
                  assigned_to_profile:assigned_to (
                    id,
                    full_name
                  ),
                  job_phase:current_phase_id (
                    job_phase_label,
                    color_dark_mode
                  ),
                  job_type:job_types (
                    job_type_label
                  )
                `)
                .in('assigned_to', matchingSubcontractors.map(user => user.id))
                .limit(25);

              if (assignedJobsError) {
                console.error('Error searching jobs by subcontractor:', assignedJobsError);
              } else {
                (assignedJobs || []).forEach(job => {
                  const property = normalizeRelation(job.property);
                  const assignedTo = normalizeRelation(job.assigned_to_profile);
                  const jobPhase = normalizeRelation(job.job_phase);
                  const jobType = normalizeRelation(job.job_type);
                  searchResults.push({
                    id: `sub-job-${job.id}`,
                    type: 'job',
                    title: `${formatWorkOrderNumber(job.work_order_num)} - Unit ${job.unit_number || 'N/A'}`,
                    subtitle: property?.property_name || 'Unknown Property',
                    description: `Assigned to ${assignedTo?.full_name || normalizedTerm}`,
                    date: formatDateLabel(job.created_at),
                    tags: [jobPhase?.job_phase_label || 'Unknown Phase', jobType?.job_type_label || 'Unknown Type'],
                    url: `/dashboard/jobs/${job.id}`,
                    icon: <FileText className="h-5 w-5 text-blue-500" />
                  });
                });
              }
            }
            publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
          }
        }

        // Search work orders if enabled
        if (searchFilters.types.work_orders) {
          let query = supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              description,
              scheduled_date,
              created_at,
              property:properties (
                id,
                property_name
              ),
              job_phase:current_phase_id (
                job_phase_label,
                color_dark_mode
              )
            `)
            .limit(25);

          if (workOrderSearch && workOrderNumber) {
            query = query.eq('work_order_num', workOrderNumber);
          } else if (exactDate) {
            query = query.gte('scheduled_date', `${exactDate}T00:00:00`).lte('scheduled_date', `${exactDate}T23:59:59`);
          } else {
            query = query.or(`unit_number.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`);
          }

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: workOrders, error } = await query;

          if (error) {
            console.error('Error searching work orders:', error);
          } else if (workOrders) {
            workOrders.forEach(wo => {
              const property = normalizeRelation(wo.property);
              const jobPhase = normalizeRelation(wo.job_phase);
              searchResults.push({
                id: wo.id,
                type: 'work_order',
                title: formatWorkOrderNumber(wo.work_order_num),
                subtitle: property?.property_name || 'Unknown Property',
                description: wo.description || '',
                date: formatDateLabel(wo.created_at),
                tags: [jobPhase?.job_phase_label || 'Work Order'],
                url: `/dashboard/jobs/${wo.id}`,
                icon: <FileText className="h-5 w-5 text-orange-500" />,
                priority: 'medium'
              });
            });
            publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
          }
        }

        // Search job requests if enabled
        if (searchFilters.types.job_requests) {
          let query = supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              description,
              scheduled_date,
              created_at,
              property:properties (
                id,
                property_name
              ),
              job_phase:current_phase_id (
                job_phase_label,
                color_dark_mode
              )
            `)
            .limit(25);

          if (workOrderSearch && workOrderNumber) {
            query = query.eq('work_order_num', workOrderNumber);
          } else if (exactDate) {
            query = query.gte('scheduled_date', `${exactDate}T00:00:00`).lte('scheduled_date', `${exactDate}T23:59:59`);
          } else {
            query = query.or(`unit_number.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`);
          }

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: jobRequests, error } = await query;

          if (error) {
            console.error('Error searching job requests:', error);
          } else if (jobRequests) {
            jobRequests
              .filter(request => normalizeRelation(request.job_phase)?.job_phase_label === 'Job Request')
              .forEach(request => {
              const property = normalizeRelation(request.property);
              searchResults.push({
                id: request.id,
                type: 'job_request',
                title: `Job Request ${formatWorkOrderNumber(request.work_order_num)}`,
                subtitle: property?.property_name || 'No property',
                description: request.description || '',
                date: formatDateLabel(request.created_at),
                tags: ['Job Request'],
                url: `/dashboard/jobs/${request.id}`,
                icon: <FileText className="h-5 w-5 text-indigo-500" />,
                priority: 'medium'
              });
            });
            publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
          }
        }

        // Search activity logs if enabled
        if (searchFilters.types.activity) {
          let query = supabase
            .from('activity_log')
            .select(`
              id,
              action,
              description,
              created_at,
              user:profiles (
                id,
                full_name
              )
            `)
            .or(`action.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`)
            .limit(25);

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: activities, error } = await query;

          if (error) {
            console.error('Error searching activity logs:', error);
          } else if (activities) {
            activities.forEach(activity => {
              const user = normalizeRelation(activity.user);
              searchResults.push({
                id: activity.id,
                type: 'activity',
                title: activity.action,
                subtitle: user ? `By ${user.full_name}` : 'System',
                description: activity.description || '',
                date: formatDateLabel(activity.created_at),
                url: '/dashboard/activity',
                icon: <Clock className="h-5 w-5 text-gray-500" />,
                priority: 'low'
              });
            });
            publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
          }
        }

        // Search property groups if enabled
        if (searchFilters.types.property_groups) {
          let query = supabase
            .from('property_management_groups')
            .select(`
              id,
              company_name,
              contact_name,
              contact_email,
              created_at
            `)
            .or(`company_name.ilike.%${safeTerm}%,contact_name.ilike.%${safeTerm}%,contact_email.ilike.%${safeTerm}%`)
            .limit(25);

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: propertyGroups, error } = await query;

          if (error) {
            console.error('Error searching property groups:', error);
          } else if (propertyGroups) {
            propertyGroups.forEach(group => {
              searchResults.push({
                id: group.id,
                type: 'property_group',
                title: group.company_name,
                subtitle: group.contact_name ? `Contact: ${group.contact_name}` : 'No contact',
                description: group.contact_email || '',
                date: formatDateLabel(group.created_at),
                url: '/dashboard/property-groups',
                icon: <Building2 className="h-5 w-5 text-teal-500" />
              });
            });
            publishSearchResults(searchRequestId, searchRequestRef.current, isMountedRef.current, searchResults, setResults);
          }
        }

        if (isMountedRef.current && searchRequestId === searchRequestRef.current) {
          setResults(searchResults);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        if (isMountedRef.current && searchRequestId === searchRequestRef.current) {
          setLoading(false);
        }
      }
    }, 300),
    []
  );

  // Trigger search when term or filters change
  useEffect(() => {
    if (searchTerm) {
      debouncedSearch(searchTerm, filters);
    } else {
      setResults([]);
    }
  }, [searchTerm, filters, debouncedSearch]);

  // Handle filter changes
  const toggleTypeFilter = (type: keyof SearchFilters['types']) => {
    setFilters(prev => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: !prev.types[type]
      }
    }));
  };

  const setDateRangeFilter = (range: SearchFilters['dateRange']) => {
    setFilters(prev => ({
      ...prev,
      dateRange: range
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16">
      <div 
        ref={overlayRef}
        className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-[#2D3B4E]"
      >
        {/* Search Header */}
        <div className="p-6 border-b border-gray-200 dark:border-[#2D3B4E] bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-[#0F172A] dark:to-[#1E293B]">
          <div className="flex items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search jobs, properties, files, users, work orders, and more..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="ml-4 px-5 py-3 bg-white dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1E293B] transition-all duration-200 flex items-center shadow-sm"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
              {showFilters ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </button>
            <button
              onClick={onClose}
              className="ml-3 p-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-[#2D3B4E]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Search In</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleTypeFilter('jobs')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.types.jobs 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Jobs
                    {filters.types.jobs ? (
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-1.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('properties')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.types.properties 
                        ? 'bg-green-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Building2 className="h-4 w-4 mr-1.5" />
                    Properties
                    {filters.types.properties ? (
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-1.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('files')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.types.files 
                        ? 'bg-yellow-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Files
                    {filters.types.files ? (
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-1.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('users')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.types.users 
                        ? 'bg-purple-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <User className="h-4 w-4 mr-1.5" />
                    Users
                    {filters.types.users ? (
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-1.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('work_orders')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.types.work_orders 
                        ? 'bg-orange-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Work Orders
                    {filters.types.work_orders ? (
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-1.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('job_requests')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.types.job_requests 
                        ? 'bg-indigo-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Job Requests
                    {filters.types.job_requests ? (
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-1.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('property_groups')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.types.property_groups 
                        ? 'bg-teal-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Building2 className="h-4 w-4 mr-1.5" />
                    Property Groups
                    {filters.types.property_groups ? (
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-1.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleTypeFilter('activity')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.types.activity 
                        ? 'bg-gray-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    Activity Logs
                    {filters.types.activity ? (
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-1.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Date Range</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDateRangeFilter('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.dateRange === 'all' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    All Time
                  </button>
                  <button
                    onClick={() => setDateRangeFilter('today')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.dateRange === 'today' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    Today
                  </button>
                  <button
                    onClick={() => setDateRangeFilter('week')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.dateRange === 'week' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    Last 7 Days
                  </button>
                  <button
                    onClick={() => setDateRangeFilter('month')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.dateRange === 'month' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Last 30 Days
                  </button>
                  <button
                    onClick={() => setDateRangeFilter('year')}
                    className={`px-4 py-2 rounded-full text-sm font-medium flex items-center transition-all duration-200 ${
                      filters.dateRange === 'year' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Last Year
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : searchTerm && results.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No results found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Try adjusting your search or filters
              </p>
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                <p>Search tips:</p>
                <ul className="list-disc list-inside mt-2">
                  <li>Try searching for a work order number (e.g., "WO-123456" or just "123456")</li>
                  <li>Search by property name or address</li>
                  <li>Search by unit number</li>
                  <li>Try using fewer or different keywords</li>
                </ul>
              </div>
            </div>
          ) : searchTerm ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Found {results.length} results for "{searchTerm}"
              </div>
              
              {/* Group results by type */}
              {['page', 'job', 'property', 'file', 'user', 'work_order', 'job_request', 'activity', 'property_group'].map(type => {
                const typeResults = results.filter(result => result.type === type);
                if (typeResults.length === 0) return null;
                
                return (
                  <div key={type} className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                      {type === 'page' && <Layers className="h-5 w-5 mr-2 text-gray-500" />}
                      {type === 'job' && <FileText className="h-5 w-5 mr-2 text-blue-500" />}
                      {type === 'property' && <Building2 className="h-5 w-5 mr-2 text-green-500" />}
                      {type === 'file' && <FileText className="h-5 w-5 mr-2 text-yellow-500" />}
                      {type === 'user' && <User className="h-5 w-5 mr-2 text-purple-500" />}
                      {type === 'work_order' && <FileText className="h-5 w-5 mr-2 text-orange-500" />}
                      {type === 'job_request' && <FileText className="h-5 w-5 mr-2 text-indigo-500" />}
                      {type === 'activity' && <Clock className="h-5 w-5 mr-2 text-gray-500" />}
                      {type === 'property_group' && <Building2 className="h-5 w-5 mr-2 text-teal-500" />}
                      {type === 'page' ? 'Pages' :
                       type === 'work_order' ? 'Work Orders' : 
                       type === 'job_request' ? 'Job Requests' :
                       type === 'property_group' ? 'Property Groups' :
                       type === 'activity' ? 'Activity Logs' :
                       type.charAt(0).toUpperCase() + type.slice(1) + 's'} ({typeResults.length})
                    </h3>
                    
                    <div className="space-y-2">
                      {typeResults.map(result => (
                        <Link 
                          key={`${result.type}-${result.id}`}
                          to={result.url}
                          onClick={onClose}
                          className="block p-5 bg-white dark:bg-[#0F172A] rounded-xl border border-gray-200 dark:border-[#2D3B4E] hover:bg-gray-50 dark:hover:bg-[#1E293B] hover:shadow-md transition-all duration-200 group"
                        >
                          <div className="flex">
                            <div className="flex-shrink-0 mr-4">
                              {result.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-base font-medium text-gray-900 dark:text-white truncate">
                                {result.title}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center">
                                {result.type === 'property' && <MapPin className="h-3.5 w-3.5 mr-1 text-gray-400" />}
                                {result.type === 'job' && <Hash className="h-3.5 w-3.5 mr-1 text-gray-400" />}
                                {result.subtitle}
                              </p>
                              {result.description && (
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 truncate">
                                  {result.description}
                                </p>
                              )}
                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center">
                                  {result.tags && result.tags.length > 0 && (
                                    <div className="flex items-center mr-4">
                                      <Tag className="h-3.5 w-3.5 mr-1 text-gray-400" />
                                      <div className="flex space-x-1">
                                        {result.tags.map((tag, index) => (
                                          <span 
                                            key={index}
                                            className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {result.date && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {result.date}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Search the entire application</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Find jobs, properties, files, users and more
              </p>
              <div className="max-w-md mx-auto text-left bg-gray-50 dark:bg-[#0F172A] p-4 rounded-lg border border-gray-200 dark:border-[#2D3B4E]">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search tips:</p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li className="flex items-center">
                    <Hash className="h-3.5 w-3.5 mr-2 text-blue-500" />
                    Search for work orders by number (e.g., "WO-123456" or just "123456")
                  </li>
                  <li className="flex items-center">
                    <Building2 className="h-3.5 w-3.5 mr-2 text-green-500" />
                    Find properties by name or address
                  </li>
                  <li className="flex items-center">
                    <FileText className="h-3.5 w-3.5 mr-2 text-yellow-500" />
                    Locate files by filename
                  </li>
                  <li className="flex items-center">
                    <User className="h-3.5 w-3.5 mr-2 text-purple-500" />
                    Find users by name or email
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Search Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-[#2D3B4E] bg-gradient-to-r from-gray-50 to-blue-50 dark:from-[#0F172A] dark:to-[#1E293B]">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Press <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded-md text-gray-800 dark:text-gray-200 font-mono text-xs shadow-sm border">ESC</kbd> to close
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Search powered by Supabase
              </div>
              <Layers className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapePostgrestSearchTerm(value: string) {
  return value
    .replace(/[%_]/g, '')
    .replace(/['"]/g, '')
    .replace(/[,()]/g, ' ')
    .trim();
}

function parseSearchDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const directIso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (directIso) return normalized;

  const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashDate) {
    const month = slashDate[1].padStart(2, '0');
    const day = slashDate[2].padStart(2, '0');
    const year = slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function publishSearchResults(
  searchRequestId: number,
  currentSearchRequestId: number,
  isMounted: boolean,
  results: SearchResult[],
  setResults: React.Dispatch<React.SetStateAction<SearchResult[]>>
) {
  if (isMounted && searchRequestId === currentSearchRequestId) {
    setResults([...results]);
  }
}

function formatDateLabel(value?: string | null) {
  if (!value) return '';

  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return '';
  }
}

function formatWorkOrderNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return 'WO-N/A';
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return `WO-${String(numericValue).padStart(6, '0')}`;
  }

  return String(value).startsWith('WO-') ? String(value) : `WO-${value}`;
}

function searchPages(term: string): SearchResult[] {
  const normalized = term.toLowerCase();
  const pages: Array<{ id: string; title: string; subtitle: string; url: string; keywords: string[] }> = [
    { id: 'dashboard', title: 'Dashboard', subtitle: 'Main dashboard', url: '/dashboard', keywords: ['dashboard', 'home'] },
    { id: 'jobs', title: 'All Jobs', subtitle: 'Job list and work order lookup', url: '/dashboard/jobs', keywords: ['jobs', 'job', 'work order', 'wo'] },
    { id: 'job-requests', title: 'Job Requests', subtitle: 'Requested jobs', url: '/dashboard/jobs/requests', keywords: ['job request', 'requests', 'new job'] },
    { id: 'work-orders', title: 'Work Orders', subtitle: 'Active work orders', url: '/dashboard/jobs/work-orders', keywords: ['work orders', 'work order', 'wo'] },
    { id: 'pending-work-orders', title: 'Pending Work Orders', subtitle: 'Pending work orders', url: '/dashboard/jobs/pending-work-orders', keywords: ['pending', 'pending work orders'] },
    { id: 'completed-work-orders', title: 'Completed Work Orders', subtitle: 'Work orders ready for Quality Control', url: '/dashboard/jobs/completed-work-orders', keywords: ['completed work orders', 'ready for qc', 'ready for quality control'] },
    { id: 'quality-control', title: 'Quality Control', subtitle: 'Quality Control job queue', url: '/dashboard/jobs/quality-control', keywords: ['quality control', 'qc', 'quality', 'scorecard'] },
    { id: 'completed', title: 'Completed Jobs', subtitle: 'Completed job list', url: '/dashboard/jobs/completed', keywords: ['completed', 'done'] },
    { id: 'invoicing', title: 'Invoicing', subtitle: 'Jobs ready for invoicing', url: '/dashboard/jobs/invoicing', keywords: ['invoice', 'invoicing', 'billing'] },
    { id: 'cancelled', title: 'Cancelled Jobs', subtitle: 'Cancelled job list', url: '/dashboard/jobs/cancelled', keywords: ['cancelled', 'canceled'] },
    { id: 'properties', title: 'Properties', subtitle: 'Property directory', url: '/dashboard/properties', keywords: ['properties', 'property'] },
    { id: 'property-groups', title: 'Property Management Groups', subtitle: 'Property management companies', url: '/dashboard/property-groups', keywords: ['property groups', 'management groups', 'property management'] },
    { id: 'files', title: 'File Manager', subtitle: 'Files and folders', url: '/dashboard/files', keywords: ['files', 'file manager', 'documents'] },
    { id: 'users', title: 'Users', subtitle: 'User and subcontractor management', url: '/dashboard/users', keywords: ['users', 'subcontractors', 'subs', 'sub'] },
    { id: 'calendar', title: 'Calendar', subtitle: 'Job calendar', url: '/dashboard/calendar', keywords: ['calendar', 'schedule', 'date'] },
    { id: 'sub-scheduler', title: 'Sub Scheduler', subtitle: 'Subcontractor schedule', url: '/dashboard/sub-scheduler', keywords: ['sub scheduler', 'scheduler', 'schedule', 'subcontractor schedule'] },
    { id: 'activity', title: 'Activity Log', subtitle: 'System activity', url: '/dashboard/activity', keywords: ['activity', 'log', 'history'] },
    { id: 'reports', title: 'Reports', subtitle: 'Reports and report history', url: '/dashboard/reports', keywords: ['reports', 'reporting', 'report history'] },
    { id: 'contacts', title: 'Contacts', subtitle: 'Contacts and leads', url: '/dashboard/contacts', keywords: ['contacts', 'leads'] },
    { id: 'employees', title: 'Employees', subtitle: 'Employee profiles', url: '/dashboard/employees', keywords: ['employees', 'employee'] },
    { id: 'support', title: 'Support', subtitle: 'Support tickets', url: '/dashboard/support', keywords: ['support', 'tickets', 'help'] },
    { id: 'settings', title: 'Admin Settings', subtitle: 'Application settings', url: '/dashboard/settings', keywords: ['settings', 'admin settings'] },
  ];

  return pages
    .filter(page => page.title.toLowerCase().includes(normalized) || page.keywords.some(keyword => keyword.includes(normalized) || normalized.includes(keyword)))
    .slice(0, 8)
    .map(page => ({
      id: page.id,
      type: 'page',
      title: page.title,
      subtitle: page.subtitle,
      url: page.url,
      icon: <Layers className="h-5 w-5 text-gray-500" />,
      priority: 'high',
    }));
}
