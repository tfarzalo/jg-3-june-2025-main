import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { debounce } from '../lib/utils/debounce';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';

interface SearchResult {
  id: string;
  type: 'job' | 'property' | 'file' | 'user';
  title: string | React.ReactNode;
  subtitle: string | React.ReactNode;
  description?: string;
  date?: string;
  tags?: string[];
  url: string;
  icon: React.ReactNode;
}

interface SearchFilters {
  types: {
    jobs: boolean;
    properties: boolean;
    files: boolean;
    users: boolean;
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
      users: true
    },
    dateRange: 'all'
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

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

  // Format work order number for search and display
  const formatWorkOrderNumber = (num: number): string => {
    return `WO-${String(num).padStart(6, '0')}`;
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (term: string, searchFilters: SearchFilters) => {
      if (!term.trim() || !isMountedRef.current) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const searchResults: SearchResult[] = [];

      try {
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
        const woMatch = term.match(woRegex);
        
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
              scheduled_date,
              created_at,
              property:properties (
                property_name
              ),
              job_phase:current_phase_id (
                job_phase_label,
                color_dark_mode
              ),
              job_type:job_types (
                job_type_label
              )
            `);
            
          // If searching for a work order number specifically
          if (workOrderSearch && workOrderNumber) {
            query = query.eq('work_order_num', workOrderNumber);
          } else {
            // Otherwise do a regular search
            query = query.or(`unit_number.ilike.%${term}%,description.ilike.%${term}%,work_order_num::text.ilike.%${term}%`);
          }

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: jobs, error } = await query;

          if (error) {
            console.error('Error searching jobs:', error);
          } else if (jobs) {
            jobs.forEach(job => {
              searchResults.push({
                id: job.id,
                type: 'job',
                title: (
                  <span>
                    <WorkOrderLink 
                      jobId={job.id}
                      workOrderNum={job.work_order_num}
                    /> - Unit {job.unit_number}
                  </span>
                ),
                subtitle: job.property ? (
                  <PropertyLink 
                    propertyId={job.property.id}
                    propertyName={job.property.property_name}
                  />
                ) : 'Unknown Property',
                description: job.description || '',
                date: format(parseISO(job.created_at), 'MMM d, yyyy'),
                tags: [job.job_phase?.job_phase_label || 'Unknown Phase', job.job_type?.job_type_label || 'Unknown Type'],
                url: `/dashboard/jobs/${job.id}`,
                icon: <FileText className="h-5 w-5 text-blue-500" />
              });
            });
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
            .or(`property_name.ilike.%${term}%,address.ilike.%${term}%,city.ilike.%${term}%`);

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: properties, error } = await query;

          if (error) {
            console.error('Error searching properties:', error);
          } else if (properties) {
            properties.forEach(property => {
              const address = [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ');
              searchResults.push({
                id: property.id,
                type: 'property',
                title: (
                  <PropertyLink 
                    propertyId={property.id}
                    propertyName={property.property_name}
                  />
                ),
                subtitle: address,
                description: property.property_management_group?.company_name || 'No Management Group',
                date: property.created_at ? format(parseISO(property.created_at), 'MMM d, yyyy') : '',
                url: `/dashboard/properties/${property.id}`,
                icon: <Building2 className="h-5 w-5 text-green-500" />
              });
            });
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
            .ilike('name', `%${term}%`);

          if (dateFilter) {
            query = query.gte('created_at', dateFilter);
          }

          const { data: files, error } = await query;

          if (error) {
            console.error('Error searching files:', error);
          } else if (files) {
            files.forEach(file => {
              let subtitle: React.ReactNode = 'General File';
              if (file.property) {
                subtitle = (
                  <span>
                    Property: <PropertyLink 
                      propertyId={file.property.id}
                      propertyName={file.property.property_name}
                    />
                  </span>
                );
              } else if (file.job) {
                subtitle = (
                  <span>
                    Job: <WorkOrderLink 
                      jobId={file.job.id}
                      workOrderNum={file.job.work_order_num}
                    /> - Unit {file.job.unit_number}
                  </span>
                );
              }

              searchResults.push({
                id: file.id,
                type: 'file',
                title: file.name,
                subtitle: subtitle,
                description: `${(file.size / 1024).toFixed(2)} KB - ${file.type}`,
                date: format(parseISO(file.created_at), 'MMM d, yyyy'),
                url: `/dashboard/files`,
                icon: <FileText className="h-5 w-5 text-yellow-500" />
              });
            });
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
            .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);

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
                date: format(parseISO(user.created_at), 'MMM d, yyyy'),
                tags: [user.role],
                url: `/dashboard/users`,
                icon: <User className="h-5 w-5 text-purple-500" />
              });
            });
          }
        }

        if (isMountedRef.current) {
          setResults(searchResults);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        if (isMountedRef.current) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20">
      <div 
        ref={overlayRef}
        className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
      >
        {/* Search Header */}
        <div className="p-4 border-b border-gray-200 dark:border-[#2D3B4E]">
          <div className="flex items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by work order #, job details, properties, files, users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="ml-3 px-4 py-3 bg-gray-100 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2D3B4E] transition-colors flex items-center"
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
              className="ml-3 p-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search In</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleTypeFilter('jobs')}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.types.jobs 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
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
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.types.properties 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
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
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.types.files 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
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
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.types.users 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
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
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDateRangeFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.dateRange === 'all' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    All Time
                  </button>
                  <button
                    onClick={() => setDateRangeFilter('today')}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.dateRange === 'today' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    Today
                  </button>
                  <button
                    onClick={() => setDateRangeFilter('week')}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.dateRange === 'week' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    Last 7 Days
                  </button>
                  <button
                    onClick={() => setDateRangeFilter('month')}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.dateRange === 'month' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Last 30 Days
                  </button>
                  <button
                    onClick={() => setDateRangeFilter('year')}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center ${
                      filters.dateRange === 'year' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
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
        <div className="flex-1 overflow-y-auto p-4">
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
              {['job', 'property', 'file', 'user'].map(type => {
                const typeResults = results.filter(result => result.type === type);
                if (typeResults.length === 0) return null;
                
                return (
                  <div key={type} className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                      {type === 'job' && <FileText className="h-5 w-5 mr-2 text-blue-500" />}
                      {type === 'property' && <Building2 className="h-5 w-5 mr-2 text-green-500" />}
                      {type === 'file' && <FileText className="h-5 w-5 mr-2 text-yellow-500" />}
                      {type === 'user' && <User className="h-5 w-5 mr-2 text-purple-500" />}
                      {type.charAt(0).toUpperCase() + type.slice(1)}s ({typeResults.length})
                    </h3>
                    
                    <div className="space-y-2">
                      {typeResults.map(result => (
                        <Link 
                          key={`${result.type}-${result.id}`}
                          to={result.url}
                          onClick={onClose}
                          className="block p-4 bg-white dark:bg-[#0F172A] rounded-lg border border-gray-200 dark:border-[#2D3B4E] hover:bg-gray-50 dark:hover:bg-[#1E293B] transition-colors"
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
        <div className="p-4 border-t border-gray-200 dark:border-[#2D3B4E] bg-gray-50 dark:bg-[#0F172A]">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-800 dark:text-gray-200 font-mono text-xs">ESC</kbd> to close
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