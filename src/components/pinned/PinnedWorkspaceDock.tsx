import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin, Minimize2, Pin, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { usePinnedWorkspace, PinnedWorkspaceItem } from '../../contexts/PinnedWorkspaceContext';

interface PropertySummary {
  id: string;
  property_name: string;
  address: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  region: string | null;
  property_grade: string | null;
  unit_layout: string | null;
  notes_and_callbacks: string | null;
  billing_notes: string | null;
  extra_charges_notes: string | null;
  quickbooks_number: string | null;
  occupied_regular_paint_fees: string | null;
  unit_map_note: string | null;
  community_manager_name: string | null;
  community_manager_email: string | null;
  community_manager_phone: string | null;
  community_manager_title: string | null;
  maintenance_supervisor_name: string | null;
  maintenance_supervisor_email: string | null;
  maintenance_supervisor_phone: string | null;
  maintenance_supervisor_title: string | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
  primary_contact_role: string | null;
  ap_name: string | null;
  ap_email: string | null;
  ap_phone: string | null;
  compliance_required: string | null;
  compliance_approved: string | null;
  compliance_bid_approved: string | null;
  compliance_po_needed: string | null;
  compliance_w9_created: string | null;
  compliance_coi_address: string | null;
  compliance_invoice_delivery: string | null;
  preferred_subcontractor_a_name_snapshot: string | null;
  preferred_subcontractor_b_name_snapshot: string | null;
  preferred_subcontractor_c_name_snapshot: string | null;
  preferred_subcontractor_d_name_snapshot: string | null;
  property_management_group: {
    company_name: string | null;
  } | null;
}

const formatAddress = (property: PropertySummary) => [
  property.address,
  property.address_2,
  property.city,
  property.state,
  property.zip,
].filter(Boolean).join(', ');

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-white break-words">{value}</dd>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-200 pt-3 dark:border-[#2D3B4E]">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

const joinValues = (values: Array<string | null | undefined>) => values.filter(Boolean).join(' | ');

function PropertySummaryPanel({ item }: { item: PinnedWorkspaceItem }) {
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const propertyId = useMemo(() => item.id.replace(/^property:/, ''), [item.id]);

  useEffect(() => {
    let mounted = true;

    const fetchProperty = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('properties')
          .select(`
            id,
            property_name,
            address,
            address_2,
            city,
            state,
            zip,
            phone,
            region,
            property_grade,
            unit_layout,
            notes_and_callbacks,
            billing_notes,
            extra_charges_notes,
            quickbooks_number,
            occupied_regular_paint_fees,
            unit_map_note,
            community_manager_name,
            community_manager_email,
            community_manager_phone,
            community_manager_title,
            maintenance_supervisor_name,
            maintenance_supervisor_email,
            maintenance_supervisor_phone,
            maintenance_supervisor_title,
            primary_contact_name,
            primary_contact_phone,
            primary_contact_email,
            primary_contact_role,
            ap_name,
            ap_email,
            ap_phone,
            compliance_required,
            compliance_approved,
            compliance_bid_approved,
            compliance_po_needed,
            compliance_w9_created,
            compliance_coi_address,
            compliance_invoice_delivery,
            preferred_subcontractor_a_name_snapshot,
            preferred_subcontractor_b_name_snapshot,
            preferred_subcontractor_c_name_snapshot,
            preferred_subcontractor_d_name_snapshot,
            property_management_group:property_management_groups(company_name)
          `)
          .eq('id', propertyId)
          .single();

        if (fetchError) throw fetchError;
        if (mounted) setProperty(data as PropertySummary);
      } catch (err) {
        console.error('Error loading pinned property summary:', err);
        if (mounted) setError(err instanceof Error ? err.message : 'Unable to load property summary');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProperty();

    return () => {
      mounted = false;
    };
  }, [propertyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-200">
        {error || 'Property summary not found'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-[#2D3B4E] dark:bg-[#0F172A]">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">{property.property_name}</div>
            <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{formatAddress(property) || 'No address on file'}</div>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryRow label="Management Group" value={property.property_management_group?.company_name} />
        <SummaryRow label="Phone" value={property.phone} />
        <SummaryRow label="Region" value={property.region} />
        <SummaryRow label="Grade" value={property.property_grade} />
        <SummaryRow label="Unit Layout" value={property.unit_layout} />
      </dl>

      <SummarySection title="Contacts">
        <dl className="grid grid-cols-1 gap-3">
          <SummaryRow label="Primary Contact" value={joinValues([property.primary_contact_name, property.primary_contact_role, property.primary_contact_phone, property.primary_contact_email])} />
          <SummaryRow label="Community Manager" value={joinValues([property.community_manager_name, property.community_manager_title, property.community_manager_phone, property.community_manager_email])} />
          <SummaryRow label="Maintenance Supervisor" value={joinValues([property.maintenance_supervisor_name, property.maintenance_supervisor_title, property.maintenance_supervisor_phone, property.maintenance_supervisor_email])} />
          <SummaryRow label="Accounts Payable" value={joinValues([property.ap_name, property.ap_phone, property.ap_email])} />
        </dl>
      </SummarySection>

      <SummarySection title="Compliance">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SummaryRow label="Required" value={property.compliance_required} />
          <SummaryRow label="Approved" value={property.compliance_approved} />
          <SummaryRow label="Bid Approved" value={property.compliance_bid_approved} />
          <SummaryRow label="PO Needed" value={property.compliance_po_needed} />
          <SummaryRow label="W9 Created" value={property.compliance_w9_created} />
          <SummaryRow label="COI Address" value={property.compliance_coi_address} />
          <SummaryRow label="Invoice Delivery" value={property.compliance_invoice_delivery} />
        </dl>
      </SummarySection>

      <SummarySection title="Billing And Work Notes">
        <dl className="grid grid-cols-1 gap-3">
          <SummaryRow label="QuickBooks #" value={property.quickbooks_number} />
          <SummaryRow label="Occupied Regular Paint Fees" value={property.occupied_regular_paint_fees} />
          <SummaryRow label="Billing Notes" value={property.billing_notes} />
          <SummaryRow label="Extra Charges Notes" value={property.extra_charges_notes} />
          <SummaryRow label="Unit Map Note" value={property.unit_map_note} />
        </dl>
      </SummarySection>

      <SummarySection title="Preferred Subcontractors">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SummaryRow label="A" value={property.preferred_subcontractor_a_name_snapshot} />
          <SummaryRow label="B" value={property.preferred_subcontractor_b_name_snapshot} />
          <SummaryRow label="C" value={property.preferred_subcontractor_c_name_snapshot} />
          <SummaryRow label="D" value={property.preferred_subcontractor_d_name_snapshot} />
        </dl>
      </SummarySection>

      {property.notes_and_callbacks && (
        <SummarySection title="Notes And Callbacks">
          <p className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100">
            {property.notes_and_callbacks}
          </p>
        </SummarySection>
      )}
    </div>
  );
}

const openRouteInNewTab = (route: string) => {
  const url = new URL(route, window.location.origin);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
};

export function PinnedWorkspaceDock() {
  const {
    canUsePinnedWorkspace,
    pinnedItems,
    expandedItemId,
    closePinnedItem,
    minimizePinnedItem,
    expandPinnedItem,
  } = usePinnedWorkspace();

  if (!canUsePinnedWorkspace || pinnedItems.length === 0) return null;

  const expandedItem = pinnedItems.find(item => item.id === expandedItemId && !item.minimized) || null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {expandedItem && (
        <section className="w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-[#2D3B4E] dark:bg-[#1E293B]">
          <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-[#2D3B4E]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{expandedItem.title}</h3>
              </div>
              {expandedItem.subtitle && (
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{expandedItem.subtitle}</p>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => openRouteInNewTab(expandedItem.route)}
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#0F172A] dark:hover:text-white"
                title="Open full page in new tab"
                aria-label="Open full page in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => minimizePinnedItem(expandedItem.id)}
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#0F172A] dark:hover:text-white"
                title="Minimize summary"
                aria-label="Minimize summary"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => closePinnedItem(expandedItem.id)}
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-[#0F172A] dark:hover:text-red-300"
                title="Close pinned summary"
                aria-label="Close pinned summary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="max-h-[60vh] overflow-auto p-4">
            {expandedItem.type === 'property' && <PropertySummaryPanel item={expandedItem} />}
          </div>
        </section>
      )}

      <div className="flex max-w-full flex-wrap justify-end gap-2">
        {pinnedItems.map(item => (
          <div
            key={item.id}
            className="flex max-w-[280px] items-center overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-[#2D3B4E] dark:bg-[#1E293B]"
          >
            <button
              type="button"
              onClick={() => expandPinnedItem(item.id)}
              className="flex min-w-0 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#0F172A]"
              title={item.title}
            >
              <Pin className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.title}</span>
            </button>
            <button
              type="button"
              onClick={() => closePinnedItem(item.id)}
              className="border-l border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-red-600 dark:border-[#2D3B4E] dark:text-gray-400 dark:hover:bg-[#0F172A] dark:hover:text-red-300"
              title="Close pinned summary"
              aria-label={`Close ${item.title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
