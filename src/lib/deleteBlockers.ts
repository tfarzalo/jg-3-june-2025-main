import { supabase } from '../utils/supabase';

type JobReference = {
  id: string;
  work_order_num?: number | null;
  unit_number?: string | null;
  property?: { property_name?: string | null } | null;
};

const workOrderLabel = (job?: JobReference | null, fallbackUnit?: string | null) => {
  const number = job?.work_order_num ? `WO-${String(job.work_order_num).padStart(6, '0')}` : 'Job';
  const property = job?.property?.property_name || 'Unknown Property';
  const unit = job?.unit_number || fallbackUnit || 'Unknown Unit';
  return `${number} - ${property} - Unit ${unit}`;
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const summarize = (title: string, items: string[], emptyMessage = '') => {
  const deduped = unique(items);
  if (deduped.length === 0) return emptyMessage;
  const shown = deduped.slice(0, 8);
  const remaining = deduped.length - shown.length;
  return [
    title,
    ...shown.map(item => `- ${item}`),
    remaining > 0 ? `- and ${remaining} more` : ''
  ].filter(Boolean).join('\n');
};

const fetchJobsByIds = async (jobIds: string[]) => {
  const ids = unique(jobIds);
  if (ids.length === 0) return new Map<string, JobReference>();

  const { data, error } = await supabase
    .from('jobs')
    .select('id, work_order_num, unit_number, property:properties(property_name)')
    .in('id', ids);

  if (error) throw error;
  return new Map((data || []).map((job: any) => [job.id, job as JobReference]));
};

const describeWorkOrderRows = async (
  rows: Array<{ job_id?: string | null; unit_number?: string | null }>
) => {
  const jobMap = await fetchJobsByIds(rows.map(row => row.job_id || ''));
  return rows.map(row => workOrderLabel(row.job_id ? jobMap.get(row.job_id) : null, row.unit_number));
};

export const describeBillingDetailDeleteBlockers = async (billingDetailIds: string[]) => {
  const ids = unique(billingDetailIds);
  if (ids.length === 0) return '';

  const blockerLines: string[] = [];

  const { data: workOrders, error: workOrderError } = await supabase
    .from('work_orders')
    .select('job_id, unit_number, ceiling_billing_detail_id, accent_wall_billing_detail_id')
    .or(`ceiling_billing_detail_id.in.(${ids.join(',')}),accent_wall_billing_detail_id.in.(${ids.join(',')})`);

  if (workOrderError) throw workOrderError;

  if (workOrders && workOrders.length > 0) {
    blockerLines.push(...await describeWorkOrderRows(workOrders));
  }

  const { data: detailRows, error: detailError } = await supabase
    .from('billing_details')
    .select('id, category:billing_categories(name), unit_size:unit_sizes(unit_size_label), property:properties(property_name)')
    .in('id', ids);

  if (detailError) throw detailError;

  const detailLabels = (detailRows || []).map((detail: any) => {
    const category = detail.category?.name || 'Unknown Category';
    const unitSize = detail.unit_size?.unit_size_label || 'Unknown Unit Size';
    const property = detail.property?.property_name || 'Unknown Property';
    return `${property}: ${category} / ${unitSize}`;
  });

  const detailSummary = detailLabels.length > 0
    ? `\n\nBilling detail${detailLabels.length === 1 ? '' : 's'} blocked:\n${detailLabels.map(label => `- ${label}`).join('\n')}`
    : '';

  return summarize('Cannot delete because these work orders use the billing detail:', blockerLines) + detailSummary;
};

export const describeBillingCategoryDeleteBlockers = async (billingCategoryIds: string[]) => {
  const ids = unique(billingCategoryIds);
  if (ids.length === 0) return '';

  const { data: details, error } = await supabase
    .from('billing_details')
    .select('id')
    .in('category_id', ids);

  if (error) throw error;
  const detailIds = (details || []).map(detail => detail.id);
  const detailBlockers = await describeBillingDetailDeleteBlockers(detailIds);

  if (detailBlockers) return detailBlockers;

  const { data: categories, error: categoryError } = await supabase
    .from('billing_categories')
    .select('name, property:properties(property_name)')
    .in('id', ids);

  if (categoryError) throw categoryError;
  return summarize(
    'Cannot delete because these billing categories still have associated elements:',
    (categories || []).map((category: any) => `${category.property?.property_name || 'Unknown Property'}: ${category.name || 'Unknown Category'}`)
  );
};

export const describeUnitSizeDeleteBlockers = async (unitSizeId: string) => {
  const blockers: string[] = [];

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, work_order_num, unit_number, property:properties(property_name)')
    .eq('unit_size_id', unitSizeId)
    .limit(20);

  if (jobsError) throw jobsError;
  blockers.push(...(jobs || []).map((job: any) => workOrderLabel(job)));

  const { data: details, error: detailsError } = await supabase
    .from('billing_details')
    .select('id, category:billing_categories(name), property:properties(property_name)')
    .eq('unit_size_id', unitSizeId)
    .limit(20);

  if (detailsError) throw detailsError;
  blockers.push(...(details || []).map((detail: any) =>
    `${detail.property?.property_name || 'Unknown Property'} billing: ${detail.category?.name || 'Unknown Category'}`
  ));

  return summarize('Cannot delete this unit size because it is used by:', blockers);
};

export const describeJobCategoryDeleteBlockers = async (category: { id: string; name: string }) => {
  const blockers: string[] = [];

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, work_order_num, unit_number, property:properties(property_name)')
    .eq('job_category_id', category.id)
    .limit(20);

  if (jobsError) throw jobsError;
  blockers.push(...(jobs || []).map((job: any) => workOrderLabel(job)));

  const { data: workOrders, error: workOrdersError } = await supabase
    .from('work_orders')
    .select('job_id, unit_number')
    .eq('job_category_id', category.id)
    .limit(20);

  if (workOrdersError) throw workOrdersError;
  blockers.push(...await describeWorkOrderRows(workOrders || []));

  const { data: billingCategories, error: billingError } = await supabase
    .from('billing_categories')
    .select('id, property:properties(property_name)')
    .eq('name', category.name)
    .limit(20);

  if (billingError) throw billingError;
  blockers.push(...(billingCategories || []).map((billingCategory: any) =>
    `${billingCategory.property?.property_name || 'Unknown Property'} billing category`
  ));

  return summarize(`Cannot delete "${category.name}" because it is used by:`, blockers);
};
