export const ADMIN_JOB_CANCELLATION_REASONS = [
  'Unit still occupied',
  "Unit doesn't have power",
  'No paint onsite',
  'Active leak',
  'Resident turned us away (applies to occupied repairs)',
] as const;

export const ADMIN_JOB_CANCELLATION_OTHER_REASON = 'Other';

export function resolveAdminJobCancellationReason(
  selectedReason: string,
  otherReason: string
) {
  if (selectedReason === ADMIN_JOB_CANCELLATION_OTHER_REASON) {
    return otherReason.trim();
  }

  return selectedReason.trim();
}

export function extractJobCancellationReason(changeReason: string | null | undefined) {
  const normalizedReason = changeReason?.trim();

  if (!normalizedReason) {
    return null;
  }

  const selectedReasonMatch = normalizedReason.match(/^Job cancelled(?:[^:]+)?:\s*(.+)$/i);
  if (selectedReasonMatch?.[1]) {
    return selectedReasonMatch[1].trim();
  }

  if (/^Job cancelled after extra charges were declined$/i.test(normalizedReason)) {
    return 'Extra charges were declined';
  }

  if (/^Job cancelled$/i.test(normalizedReason)) {
    return 'No reason recorded';
  }

  return normalizedReason;
}
