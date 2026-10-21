import { getMiscAdditionalCostAmounts, type MiscAdditionalCostLike } from '../miscAdditionalCosts';

export type MiscAdditionalCostRecord = MiscAdditionalCostLike & {
  id?: string;
  description?: string | null;
};

export type BillingMetricForDuplicateCheck = {
  label?: string | null;
  billAmount?: number | string | null;
  subPayAmount?: number | string | null;
};

const cents = (value: unknown): number => Math.round((Number(value) || 0) * 100);

/**
 * An array, including an empty one, is an explicit saved value. Legacy fallback
 * is only appropriate when the structured field is absent or malformed.
 */
export const shouldUseLegacyMiscAdditionalCostFallback = (items: unknown): boolean =>
  !Array.isArray(items);

export const findBillingMetricDuplicateIds = (
  items: MiscAdditionalCostRecord[],
  metric: BillingMetricForDuplicateCheck | null | undefined,
): string[] => {
  if (!metric || cents(metric.billAmount) <= 0) return [];

  return items.flatMap((item) => {
    const { billAmount, subPayAmount } = getMiscAdditionalCostAmounts(item);
    const billMatches = cents(billAmount) === cents(metric.billAmount);
    const metricSubPay = metric.subPayAmount;
    const subPayMatches = metricSubPay == null || cents(subPayAmount) === cents(metricSubPay);
    return billMatches && subPayMatches && item.id ? [item.id] : [];
  });
};
