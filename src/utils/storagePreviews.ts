// src/utils/storagePreviews.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type PreviewResult =
  | { kind: 'signed'; url: string }
  | { kind: 'blob'; url: string; revoke: () => void };

export async function getPreviewUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  opts?: { expiresIn?: number }
): Promise<PreviewResult> {
  const expiresIn = opts?.expiresIn ?? 60 * 60 * 6; // 6h
  // Try signed URL first (fast, cacheable by src)
  const { data: signed, error: signedErr } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (signed?.signedUrl && !signedErr) {
    return { kind: 'signed', url: signed.signedUrl };
  }

  // Fallback: download() and create a blob URL
  const { data: file, error: dlErr } = await supabase
    .storage
    .from(bucket)
    .download(path);

  if (file && !dlErr) {
    const blobUrl = URL.createObjectURL(file);
    return { kind: 'blob', url: blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) };
  }

  throw new Error(`Unable to generate preview for ${bucket}/${path}: ${signedErr?.message ?? dlErr?.message ?? 'unknown error'}`);
}

export async function uploadAndPreview(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
  opts?: { upsert?: boolean; contentType?: string; expiresIn?: number }
): Promise<PreviewResult> {
  const { error } = await supabase
    .storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: !!opts?.upsert,
      contentType: opts?.contentType ?? file.type,
    });

  if (error) throw error;
  return getPreviewUrl(supabase, bucket, path, { expiresIn: opts?.expiresIn });
}
