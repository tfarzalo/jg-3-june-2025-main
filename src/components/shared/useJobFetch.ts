import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import type { Job } from './JobListingPage';
import { findBillingDetail } from '../../lib/billing/lookups';

interface UseJobFetchProps {
  phaseLabel: string | string[];
  query?: JobFetchQuery;
}

export interface JobFetchQuery {
  page: number;
  pageSize: number;
  searchTerm?: string;
  propertyName?: string;
  subcontractor?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  sortField?: 'work_order_num' | 'job_phase' | 'property_name' | 'unit_number' | 'unit_size' | 'job_type' | 'scheduled_date' | 'total_billing_amount';
  sortDirection?: 'asc' | 'desc';
}

const normalizeRelation = (value: unknown): Record<string, unknown> | undefined => {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
};

export function useJobFetch({ phaseLabel, query }: UseJobFetchProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseIds, setPhaseIds] = useState<string[]>([]);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum time between fetches in milliseconds
  const phaseKey = Array.isArray(phaseLabel) ? phaseLabel.join('|') : phaseLabel;

  const fetchJobs = useCallback(async (forceRefresh = false) => {
    // Prevent fetching too frequently unless forced
    const now = Date.now();
    if (!query && !forceRefresh && now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new abort controller for this request
    abortControllerRef.current = new AbortController();
    let timedOut = false;
    const requestTimeout = window.setTimeout(() => {
      timedOut = true;
      abortControllerRef.current?.abort();
    }, 20000);
    if (isMountedRef.current) setLoading(true);
    
    try {
      const { data: phaseData, error: phaseError } = await supabase
        .from('job_phases')
        .select('id')
        .in('job_phase_label', phaseKey.split('|'));

      if (phaseError) throw phaseError;
      if (!phaseData?.length) throw new Error(`${phaseKey} phase not found`);

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
        phaseLabel === 'Completed Work Orders' ||
        phaseLabel === 'Grading' || 
        phaseLabel === 'Quality Control' ||
        phaseLabel === 'Invoicing' ||
        (Array.isArray(phaseLabel) && (
          phaseLabel.includes('Work Order') || 
          phaseLabel.includes('Pending Work Order') ||
          phaseLabel.includes('Completed Work Orders') ||
          phaseLabel.includes('Grading') || 
          phaseLabel.includes('Quality Control') ||
          phaseLabel.includes('Invoicing')
        ))
      ) {
        orderColumn = 'updated_at';
        ascending = false;
      }

      let jobsQuery = supabase
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
          unit_size_label_snapshot,
          invoice_sent,
          invoice_paid,
          invoice_sent_date,
          invoice_paid_date,
          cancellation_trip_charge_added,
          cancellation_trip_charge_bill_amount,
          cancellation_trip_charge_sub_pay_amount,
          historical_data_mode,
          active_snapshot_id,
          snapshot_frozen_at,
          purchase_order,
          property_id,
          job_type_id,
          assigned_to,
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
          ),
          assigned_to_profile:assigned_to (
            full_name
          )
        `, { count: query ? 'exact' : undefined })
        .in('current_phase_id', phaseData.map(phase => phase.id));

      if (query) {
        const trimmedSearch = query.searchTerm?.trim();
        if (query.propertyName && query.propertyName !== 'all') {
          const { data: matchingProperties, error: propertyError } = await supabase
            .from('properties')
            .select('id')
            .eq('property_name', query.propertyName);
          if (propertyError) throw propertyError;
          jobsQuery = jobsQuery.in('property_id', (matchingProperties || []).map(row => row.id));
        }

        if (query.subcontractor === 'unassigned') {
          jobsQuery = jobsQuery.is('assigned_to', null);
        } else if (query.subcontractor && query.subcontractor !== 'all') {
          const { data: matchingProfiles, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('full_name', query.subcontractor);
          if (profileError) throw profileError;
          jobsQuery = jobsQuery.in('assigned_to', (matchingProfiles || []).map(row => row.id));
        }

        if (query.scheduledStartDate) jobsQuery = jobsQuery.gte('scheduled_date', query.scheduledStartDate);
        if (query.scheduledEndDate) jobsQuery = jobsQuery.lte('scheduled_date', query.scheduledEndDate);

        if (trimmedSearch) {
          const safeTerm = trimmedSearch.replace(/[,%()]/g, ' ').trim();
          const [propertiesResult, unitSizesResult, jobTypesResult, profilesResult] = await Promise.all([
            supabase.from('properties').select('id').ilike('property_name', `%${safeTerm}%`),
            supabase.from('unit_sizes').select('id').ilike('unit_size_label', `%${safeTerm}%`),
            supabase.from('job_types').select('id').ilike('job_type_label', `%${safeTerm}%`),
            supabase.from('profiles').select('id').ilike('full_name', `%${safeTerm}%`)
          ]);
          const lookupError = propertiesResult.error || unitSizesResult.error || jobTypesResult.error || profilesResult.error;
          if (lookupError) throw lookupError;
          const clauses = [
            `unit_number.ilike.%${safeTerm}%`,
            `purchase_order.ilike.%${safeTerm}%`,
            ...((propertiesResult.data || []).map(row => `property_id.eq.${row.id}`)),
            ...((unitSizesResult.data || []).map(row => `unit_size_id.eq.${row.id}`)),
            ...((jobTypesResult.data || []).map(row => `job_type_id.eq.${row.id}`)),
            ...((profilesResult.data || []).map(row => `assigned_to.eq.${row.id}`))
          ];
          const workOrderNumber = Number(trimmedSearch.replace(/^wo-?/i, ''));
          if (Number.isFinite(workOrderNumber) && workOrderNumber > 0) clauses.push(`work_order_num.eq.${workOrderNumber}`);
          jobsQuery = jobsQuery.or(clauses.join(','));
        }

        const directSortColumns: Record<string, string> = {
          work_order_num: 'work_order_num',
          job_phase: 'job_phase(job_phase_label)',
          property_name: 'property(property_name)',
          unit_number: 'unit_number',
          unit_size: 'unit_size(unit_size_label)',
          job_type: 'job_type(job_type_label)',
          scheduled_date: 'scheduled_date',
          total_billing_amount: 'total_billing_amount'
        };
        const requestedOrder = directSortColumns[query.sortField || ''] || orderColumn;
        jobsQuery = jobsQuery
          .order(requestedOrder, { ascending: query.sortDirection === 'asc' })
          .order('id', { ascending: true })
          .range((query.page - 1) * query.pageSize, query.page * query.pageSize - 1);
      } else {
        jobsQuery = jobsQuery.order(orderColumn, { ascending });
      }

      jobsQuery = jobsQuery.abortSignal(abortControllerRef.current.signal);
      const { data, error, count } = await jobsQuery;
      window.clearTimeout(requestTimeout);

      if (error) throw error;
      if (isMountedRef.current && query) setTotalCount(count || 0);
      
      // Pre-fetch base billing for relevant property/unit size/category combos
      const propertyIds = Array.from(new Set((data || [])
        .map(job => normalizeRelation(job.property)?.id)
        .filter((id): id is string => typeof id === 'string')));
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

        // RPC billing cache to avoid duplicate get_job_details calls
        const billingRpcCache = new Map<string, number | null>();
        const computeBillingTotalFromRpc = async (jobId: string) => {
          if (billingRpcCache.has(jobId)) return billingRpcCache.get(jobId) ?? null;
          const { data: jd } = await supabase.rpc('get_job_details', { p_job_id: jobId });
          let total: number | null = null;
          if (jd) {
            const base = Number(jd?.billing_details?.bill_amount ?? jd?.billing_details?.base_price ?? 0) || 0;
            const extraLabor = Number(jd?.extra_charges_details?.bill_amount ?? jd?.extra_charges_details?.total_extra_charges ?? 0) || 0;

            // Extra charge line items
            const lineItems = jd?.work_order?.extra_charges_line_items ?? [];
            const lineItemsTotal = Array.isArray(lineItems)
              ? lineItems.reduce((sum: number, item: any) => {
                  const qty = Number(item?.quantity ?? 0) || 0;
                  const rate = Number(item?.billRate ?? 0) || 0;
                  const calc = Number(item?.calculatedBillAmount ?? qty * rate) || 0;
                  return sum + calc;
                }, 0)
              : 0;

            // Additional services
            const frozenLines = jd?.work_order?.frozen_billing_lines ?? [];
            const frozenLinesTotal = Array.isArray(frozenLines)
              ? frozenLines.reduce((sum: number, line: any) => {
                  const amt = Number(line?.amountBill ?? 0) || 0;
                  return sum + amt;
                }, 0)
              : 0;

            const additional = jd?.work_order?.additional_services ?? [];
            const additionalTotal = Array.isArray(additional)
              ? additional.reduce((sum: number, svc: any) => {
                  const amt = Number(svc?.amountBill ?? svc?.amount_bill ?? 0) || 0;
                  return sum + amt;
                }, 0)
              : 0;

            const computed = base + extraLabor + lineItemsTotal + Math.max(frozenLinesTotal, additionalTotal);
            total = computed > 0 ? computed : null;
          }
          billingRpcCache.set(jobId, total);
          return total;
        };

        // Transform first so the list can render without waiting for optional billing lookups.
        const transformedJobs: Job[] = (data || []).map(job => {
          const property = normalizeRelation(job.property) as Job['property'] | undefined;
          const unitSize = normalizeRelation(job.unit_size) as Job['unit_size'] | undefined;
          const jobType = normalizeRelation(job.job_type) as Job['job_type'] | undefined;
          const jobPhase = normalizeRelation(job.job_phase) as Job['job_phase'] | undefined;
          const assignedProfile = normalizeRelation(job.assigned_to_profile) as Job['assigned_to_profile'] | undefined;
          return {
          id: job.id,
            work_order_num: job.work_order_num ?? 0,
            unit_number: job.unit_number || '',
            scheduled_date: job.scheduled_date || '',
            created_at: job.created_at,
            updated_at: job.updated_at,
            total_billing_amount: job.total_billing_amount,
            historical_data_mode: job.historical_data_mode === 'snapshot' ? 'snapshot' : 'live',
            active_snapshot_id: job.active_snapshot_id ?? null,
            snapshot_frozen_at: job.snapshot_frozen_at ?? null,
            invoice_sent: job.invoice_sent,
            invoice_paid: job.invoice_paid,
            invoice_sent_date: job.invoice_sent_date,
            invoice_paid_date: job.invoice_paid_date,
            cancellation_trip_charge_added: job.cancellation_trip_charge_added,
            cancellation_trip_charge_bill_amount: job.cancellation_trip_charge_bill_amount,
            cancellation_trip_charge_sub_pay_amount: job.cancellation_trip_charge_sub_pay_amount,
            purchase_order: job.purchase_order,
            property: property || { id: '', property_name: 'Unknown property', address: '', city: '', state: '' },
            unit_size: {
              ...(unitSize || {}),
              unit_size_label: job.unit_size_label_snapshot || unitSize?.unit_size_label || 'Unknown',
            },
            job_type: jobType || { job_type_label: 'Unknown' },
            job_phase: jobPhase || null,
            assigned_to_profile: assignedProfile
          } as Job;
        });
        
        setJobs(transformedJobs);
        setError(null);
        setLoading(false);

        // Enrich missing amounts in bounded batches after the page is already usable.
        const missingAmounts = transformedJobs.filter(job => !job.total_billing_amount);
        for (let index = 0; index < missingAmounts.length && isMountedRef.current; index += 10) {
          const batch = missingAmounts.slice(index, index + 10);
          const updates = await Promise.all(batch.map(async job => {
            let amount: number | null = null;
            if (job.job_phase?.job_phase_label === 'Job Request') {
              amount = await getBaseBillForJobRequest(job.property?.id, job.unit_size?.id, job.unit_size?.unit_size_label, job.job_type?.job_type_label);
            }
            if (amount === null) {
              amount = job.cancellation_trip_charge_added
                ? Number(job.cancellation_trip_charge_bill_amount || 0) || null
                : await computeBillingTotalFromRpc(job.id);
            }
            return [job.id, amount] as const;
          }));
          if (!isMountedRef.current) break;
          const amountById = new Map(updates);
          setJobs(current => current.map(job => amountById.has(job.id)
            ? { ...job, total_billing_amount: amountById.get(job.id) ?? job.total_billing_amount }
            : job));
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError' && !timedOut) return;
      if (isMountedRef.current) {
        setError(timedOut ? 'The job list took too long to load. Please try again.' : err instanceof Error ? err.message : 'Failed to fetch jobs');
      }
    } finally {
      window.clearTimeout(requestTimeout);
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [phaseKey, query]);

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
          if (query) {
            fetchJobs(true);
            return;
          }
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
              cancellation_trip_charge_added,
              cancellation_trip_charge_bill_amount,
              cancellation_trip_charge_sub_pay_amount,
              historical_data_mode,
              active_snapshot_id,
              snapshot_frozen_at,
              unit_size_label_snapshot,
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
              ),
              assigned_to_profile:assigned_to (
                full_name
              )
            `)
            .eq('id', payload.new.id)
            .single();
            
          if (!error && newJob) {
            const propertyObj = normalizeRelation(newJob.property);
            const rawUnitSize = normalizeRelation(newJob.unit_size);
            const unitSizeObj = {
              ...(rawUnitSize || {}),
              unit_size_label: newJob.unit_size_label_snapshot || rawUnitSize?.unit_size_label,
            };
            let totalBillingAmount = newJob.total_billing_amount;
            const phaseLabel = normalizeRelation(newJob.job_phase)?.job_phase_label;
            const jobCategory = normalizeRelation(newJob.job_type)?.job_type_label;
            const cancellationTripChargeAdded = Boolean(newJob.cancellation_trip_charge_added);

            if ((!totalBillingAmount || totalBillingAmount === 0) && phaseLabel === 'Job Request' &&
                typeof propertyObj?.id === 'string' && typeof jobCategory === 'string') {
              const billing = await findBillingDetail(supabase, {
                propertyId: propertyObj.id,
                categoryName: jobCategory,
                unitSizeLabel: unitSizeObj?.unit_size_label as string | undefined
              });
              totalBillingAmount = billing?.bill_amount ?? totalBillingAmount;
            }

            // Fallback: live RPC billing total for other phases
            if (!totalBillingAmount || totalBillingAmount === 0) {
              if (cancellationTripChargeAdded) {
                totalBillingAmount = Number(newJob.cancellation_trip_charge_bill_amount ?? 0) || null;
              } else {
                const { data: jd } = await supabase.rpc('get_job_details', { p_job_id: newJob.id });
                if (jd) {
                const base = Number(jd?.billing_details?.bill_amount ?? jd?.billing_details?.base_price ?? 0) || 0;
                const extraLabor = Number(jd?.extra_charges_details?.bill_amount ?? jd?.extra_charges_details?.total_extra_charges ?? 0) || 0;
                const lineItems = jd?.work_order?.extra_charges_line_items ?? [];
                const lineItemsTotal = Array.isArray(lineItems)
                  ? lineItems.reduce((sum: number, item: any) => {
                      const qty = Number(item?.quantity ?? 0) || 0;
                      const rate = Number(item?.billRate ?? 0) || 0;
                      const calc = Number(item?.calculatedBillAmount ?? qty * rate) || 0;
                      return sum + calc;
                    }, 0)
                  : 0;
                const frozenLines = jd?.work_order?.frozen_billing_lines ?? [];
                const frozenLinesTotal = Array.isArray(frozenLines)
                  ? frozenLines.reduce((sum: number, line: any) => {
                      const amt = Number(line?.amountBill ?? 0) || 0;
                      return sum + amt;
                    }, 0)
                  : 0;
                const additional = jd?.work_order?.additional_services ?? [];
                const additionalTotal = Array.isArray(additional)
                  ? additional.reduce((sum: number, svc: any) => {
                      const amt = Number(svc?.amountBill ?? svc?.amount_bill ?? 0) || 0;
                      return sum + amt;
                    }, 0)
                  : 0;
                const computed = base + extraLabor + lineItemsTotal + Math.max(frozenLinesTotal, additionalTotal);
                if (computed > 0) totalBillingAmount = computed;
                }
              }
            }

            // Transform the data to match the Job interface
            const transformedJob: Job = {
              id: newJob.id,
              work_order_num: newJob.work_order_num ?? 0,
              unit_number: newJob.unit_number || '',
              scheduled_date: newJob.scheduled_date || '',
              total_billing_amount: totalBillingAmount,
              historical_data_mode: newJob.historical_data_mode === 'snapshot' ? 'snapshot' : 'live',
              active_snapshot_id: newJob.active_snapshot_id ?? null,
              snapshot_frozen_at: newJob.snapshot_frozen_at ?? null,
              invoice_sent: newJob.invoice_sent,
              invoice_paid: newJob.invoice_paid,
              invoice_sent_date: newJob.invoice_sent_date,
              invoice_paid_date: newJob.invoice_paid_date,
              cancellation_trip_charge_added: newJob.cancellation_trip_charge_added,
              cancellation_trip_charge_bill_amount: newJob.cancellation_trip_charge_bill_amount,
              cancellation_trip_charge_sub_pay_amount: newJob.cancellation_trip_charge_sub_pay_amount,
              property: (propertyObj as unknown as Job['property']) || { id: '', property_name: 'Unknown property', address: '', city: '', state: '' },
              unit_size: {
                ...(rawUnitSize || {}),
                unit_size_label: String(unitSizeObj.unit_size_label || 'Unknown')
              } as Job['unit_size'],
              job_type: (normalizeRelation(newJob.job_type) as Job['job_type'] | undefined) || { job_type_label: 'Unknown' },
              job_phase: (normalizeRelation(newJob.job_phase) as Job['job_phase'] | undefined) || null,
              assigned_to_profile: normalizeRelation(newJob.assigned_to_profile) as Job['assigned_to_profile'] | undefined
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
          if (query) fetchJobs(true);
          else setJobs(prev => prev.filter(job => job.id !== payload.old.id));
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
    totalCount,
    refetch: () => fetchJobs(true)
  };
}
