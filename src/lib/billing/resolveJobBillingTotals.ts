import { getMiscAdditionalCostAmounts } from '../miscAdditionalCosts';
import { shouldUseLegacyMiscAdditionalCostFallback } from './miscAdditionalCostEditing';

type UnknownRecord = Record<string, unknown>;

export type ResolvedBillingTotals = {
  baseBill: number;
  baseSubPay: number;
  standardExtraBill: number;
  standardExtraSubPay: number;
  supplementalBill: number;
  supplementalSubPay: number;
  miscBill: number;
  miscSubPay: number;
  totalBill: number;
  totalSubPay: number;
  sources: {
    standardExtras: 'structured' | 'legacy';
    supplemental: 'live' | 'frozen';
    miscellaneous: 'structured' | 'legacy' | 'invalid';
    total: 'live' | 'snapshot' | 'cancellation';
  };
  validationErrors: string[];
};

const record = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};

const amount = (...values: unknown[]): number => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const sumLines = (
  lines: unknown,
  billKeys: string[],
  subPayKeys: string[],
): { bill: number; subPay: number } => {
  if (!Array.isArray(lines)) return { bill: 0, subPay: 0 };
  return lines.reduce((totals, rawLine) => {
    const line = record(rawLine);
    totals.bill += amount(...billKeys.map(key => line[key]));
    totals.subPay += amount(...subPayKeys.map(key => line[key]));
    return totals;
  }, { bill: 0, subPay: 0 });
};

const resolveStandardExtras = (
  workOrder: UnknownRecord,
  legacyExtra: UnknownRecord,
): { bill: number; subPay: number; source: 'structured' | 'legacy' } => {
  const items = workOrder.extra_charges_line_items;
  if (Array.isArray(items) && items.length > 0) {
    const totals = items.reduce((sum, rawItem) => {
      const item = record(rawItem);
      const quantity = amount(item.quantity);
      sum.bill += amount(item.calculatedBillAmount, quantity * amount(item.billRate));
      sum.subPay += amount(item.calculatedSubAmount, quantity * amount(item.subRate));
      return sum;
    }, { bill: 0, subPay: 0 });
    return { ...totals, source: 'structured' };
  }
  return {
    bill: amount(legacyExtra.bill_amount, legacyExtra.total_extra_charges),
    subPay: amount(legacyExtra.sub_pay_amount),
    source: 'legacy',
  };
};

const resolveMiscellaneous = (
  workOrder: UnknownRecord,
  details: UnknownRecord,
): {
  bill: number;
  subPay: number;
  source: 'structured' | 'legacy' | 'invalid';
  error?: string;
} => {
  const items = workOrder.misc_additional_cost_items;
  if (Array.isArray(items)) {
    const totals = items.reduce((sum, rawItem) => {
      const item = record(rawItem);
      const values = getMiscAdditionalCostAmounts(item);
      sum.bill += values.billAmount;
      sum.subPay += values.subPayAmount ?? 0;
      return sum;
    }, { bill: 0, subPay: 0 });
    return { ...totals, source: 'structured' };
  }
  if (shouldUseLegacyMiscAdditionalCostFallback(items)) {
    return {
      bill: amount(details.repair_amount, workOrder.repair_cost),
      subPay: amount(details.repair_sub_pay),
      source: 'legacy',
    };
  }
  return {
    bill: 0,
    subPay: 0,
    source: 'invalid',
    error: 'misc_additional_cost_items must be an array, null, or absent',
  };
};

/**
 * Application compatibility resolver used while the database calculator is
 * introduced. It preserves current standard-extra fallback behavior, treats a
 * structured miscellaneous array (including []) as authoritative, and chooses
 * supplemental lines by live/snapshot data mode rather than by largest value.
 */
export const resolveJobBillingTotals = (input: unknown): ResolvedBillingTotals => {
  const details = record(input);
  const workOrder = record(details.work_order);
  const base = record(details.billing_details);
  const legacyExtra = record(details.extra_charges_details);
  const validationErrors: string[] = [];

  const baseBill = amount(base.bill_amount, base.base_price);
  const baseSubPay = amount(base.sub_pay_amount);
  const standard = resolveStandardExtras(workOrder, legacyExtra);
  const misc = resolveMiscellaneous(workOrder, details);
  if (misc.error) validationErrors.push(misc.error);

  const isSnapshot = details.historical_data_mode === 'snapshot';
  const supplemental = isSnapshot
    ? sumLines(workOrder.frozen_billing_lines, ['amountBill', 'bill_amount'], ['amountSub', 'sub_pay_amount'])
    : sumLines(workOrder.additional_services, ['amountBill', 'bill_amount'], ['amountSub', 'sub_pay_amount']);

  const phase = record(details.job_phase);
  const phaseLabel = String(
    phase.job_phase_label
      ?? details.snapshot_phase_label
      ?? details.snapshot_last_phase_label
      ?? '',
  ).trim();
  const isCancelled = phaseLabel === 'Cancelled';
  if (isCancelled) {
    const cancellationAdded = Boolean(details.cancellation_trip_charge_added);
    const totalBill = cancellationAdded
      ? amount(details.cancellation_trip_charge_bill_amount)
      : 0;
    const totalSubPay = cancellationAdded
      ? amount(details.cancellation_trip_charge_sub_pay_amount)
      : 0;
    return {
      baseBill: 0,
      baseSubPay: 0,
      standardExtraBill: 0,
      standardExtraSubPay: 0,
      supplementalBill: 0,
      supplementalSubPay: 0,
      miscBill: 0,
      miscSubPay: 0,
      totalBill,
      totalSubPay,
      sources: {
        standardExtras: standard.source,
        supplemental: isSnapshot ? 'frozen' : 'live',
        miscellaneous: misc.source,
        total: 'cancellation',
      },
      validationErrors,
    };
  }

  return {
    baseBill,
    baseSubPay,
    standardExtraBill: standard.bill,
    standardExtraSubPay: standard.subPay,
    supplementalBill: supplemental.bill,
    supplementalSubPay: supplemental.subPay,
    miscBill: misc.bill,
    miscSubPay: misc.subPay,
    totalBill: baseBill + standard.bill + supplemental.bill + misc.bill,
    totalSubPay: baseSubPay + standard.subPay + supplemental.subPay + misc.subPay,
    sources: {
      standardExtras: standard.source,
      supplemental: isSnapshot ? 'frozen' : 'live',
      miscellaneous: misc.source,
      total: isSnapshot ? 'snapshot' : 'live',
    },
    validationErrors,
  };
};
