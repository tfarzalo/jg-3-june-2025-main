import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { debounce } from '../lib/utils/debounce';
import { normalizeJobDetails, JobDetailsNormalized } from '@/utils/normalizeJobDetails';

// Helper function for safe phase label access
export function getPhaseLabel(obj?: any) {
  return obj?.job_phase?.label ?? obj?.job_phase?.name ?? '—';
}

export interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  description: string;
  scheduled_date: string;
  assigned_to: string | null;
  job_category?: {
    id: string;
    name: string;
    description: string | null;
  };
  property: {
    id: string;
    name: string;
    address: string;
    address_2: string | null;
    city: string;
    state: string;
    zip: string;
    ap_name: string | null;
    ap_email: string | null;
    quickbooks_number: string | null;
    is_archived: boolean;
  };
  unit_size: {
    id: string;
    label: string;
  };
  job_type: {
    id: string;
    label: string;
  };
  job_phase?: {
    id: string;
    label: string;
    color_light_mode: string;
    color_dark_mode: string;
  } | null;
  work_order?: {
    id: string;
    submission_date: string;
    unit_number: string;
    is_occupied: boolean;
    is_full_paint: boolean;
    unit_size: string;
    job_category: string;
    has_sprinklers: boolean;
    sprinklers_painted: boolean;
    painted_ceilings: boolean;
    ceiling_rooms_count: number;
    individual_ceiling_count?: number | null;
    ceiling_display_label?: string | null;
    ceiling_billing_detail_id?: string | null;
    painted_patio: boolean;
    painted_garage: boolean;
    painted_cabinets: boolean;
    painted_crown_molding: boolean;
    painted_front_door: boolean;
    has_accent_wall: boolean;
    accent_wall_type: string | null;
    accent_wall_count: number;
    accent_wall_billing_detail_id?: string | null;
    has_extra_charges: boolean;
    extra_charges_description: string | null;
    extra_hours: number;
    additional_comments: string | null;
    is_active: boolean;
  };
  billing_details?: {
    bill_amount: number;
    sub_pay_amount: number;
    profit_amount: number;
    is_hourly: boolean;
    display_order: number;
    section_name: string;
    debug: {
      property_id: string;
      billing_category_id: string;
      billing_category_name: string;
      unit_size_id: string;
      job_category_name: string;
      bill_amount: number;
      sub_pay_amount: number;
      raw_record: any;
      record_count: number;
      billing_category_exists: boolean;
      unit_size_exists: boolean;
      matching_billing_categories: any[];
      query_params: {
        property_id: string;
        billing_category_id: string;
        unit_size_id: string;
        is_hourly: boolean;
      };
    };
  };
  hourly_billing_details?: {
    bill_amount: number;
    sub_pay_amount: number;
    profit_amount: number;
    is_hourly: boolean;
    display_order: number;
    section_name: string;
    debug: {
      property_id: string;
      billing_category_id: string;
      billing_category_name: string;
      unit_size_id: string;
      job_category_name: string;
      bill_amount: number;
      sub_pay_amount: number;
      raw_record: any;
      record_count: number;
      billing_category_exists: boolean;
      unit_size_exists: boolean;
      matching_billing_categories: any[];
      query_params: {
        property_id: string;
        billing_category_id: string;
        unit_size_id: string;
        is_hourly: boolean;
      };
    };
  };
  extra_charges_details?: {
    description: string;
    hours: number;
    amount: number;
    display_order: number;
    section_name: string;
    debug: {
      property_id: string;
      billing_category_id: string;
      billing_category_name: string;
      unit_size_id: string;
      job_category_name: string;
      bill_amount: number;
      sub_pay_amount: number;
      raw_record: any;
      record_count: number;
      billing_category_exists: boolean;
      unit_size_exists: boolean;
      matching_billing_categories: any[];
      query_params: {
        property_id: string;
        billing_category_id: string;
        unit_size_id: string;
        is_hourly: boolean;
      };
    };
  };
  debug_billing_joins?: {
    property_id: string;
    job_category_id: string;
    billing_category_id: string;
    billing_category_name: string;
    hourly_billing_category_id: string;
    unit_size_id: string;
    job_category_name: string;
    extra_charges: any;
    billing_counts: {
      property_total: number;
      category_total: number;
      unit_size_total: number;
      regular_total: number;
      hourly_total: number;
    };
    existence_checks: {
      billing_category_exists: boolean;
      unit_size_exists: boolean;
      hourly_billing_exists: boolean;
    };
    matching_billing_categories: any[];
    regular_billing: {
      bill_amount: number;
      sub_pay_amount: number;
      profit_amount: number;
      raw_record: any;
      record_count: number;
      query_params: {
        property_id: string;
        billing_category_id: string;
        unit_size_id: string;
        is_hourly: boolean;
      };
    };
    hourly_billing: {
      bill_amount: number;
      sub_pay_amount: number;
      profit_amount: number;
      raw_record: any;
      record_count: number;
      query_params: {
        property_id: string;
        billing_category_id: string;
        unit_size_id: string;
        is_hourly: boolean;
      };
    };
  };
  invoice_sent?: boolean;
  invoice_paid?: boolean;
  invoice_sent_date?: string;
  invoice_paid_date?: string;
}

// Normalization helpers
function normalizeJobCategory(jobCategoryId: string): string {
  // Map job category ID to billing category name
  if (!jobCategoryId) return '';
  
  // This will be replaced with a database lookup
  return jobCategoryId;
}

function normalizeUnitSize(unitSize: string): string {
  // If your billing uses "2 Bedroom" but your work order uses "2BR", map here
  // For now, assume the label matches the billing table
  return unitSize;
}

export function useJobDetails(jobId: string | undefined) {
  const [rawJob, setRawJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum time between fetches in milliseconds

  // Normalize the job data
  const job: JobDetailsNormalized | null = useMemo(
    () => (rawJob ? normalizeJobDetails(rawJob) : null),
    [rawJob]
  );

  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setRawJob(null);
      setLoading(false);
      return;
    }

    // Prevent fetching too frequently
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTimeRef.current = now;

    try {
      console.log('Fetching job details for ID:', jobId);

      // Get the job details with better error handling
      const { data, error: rpcError } = await supabase
        .rpc('get_job_details', { p_job_id: jobId });

      if (rpcError) {
        console.error('Supabase RPC error:', rpcError);
        console.error('RPC error details:', {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint
        });
        
        // If RPC fails, try fallback query
        if (rpcError.code === '401' || rpcError.message?.includes('401')) {
          console.log('401 error detected, trying fallback query...');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();
            
          if (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            setError(rpcError);
            setLoading(false);
            return;
          }
          
          if (fallbackData) {
            console.log('Fallback query successful, using basic job data');
            setRawJob(fallbackData as any);
            setLoading(false);
            return;
          }
        }
        
        // Handle specific RPC errors
        if (rpcError.message?.includes('function') && rpcError.message?.includes('does not exist')) {
          setError(new Error('Database function not found. Please contact support.'));
        } else if (rpcError.message?.includes('permission denied')) {
          setError(new Error('Permission denied. Please check your access rights.'));
        } else {
          setError(rpcError);
        }
        
        setLoading(false);
        return;
      }

      if (!data) {
        console.error('No data returned from get_job_details');
        setError(new Error('Job not found'));
        setLoading(false);
        return;
      }

      console.log('Job data received:', data);
      console.log('Job data keys:', Object.keys(data));

      // If job has an assigned_to value, fetch the subcontractor's name
      let assignedToName = null;
      if (data.assigned_to) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.assigned_to)
          .single();

        if (profileError) {
          console.error('Error fetching subcontractor profile:', profileError);
        } else if (profileData) {
          assignedToName = profileData.full_name;
        }
      }

      // If job_phase colors are missing, fetch them directly
      if (data.job_phase && (!data.job_phase.color_dark_mode || !data.job_phase.color_light_mode)) {
        console.log('Job phase colors missing, fetching directly...');
        const { data: phaseData, error: phaseError } = await supabase
          .from('job_phases')
          .select('color_dark_mode, color_light_mode')
          .eq('id', data.job_phase.id)
          .single();
          
        if (!phaseError && phaseData) {
          data.job_phase.color_dark_mode = phaseData.color_dark_mode;
          data.job_phase.color_light_mode = phaseData.color_light_mode;
          console.log('Job phase colors fetched:', phaseData);
        }
      }

      // Add the assigned_to_name to the job data
      const jobWithDetails = {
        ...data,
        assigned_to_name: assignedToName
      };

      if (isMountedRef.current) {
        setRawJob(jobWithDetails);
        setError(null);
      }
    } catch (err) {
      console.error('Error in fetchJob:', err);
      
      // Handle specific error types
      if (err instanceof Error) {
        if (err.message.includes('status code null') || err.message.includes('Request failed')) {
          console.error('Network/database connection error detected');
          setError(new Error('Unable to connect to database. Please check your connection and try again.'));
        } else {
          setError(err);
        }
      } else {
        setError(new Error('Failed to fetch job details'));
      }
      
      if (isMountedRef.current) {
        setRawJob(null);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [jobId]);

  // Create a debounced version of fetchJob
  const debouncedFetchJob = useCallback(
    debounce(() => {
      if (isMountedRef.current) {
        fetchJob();
      }
    }, 1000),
    [fetchJob]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchJob();

    // Subscribe to job changes
    const jobChannel = supabase
      .channel(`job-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${jobId}`
      }, (payload) => {
        console.log('Job change detected:', payload);
        if (isMountedRef.current) {
          debouncedFetchJob();
        }
      })
      .subscribe((status) => {
        console.log('Job subscription status:', status);
      });

    // Subscribe to work order changes
    const workOrderChannel = supabase
      .channel(`work-order-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'work_orders',
        filter: `job_id=eq.${jobId}`
      }, (payload) => {
        console.log('Work order change detected:', payload);
        if (isMountedRef.current) {
          debouncedFetchJob();
        }
      })
      .subscribe((status) => {
        console.log('Work order subscription status:', status);
      });

    // Subscribe to job phase changes for this specific job
    const phaseChangeChannel = supabase
      .channel(`phase-change-${jobId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'job_phase_changes',
        filter: `job_id=eq.${jobId}`
      }, (payload) => {
        console.log('Job phase change detected for job:', payload);
        if (isMountedRef.current) {
          // Immediate fetch for phase changes to ensure UI updates quickly
          fetchJob();
        }
      })
      .subscribe((status) => {
        console.log('Phase change subscription status:', status);
      });

    return () => {
      isMountedRef.current = false;
      jobChannel.unsubscribe();
      workOrderChannel.unsubscribe();
      phaseChangeChannel.unsubscribe();
    };
  }, [jobId, fetchJob, debouncedFetchJob]);

  return {
    job,
    loading,
    error,
    refetch: fetchJob
  };
}