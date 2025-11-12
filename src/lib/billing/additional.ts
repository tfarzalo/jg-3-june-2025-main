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
        .select('id,bill_amount,sub_pay_amount')
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
        .select('id,bill_amount,sub_pay_amount')
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
      });
    } else {
      warnings.push('Accent Wall rate missing in Property Billing.');
    }
  }

  return { lines, warnings };
}
