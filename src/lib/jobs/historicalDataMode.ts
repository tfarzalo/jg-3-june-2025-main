export type HistoricalDataMode = 'live' | 'snapshot';

export const HISTORICAL_PHASES = new Set(['Completed', 'Archived']);

export function isHistoricalPhase(phaseLabel?: string | null): boolean {
  return HISTORICAL_PHASES.has((phaseLabel ?? '').trim());
}

export function normalizeHistoricalDataMode(
  mode?: string | null
): HistoricalDataMode {
  return mode === 'snapshot' ? 'snapshot' : 'live';
}

export function shouldShowHistoricalDataIndicator(
  phaseLabel?: string | null
): boolean {
  return isHistoricalPhase(phaseLabel);
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
  label: 'Live' | 'Snapshot';
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
      label: 'Snapshot',
      bgClass: 'bg-emerald-600',
      title: 'Snapshot data: this completed or archived job is frozen as a historical record.',
    };
  }

  return {
    code: 'L',
    label: 'Live',
    bgClass: 'bg-red-600',
    title: 'Live data: this completed or archived job is still using mutable live data.',
  };
}
