import type { ExtraChargeLineItem } from '../../types/extraCharges';

export type AdditionalService = {
  code: string;                 // e.g. 'painted_ceilings' | 'accent_wall'
  label: string;                // e.g. "Painted Ceilings" | "Accent Wall — Paint Over"
  unit_label?: string | null;   // e.g. "1 Bedroom" or "Per Wall"
  quantity: number;             // e.g. 2
  billing_detail_id: string;    // uuid
  bill_amount: number;          // line total
  sub_pay_amount: number;       // line total
  profit_amount: number;        // line total
};

export type BillingBlock = {
  bill_amount: number;
  sub_pay_amount: number;
  profit_amount: number;
  section_name: string;
};

export type JobBillingPayload = {
  billing_details: BillingBlock;
  hourly_billing_details: BillingBlock;
  extra_charges_details?: {
    description?: string | null;
    hours?: number;
    hourly_rate?: number;
    sub_pay_rate?: number;
    bill_amount: number;
    sub_pay_amount: number;
    profit_amount: number;
    section_name: string;
  } | null;
  extra_charges_line_items?: ExtraChargeLineItem[];
  additional_services?: AdditionalService[];
  // Repair fields
  repair_amount?: number;        // admin-set: billed to customer
  repair_sub_pay?: number;       // admin-set: paid to subcontractor for repair
  repair_cost?: number;          // sub-reported: informational only
  is_editing_repair?: boolean;
  repair_amount_input?: string;
  repair_sub_pay_input?: string;
  saving_repair?: boolean;
  on_repair_edit?: () => void;
  on_repair_save?: () => void;
  on_repair_cancel?: () => void;
  on_repair_input_change?: (val: string) => void;
  on_repair_sub_pay_change?: (val: string) => void;
};
