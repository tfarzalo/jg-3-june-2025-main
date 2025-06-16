import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { debounce } from '../lib/utils/debounce';

interface Job {
  id: string;
  work_order_num: number;
  unit_number: string;
  description: string;
  scheduled_date: string;
  assigned_to: string | null;
  property: {
    id: string;
    name: string;
    address: string;
    address_2: string | null;
    city: string;
    state: string;
    zip: string;
  };
  unit_size: {
    id: string;
    label: string;
  };
  job_type: {
    id: string;
    label: string;
  };
  job_phase: {
    id: string;
    label: string;
    color_light_mode: string;
    color_dark_mode: string;
  };
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
    painted_patio: boolean;
    painted_garage: boolean;
    painted_cabinets: boolean;
    painted_crown_molding: boolean;
    painted_front_door: boolean;
    has_accent_wall: boolean;
    accent_wall_type: string | null;
    accent_wall_count: number;
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
    hourly_rate: number;
    sub_pay_rate: number;
    bill_amount: number;
    sub_pay_amount: number;
    profit_amount: number;
    is_hourly: boolean;
    display_order: number;
    section_name: string;
    debug: {
      hourly_bill_amount: number;
      hourly_sub_pay_amount: number;
      extra_hours: number;
      has_hourly_billing: boolean;
      raw_hourly_record: any;
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
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum time between fetches in milliseconds

  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setJob(null);
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

      // Get the job details
      const { data, error: rpcError } = await supabase
        .rpc('get_job_details', { p_job_id: jobId });

      if (rpcError) {
        console.error('Supabase RPC error:', rpcError);
        throw rpcError;
      }

      if (!data) {
        console.error('No data returned from get_job_details');
        throw new Error('Job not found');
      }

      console.log('Job data received:', data);
      console.log('Job data keys:', Object.keys(data));
      console.log('Billing details:', data.billing_details);
      console.log('Hourly billing details:', data.hourly_billing_details);
      console.log('Extra charges details:', data.extra_charges_details);
      console.log('Debug billing joins:', data.debug_billing_joins);

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

      // Add the assigned_to_name to the job data
      const jobWithDetails = {
        ...data,
        assigned_to_name: assignedToName
      };

      if (isMountedRef.current) {
        setJob(jobWithDetails);
        setError(null);
      }
    } catch (err) {
      console.error('Error in fetchJob:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch job');
        setJob(null);
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

    return () => {
      isMountedRef.current = false;
      jobChannel.unsubscribe();
      workOrderChannel.unsubscribe();
    };
  }, [jobId, fetchJob, debouncedFetchJob]);

  return {
    job,
    loading,
    error,
    refetch: fetchJob
  };
}