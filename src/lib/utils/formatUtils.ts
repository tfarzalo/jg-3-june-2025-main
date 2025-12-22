export const formatWorkOrderNumber = (num: number): string =>
  `WO-${String(num).padStart(6, '0')}`;

export const formatAddress = (property: {
  address: string;
  address_2?: string | null;
  city: string;
  state: string;
  zip: string;
}): string => {
  const parts = [
    property.address,
    property.address_2,
    property.city,
    property.state,
    property.zip
  ].filter(Boolean);
  return parts.join(', ');
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);