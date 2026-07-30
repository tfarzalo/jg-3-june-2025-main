export type MiscAdditionalCostLike = {
  price?: number | string | null;
  subPay?: number | string | null;
  sub_pay?: number | string | null;
  sub_pay_amount?: number | string | null;
};

const parseAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : null;
};

export const getMiscAdditionalCostAmounts = (
  item: MiscAdditionalCostLike
): { billAmount: number; subPayAmount: number | null } => {
  const parsedPrice = parseAmount(item.price);
  const parsedSubPay = parseAmount(item.subPay ?? item.sub_pay ?? item.sub_pay_amount);

  if ((parsedPrice === null || parsedPrice <= 0) && parsedSubPay !== null && parsedSubPay > 0) {
    return {
      billAmount: parsedSubPay,
      subPayAmount: null
    };
  }

  return {
    billAmount: parsedPrice ?? 0,
    subPayAmount: parsedSubPay
  };
};
