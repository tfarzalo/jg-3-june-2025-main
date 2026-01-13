import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowLeft, Upload, X, Image, FileText } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { getCurrentDateInEastern, formatDateForInput } from '../lib/dateUtils';
import { JobType } from '../lib/types';
import { useAuth } from '../contexts/AuthProvider';
import { WorkOrderLink } from './shared/WorkOrderLink';
import { PropertyLink } from './shared/PropertyLink';
import { optimizeImage } from '../lib/utils/imageOptimization';
import { useUnsavedChangesPrompt } from '../hooks/useUnsavedChangesPrompt';

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { attemptNavigate } = useUnsavedChangesPrompt(hasChanges, async () => {
    const fakeEvent = { preventDefault() {} } as any;
    await handleSubmit(fakeEvent);
  });

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
    // Ensure we start with a clean YYYY-MM-DD date
    const currentDate = getCurrentDateInEastern();
    console.log('JobRequestForm: Initial scheduled_date:', formData.scheduled_date);
    console.log('JobRequestForm: Current date in Eastern:', currentDate);
    
    // Only update if it's empty or invalid
    if (!formData.scheduled_date) {
      setFormData(prev => ({ ...prev, scheduled_date: currentDate }));
      console.log('JobRequestForm: set scheduled_date to:', currentDate);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setHasChanges(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setHasChanges(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const sanitizeFilename = (filename: string) => {
    const name = filename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    return name;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-5 w-5" />;
    }
    return <FileText className="h-5 w-5" />;
  };

  const uploadFilesToJob = async (jobId: string, propertyName: string, workOrderNum: number) => {
    if (selectedFiles.length === 0) return;

    try {
      const targetFolderType = 'job_files';

      // Ensure the Work Order and Job Files subfolder exist and get definitive IDs/paths
      const { data: jobFilesFolderId, error: jobFilesErr } = await supabase.rpc('get_upload_folder', {
        p_property_id: formData.property_id,
        p_job_id: jobId,
        p_folder_type: targetFolderType
      });
      if (jobFilesErr || !jobFilesFolderId) {
        console.error('Failed to ensure Job Files folder:', jobFilesErr);
        throw new Error('Failed to ensure Job Files folder');
      }

      // Resolve the canonical path for the Job Files folder (with retry in case of immediate creation lag)
      let folderPath = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: folderInfo, error: folderInfoError } = await supabase
          .from('files')
          .select('path')
          .eq('id', jobFilesFolderId)
          .maybeSingle();
        if (!folderInfoError && folderInfo?.path) {
          folderPath = folderInfo.path;
          break;
        }
        await new Promise(res => setTimeout(res, 200));
      }
      if (!folderPath) {
        throw new Error('Failed to resolve Job Files folder path after retries');
      }

      // Compute starting index for auto naming in 'other' category
      let nextIndex = 1
      {
        const { data: existing } = await supabase
          .from('files')
          .select('name')
          .eq('folder_id', jobFilesFolderId)
          .eq('job_id', jobId)
          .eq('category', targetFolderType)
        let maxIdx = 0
        const rx = /^wo-\d+_other_(\d+)\./
        if (existing && Array.isArray(existing)) {
          for (const row of existing as any[]) {
            const m = typeof row.name === 'string' ? row.name.toLowerCase().match(rx) : null
            if (m && m[1]) {
              const n = parseInt(m[1], 10)
              if (!isNaN(n)) maxIdx = Math.max(maxIdx, n)
            }
          }
        }
        nextIndex = maxIdx + 1
      }

      // Upload each file into the resolved Job Files folder
      for (const file of selectedFiles) {
        try {
          const optimized = file.type.startsWith('image/') ? await optimizeImage(file) : { blob: file, mime: file.type || 'application/octet-stream', suggestedExt: '', width: 0, height: 0, originalSize: file.size, optimizedSize: file.size }
          const ext = optimized.suggestedExt || (file.name.split('.').pop() || 'bin')
          const woLabel = `wo-${String(workOrderNum).padStart(6, '0')}`
          const autoName = `${woLabel}_other_${nextIndex}.${ext}`
          nextIndex += 1
          const sanitizedFilename = sanitizeFilename(autoName);
          const normalizedStoragePath = `${folderPath.replace(/^\/+/, '')}/${sanitizedFilename}`.replace(/\/+/g, '/');

          const uploadFile = new File([optimized.blob], sanitizedFilename, { type: optimized.mime })
          const { error: storageError } = await supabase.storage
            .from('files')
            .upload(normalizedStoragePath, uploadFile, {
              cacheControl: '3600',
              upsert: false,
              contentType: optimized.mime
            });
          if (storageError) {
            console.error('Storage upload failed:', sanitizedFilename, storageError);
            continue;
          }

          const { error: dbError } = await supabase
            .from('files')
            .insert({
              name: sanitizedFilename,
              path: normalizedStoragePath,
              size: optimized.optimizedSize,
              original_size: optimized.originalSize,
              optimized_size: optimized.optimizedSize,
              type: uploadFile.type,
              uploaded_by: user?.id,
              property_id: formData.property_id,
              job_id: jobId,
              folder_id: jobFilesFolderId,
              category: 'other'
            });
          if (dbError) {
            console.error('DB insert failed for file:', sanitizedFilename, dbError);
          }
        } catch (err) {
          console.error('Upload pipeline error:', file.name, err);
        }
      }
    } catch (err) {
      console.error('Error in uploadFilesToJob:', err);
      setError('Failed to upload files. Please try again.');
    }
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
      const scheduledDate = formData.scheduled_date;
      console.log('JobRequestForm: Sending EXACT string to database:', scheduledDate);

      const { data, error } = await supabase.rpc('create_job', {
        p_property_id: formData.property_id,
        p_unit_number: formData.unit_number,
        p_unit_size_id: formData.unit_size_id,
        p_job_type_id: formData.job_type_id,
        p_description: formData.description || '', // Ensure description is not null
        p_scheduled_date: scheduledDate,
        p_job_category_id: formData.job_category_id || null
      });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      if (!data) throw new Error('Failed to create job');

      // Upload files if any were selected
      if (selectedFiles.length > 0) {
        await uploadFilesToJob(data.id, data.property.name, data.work_order_num);
      }

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
    setHasChanges(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => attemptNavigate(() => navigate(-1))}
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
                    onClick={(e) => e.currentTarget.showPicker?.()}
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

          {/* File Upload Section */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attach Files or Images</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Upload photos, documents, or other files related to this job request (optional)
            </p>

            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              onClick={() => document.getElementById('job-file-input')?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                id="job-file-input"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Drag and drop files here, or click to select
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Images, PDFs, and documents accepted
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-6 bg-gray-50 dark:bg-[#0F172A] rounded-lg overflow-hidden border border-gray-200 dark:border-[#2D3B4E]">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-[#2D3B4E]">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Selected Files ({selectedFiles.length})
                  </h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-[#2D3B4E] max-h-64 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-[#1E293B] transition-colors">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {getFileIcon(file.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="ml-3 text-gray-400 hover:text-red-600 dark:hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label="Remove file"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => attemptNavigate(() => navigate(-1))}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{selectedFiles.length > 0 ? 'Creating & Uploading...' : 'Creating...'}</span>
                </span>
              ) : (
                `Create Job Request${selectedFiles.length > 0 ? ` (${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''})` : ''}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
