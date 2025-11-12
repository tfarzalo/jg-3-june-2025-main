import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowLeft } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { getCurrentDateInEastern, formatDateForInput } from '../lib/dateUtils';
import { JobType } from '../lib/types';
import { useAuth } from '../contexts/AuthProvider';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';

interface Property {
  id: string;
  property_name: string;
  address: string;
  address_2: string | null;
  city: string;
  state: string;
  zip: string;
}

interface UnitSize {
  id: string;
  unit_size_label: string;
}

interface JobCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export function JobRequestForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [unitSizes, setUnitSizes] = useState<UnitSize[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  
  const [debugInfo, setDebugInfo] = useState<{
    supabaseConnected: boolean;
    propertiesLoaded: boolean;
    unitSizesLoaded: boolean;
    jobTypesLoaded: boolean;
    jobCategoriesLoaded: boolean;
  }>({
    supabaseConnected: false,
    propertiesLoaded: false,
    unitSizesLoaded: false,
    jobTypesLoaded: false,
    jobCategoriesLoaded: false
  });

  // Initialize form data with today's date properly formatted
  const [formData, setFormData] = useState({
    property_id: '',
    unit_number: '',
    unit_size_id: '',
    job_category_id: '',
    job_type_id: '',
    description: '',
    scheduled_date: getCurrentDateInEastern(),
  });

  // Debug log the initial date and ensure it's properly set
  useEffect(() => {
    const currentDate = getCurrentDateInEastern();
    console.log('JobRequestForm: Initial scheduled_date:', formData.scheduled_date);
    console.log('JobRequestForm: Current date in Eastern:', currentDate);
    
    // Ensure the date is set to today if it's not already
    if (formData.scheduled_date !== currentDate) {
      setFormData(prev => ({ ...prev, scheduled_date: currentDate }));
      console.log('JobRequestForm: Updated scheduled_date to:', currentDate);
    }
  }, []);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.from('properties').select('count').limit(1);
        setDebugInfo(prev => ({ ...prev, supabaseConnected: !error }));
        if (error) throw error;
      } catch (err) {
        console.error('Supabase connection test failed:', err);
      }
    };

    testConnection();
    Promise.all([
      fetchProperties(),
      fetchUnitSizes(),
      fetchJobTypes(),
      fetchJobCategories()
    ]);
  }, []);

  // Fetch job categories when property changes
  useEffect(() => {
    if (formData.property_id) {
      fetchPropertyJobCategories(formData.property_id);
    } else {
      setJobCategories([]);
    }
  }, [formData.property_id]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_archived', false)
        .order('property_name');

      if (error) throw error;
      setProperties(data || []);
      setDebugInfo(prev => ({ ...prev, propertiesLoaded: true }));
    } catch (err) {
      console.error('Error fetching properties:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch properties');
    }
  };

  const fetchUnitSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('unit_sizes')
        .select('*')
        .order('unit_size_label');

      if (error) throw error;
      setUnitSizes(data || []);
      setDebugInfo(prev => ({ ...prev, unitSizesLoaded: true }));
    } catch (err) {
      console.error('Error fetching unit sizes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch unit sizes');
    }
  };

  const fetchJobTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('job_types')
        .select('*')
        .order('job_type_label');

      if (error) throw error;
      setJobTypes(data || []);
      setDebugInfo(prev => ({ ...prev, jobTypesLoaded: true }));
    } catch (err) {
      console.error('Error fetching job types:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job types');
    }
  };

  const fetchJobCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('job_categories')
        .select('*')
        .order('sort_order, name');

      if (error) throw error;
      setJobCategories(data || []);
      setDebugInfo(prev => ({ ...prev, jobCategoriesLoaded: true }));
    } catch (err) {
      console.error('Error fetching job categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job categories');
    }
  };

  const fetchPropertyJobCategories = async (propertyId: string) => {
    try {
      // Get the job categories that exist in the property's billing categories
      const { data, error } = await supabase
        .from('billing_categories')
        .select(`
          name,
          description,
          sort_order
        `)
        .eq('property_id', propertyId)
        .order('sort_order, name');

      if (error) throw error;
      
      // Get the corresponding job_categories IDs for these names
      if (data && data.length > 0) {
        const categoryNames = data.map(cat => cat.name);
        
        const { data: jobCategoriesData, error: jobCategoriesError } = await supabase
          .from('job_categories')
          .select('id, name, description, sort_order')
          .in('name', categoryNames)
          .order('sort_order, name');
          
        if (jobCategoriesError) throw jobCategoriesError;
        
        setJobCategories(jobCategoriesData || []);
      } else {
        setJobCategories([]);
      }
    } catch (err) {
      console.error('Error fetching property job categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch property job categories');
    }
  };

  const formatPropertyAddress = (property: Property) => {
    const parts = [
      property.address,
      property.address_2,
      property.city,
      property.state,
      property.zip
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!user) {
      setError('You must be logged in to create a job request');
      setLoading(false);
      return;
    }

    try {
      // Ensure the date is in YYYY-MM-DD format
      const formattedDate = formData.scheduled_date;

      // Debug log the data being sent
      console.log('JobRequestForm: Form data:', formData);
      console.log('JobRequestForm: Formatted date:', formattedDate);
      console.log('JobRequestForm: Date type:', typeof formattedDate);
      console.log('JobRequestForm: Current Eastern date:', getCurrentDateInEastern());
      console.log('JobRequestForm: User:', user);

      const { data, error } = await supabase.rpc('create_job', {
        p_property_id: formData.property_id,
        p_unit_number: formData.unit_number,
        p_unit_size_id: formData.unit_size_id,
        p_job_type_id: formData.job_type_id,
        p_description: formData.description || '', // Ensure description is not null
        p_scheduled_date: formattedDate,
        p_job_category_id: formData.job_category_id
      });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      if (!data) throw new Error('Failed to create job');

      navigate(`/dashboard/jobs/${data.id}`);
    } catch (err) {
      console.error('Error details:', err);
      setError(err instanceof Error ? err.message : 'Failed to create job request');
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/dashboard/jobs')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Job Request</h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Property Information</h2>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="property_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Select Property
                </label>
                <select
                  id="property_id"
                  name="property_id"
                  required
                  value={formData.property_id}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a property</option>
                  {properties.map(property => (
                    <option key={property.id} value={property.id}>
                      {property.property_name} | {formatPropertyAddress(property)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="unit_number" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Unit #
                </label>
                <input
                  type="text"
                  id="unit_number"
                  name="unit_number"
                  required
                  value={formData.unit_number}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter unit number"
                />
              </div>

              <div>
                <label htmlFor="unit_size_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Unit Size
                </label>
                <select
                  id="unit_size_id"
                  name="unit_size_id"
                  required
                  value={formData.unit_size_id}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a unit size</option>
                  {unitSizes.map(size => (
                    <option key={size.id} value={size.id}>
                      {size.unit_size_label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Job Details</h2>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="scheduled_date" className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Schedule Work Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    id="scheduled_date"
                    name="scheduled_date"
                    required
                    value={formData.scheduled_date}
                    onChange={handleChange}
                    className="w-full h-12 px-4 pr-12 bg-white dark:bg-[#0F172A] border-2 border-gray-200 dark:border-[#2D3B4E] rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 shadow-sm hover:border-gray-300 dark:hover:border-[#374151] hover:shadow-md"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="job_category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Job Category
                </label>
                <select
                  id="job_category_id"
                  name="job_category_id"
                  required
                  value={formData.job_category_id}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a job category</option>
                  {jobCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="job_type_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Job Type (Scheduling Reference)
                </label>
                <select
                  id="job_type_id"
                  name="job_type_id"
                  required
                  value={formData.job_type_id}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a job type</option>
                  {jobTypes.map(jobType => (
                    <option key={jobType.id} value={jobType.id}>
                      {jobType.job_type_label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Job Request Notes / Additional Info
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter job request notes and additional information..."
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => navigate('/dashboard/jobs')}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Job Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}