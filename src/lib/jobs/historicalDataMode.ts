export type HistoricalDataMode = 'live' | 'snapshot';

export const HISTORICAL_PHASES = new Set(['Completed Work Orders', 'Quality Control', 'Completed', 'Invoicing', 'Cancelled', 'Archived']);

export function isHistoricalPhase(phaseLabel?: string | null): boolean {
  return HISTORICAL_PHASES.has((phaseLabel ?? '').trim());
}

export function normalizeHistoricalDataMode(
  mode?: string | null
): HistoricalDataMode {
  return mode === 'snapshot' ? 'snapshot' : 'live';
}

export function shouldShowHistoricalDataIndicator(
  _phaseLabel?: string | null
): boolean {
  return true;
}

export function isFrozenHistoricalSnapshot(
  phaseLabel?: string | null,
  mode?: string | null
): boolean {
  return isHistoricalPhase(phaseLabel) && normalizeHistoricalDataMode(mode) === 'snapshot';
}

export function getHistoricalDataIndicator(
  phaseLabel?: string | null,
  mode?: string | null
): {
  code: 'L' | 'S';
  label: 'Live' | 'Static';
  bgClass: string;
  title: string;
} | null {
  if (!shouldShowHistoricalDataIndicator(phaseLabel)) {
    return null;
  }

  const normalizedMode = normalizeHistoricalDataMode(mode);

  if (normalizedMode === 'snapshot') {
    return {
      code: 'S',
      label: 'Static',
      bgClass: 'bg-sky-400',
      title: 'Static/frozen data: this job is showing a saved snapshot instead of live mutable data.',
    };
  }

  return {
    code: 'L',
    label: 'Live',
    bgClass: 'bg-red-600',
    title: 'Live data: this job is showing current mutable job and work order data.',
  };
}
