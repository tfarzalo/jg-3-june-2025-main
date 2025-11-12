// src/utils/normalizeJobDetails.ts
export type JobPhase = { 
  id: string | null; 
  label: string;
  color_light_mode?: string;
  color_dark_mode?: string;
};
export type UnitSize = { id: string | null; label: string };
export type PropertyLite = {
  id: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: number | string | null;
  ap_name?: string | null;
  ap_email?: string | null;
  quickbooks_number?: string | null;
  is_archived?: boolean;
};
export type WorkOrderLite = {
  id: string | null;
  submission_date?: string | null;
  job_category_id?: string | null;
  job_category?: string | null;
  is_occupied?: boolean;
  is_full_paint?: boolean;
  has_sprinklers?: boolean;
  sprinklers_painted?: boolean;
  has_accent_wall?: boolean;
  accent_wall_type?: string | null;
  accent_wall_count?: number;
  painted_ceilings?: boolean;
  ceiling_rooms_count?: number;
  individual_ceiling_count?: number;
  ceiling_display_label?: string | null;
  painted_patio?: boolean;
  painted_garage?: boolean;
  painted_cabinets?: boolean;
  painted_crown_molding?: boolean;
  painted_front_door?: boolean;
  has_extra_charges?: boolean;
  extra_charges_description?: string | null;
  extra_hours?: number;
  additional_comments?: string | null;
  // keep other fields as-is
  [k: string]: any;
};

export type JobDetailsNormalized = {
  id: string | null;
  work_order_num?: number | null;
  unit_number?: string | null;
  description?: string | null;
  scheduled_date?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  invoice_sent?: boolean | null;
  invoice_paid?: boolean | null;
  invoice_sent_date?: string | null;
  invoice_paid_date?: string | null;
  property: PropertyLite;
  unit_size: UnitSize;
  job_type?: { id: string | null; label: string } | null;
  job_phase: JobPhase | null;
  work_order: WorkOrderLite | null;
  billing_details?: any;
  hourly_billing_details?: any;
  extra_charges_details?: any;
  debug_billing_joins?: any;
};

export function normalizeJobDetails(d: any): JobDetailsNormalized {
  const property = {
    id: d?.property?.id ?? null,
    name: d?.property?.name ?? '—',
    address: d?.property?.address ?? null,
    city: d?.property?.city ?? null,
    state: d?.property?.state ?? null,
    zip: d?.property?.zip ?? null,
    ap_name: d?.property?.ap_name ?? null,
    ap_email: d?.property?.ap_email ?? null,
    quickbooks_number: d?.property?.quickbooks_number ?? null,
    is_archived: d?.property?.is_archived ?? false,
  };

  const unit_size = {
    id: d?.unit_size?.id ?? null,
    label: d?.unit_size?.label ?? '—',
  };

  const job_phase: JobPhase | null = d?.job_phase
    ? {
        id: d?.job_phase?.id ?? null,
        label: d?.job_phase?.label ?? d?.job_phase?.name ?? 'Unknown Phase',
        color_light_mode: d?.job_phase?.color_light_mode,
        color_dark_mode: d?.job_phase?.color_dark_mode,
      }
    : null;

  const work_orderRaw = d?.work_order ?? null;
  const work_order: WorkOrderLite | null = work_orderRaw
    ? {
        ...work_orderRaw,
        id: work_orderRaw?.id ?? null,
        submission_date: work_orderRaw?.submission_date ?? null,
        job_category_id: work_orderRaw?.job_category_id ?? null,
        job_category: work_orderRaw?.job_category ?? null,
        is_occupied: !!work_orderRaw?.is_occupied,
        is_full_paint: !!work_orderRaw?.is_full_paint,
        has_sprinklers: !!work_orderRaw?.has_sprinklers,
        sprinklers_painted: !!work_orderRaw?.sprinklers_painted,
        has_accent_wall: !!work_orderRaw?.has_accent_wall,
        accent_wall_type: work_orderRaw?.accent_wall_type ?? null,
        accent_wall_count: Number(work_orderRaw?.accent_wall_count ?? 0),
        painted_ceilings: !!work_orderRaw?.painted_ceilings,
        ceiling_rooms_count: Number(work_orderRaw?.ceiling_rooms_count ?? 0),
        individual_ceiling_count: Number(work_orderRaw?.individual_ceiling_count ?? 0),
        ceiling_display_label: work_orderRaw?.ceiling_display_label ?? null,
        painted_patio: !!work_orderRaw?.painted_patio,
        painted_garage: !!work_orderRaw?.painted_garage,
        painted_cabinets: !!work_orderRaw?.painted_cabinets,
        painted_crown_molding: !!work_orderRaw?.painted_crown_molding,
        painted_front_door: !!work_orderRaw?.painted_front_door,
        has_extra_charges: !!work_orderRaw?.has_extra_charges,
        extra_charges_description: work_orderRaw?.extra_charges_description ?? null,
        extra_hours: Number(work_orderRaw?.extra_hours ?? 0),
        additional_comments: work_orderRaw?.additional_comments ?? null,
      }
    : null;

  return {
    id: d?.id ?? null,
    work_order_num: d?.work_order_num ?? null,
    unit_number: d?.unit_number ?? null,
    description: d?.description ?? null,
    scheduled_date: d?.scheduled_date ?? null,
    assigned_to: d?.assigned_to ?? null,
    assigned_to_name: d?.assigned_to_name ?? null,
    invoice_sent: d?.invoice_sent ?? null,
    invoice_paid: d?.invoice_paid ?? null,
    invoice_sent_date: d?.invoice_sent_date ?? null,
    invoice_paid_date: d?.invoice_paid_date ?? null,
    property,
    unit_size,
    job_type: d?.job_type
      ? { id: d?.job_type?.id ?? null, label: d?.job_type?.label ?? '—' }
      : null,
    job_phase,
    work_order,
    billing_details: d?.billing_details ?? null,
    hourly_billing_details: d?.hourly_billing_details ?? null,
    extra_charges_details: d?.extra_charges_details ?? null,
    debug_billing_joins: d?.debug_billing_joins ?? null,
  };
}
