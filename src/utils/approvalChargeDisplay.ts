export interface ApprovalChargeDisplayData {
  cost: number;
  hours?: number;
  bill_hours?: number;
  quantity?: number;
  unit?: string;
}

export function getApprovalChargeHours(charge: ApprovalChargeDisplayData): number | undefined {
  if (typeof charge.bill_hours === 'number') return charge.bill_hours;
  if (typeof charge.hours === 'number') return charge.hours;
  return undefined;
}

export function getApprovalChargeHoursText(charge: ApprovalChargeDisplayData): string | null {
  const hours = getApprovalChargeHours(charge);
  if (hours === undefined) return null;
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

export function shouldShowApprovalChargeQuantity(charge: ApprovalChargeDisplayData): boolean {
  return typeof charge.quantity === 'number' && getApprovalChargeHours(charge) === undefined;
}

export function getApprovalChargeRateText(charge: ApprovalChargeDisplayData): string | null {
  const hours = getApprovalChargeHours(charge);
  const quantity = shouldShowApprovalChargeQuantity(charge) ? charge.quantity : undefined;
  const hasHours = typeof hours === 'number' && hours > 0;
  const hasQuantity = typeof quantity === 'number' && quantity > 0;
  const divisor = hasHours ? hours : hasQuantity ? quantity : undefined;

  if (!divisor) return null;

  const rate = charge.cost / divisor;
  return `Rate: $${rate.toFixed(2)}${hasHours ? '/hr' : ` per ${charge.unit || 'item'}`}`;
}
