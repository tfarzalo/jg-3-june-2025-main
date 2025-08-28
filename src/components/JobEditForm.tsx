import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatDateForInput } from '../lib/dateUtils';
import { JobType } from '../lib/types';
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

interface JobPhase {
  id: string;
  job_phase_label: string;
  color_light_mode: string;
  color_dark_mode: string;
  sort_order: number;
  order_index: number;
  created_at: string;
}

interface JobCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface Job {
  id: string;
  property_id: string;
  unit_number: string;
  unit_size_id: string;
  job_type_id: string;
  job_category_id: string | null;
  description: string;
  scheduled_date: string;
  job_phase: JobPhase;
}

export function JobEditForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [unitSizes, setUnitSizes] = useState<UnitSize[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [jobPhases, setJobPhases] = useState<JobPhase[]>([]);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [formData, setFormData] = useState({
    property_id: '',
    unit_number: '',
    unit_size_id: '',
    job_category_id: '',
    job_type_id: '',
    description: '',
    scheduled_date: ''
  });

  useEffect(() => {
    if (!jobId) {
      navigate('/dashboard/jobs');
      return;
    }
    Promise.all([
      fetchJob(),
      fetchProperties(),
      fetchUnitSizes(),
      fetchJobTypes(),
      fetchJobPhases()
    ]);
  }, [jobId, navigate]);

  // Fetch job categories when property changes
  useEffect(() => {
    if (formData.property_id) {
      fetchPropertyJobCategories(formData.property_id);
    } else {
      setJobCategories([]);
    }
  }, [formData.property_id]);

  const fetchJob = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          property_id,
          unit_number,
          unit_size_id,
          job_type_id,
          job_category_id,
          description,
          scheduled_date,
          job_phase:current_phase_id (
            id,
            job_phase_label,
            color_light_mode,
            color_dark_mode,
            sort_order,
            order_index,
            created_at
          )
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Job not found');

      setFormData({
        property_id: data.property_id,
        unit_number: data.unit_number,
        unit_size_id: data.unit_size_id,
        job_category_id: data.job_category_id || '',
        job_type_id: data.job_type_id,
        description: data.description || '',
        scheduled_date: formatDateForInput(data.scheduled_date)
      });

      setLoadingJob(false);
    } catch (err) {
      console.error('Error fetching job:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job');
      setLoadingJob(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_archived', false)
        .order('property_name');

      if (error) throw error;
      setProperties(data || []);
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job types');
    }
  };

  const fetchJobPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('job_phases')
        .select('id, job_phase_label, color_light_mode, color_dark_mode, sort_order, order_index, created_at')
        .order('sort_order');

      if (error) throw error;
      setJobPhases(data || []);
    } catch (err) {
      console.error('Error fetching job phases:', err);
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

    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          property_id: formData.property_id,
          unit_number: formData.unit_number,
          unit_size_id: formData.unit_size_id,
          job_category_id: formData.job_category_id || null,
          job_type_id: formData.job_type_id,
          description: formData.description,
          scheduled_date: formData.scheduled_date
        })
        .eq('id', jobId);

      if (error) throw error;

      navigate(`/dashboard/jobs/${jobId}`);
    } catch (err) {
      console.error('Error updating job:', err);
      setError(err instanceof Error ? err.message : 'Failed to update job');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      // Delete related job phase changes first
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .delete()
        .eq('job_id', jobId);

      if (phaseChangeError) throw phaseChangeError;

      // Then delete the job
      const { error: jobError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (jobError) throw jobError;

      navigate('/dashboard/jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job');
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loadingJob) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/dashboard/jobs/${jobId}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Job Request</h1>
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
                <label htmlFor="scheduled_date" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Schedule Work Date
                </label>
                <input
                  type="date"
                  id="scheduled_date"
                  name="scheduled_date"
                  required
                  value={formData.scheduled_date}
                  onChange={handleChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </button>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/jobs/${jobId}`)}
                className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Job</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete this job? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete Job'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}