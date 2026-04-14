import React from 'react';
import { getHistoricalDataIndicator } from '@/lib/jobs/historicalDataMode';

interface JobDataModeIndicatorProps {
  phaseLabel?: string | null;
  dataMode?: string | null;
  className?: string;
}

export function JobDataModeIndicator({
  phaseLabel,
  dataMode,
  className = '',
}: JobDataModeIndicatorProps) {
  const indicator = getHistoricalDataIndicator(phaseLabel, dataMode);

  if (!indicator) {
    return null;
  }

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${indicator.bgClass} ${className}`.trim()}
      title={indicator.title}
      aria-label={`${indicator.label} data`}
    >
      {indicator.code}
    </span>
  );
}
