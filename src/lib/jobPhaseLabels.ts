export function formatJobPhaseLabel(label?: string | null) {
  return label === 'Completed' ? 'Completed Jobs' : (label || '');
}
