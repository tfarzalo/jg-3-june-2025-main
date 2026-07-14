import { useMemo } from 'react';
import { usePhases } from './usePhases';

const PHASE_LABEL_BY_NAV_LABEL: Record<string, string> = {
  Dashboard: 'Job Request',
  'Job Requests': 'Job Request',
  'Work Orders': 'Work Order',
  'Pending Work Orders': 'Pending Work Order',
  'Completed Work Orders': 'Completed Work Orders',
  'Quality Control': 'Quality Control',
  'Completed Jobs': 'Completed',
  Completed: 'Completed',
  Invoicing: 'Invoicing',
  Cancelled: 'Cancelled',
  Archives: 'Archived',
};

export function useJobPhaseColorMap() {
  const { phases } = usePhases();

  return useMemo(() => {
    return phases.reduce<Record<string, string>>((colors, phase) => {
      colors[phase.job_phase_label] = phase.color_dark_mode;
      return colors;
    }, {});
  }, [phases]);
}

export function getPhaseLabelForNavigationLabel(label: string) {
  return PHASE_LABEL_BY_NAV_LABEL[label] || null;
}
