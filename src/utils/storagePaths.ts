// src/utils/storagePaths.ts

/**
 * Sanitize a string for storage paths (backend/URLs)
 * Converts spaces to underscores, removes special characters
 * Example: "511 Queens Rd" -> "511_Queens_Rd"
 */
export function sanitizeForStorage(s: string): string {
  if (!s) return '';
  return s
    .trim()
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/[\\?#%*:|"<>]/g, '-')  // Replace invalid chars with dashes
    .replace(/_+/g, '_')  // Collapse multiple underscores
    .replace(/^_+|_+$/g, '');  // Remove leading/trailing underscores
}

/**
 * Legacy function - kept for compatibility
 * Use sanitizeForStorage for new code
 */
export function sanitizeSegment(s: string): string {
  if (!s) return '';
  // Replace characters that break storage/object paths or URLs
  return s.replace(/[\\?#%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();
}

/**
 * Format a display name from a storage path segment
 * Converts underscores to spaces for display
 * Example: "511_Queens_Rd" -> "511 Queens Rd"
 */
export function formatDisplayName(s: string): string {
  if (!s) return '';
  return s.replace(/_/g, ' ').trim();
}

export function joinPathSegments(...segs: string[]): string {
  // Encode *segments* (not slashes), keep folder structure
  return segs
    .filter(Boolean)
    .map(sanitizeForStorage)
    .map(s => s.replace(/^\/+|\/+$/g, '')) // trim leading/trailing slashes per segment
    .join('/');
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  const justName = filename.split('/').pop() || filename;
  const parts = justName.split('.');
  if (parts.length <= 1) {
    return sanitizeForStorage(justName);
  }
  const ext = parts.pop() as string;
  const base = parts.join('.');
  const safeBase = sanitizeForStorage(base);
  const safeExt = sanitizeForStorage(ext);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

export function buildStoragePath(params: {
  propertyId: string;
  workOrderId?: string | null;
  jobIdFallback?: string | null;
  category: string;
  filename: string;
}): string {
  const { propertyId, workOrderId, jobIdFallback, category, filename } = params;
  const safeName = sanitizeFilename(filename);
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const finalName = safeName ? `${uniquePrefix}_${safeName}` : uniquePrefix;
  const woId = workOrderId || jobIdFallback || '';
  const categorySegment = category;

  if (!propertyId) {
    return joinPathSegments('unknown', categorySegment, finalName);
  }

  if (categorySegment === 'property-files' || categorySegment === 'property_files') {
    return joinPathSegments('properties', propertyId, 'property-files', finalName);
  }

  if (woId) {
    return joinPathSegments('properties', propertyId, 'work-orders', woId, categorySegment, finalName);
  }

  return joinPathSegments('properties', propertyId, categorySegment, finalName);
}
