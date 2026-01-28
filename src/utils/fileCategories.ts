export type FileCategory =
  | 'property_files'
  | 'job_files'
  | 'before_images'
  | 'sprinkler_images'
  | 'other_files';

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  property_files: 'Property Files',
  job_files: 'Job Files',
  before_images: 'Before Images',
  sprinkler_images: 'Sprinkler Images',
  other_files: 'Other Files',
};

export const FILE_CATEGORY_PATHS: Record<FileCategory, string> = {
  property_files: 'property-files',
  job_files: 'job-files',
  before_images: 'before-images',
  sprinkler_images: 'sprinkler-images',
  other_files: 'other-files',
};

export const FOLDER_KEY_TO_CATEGORY: Record<string, FileCategory> = {
  property_files: 'property_files',
  job_files: 'job_files',
  before: 'before_images',
  sprinkler: 'sprinkler_images',
  other: 'other_files',
};

export const FOLDER_NAME_TO_CATEGORY: Record<string, FileCategory> = {
  'Property Files': 'property_files',
  'Job Files': 'job_files',
  'Before Images': 'before_images',
  'Sprinkler Images': 'sprinkler_images',
  'Other Files': 'other_files',
};

const LEGACY_CATEGORY_MAP: Record<string, FileCategory> = {
  before: 'before_images',
  sprinkler: 'sprinkler_images',
  other: 'other_files',
  job_files: 'job_files',
  property_files: 'property_files',
  before_images: 'before_images',
  sprinkler_images: 'sprinkler_images',
  other_files: 'other_files',
};

export const LEGACY_CATEGORY_ALIASES: Record<FileCategory, string[]> = {
  property_files: ['property_files'],
  job_files: ['job_files'],
  before_images: ['before_images', 'before'],
  sprinkler_images: ['sprinkler_images', 'sprinkler'],
  other_files: ['other_files', 'other'],
};

export function normalizeCategory(value?: string | null): FileCategory | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return LEGACY_CATEGORY_MAP[key] ?? null;
}
