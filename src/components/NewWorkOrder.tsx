import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  FileText, 
  Calendar, 
  Save, 
  AlertCircle,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/dateUtils';
import { toast } from 'sonner';
import ImageUpload from './ImageUpload';
import { ImageGallery } from './ImageGallery';
import { useSubcontractorPreview } from '../contexts/SubcontractorPreviewContext';
import { toast as hotToast } from 'react-hot-toast';

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
  unit_size: {
    id: string;
    unit_size_label: string;
  } | null;
  job_type: {
    id: string;
    job_type_label: string;
  } | null;
  job_phase: {
    id: string;
    job_phase_label: string;
    color_dark_mode: string;
  } | null;
  work_order?: WorkOrder;
  is_occupied: boolean;
  is_full_paint: boolean;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
  painted_patio: boolean;
  painted_garage: boolean;
  painted_cabinets: boolean;
  painted_crown_molding: boolean;
  painted_front_door: boolean;
  has_accent_wall: boolean;
  accent_wall_type: string;
  accent_wall_count: number;
  has_extra_charges: boolean;
  extra_charges_description: string;
  extra_hours: number;
  additional_comments: string;
  created_by: string;
}

interface UnitSize {
  id: string;
  unit_size_label: string;
}

interface WorkOrder {
  id: string;
  job_id: string;
  prepared_by: string;
  submission_date: string;
  unit_number: string;
  is_occupied: boolean;
  is_full_paint: boolean;
  job_type?: string;
  job_category_id: string;
  has_sprinklers: boolean;
  sprinklers_painted: boolean;
  painted_ceilings: boolean;
  ceiling_rooms_count: number;
  painted_patio: boolean;
  painted_garage: boolean;
  painted_cabinets: boolean;
  painted_crown_molding: boolean;
  painted_front_door: boolean;
  has_accent_wall: boolean;
  accent_wall_type: string;
  accent_wall_count: number;
  has_extra_charges: boolean;
  extra_charges_description: string;
  extra_hours: number;
  additional_comments: string;
}

interface JobCategory {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

const NewWorkOrder = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const previewUserId = queryParams.get('userId');
  const isEditMode = queryParams.get('edit') === 'true';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobPhases, setJobPhases] = useState<{ id: string; job_phase_label: string }[]>([]);
  const [unitSizes, setUnitSizes] = useState<UnitSize[]>([]);
  const [existingWorkOrder, setExistingWorkOrder] = useState<WorkOrder | null>(null);
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [refreshImages, setRefreshImages] = useState(0);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<Set<string>>(new Set());
  
  // Form state
  const [formData, setFormData] = useState({
    unit_number: '',
    is_occupied: false,
    is_full_paint: false,
    job_type: '',
    job_category_id: '',
    has_sprinklers: false,
    sprinklers: false,
    sprinklers_painted: false,
    painted_ceilings: false,
    ceiling_rooms_count: 0,
    painted_patio: false,
    painted_garage: false,
    painted_cabinets: false,
    painted_crown_molding: false,
    painted_front_door: false,
    has_accent_wall: false,
    accent_wall_type: '',
    accent_wall_count: 0,
    has_extra_charges: false,
    extra_charges_description: '',
    extra_hours: 0,
    additional_comments: ''
  });

  const { previewUserId: subcontractorPreviewUserId } = useSubcontractorPreview();

  useEffect(() => {
    if (!jobId) {
      navigate('/dashboard/subcontractor');
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // First fetch unit sizes since we need them for the form
        await fetchUnitSizes();
        // Then fetch the rest of the data
        await Promise.all([
          fetchJob(),
          fetchJobPhases(),
          fetchExistingWorkOrder()
        ]);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLoading(false);
      }
    };

    void fetchData();
  }, [jobId, navigate]);
  
  useEffect(() => {
    if (existingWorkOrder) {
      setFormData({
        unit_number: existingWorkOrder.unit_number || '',
        is_occupied: existingWorkOrder.is_occupied || false,
        is_full_paint: existingWorkOrder.is_full_paint || false,
        job_type: existingWorkOrder.job_type || '',
        job_category_id: existingWorkOrder.job_category_id || '',
        has_sprinklers: existingWorkOrder.has_sprinklers || false,
        sprinklers: existingWorkOrder.has_sprinklers || false,
        sprinklers_painted: existingWorkOrder.sprinklers_painted || false,
        painted_ceilings: existingWorkOrder.painted_ceilings || false,
        ceiling_rooms_count: existingWorkOrder.ceiling_rooms_count || 0,
        painted_patio: existingWorkOrder.painted_patio || false,
        painted_garage: existingWorkOrder.painted_garage || false,
        painted_cabinets: existingWorkOrder.painted_cabinets || false,
        painted_crown_molding: existingWorkOrder.painted_crown_molding || false,
        painted_front_door: existingWorkOrder.painted_front_door || false,
        has_accent_wall: existingWorkOrder.has_accent_wall || false,
        accent_wall_type: existingWorkOrder.accent_wall_type || '',
        accent_wall_count: existingWorkOrder.accent_wall_count || 0,
        has_extra_charges: existingWorkOrder.has_extra_charges || false,
        extra_charges_description: existingWorkOrder.extra_charges_description || '',
        extra_hours: existingWorkOrder.extra_hours || 0,
        additional_comments: existingWorkOrder.additional_comments || ''
      });
    } else if (job) {
      setFormData({
        unit_number: job.unit_number || '',
        is_occupied: job.is_occupied || false,
        is_full_paint: job.is_full_paint || false,
        job_type: job.job_type?.job_type_label || '',
        job_category_id: job.job_category_id || '',
        has_sprinklers: job.has_sprinklers || false,
        sprinklers: job.has_sprinklers || false,
        sprinklers_painted: job.sprinklers_painted || false,
        painted_ceilings: job.painted_ceilings || false,
        ceiling_rooms_count: job.ceiling_rooms_count || 0,
        painted_patio: job.painted_patio || false,
        painted_garage: job.painted_garage || false,
        painted_cabinets: job.painted_cabinets || false,
        painted_crown_molding: job.painted_crown_molding || false,
        painted_front_door: job.painted_front_door || false,
        has_accent_wall: job.has_accent_wall || false,
        accent_wall_type: job.accent_wall_type || '',
        accent_wall_count: job.accent_wall_count || 0,
        has_extra_charges: job.has_extra_charges || false,
        extra_charges_description: job.extra_charges_description || '',
        extra_hours: job.extra_hours || 0,
        additional_comments: job.additional_comments || ''
      });
    }
  }, [existingWorkOrder, job]);
  
  const fetchJob = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          property:properties(*),
          unit_size:unit_sizes(*),
          job_type:job_types(*),
          job_phase:job_phases(*)
        `)
        .eq('id', jobId)
        .single();

      if (error) {
        console.error('Error fetching job:', error);
        throw error;
      }

      if (!data) {
        console.error('No job data found');
        throw new Error('Job not found');
      }

      // Map the job data to include all required fields
      const mappedJob: Job = {
        ...data,
        is_occupied: data.is_occupied ?? false,
        is_full_paint: data.is_full_paint ?? false,
        job_category: data.job_category ?? 'Regular Paint',
        has_sprinklers: data.has_sprinklers ?? false,
        sprinklers_painted: data.sprinklers_painted ?? false,
        painted_ceilings: data.painted_ceilings ?? false,
        ceiling_rooms_count: data.ceiling_rooms_count ?? 0,
        painted_patio: data.painted_patio ?? false,
        painted_garage: data.painted_garage ?? false,
        painted_cabinets: data.painted_cabinets ?? false,
        painted_crown_molding: data.painted_crown_molding ?? false,
        painted_front_door: data.painted_front_door ?? false,
        has_accent_wall: data.has_accent_wall ?? false,
        accent_wall_type: data.accent_wall_type ?? '',
        accent_wall_count: data.accent_wall_count ?? 0,
        has_extra_charges: data.has_extra_charges ?? false,
        extra_charges_description: data.extra_charges_description ?? '',
        extra_hours: data.extra_hours ?? 0,
        additional_comments: data.additional_comments ?? ''
      };

      console.log('Mapped job data:', mappedJob);
      setJob(mappedJob);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchJob:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch job details');
      setLoading(false);
    }
  };
  
  const fetchJobPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('job_phases')
        .select('id, job_phase_label')
        .order('sort_order');
        
      if (error) throw error;
      setJobPhases(data || []);
    } catch (err) {
      console.error('Error fetching job phases:', err);
    }
  };
  
  const fetchUnitSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('unit_sizes')
        .select('id, unit_size_label')
        .order('unit_size_label');
        
      if (error) throw error;
      console.log('Fetched unit sizes:', data);
      setUnitSizes(data || []);
    } catch (err) {
      console.error('Error fetching unit sizes:', err);
    }
  };
  
  const fetchExistingWorkOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) {
        console.error('Error fetching existing work order:', error);
        return;
      }
      
      if (data) {
        setExistingWorkOrder(data as WorkOrder);
      }
    } catch (err) {
      console.error('Error fetching existing work order:', err);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      if (!job) throw new Error('Job not found');
      
      // Get the target phase ID based on whether there are extra charges
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .eq('job_phase_label', formData.has_extra_charges ? 'Pending Work Order' : 'Work Order');
        
      if (phaseError) {
        console.error('Error fetching phase:', phaseError);
        throw phaseError;
      }
      if (!phaseData || phaseData.length === 0) throw new Error('Target phase not found');
      
      const targetPhaseId = phaseData[0].id;
      
      // Create or update work order
      const workOrderData = {
        job_id: job.id,
        unit_number: formData.unit_number,
        unit_size: job.unit_size?.unit_size_label,
        is_occupied: formData.is_occupied,
        is_full_paint: formData.is_full_paint,
        job_category_id: formData.job_category_id,
        has_sprinklers: formData.has_sprinklers,
        sprinklers_painted: formData.sprinklers_painted,
        painted_ceilings: formData.painted_ceilings,
        ceiling_rooms_count: formData.ceiling_rooms_count || 0,
        painted_patio: formData.painted_patio,
        painted_garage: formData.painted_garage,
        painted_cabinets: formData.painted_cabinets,
        painted_crown_molding: formData.painted_crown_molding,
        painted_front_door: formData.painted_front_door,
        has_accent_wall: formData.has_accent_wall,
        accent_wall_type: formData.accent_wall_type || null,
        accent_wall_count: formData.accent_wall_count || 0,
        has_extra_charges: formData.has_extra_charges,
        extra_charges_description: formData.extra_charges_description || null,
        extra_hours: formData.extra_hours || 0,
        additional_comments: formData.additional_comments || null,
        prepared_by: (await supabase.auth.getUser()).data.user?.id
      };

      console.log('Submitting work order data:', workOrderData);
      
      let workOrderResult;
      
      if (existingWorkOrder) {
        // Update existing work order
        const { data, error } = await supabase
          .from('work_orders')
          .update(workOrderData)
          .eq('id', existingWorkOrder.id)
          .select()
          .single();
        workOrderResult = { data, error };
      } else {
        // Create new work order
        const { data, error } = await supabase
          .from('work_orders')
          .insert([workOrderData])
          .select()
          .single();
        workOrderResult = { data, error };
      }
      
      if (workOrderResult.error) {
        console.error('Error creating/updating work order:', workOrderResult.error);
        throw workOrderResult.error;
      }

      if (!workOrderResult.data) {
        throw new Error('No data returned from work order creation/update');
      }
      
      // Set the work order ID for image uploads
      setWorkOrderId(workOrderResult.data.id);
      
      // Update job phase
      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .update({ current_phase_id: targetPhaseId })
        .eq('id', job.id);
        
      if (jobUpdateError) {
        console.error('Error updating job phase:', jobUpdateError);
        throw jobUpdateError;
      }
      
      // Create job phase change record
      const { error: phaseChangeError } = await supabase
        .from('job_phase_changes')
        .insert([{
          job_id: job.id,
          changed_by: previewUserId || (await supabase.auth.getUser()).data.user?.id,
          from_phase_id: job.job_phase?.id,
          to_phase_id: targetPhaseId,
          change_reason: formData.has_extra_charges 
            ? 'Work order created with extra charges' 
            : 'Work order created'
        }]);
        
      if (phaseChangeError) {
        console.error('Error creating phase change record:', phaseChangeError);
        throw phaseChangeError;
      }
      
      // Delete marked images
      for (const filePath of imagesToDelete) {
        // Remove from storage
        const { error: storageError } = await supabase.storage
          .from('work_orders')
          .remove([filePath.replace(/^\/+/, '')]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }

        // Remove from database
        const { error: dbError } = await supabase
          .from('files')
          .delete()
          .eq('path', filePath);

        if (dbError) {
          console.error('Error deleting file record:', dbError);
        }
      }
      
      // Clear the images to delete set after successful submission
      setImagesToDelete(new Set());
      
      toast.success(existingWorkOrder ? 'Work order updated successfully' : 'Work order created successfully');
      
      // Redirect back to job details page
      navigate(`/dashboard/jobs/${jobId}`);
    } catch (err) {
      console.error('Error creating/updating work order:', err);
      setError(err instanceof Error ? err.message : 'Failed to create/update work order');
      setSaving(false);
    }
  };
  
  const handleImageUploadComplete = () => {
    setRefreshImages(prev => prev + 1);
  };
  
  const formatWorkOrderNumber = (num: number) => {
    return `WO-${String(num).padStart(6, '0')}`;
  };
  
  const checkPhase = async () => {
    if (!job) {
      return null;
    }

    try {
      // If user is admin/manager, allow submission regardless of phase
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userData.user.id)
          .single();
          
        if (profile?.role === 'admin' || profile?.role === 'jg_management') {
          return null; // Continue with the form
        }
      }

      // For non-admin users, check phase restrictions
      if (job.job_phase?.job_phase_label !== 'Job Request' && !previewUserId) {
        // If the job is in Work Order phase but has no work order, allow submission
        if (job.job_phase?.job_phase_label === 'Work Order' && !job.work_order) {
          return null; // Continue with the form
        }
        return 'Work order already submitted';
      }
      return null;
    } catch (err) {
      console.error('Error checking phase:', err);
      return 'Error checking job phase';
    }
  };

  // Move useEffect outside of any conditional logic
  useEffect(() => {
    const checkPhaseAndUpdate = async () => {
      if (job?.job_phase) {
        const phaseCheck = await checkPhase();
        if (phaseCheck) {
          setError(phaseCheck);
        }
      }
    };
    void checkPhaseAndUpdate();
  }, [job?.job_phase]);

  const handleUploadComplete = (filePath: string) => {
    toast.success('Image uploaded successfully');
    // Optionally refresh the images list if needed
  };

  const handleUploadError = (error: string) => {
    toast.error(error);
  };

  const handleImageDelete = (filePath: string) => {
    setImagesToDelete(prev => new Set([...prev, filePath]));
  };

  useEffect(() => {
    if (job?.property?.id) {
      fetchJobCategories();
    }
  }, [job?.property?.id]);

  const fetchJobCategories = async () => {
    try {
      if (!job?.property?.id) {
        throw new Error('Job property not found');
      }

      // Get billing categories for this property
      const { data: billingCategories, error: billingError } = await supabase
        .from('billing_categories')
        .select('name')
        .eq('property_id', job.property.id);

      if (billingError) throw billingError;

      if (!billingCategories || billingCategories.length === 0) {
        setJobCategories([]);
        return;
      }

      // Get job categories that match the billing categories
      const { data: jobCategories, error: categoriesError } = await supabase
        .from('job_categories')
        .select('*')
        .in('name', billingCategories.map(bc => bc.name))
        .order('sort_order');

      if (categoriesError) throw categoriesError;
      setJobCategories(jobCategories || []);
    } catch (err) {
      console.error('Error fetching job categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job categories');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error || !job) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          <h3 className="font-medium mb-2">Error Loading Work Order</h3>
          <p className="mb-4">{error || 'Job not found'}</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                if (previewUserId) {
                  navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
                } else {
                  navigate('/dashboard/subcontractor');
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Add null check for job.unit_size
  if (!job?.unit_size) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-[#0F172A]">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          <h3 className="font-medium mb-2">Error Loading Work Order</h3>
          <p className="mb-4">Unit size information is missing for this job.</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                if (previewUserId) {
                  navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
                } else {
                  navigate('/dashboard/subcontractor');
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-[#0F172A] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (previewUserId) {
                  navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
                } else {
                  navigate('/dashboard/jobs');
                }
              }}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? 'Edit Work Order' : 'Add Work Order'}
            </h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Job Details Section */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow-lg mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Property
              </label>
              <div className="text-gray-900 dark:text-white font-medium flex items-center">
                <Building2 className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                {job.property?.property_name}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Work Order #
              </label>
              <div className="text-gray-900 dark:text-white font-medium flex items-center">
                <FileText className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                {formatWorkOrderNumber(job.work_order_num)}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Unit #
              </label>
              <div className="text-gray-900 dark:text-white font-medium">
                {job.unit_number}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Job Type
              </label>
              <div className="text-gray-900 dark:text-white font-medium">
                {job.job_type?.job_type_label || 'Not specified'}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Unit Size
              </label>
              <div className="text-gray-900 dark:text-white font-medium">
                {job.unit_size?.unit_size_label}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Scheduled Date
              </label>
              <div className="text-gray-900 dark:text-white font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                {formatDate(job.scheduled_date)}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Unit Information */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Unit Information</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                  onChange={handleInputChange}
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="job_category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Job Category
                </label>
                {jobCategories.length === 0 ? (
                  <div className="text-yellow-600 dark:text-yellow-400 mb-4">
                    No billable categories available for this property. Please add billing details for the property first.
                  </div>
                ) : (
                  <select
                    id="job_category_id"
                    name="job_category_id"
                    required
                    value={formData.job_category_id}
                    onChange={handleInputChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a job category</option>
                    {jobCategories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_occupied"
                  name="is_occupied"
                  checked={formData.is_occupied}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_occupied: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_occupied" className="ml-2 block text-sm text-gray-900 dark:text-white">
                  Unit is Occupied
                </label>
              </div>
            </div>
          </div>

          {/* Sprinklers */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Sprinklers</h2>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sprinklers"
                  checked={formData.sprinklers}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    sprinklers: e.target.checked,
                    has_sprinklers: e.target.checked 
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="sprinklers" className="ml-2 block text-sm text-gray-900 dark:text-white">
                  Unit Has Sprinklers
                </label>
              </div>
              
              {formData.sprinklers && (
                <>
                  <div className="flex items-center mt-4">
                    <input
                      type="checkbox"
                      id="sprinklers_painted"
                      checked={formData.sprinklers_painted}
                      onChange={e => setFormData(prev => ({ ...prev, sprinklers_painted: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="sprinklers_painted" className="ml-2 block text-sm text-gray-900 dark:text-white">
                      Paint on Sprinklers
                    </label>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sprinkler Images
                    </label>
                    <ImageUpload
                      jobId={jobId || ''}
                      workOrderId={existingWorkOrder?.id || ''}
                      folder="sprinkler"
                      onUploadComplete={handleUploadComplete}
                      onError={handleUploadError}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Before Images */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Before Images</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Before Images
                </label>
                <ImageUpload
                  jobId={jobId || ''}
                  workOrderId={existingWorkOrder?.id || ''}
                  folder="before"
                  onUploadComplete={handleUploadComplete}
                  onError={handleUploadError}
                  onImageDelete={handleImageDelete}
                />
              </div>
            </div>
          </div>

          {/* Other Files */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Other Files</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Files (All File Types)
                </label>
                <ImageUpload
                  jobId={jobId || ''}
                  workOrderId={existingWorkOrder?.id || ''}
                  folder="other"
                  onUploadComplete={handleUploadComplete}
                  onError={handleUploadError}
                  onImageDelete={handleImageDelete}
                />
              </div>
            </div>
          </div>

          {/* Painted Items */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Painted Items</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_ceilings"
                    name="painted_ceilings"
                    checked={formData.painted_ceilings}
                    onChange={(e) => setFormData(prev => ({ ...prev, painted_ceilings: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_ceilings" className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Painted Ceilings
                  </label>
                </div>
                
                {formData.painted_ceilings && (
                  <div className="ml-6">
                    <label htmlFor="ceiling_rooms_count" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Number of Rooms
                    </label>
                    <input
                      type="number"
                      id="ceiling_rooms_count"
                      name="ceiling_rooms_count"
                      min="0"
                      value={formData.ceiling_rooms_count}
                      onChange={handleInputChange}
                      className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_patio"
                    name="painted_patio"
                    checked={formData.painted_patio}
                    onChange={(e) => setFormData(prev => ({ ...prev, painted_patio: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_patio" className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Painted Patio
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_garage"
                    name="painted_garage"
                    checked={formData.painted_garage}
                    onChange={(e) => setFormData(prev => ({ ...prev, painted_garage: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_garage" className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Painted Garage
                  </label>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_cabinets"
                    name="painted_cabinets"
                    checked={formData.painted_cabinets}
                    onChange={(e) => setFormData(prev => ({ ...prev, painted_cabinets: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_cabinets" className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Painted Cabinets
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_crown_molding"
                    name="painted_crown_molding"
                    checked={formData.painted_crown_molding}
                    onChange={(e) => setFormData(prev => ({ ...prev, painted_crown_molding: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_crown_molding" className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Painted Crown Molding
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="painted_front_door"
                    name="painted_front_door"
                    checked={formData.painted_front_door}
                    onChange={(e) => setFormData(prev => ({ ...prev, painted_front_door: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="painted_front_door" className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Painted Front Door
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Accent Wall */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <div className="flex items-center mb-6">
              <input
                type="checkbox"
                id="has_accent_wall"
                name="has_accent_wall"
                checked={formData.has_accent_wall}
                onChange={(e) => setFormData(prev => ({ ...prev, has_accent_wall: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="has_accent_wall" className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
                Accent Wall
              </label>
            </div>
            
            {formData.has_accent_wall && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="accent_wall_type" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Accent Wall Type
                  </label>
                  <select
                    id="accent_wall_type"
                    name="accent_wall_type"
                    required={formData.has_accent_wall}
                    value={formData.accent_wall_type}
                    onChange={handleInputChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type</option>
                    <option value="Custom">Custom</option>
                    <option value="Paint Over">Paint Over</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="accent_wall_count" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Number of Accent Walls
                  </label>
                  <input
                    type="number"
                    id="accent_wall_count"
                    name="accent_wall_count"
                    min="0"
                    required={formData.has_accent_wall}
                    value={formData.accent_wall_count}
                    onChange={handleInputChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Extra Charges */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <div className="flex items-center mb-6">
              <input
                type="checkbox"
                id="has_extra_charges"
                name="has_extra_charges"
                checked={formData.has_extra_charges}
                onChange={(e) => setFormData(prev => ({ ...prev, has_extra_charges: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="has_extra_charges" className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
                Extra Charges
              </label>
            </div>
            
            {formData.has_extra_charges && (
              <div className="space-y-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg mb-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Extra Charges Require Approval</p>
                      <p className="mt-1 text-sm">Adding extra charges will set this job to "Pending Work Order" status until the charges are approved.</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="extra_charges_description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Description
                  </label>
                  <textarea
                    id="extra_charges_description"
                    name="extra_charges_description"
                    rows={3}
                    required={formData.has_extra_charges}
                    value={formData.extra_charges_description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the extra charges"
                  />
                </div>
                
                <div>
                  <label htmlFor="extra_hours" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Extra Hours
                  </label>
                  <input
                    type="number"
                    id="extra_hours"
                    name="extra_hours"
                    min="0"
                    required={formData.has_extra_charges}
                    value={formData.extra_hours}
                    onChange={handleInputChange}
                    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Additional Comments */}
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Additional Comments</h2>
            
            <div>
              <textarea
                id="additional_comments"
                name="additional_comments"
                rows={4}
                value={formData.additional_comments}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter any additional comments or notes"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/jobs')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Update Work Order' : 'Create Work Order'}
                </span>
              )}
            </button>
          </div>
        </form>

        {/* Add image upload and gallery after the form */}
        {workOrderId && (
          <div className="mt-8 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Work Order Images
            </h2>
            
            <ImageGallery
              workOrderId={workOrderId}
              key={refreshImages}
            />
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  if (previewUserId) {
                    navigate(`/dashboard/subcontractor?userId=${previewUserId}`);
                  } else {
                    navigate('/dashboard/subcontractor');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewWorkOrder;