import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import type { Job } from './JobListingPage';
import { findBillingDetail } from '../../lib/billing/lookups';

interface UseJobFetchProps {
  phaseLabel: string | string[];
}

export function useJobFetch({ phaseLabel }: UseJobFetchProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseIds, setPhaseIds] = useState<string[]>([]);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum time between fetches in milliseconds

  const fetchJobs = useCallback(async (forceRefresh = false) => {
    // Prevent fetching too frequently unless forced
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .in('job_phase_label', Array.isArray(phaseLabel) ? phaseLabel : [phaseLabel]);

      if (phaseError) throw phaseError;
      if (!phaseData?.length) throw new Error(`${phaseLabel} phase not found`);

      // Store phase IDs for subscription filtering
      if (isMountedRef.current) {
        setPhaseIds(phaseData.map(phase => phase.id));
      }

      // Determine sort order based on phase
      let orderColumn = 'created_at';
      let ascending = false;
      
      // For Job Requests, sort by scheduled date (most recent first)
      if (phaseLabel === 'Job Request' || (Array.isArray(phaseLabel) && phaseLabel.includes('Job Request'))) {
        orderColumn = 'scheduled_date';
        ascending = false;
      } 
      // For Work Orders, Grading, Invoicing, sort by modified date (newest first)
      else if (
        phaseLabel === 'Work Order' || 
        phaseLabel === 'Pending Work Order' ||
        phaseLabel === 'Grading' || 
        phaseLabel === 'Invoicing' ||
        (Array.isArray(phaseLabel) && (
          phaseLabel.includes('Work Order') || 
          phaseLabel.includes('Pending Work Order') ||
          phaseLabel.includes('Grading') || 
          phaseLabel.includes('Invoicing')
        ))
      ) {
        orderColumn = 'updated_at';
        ascending = false;
      }

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          work_order_num,
          unit_number,
          scheduled_date,
          created_at,
          updated_at,
          total_billing_amount,
          unit_size_id,
          invoice_sent,
          invoice_paid,
          invoice_sent_date,
          invoice_paid_date,
          property:properties (
            id,
            property_name,
            address,
            city,
            state
          ),
          unit_size:unit_sizes (
            id,
            unit_size_label
          ),
          job_type:job_types (
            job_type_label
          ),
          job_phase:current_phase_id (
            job_phase_label,
            color_light_mode,
            color_dark_mode
          )
        `)
        .in('current_phase_id', phaseData.map(phase => phase.id))
        .order(orderColumn, { ascending });

      if (error) throw error;
      
      // Pre-fetch base billing for relevant property/unit size/category combos
      const propertyIds = Array.from(new Set((data || []).map(j => (Array.isArray(j.property) ? j.property[0]?.id : j.property?.id)).filter(Boolean)));
      const baseBillingMap = new Map<string, number | null>();

      if (propertyIds.length > 0) {
        const { data: billingRows } = await supabase
          .from('billing_details')
          .select('bill_amount, property_id, unit_size:unit_sizes(id,unit_size_label), category:billing_categories(name)')
          .in('property_id', propertyIds);

        billingRows?.forEach((row: any) => {
          const unitLabel = row.unit_size?.unit_size_label;
          const unitId = row.unit_size?.id;
          const categoryName = row.category?.name;
          if (!unitLabel || !categoryName) return;
          const keyId = unitId ? `${row.property_id}|${unitId}|${categoryName}` : null;
          const keyLabel = `${row.property_id}|${unitLabel}|${categoryName}`;
          if (keyId && !baseBillingMap.has(keyId)) baseBillingMap.set(keyId, row.bill_amount ?? null);
          if (!baseBillingMap.has(keyLabel)) baseBillingMap.set(keyLabel, row.bill_amount ?? null);
        });
      }
      
      if (isMountedRef.current) {
        // Cache billing lookup by property+unitSize to avoid repeated queries (fallback to RPC lookup)
        const billingCache = new Map(baseBillingMap);
        const getBaseBillForJobRequest = async (propertyId?: string, unitSizeId?: string, unitSizeLabel?: string, categoryName?: string) => {
          if (!propertyId || !categoryName) return null;
          const keysToTry = [
            unitSizeId ? `${propertyId}|${unitSizeId}|${categoryName}` : null,
            unitSizeLabel ? `${propertyId}|${unitSizeLabel}|${categoryName}` : null,
            unitSizeId ? `${propertyId}|${unitSizeId}|Regular Paint` : null,
            unitSizeLabel ? `${propertyId}|${unitSizeLabel}|Regular Paint` : null,
          ].filter(Boolean) as string[];

          for (const key of keysToTry) {
            if (billingCache.has(key)) return billingCache.get(key) ?? null;
          }

          const billing = await findBillingDetail(supabase, {
            propertyId,
            categoryName,
            unitSizeLabel,
            unitSizeId
          });
          const amount = billing?.bill_amount ?? null;
          keysToTry.forEach(key => billingCache.set(key, amount));
          return amount;
        };

        // Transform the data to match the Job interface
        const transformedJobs: Job[] = await Promise.all((data || []).map(async job => {
          const phaseLabel = Array.isArray(job.job_phase) ? job.job_phase[0]?.job_phase_label : job.job_phase?.job_phase_label;
          const jobCategory = Array.isArray(job.job_type) ? job.job_type[0]?.job_type_label : job.job_type?.job_type_label;
          let totalBillingAmount = job.total_billing_amount;

          if ((!totalBillingAmount || totalBillingAmount === 0) && phaseLabel === 'Job Request') {
            const propertyObj = Array.isArray(job.property) ? job.property[0] : job.property;
            const unitSizeObj = Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size;
            const baseBill = await getBaseBillForJobRequest(propertyObj?.id, job.unit_size_id, unitSizeObj?.unit_size_label, jobCategory);
            if (baseBill !== null) {
              totalBillingAmount = baseBill;
            }
          }

        return {
          id: job.id,
            work_order_num: job.work_order_num,
            unit_number: job.unit_number,
            scheduled_date: job.scheduled_date,
            created_at: job.created_at,
            updated_at: job.updated_at,
            total_billing_amount: totalBillingAmount,
            invoice_sent: job.invoice_sent,
            invoice_paid: job.invoice_paid,
            invoice_sent_date: job.invoice_sent_date,
            invoice_paid_date: job.invoice_paid_date,
            property: Array.isArray(job.property) ? job.property[0] : job.property,
            unit_size: Array.isArray(job.unit_size) ? job.unit_size[0] : job.unit_size,
            job_type: Array.isArray(job.job_type) ? job.job_type[0] : job.job_type,
            job_phase: Array.isArray(job.job_phase) ? job.job_phase[0] : job.job_phase
          };
        }));
        
        setJobs(transformedJobs);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [phaseLabel]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchJobs();

    return () => {
      isMountedRef.current = false;
      
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchJobs]);

  // Separate effect for subscription that depends on phaseIds
  useEffect(() => {
    if (phaseIds.length === 0) return;

    // Set up real-time subscription for job changes
    const subscription = supabase
      .channel('jobs-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: `current_phase_id=in.(${phaseIds.join(',')})`
      }, async (payload) => {
        if (isMountedRef.current) {
          console.log('New job added to phase:', payload.new);
          
          // Fetch the complete job data with relations
          const { data: newJob, error } = await supabase
            .from('jobs')
            .select(`
              id,
              work_order_num,
              unit_number,
              scheduled_date,
              unit_size_id,
              total_billing_amount,
              invoice_sent,
              invoice_paid,
              invoice_sent_date,
              invoice_paid_date,
              property:properties (
                id,
                property_name,
                address,
                city,
                state
              ),
              unit_size:unit_sizes (
                unit_size_label
              ),
              job_type:job_types (
                job_type_label
              ),
              job_phase:current_phase_id (
                job_phase_label,
                color_light_mode,
                color_dark_mode
              )
            `)
            .eq('id', payload.new.id)
            .single();
            
          if (!error && newJob) {
            const propertyObj = Array.isArray(newJob.property) ? newJob.property[0] : newJob.property;
            const unitSizeObj = Array.isArray(newJob.unit_size) ? newJob.unit_size[0] : newJob.unit_size;
            let totalBillingAmount = newJob.total_billing_amount;
            const phaseLabel = Array.isArray(newJob.job_phase) ? newJob.job_phase[0]?.job_phase_label : newJob.job_phase?.job_phase_label;
            const jobCategory = Array.isArray(newJob.job_type) ? newJob.job_type[0]?.job_type_label : newJob.job_type?.job_type_label;

            if ((!totalBillingAmount || totalBillingAmount === 0) && phaseLabel === 'Job Request') {
              const billing = await findBillingDetail(supabase, {
                propertyId: propertyObj?.id,
                categoryName: jobCategory,
                unitSizeLabel: unitSizeObj?.unit_size_label
              });
              totalBillingAmount = billing?.bill_amount ?? totalBillingAmount;
            }

            // Transform the data to match the Job interface
            const transformedJob: Job = {
              id: newJob.id,
              work_order_num: newJob.work_order_num,
              unit_number: newJob.unit_number,
              scheduled_date: newJob.scheduled_date,
              total_billing_amount: totalBillingAmount,
              invoice_sent: newJob.invoice_sent,
              invoice_paid: newJob.invoice_paid,
              invoice_sent_date: newJob.invoice_sent_date,
              invoice_paid_date: newJob.invoice_paid_date,
              property: Array.isArray(newJob.property) ? newJob.property[0] : newJob.property,
              unit_size: Array.isArray(newJob.unit_size) ? newJob.unit_size[0] : newJob.unit_size,
              job_type: Array.isArray(newJob.job_type) ? newJob.job_type[0] : newJob.job_type,
              job_phase: Array.isArray(newJob.job_phase) ? newJob.job_phase[0] : newJob.job_phase
            };
            setJobs(prev => [transformedJob, ...prev]);
          } else {
            // Fallback to full refetch if individual fetch fails
            fetchJobs(true);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs'
      }, async (payload) => {
        if (isMountedRef.current) {
          console.log('Job updated:', payload);
          
          // Always refetch to ensure consistency regardless of phase changes
          setTimeout(() => fetchJobs(true), 500);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'job_phase_changes'
      }, async (payload) => {
        if (isMountedRef.current) {
          console.log('Job phase change detected:', payload);
          
          // Refetch jobs to reflect phase changes
          setTimeout(() => fetchJobs(true), 1000);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'jobs'
      }, (payload) => {
        if (isMountedRef.current) {
          console.log('Job deleted:', payload.old);
          setJobs(prev => prev.filter(job => job.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [phaseIds, fetchJobs]);

  return { 
    jobs, 
    loading, 
    error,
    refetch: () => fetchJobs(true)
  };
}
