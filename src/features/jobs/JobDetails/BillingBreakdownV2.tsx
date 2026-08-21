import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency, sum } from '../../../lib/money';
import type { JobBillingPayload, AdditionalService } from '../../billing/types';
import { getLineItemBillHours, getLineItemSubPayHours } from '../../../utils/extraChargesCalculations';

type Props = { billing: JobBillingPayload };

const SectionCard: React.FC<{ title: string; children: React.ReactNode; accentColor?: string }> = ({ title, children, accentColor = "blue" }) => {
  const colorClasses = {
    blue: "border-blue-200/60 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20",
    emerald: "border-emerald-200/60 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/80 to-green-50/80 dark:from-emerald-900/20 dark:to-green-900/20",
    amber: "border-amber-200/60 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/80 to-yellow-50/80 dark:from-amber-900/20 dark:to-yellow-900/20",
    purple: "border-purple-200/60 dark:border-purple-800/60 bg-gradient-to-br from-purple-50/80 to-violet-50/80 dark:from-purple-900/20 dark:to-violet-900/20"
  };
  
  return (
    <div className={`rounded-2xl shadow-lg p-6 border-2 ${colorClasses[accentColor as keyof typeof colorClasses]}`}>
      <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center">
        <div className={`w-2 h-2 rounded-full mr-3 ${
          accentColor === 'blue' ? 'bg-blue-500' :
          accentColor === 'emerald' ? 'bg-emerald-500' :
          accentColor === 'amber' ? 'bg-amber-500' :
          'bg-purple-500'
        }`}></div>
        {title}
      </div>
      {children}
    </div>
  );
};

const KeyValue: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm text-zinc-500">{k}</span>
    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v}</span>
  </div>
);

type UnifiedChargeItem = {
  id: string;
  label: string;
  unit_label?: string;
  quantity_or_hours: number;
  is_hours: boolean;
  source_item_id?: string;
  customize_hours?: boolean;
  rate?: number;
  sub_rate?: number;
  bill_hours?: number;
  sub_pay_hours?: number;
  bill_amount: number;
  sub_pay_amount: number;
  profit_amount: number;
};

const ChargeRateDetails: React.FC<{ item: UnifiedChargeItem }> = ({ item }) => {
  const hasCustomerRate = item.rate !== undefined;
  const hasSubpayRate = item.sub_rate !== undefined;

  if (!hasCustomerRate && !hasSubpayRate) return null;

  const rateUnit = item.is_hours ? 'hr' : 'unit';

  return (
    <div className="mt-1 space-y-0.5 text-xs font-normal leading-snug text-zinc-500 dark:text-zinc-400">
      {hasCustomerRate && (
        <div>
          Customer Rate: {formatCurrency(item.rate ?? 0)}/{rateUnit}
        </div>
      )}
      {hasSubpayRate && (
        <div>
          Subpay Rate: {formatCurrency(item.sub_rate ?? 0)}/{rateUnit}
        </div>
      )}
    </div>
  );
};

const UnifiedChargesTable: React.FC<{ items: UnifiedChargeItem[] }> = ({ items }) => {
  if (!items?.length) return (
    <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-xl">
      <div className="text-lg font-medium">No extra charges</div>
      <div className="text-sm mt-1">Extra charges will appear here when added</div>
    </div>
  );
  
  return (
    <div className="overflow-hidden rounded-xl border-2 border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-800/40 shadow-inner">
      <table className="w-full text-sm">
        <thead className="bg-gradient-to-r from-zinc-100/80 to-zinc-200/60 dark:from-zinc-700/60 dark:to-zinc-800/40">
          <tr>
            <th className="text-left px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Description</th>
            <th className="text-left px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Unit</th>
            <th className="text-center px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Qty/Hrs</th>
            <th className="text-right px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Bill to Customer</th>
            <th className="text-right px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Pay to Sub</th>
            <th className="text-right px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Profit</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, index) => (
            <tr 
              key={s.id} 
              className={`border-t border-zinc-200/60 dark:border-zinc-700/60 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/30 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/10 transition-all duration-200 ${
                index % 2 === 0 ? 'bg-white/40 dark:bg-zinc-800/20' : 'bg-zinc-50/30 dark:bg-zinc-800/10'
              }`}
            >
              <td className="px-6 py-4 text-zinc-800 dark:text-zinc-100 font-semibold text-base">
                {s.label}
                <ChargeRateDetails item={s} />
              </td>
              <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-base">{s.unit_label ?? (s.is_hours ? 'Hours' : '—')}</td>
              <td className="px-6 py-4 text-center text-zinc-800 dark:text-zinc-100 font-bold text-lg">{s.quantity_or_hours == null ? '—' : s.quantity_or_hours}</td>
              <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                {s.bill_hours !== undefined && (
                  <span className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {s.bill_hours} bill hrs
                  </span>
                )}
                {formatCurrency(s.bill_amount)}
              </td>
              <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                {s.sub_pay_hours !== undefined && (
                  <span className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {s.sub_pay_hours} sub hrs
                  </span>
                )}
                {formatCurrency(s.sub_pay_amount)}
              </td>
              <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-lg">{formatCurrency(s.profit_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ExtraChargeHoursEditor: React.FC<{
  lineItem: UnifiedChargeItem & { source_item_id: string };
  saving?: boolean;
  onSave?: JobBillingPayload['on_extra_charge_hours_save'];
}> = ({ lineItem, saving = false, onSave }) => {
  const getInitialBillHours = () => lineItem.customize_hours && lineItem.bill_hours !== undefined
    ? String(lineItem.bill_hours)
    : '';
  const getInitialSubPayHours = () => lineItem.customize_hours && lineItem.sub_pay_hours !== undefined
    ? String(lineItem.sub_pay_hours)
    : '';
  const [customizeHours, setCustomizeHours] = useState(lineItem.customize_hours);
  const [billHours, setBillHours] = useState(getInitialBillHours);
  const [subPayHours, setSubPayHours] = useState(getInitialSubPayHours);

  useEffect(() => {
    setCustomizeHours(lineItem.customize_hours);
    setBillHours(getInitialBillHours());
    setSubPayHours(getInitialSubPayHours());
  }, [lineItem.customize_hours, lineItem.bill_hours, lineItem.sub_pay_hours, lineItem.quantity_or_hours]);

  const parsedBillHours = billHours.trim() === '' ? Number.NaN : Number(billHours);
  const parsedSubPayHours = subPayHours.trim() === '' ? Number.NaN : Number(subPayHours);
  const isValid = !customizeHours || (
    Number.isFinite(parsedBillHours) &&
    Number.isFinite(parsedSubPayHours) &&
    parsedBillHours >= 0 &&
    parsedSubPayHours >= 0
  );

  return (
    <div className="rounded-lg border border-amber-200 bg-white/80 p-4 dark:border-amber-900/50 dark:bg-zinc-900/40">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {lineItem.label}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <input
              type="checkbox"
              checked={customizeHours}
              onChange={(event) => setCustomizeHours(event.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            Customize Hour Totals
          </label>
          {customizeHours && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                  Bill Hours
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={billHours}
                  onChange={(event) => setBillHours(event.target.value)}
                  placeholder="-"
                  disabled={saving}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60 dark:border-amber-800 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                  Sub Pay Hours
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={subPayHours}
                  onChange={(event) => setSubPayHours(event.target.value)}
                  placeholder="-"
                  disabled={saving}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60 dark:border-amber-800 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSave?.({
            itemId: lineItem.source_item_id,
            customizeHours,
            billHours: customizeHours ? parsedBillHours : lineItem.quantity_or_hours,
            subPayHours: customizeHours ? parsedSubPayHours : lineItem.quantity_or_hours,
          })}
          disabled={saving || !isValid}
          className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Updating...' : 'Update'}
        </button>
      </div>
    </div>
  );
};

export const BillingBreakdownV2: React.FC<Props> = ({ billing }) => {
  const base = billing.billing_details;
  const extra = billing.extra_charges_details ?? null;
  const items = billing.additional_services ?? [];
  const extraLineItems = billing.extra_charges_line_items ?? [];
  const hasExtraLineItems = extraLineItems.length > 0;

  const repairAmount = billing.repair_amount ?? 0;
  const repairSubPay = billing.repair_sub_pay ?? 0;
  const repairCost = billing.repair_cost ?? 0;
  const repairDescription = billing.repair_description?.trim();
  const miscAdditionalCostItems = billing.misc_additional_cost_items ?? [];
  const isEditingRepair = billing.is_editing_repair ?? false;
  const repairInput = billing.repair_amount_input ?? '';
  const repairSubPayInput = billing.repair_sub_pay_input ?? '';
  const savingRepair = billing.saving_repair ?? false;

  // Prepare unified list
  const unifiedItems: UnifiedChargeItem[] = [
    // Map Additional Services
    ...items.map(i => ({
      id: `svc-${i.code}-${i.billing_detail_id}`,
      label: i.label,
      unit_label: i.unit_label,
      quantity_or_hours: i.quantity,
      is_hours: false,
      rate: i.quantity > 0 ? i.bill_amount / i.quantity : undefined,
      sub_rate: i.quantity > 0 ? i.sub_pay_amount / i.quantity : undefined,
      bill_amount: i.bill_amount,
      sub_pay_amount: i.sub_pay_amount,
      profit_amount: i.profit_amount
    })),
    // Map Extra Charges (Itemized)
    ...extraLineItems.map(item => {
      const quantity = Number(item.quantity) || 0;
      const billRate = Number(item.billRate) || 0;
      const subRate = Number(item.subRate) || 0;
      const billHours = getLineItemBillHours(item);
      const subPayHours = getLineItemSubPayHours(item);
      const billAmount = Number(item.calculatedBillAmount ?? quantity * billRate) || 0;
      const subAmount = Number(item.calculatedSubAmount ?? quantity * subRate) || 0;
      return {
        id: `extra-${item.id}`,
        source_item_id: item.id,
        label: item.description?.trim() || `Extra Charges - ${item.categoryName}: ${item.detailName}`,
        unit_label: item.isHourly ? 'Hours' : 'Units',
        quantity_or_hours: quantity,
        is_hours: item.isHourly,
        customize_hours: Boolean(item.customizeHours),
        rate: billRate,
        sub_rate: subRate,
        bill_hours: item.isHourly ? billHours : undefined,
        sub_pay_hours: item.isHourly ? subPayHours : undefined,
        bill_amount: billAmount,
        sub_pay_amount: subAmount,
        profit_amount: billAmount - subAmount
      };
    }),
    // Map Extra Charges (Labor)
    ...(!hasExtraLineItems && extra ? [{
      id: 'extra-labor',
      label: extra.description || 'Extra Charges (Labor)',
      unit_label: 'Hours',
      quantity_or_hours: extra.hours || 0,
      is_hours: true,
      rate: extra.hourly_rate,
      sub_rate: extra.sub_pay_rate,
      bill_hours: extra.hours || 0,
      sub_pay_hours: extra.hours || 0,
      bill_amount: extra.bill_amount || 0,
      sub_pay_amount: extra.sub_pay_amount || 0,
      profit_amount: (extra.bill_amount || 0) - (extra.sub_pay_amount || 0)
    }] : []),
    // Repair line item — only shown when admin has set a repair amount
    ...(repairAmount > 0 ? [{
      id: 'repair',
      label: [
        'Miscellaneous Additional Cost',
        repairCost > 0 ? `Items total: ${formatCurrency(repairCost)}` : '',
        miscAdditionalCostItems.length > 0
          ? miscAdditionalCostItems.map(item => {
              const billAmount = Number(item.price) || 0;
              const subPayAmount = Number(item.subPay) || 0;
              const amounts = [
                billAmount > 0 ? `Bill ${formatCurrency(billAmount)}` : '',
                subPayAmount > 0 ? `Sub ${formatCurrency(subPayAmount)}` : ''
              ].filter(Boolean).join(' / ');
              return `${item.description || 'Item'}${amounts ? ` (${amounts})` : ''}`;
            }).join('; ')
          : (repairDescription || '')
      ].filter(Boolean).join(' - '),
      unit_label: '—',
      quantity_or_hours: null as unknown as number,
      is_hours: false,
      bill_amount: repairAmount,
      sub_pay_amount: repairSubPay,
      profit_amount: repairAmount - repairSubPay
    }] : [])
  ];

  // Calculate totals
  const baseBill = base?.bill_amount ?? 0;
  const baseSub = base?.sub_pay_amount ?? 0;
  const baseProfit = baseBill - baseSub;

  const totalExtraBill = sum(unifiedItems.map(i => i.bill_amount));
  const totalExtraSub = sum(unifiedItems.map(i => i.sub_pay_amount));
  const totalExtraProfit = totalExtraBill - totalExtraSub;
  const totalBillHours = sum(unifiedItems.map(i => i.bill_hours ?? 0));
  const totalSubPayHours = sum(unifiedItems.map(i => i.sub_pay_hours ?? 0));
  const hasHourlyExtraCharges = totalBillHours > 0 || totalSubPayHours > 0;
  const editableHourlyLineItems = useMemo(
    () => unifiedItems.filter(item => item.is_hours && Boolean(item.source_item_id)),
    [unifiedItems]
  );

  // Repair is already included as a line item inside unifiedItems — no double-counting needed
  const totals = {
    bill: baseBill + totalExtraBill,
    sub: baseSub + totalExtraSub,
  };
  const totalProfit = totals.bill - totals.sub;

  // Profit margin percentages
  const baseProfitPct = baseBill > 0 ? (baseProfit / baseBill) * 100 : 0;
  const extraProfitPct = totalExtraBill > 0 ? (totalExtraProfit / totalExtraBill) * 100 : 0;
  const totalProfitPct = totals.bill > 0 ? (totalProfit / totals.bill) * 100 : 0;

  const formatPct = (val: number) => `${val.toFixed(1)}%`;

  return (
    <div className="space-y-8">

      {/* Base Billing Section */}
      <SectionCard title="Base Billing" accentColor="blue">
        <div className="bg-white/60 dark:bg-zinc-800/40 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            <div className="text-left">
              <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Bill to Customer</div>
              <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(baseBill)}</div>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Pay to Subcontractor</div>
              <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(baseSub)}</div>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Profit Amount</div>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(baseProfit)}</div>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Profit Margin</div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatPct(baseProfitPct)}</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Unified Extra Charges Section */}
      {(unifiedItems.length > 0) && (
        <SectionCard title="Extra Charges" accentColor="amber">
          <UnifiedChargesTable items={unifiedItems} />
          <div className="mt-6 bg-white/60 dark:bg-zinc-800/40 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
            {hasHourlyExtraCharges && (
              <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-900/20 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">Total Bill Hours</div>
                  <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalBillHours}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">Total Sub Pay Hours</div>
                  <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalSubPayHours}</div>
                </div>
              </div>
            )}
            {billing.can_customize_extra_charge_hours && editableHourlyLineItems.length > 0 && (
              <div className="mb-6 space-y-3">
                {editableHourlyLineItems.map(item => (
                  <ExtraChargeHoursEditor
                    key={item.id}
                    lineItem={item}
                    saving={billing.saving_extra_charge_hours}
                    onSave={billing.on_extra_charge_hours_save}
                  />
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Total Bill to Customer</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(totalExtraBill)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Total Pay to Subcontractor</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(totalExtraSub)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Total Profit Amount</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalExtraProfit)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Profit Margin</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatPct(extraProfitPct)}</div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Grand Total Section */}
      <SectionCard title="Grand Total" accentColor="emerald">
        <div className="bg-gradient-to-br from-emerald-50/80 to-green-50/60 dark:from-emerald-900/30 dark:to-green-900/20 rounded-xl p-8 border-2 border-emerald-200/60 dark:border-emerald-700/60">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-8">
            <div className="text-left">
              <div className="text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-3 uppercase tracking-wider">Total Bill to Customer</div>
              <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(totals.bill)}</div>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-3 uppercase tracking-wider">Total Pay to Subcontractor</div>
              <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(totals.sub)}</div>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-3 uppercase tracking-wider">Total Profit Amount</div>
              <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalProfit)}</div>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-3 uppercase tracking-wider">Profit Margin</div>
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{formatPct(totalProfitPct)}</div>
            </div>
          </div>
          
          {/* Calculation Breakdown */}
          <div className="pt-8 border-t-2 border-emerald-200/60 dark:border-emerald-700/60">
            <div className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-6 text-left">Calculation Breakdown</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white/80 dark:bg-zinc-800/60 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="font-bold text-zinc-700 dark:text-zinc-300 mb-4 text-left text-lg">Bill to Customer</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Base Billing:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(baseBill)}</span>
                  </div>
                  {totalExtraBill > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges & Repairs:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(totalExtraBill)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-zinc-200 dark:border-zinc-700">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">Total:</span>
                    <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{formatCurrency(totals.bill)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/80 dark:bg-zinc-800/60 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="font-bold text-zinc-700 dark:text-zinc-300 mb-4 text-left text-lg">Pay to Subcontractor</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Base Billing:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(baseSub)}</span>
                  </div>
                  {totalExtraSub > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges & Repairs:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(totalExtraSub)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-zinc-200 dark:border-zinc-700">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">Total:</span>
                    <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{formatCurrency(totals.sub)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/80 dark:bg-zinc-800/60 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="font-bold text-zinc-700 dark:text-zinc-300 mb-4 text-left text-lg">Profit Amount</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Base Billing:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(baseProfit)}</span>
                  </div>
                  {totalExtraProfit > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges & Repairs:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalExtraProfit)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-zinc-200 dark:border-zinc-700">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">Total:</span>
                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(totalProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">Profit Margin:</span>
                    <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatPct(totalProfitPct)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
