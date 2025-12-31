import type { SupabaseClient } from '@supabase/supabase-js';

export type BillingLine = {
  key: string;
  label: string;
  qty: number;
  unitLabel?: string;
  rateBill: number;
  rateSub: number;
  amountBill: number;
  amountSub: number;
  orderKey?: number;
};

export async function getAdditionalBillingLines(
  supabase: SupabaseClient,
  workOrder: {
    painted_ceilings?: boolean | null;
    ceiling_billing_detail_id?: string | null;
    individual_ceiling_count?: number | null;
    ceiling_display_label?: string | null;
    ceiling_billing_detail?: {
      id: string;
      bill_amount: number;
      sub_pay_amount: number;
    } | null;

    has_accent_wall?: boolean | null;
    accent_wall_billing_detail_id?: string | null;
    accent_wall_type?: string | null;
    accent_wall_count?: number | null;
    accent_wall_billing_detail?: {
      id: string;
      bill_amount: number;
      sub_pay_amount: number;
    } | null;

    additional_services?: Record<string, {
      quantity: number;
      billing_detail_id: string;
      description?: string;
    }> | null;
  }
): Promise<{ lines: BillingLine[]; warnings: string[] }> {
  const lines: BillingLine[] = [];
  const warnings: string[] = [];

  // Painted Ceilings - use embedded billing detail if available, otherwise query
  if (workOrder.painted_ceilings) {
    let billingData = workOrder.ceiling_billing_detail;
    
    if (!billingData && workOrder.ceiling_billing_detail_id) {
      const { data } = await supabase
        .from('billing_details')
        .select('id,bill_amount,sub_pay_amount,sort_order,category:billing_categories(sort_order)')
        .eq('id', workOrder.ceiling_billing_detail_id)
        .maybeSingle();
      billingData = data;
    }

    // If still no billing data and this is individual ceiling mode, try to find Paint Individual Ceiling rate
    if (!billingData && workOrder.ceiling_display_label === 'Paint Individual Ceiling' && workOrder.individual_ceiling_count) {
      // Import the findPerCeilingRate function
      const { findPerCeilingRate } = await import('./lookups');
      
      // We need to get the property ID from the work order context
      // For now, we'll try to find it from the billing detail if it exists
      if (workOrder.ceiling_billing_detail_id) {
      const { data: billingDetail } = await supabase
          .from('billing_details')
          .select('property_id')
          .eq('id', workOrder.ceiling_billing_detail_id)
          .maybeSingle();
        
        if (billingDetail?.property_id) {
          billingData = await findPerCeilingRate(supabase, billingDetail.property_id);
        }
      }
    }

    if (billingData) {
      // Determine quantity and unit label based on mode
      let qty: number;
      let unitLabel: string | undefined;
      
      if (workOrder.ceiling_display_label === 'Paint Individual Ceiling' && workOrder.individual_ceiling_count) {
        // Individual ceiling mode
        qty = Number(workOrder.individual_ceiling_count);
        unitLabel = 'Paint Individual Ceiling';
      } else {
        // Unit size mode
        qty = 1;
        unitLabel = workOrder.ceiling_display_label ?? undefined;
      }
      
      const rateBill = Number(billingData.bill_amount ?? 0);
      const rateSub = Number(billingData.sub_pay_amount ?? 0);

      lines.push({
        key: 'painted_ceilings',
        label: `Painted Ceilings (${workOrder.ceiling_display_label === 'Paint Individual Ceiling' ? 'Individual' : workOrder.ceiling_display_label ?? 'Unit'})`,
        qty,
        unitLabel,
        rateBill,
        rateSub,
        amountBill: qty * rateBill,
        amountSub: qty * rateSub,
        orderKey: (billingData as any)?.category?.sort_order ?? (billingData as any)?.sort_order ?? 0
      });
    } else {
      warnings.push('Painted Ceilings rate missing in Property Billing.');
    }
  }

  // Accent Wall - use embedded billing detail if available, otherwise query
  if (workOrder.has_accent_wall) {
    let billingData = workOrder.accent_wall_billing_detail;
    
    if (!billingData && workOrder.accent_wall_billing_detail_id) {
      const { data } = await supabase
        .from('billing_details')
        .select('id,bill_amount,sub_pay_amount,sort_order,category:billing_categories(sort_order)')
        .eq('id', workOrder.accent_wall_billing_detail_id)
        .maybeSingle();
      billingData = data;
    }

    if (billingData) {
      const qty = Number(workOrder.accent_wall_count ?? 0) || 1;
      const rateBill = Number(billingData.bill_amount ?? 0);
      const rateSub = Number(billingData.sub_pay_amount ?? 0);
      const type = workOrder.accent_wall_type ? ` (${workOrder.accent_wall_type})` : '';

      lines.push({
        key: 'accent_wall',
        label: `Accent Wall${type}`,
        qty,
        unitLabel: 'Per Wall',
        rateBill,
        rateSub,
        amountBill: qty * rateBill,
        amountSub: qty * rateSub,
        orderKey: (billingData as any)?.category?.sort_order ?? (billingData as any)?.sort_order ?? 0
      });
    } else {
      warnings.push('Accent Wall rate missing in Property Billing.');
    }
  }

  // Dynamic Additional Services
  if (workOrder.additional_services) {
    const services = workOrder.additional_services;
    
    // We need to fetch category names and billing rates
    // This is less efficient than embedded data but necessary for dynamic fields
    // unless we pre-fetch them in the caller
    
    const billingDetailIds = Object.values(services)
      .map(s => s.billing_detail_id)
      .filter(Boolean);

    if (billingDetailIds.length > 0) {
      const { data: billingDetails } = await supabase
        .from('billing_details')
        .select(`
          id,
          bill_amount,
          sub_pay_amount,
          sort_order,
          category:billing_categories(name,sort_order),
          unit_size:unit_sizes(unit_size_label)
        `)
        .in('id', billingDetailIds);

      if (billingDetails) {
        Object.entries(services).forEach(([categoryId, serviceData]) => {
          const detail = billingDetails.find(d => d.id === serviceData.billing_detail_id);
          
          if (detail) {
            const qty = Number(serviceData.quantity) || 1;
            const rateBill = Number(detail.bill_amount ?? 0);
            const rateSub = Number(detail.sub_pay_amount ?? 0);
            // @ts-ignore - Supabase types join
            const catName = detail.category?.name || 'Additional Service';
            // @ts-ignore
            const unitLabel = detail.unit_size?.unit_size_label;

            // Use description if available, otherwise fallback to category name
            const label = serviceData.description 
              ? `${catName}${unitLabel ? ` (${unitLabel})` : ''} - ${serviceData.description}`
              : `${catName}${unitLabel ? ` (${unitLabel})` : ''}`;

            lines.push({
              key: `additional_${categoryId}`,
              label: label,
              qty,
              unitLabel,
              rateBill,
              rateSub,
              amountBill: qty * rateBill,
              amountSub: qty * rateSub,
              orderKey: (detail as any)?.category?.sort_order ?? (detail as any)?.sort_order ?? 0
            });
          } else {
             // Fallback if billing detail not found (e.g. deleted) but service exists
             // Ideally we should try to fetch category name separately if critical
             warnings.push(`Rate missing for additional service (ID: ${categoryId})`);
          }
        });
      }
    }
  }

  const sortedLines = [...lines].sort((a, b) => {
    const ao = a.orderKey ?? 0;
    const bo = b.orderKey ?? 0;
    if (ao !== bo) return ao - bo;
    return a.label.localeCompare(b.label);
  });
  return { lines: sortedLines, warnings };
}
