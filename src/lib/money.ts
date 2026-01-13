export const formatCurrency = (n: number | null | undefined, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n ?? 0);

export const sum = (vals: Array<number | null | undefined>) =>
  vals.reduce((acc, v) => acc + Number(v ?? 0), 0);
