export type QualityControlScoreKey =
  | 'prep_work_order_photos'
  | 'prep_holes_repaired'
  | 'prep_sanding_completed'
  | 'prep_cracks_caulked'
  | 'prep_spot_prime_completed'
  | 'paint_full_coverage'
  | 'paint_no_roller_lines'
  | 'paint_trim_baseboards'
  | 'paint_doors_frames_completed'
  | 'paint_proper_sheen'
  | 'details_clean_switch_plates'
  | 'details_no_runs_drips'
  | 'details_straight_cut_lines'
  | 'details_floors_protected'
  | 'details_hardware_protected'
  | 'cleanup_floors_cleaned'
  | 'cleanup_trash_removed'
  | 'cleanup_paint_returned_organized'
  | 'cleanup_reset_unit_items'
  | 'cleanup_lock_unit_return_keys';

export type QualityControlScoreItem = {
  key: QualityControlScoreKey;
  label: string;
  max: number;
};

export type QualityControlScoreSection = {
  key: string;
  label: string;
  max: number;
  items: QualityControlScoreItem[];
};

export const QUALITY_CONTROL_SCORE_SECTIONS: QualityControlScoreSection[] = [
  {
    key: 'prep',
    label: 'Prep',
    max: 25,
    items: [
      { key: 'prep_work_order_photos', label: 'Submit work order/photos', max: 5 },
      { key: 'prep_holes_repaired', label: 'Holes repaired', max: 5 },
      { key: 'prep_sanding_completed', label: 'Sanding completed', max: 5 },
      { key: 'prep_cracks_caulked', label: 'Cracks caulked', max: 5 },
      { key: 'prep_spot_prime_completed', label: 'Spot prime completed', max: 5 },
    ],
  },
  {
    key: 'paint_quality',
    label: 'Paint Quality',
    max: 25,
    items: [
      { key: 'paint_full_coverage', label: 'Full coverage', max: 5 },
      { key: 'paint_no_roller_lines', label: 'No roller lines', max: 5 },
      { key: 'paint_trim_baseboards', label: 'Trim/baseboards', max: 5 },
      { key: 'paint_doors_frames_completed', label: 'Doors & frames completed', max: 5 },
      { key: 'paint_proper_sheen', label: 'Proper sheen', max: 5 },
    ],
  },
  {
    key: 'details_finish',
    label: 'Details / Finish',
    max: 25,
    items: [
      { key: 'details_clean_switch_plates', label: 'Clean switch plates', max: 5 },
      { key: 'details_no_runs_drips', label: 'No runs/drips', max: 5 },
      { key: 'details_straight_cut_lines', label: 'Straight cut lines', max: 5 },
      { key: 'details_floors_protected', label: 'Floors protected', max: 5 },
      { key: 'details_hardware_protected', label: 'Hardware protected', max: 5 },
    ],
  },
  {
    key: 'cleanup_closeout',
    label: 'Cleanup & Closeout',
    max: 25,
    items: [
      { key: 'cleanup_floors_cleaned', label: 'Floors cleaned', max: 5 },
      { key: 'cleanup_trash_removed', label: 'Trash removed', max: 5 },
      { key: 'cleanup_paint_returned_organized', label: 'Paint returned/organized', max: 5 },
      { key: 'cleanup_reset_unit_items', label: 'Reset unit items', max: 5 },
      { key: 'cleanup_lock_unit_return_keys', label: 'Lock unit / return keys', max: 5 },
    ],
  },
];

export const QUALITY_CONTROL_SCORE_ITEMS = QUALITY_CONTROL_SCORE_SECTIONS.flatMap(section => section.items);
export const QUALITY_CONTROL_SCORE_TOTAL = QUALITY_CONTROL_SCORE_SECTIONS.reduce((sum, section) => sum + section.max, 0);
export const QUALITY_CONTROL_LIKERT_VALUES = [0, 1, 2, 3, 4, 5] as const;

export function createEmptyQualityControlScores(): Record<QualityControlScoreKey, number> {
  return QUALITY_CONTROL_SCORE_ITEMS.reduce((acc, item) => {
    acc[item.key] = 0;
    return acc;
  }, {} as Record<QualityControlScoreKey, number>);
}

export function calculateQualityControlTotal(scores: Partial<Record<QualityControlScoreKey, number>>): number {
  return QUALITY_CONTROL_SCORE_ITEMS.reduce((sum, item) => {
    const value = Number(scores[item.key] || 0);
    return sum + Math.min(item.max, Math.max(0, value));
  }, 0);
}

export function getQualityControlSectionTotal(
  scores: Partial<Record<QualityControlScoreKey, number>>,
  section: QualityControlScoreSection
): number {
  return section.items.reduce((sum, item) => sum + Number(scores[item.key] || 0), 0);
}
