import React from 'react';
import { formatCurrency, sum } from '../../../lib/money';
import type { JobBillingPayload, AdditionalService } from '../../billing/types';

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
                {s.rate !== undefined && (
                   <span className="block text-xs font-normal text-zinc-500 mt-1">
                     Rate: {formatCurrency(s.rate)}
                   </span>
                )}
              </td>
              <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-base">{s.unit_label ?? (s.is_hours ? 'Hours' : '—')}</td>
              <td className="px-6 py-4 text-center text-zinc-800 dark:text-zinc-100 font-bold text-lg">{s.quantity_or_hours}</td>
              <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100 text-lg">{formatCurrency(s.bill_amount)}</td>
              <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100 text-lg">{formatCurrency(s.sub_pay_amount)}</td>
              <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-lg">{formatCurrency(s.profit_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

type UnifiedChargeItem = {
  id: string;
  label: string;
  unit_label?: string;
  quantity_or_hours: number;
  is_hours: boolean;
  rate?: number;
  bill_amount: number;
  sub_pay_amount: number;
  profit_amount: number;
};

export const BillingBreakdownV2: React.FC<Props> = ({ billing }) => {
  const base = billing.billing_details;
  const extra = billing.extra_charges_details ?? null;
  const items = billing.additional_services ?? [];

  // Prepare unified list
  const unifiedItems: UnifiedChargeItem[] = [
    // Map Additional Services
    ...items.map(i => ({
      id: `svc-${i.code}-${i.billing_detail_id}`,
      label: i.label,
      unit_label: i.unit_label,
      quantity_or_hours: i.quantity,
      is_hours: false,
      bill_amount: i.bill_amount,
      sub_pay_amount: i.sub_pay_amount,
      profit_amount: i.profit_amount
    })),
    // Map Extra Charges (Labor)
    ...(extra ? [{
      id: 'extra-labor',
      label: extra.description || 'Extra Charges (Labor)',
      unit_label: 'Hours',
      quantity_or_hours: extra.hours || 0,
      is_hours: true,
      rate: extra.hourly_rate,
      bill_amount: extra.bill_amount || 0,
      sub_pay_amount: extra.sub_pay_amount || 0,
      profit_amount: (extra.bill_amount || 0) - (extra.sub_pay_amount || 0)
    }] : [])
  ];

  // Calculate totals
  const baseBill = base?.bill_amount ?? 0;
  const baseSub = base?.sub_pay_amount ?? 0;
  const baseProfit = baseBill - baseSub;

  const totalExtraBill = sum(unifiedItems.map(i => i.bill_amount));
  const totalExtraSub = sum(unifiedItems.map(i => i.sub_pay_amount));
  const totalExtraProfit = totalExtraBill - totalExtraSub;

  const totals = {
    bill: baseBill + totalExtraBill,
    sub: baseSub + totalExtraSub,
  };
  const totalProfit = totals.bill - totals.sub;

  return (
    <div className="space-y-8">

      {/* Base Billing Section */}
      <SectionCard title="Base Billing" accentColor="blue">
        <div className="bg-white/60 dark:bg-zinc-800/40 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
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
          </div>
        </div>
      </SectionCard>

      {/* Unified Extra Charges Section */}
      {(unifiedItems.length > 0) && (
        <SectionCard title="Extra Charges" accentColor="amber">
          <UnifiedChargesTable items={unifiedItems} />
          <div className="mt-6 bg-white/60 dark:bg-zinc-800/40 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
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
            </div>
          </div>
        </SectionCard>
      )}

      {/* Grand Total Section */}
      <SectionCard title="Grand Total" accentColor="emerald">
        <div className="bg-gradient-to-br from-emerald-50/80 to-green-50/60 dark:from-emerald-900/30 dark:to-green-900/20 rounded-xl p-8 border-2 border-emerald-200/60 dark:border-emerald-700/60">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
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
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges:</span>
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
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges:</span>
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
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalExtraProfit)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-zinc-200 dark:border-zinc-700">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">Total:</span>
                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(totalProfit)}</span>
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
