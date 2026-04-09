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

const PHONE_DIGIT_LIMIT = 10;

const normalizePhoneDigits = (value?: string | null): string => {
  if (!value) return '';

  const digitsOnly = value.replace(/\D/g, '');
  const trimmedDigits =
    digitsOnly.length === 11 && digitsOnly.startsWith('1')
      ? digitsOnly.slice(1)
      : digitsOnly;

  return trimmedDigits.slice(0, PHONE_DIGIT_LIMIT);
};

export const formatPhoneNumber = (value?: string | null): string => {
  const digits = normalizePhoneDigits(value);

  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const toDialablePhoneNumber = (value?: string | null): string =>
  normalizePhoneDigits(value);

export const normalizePhoneList = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    const formatted = formatPhoneNumber(value);
    if (!formatted || seen.has(formatted)) return;
    seen.add(formatted);
    normalized.push(formatted);
  });

  return normalized;
};

export const coercePhoneList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return normalizePhoneList(value.filter((item): item is string => typeof item === 'string'));
};

export const isPhoneFieldName = (name?: string | null): boolean => {
  if (!name) return false;
  return /(^|_)(phone|tel|telephone)$/i.test(name);
};

export const mapInputValueByField = (name: string, value: string): string =>
  isPhoneFieldName(name) ? formatPhoneNumber(value) : value;
