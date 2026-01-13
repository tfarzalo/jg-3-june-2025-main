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

const ServicesTable: React.FC<{ items: AdditionalService[] }> = ({ items }) => {
  if (!items?.length) return (
    <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-xl">
      <div className="text-lg font-medium">No additional services</div>
      <div className="text-sm mt-1">Additional services will appear here when added</div>
    </div>
  );
  
  return (
    <div className="overflow-hidden rounded-xl border-2 border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-800/40 shadow-inner">
      <table className="w-full text-sm">
        <thead className="bg-gradient-to-r from-zinc-100/80 to-zinc-200/60 dark:from-zinc-700/60 dark:to-zinc-800/40">
          <tr>
            <th className="text-left px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Service</th>
            <th className="text-left px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Unit</th>
            <th className="text-center px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Qty</th>
            <th className="text-right px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Bill to Customer</th>
            <th className="text-right px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Pay to Sub</th>
            <th className="text-right px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-base">Profit</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, index) => (
            <tr 
              key={`${s.code}-${s.billing_detail_id}`} 
              className={`border-t border-zinc-200/60 dark:border-zinc-700/60 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/30 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/10 transition-all duration-200 ${
                index % 2 === 0 ? 'bg-white/40 dark:bg-zinc-800/20' : 'bg-zinc-50/30 dark:bg-zinc-800/10'
              }`}
            >
              <td className="px-6 py-4 text-zinc-800 dark:text-zinc-100 font-semibold text-base">{s.label}</td>
              <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-base">{s.unit_label ?? '—'}</td>
              <td className="px-6 py-4 text-center text-zinc-800 dark:text-zinc-100 font-bold text-lg">{s.quantity}</td>
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

export const BillingBreakdownV2: React.FC<Props> = ({ billing }) => {
  const base = billing.billing_details;
  const extra = billing.extra_charges_details ?? null;
  const items = billing.additional_services ?? [];

  // Debug: Check if extra charges should be present but aren't
  const shouldHaveExtraCharges = billing.extra_charges_details === null && 
    (billing.hourly_billing_details?.bill_amount ?? 0) > 0;

  // Calculate totals with clear breakdown
  const baseBill = base?.bill_amount ?? 0;
  const baseSub = base?.sub_pay_amount ?? 0;
  const baseProfit = baseBill - baseSub;

  const extraBill = extra?.bill_amount ?? 0;
  const extraSub = extra?.sub_pay_amount ?? 0;
  const extraProfit = extraBill - extraSub;

  const additionalBill = sum(items.map(i => i.bill_amount));
  const additionalSub = sum(items.map(i => i.sub_pay_amount));
  const additionalProfit = additionalBill - additionalSub;

  const totals = {
    bill: baseBill + extraBill + additionalBill,
    sub: baseSub + extraSub + additionalSub,
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

      {/* Additional Services Section */}
      <SectionCard title="Additional Services" accentColor="purple">
        <ServicesTable items={items} />
        {items.length > 0 && (
          <div className="mt-6 bg-white/60 dark:bg-zinc-800/40 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Total Bill to Customer</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(additionalBill)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Total Pay to Subcontractor</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(additionalSub)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Total Profit Amount</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(additionalProfit)}</div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Extra Charges Section */}
      {extra && (
        <SectionCard title="Extra Charges" accentColor="amber">
          <div className="bg-white/60 dark:bg-zinc-800/40 rounded-xl p-6 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-6">
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Bill to Customer</div>
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(extraBill)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Pay to Subcontractor</div>
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(extraSub)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Profit Amount</div>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(extraProfit)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t-2 border-zinc-200/60 dark:border-zinc-700/60">
              <div className="text-left">
                <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Hours</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{extra.hours ?? 0}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Hourly Rate</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(extra.hourly_rate)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Sub Rate</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(extra.sub_pay_rate)}</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Description</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{extra.description || 'N/A'}</div>
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
                  {additionalBill > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Additional Services:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(additionalBill)}</span>
                    </div>
                  )}
                  {extraBill > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(extraBill)}</span>
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
                  {additionalSub > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Additional Services:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(additionalSub)}</span>
                    </div>
                  )}
                  {extraSub > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(extraSub)}</span>
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
                  {additionalProfit > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Additional Services:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(additionalProfit)}</span>
                    </div>
                  )}
                  {extraProfit > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-600 dark:text-zinc-400">Extra Charges:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(extraProfit)}</span>
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
