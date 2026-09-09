import React from 'react';
import { Activity, Lock } from 'lucide-react';
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

  const Icon = indicator.code === 'S' ? Lock : Activity;

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-white ${indicator.bgClass} ${className}`.trim()}
      title={indicator.title}
      aria-label={`${indicator.label} data`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}
