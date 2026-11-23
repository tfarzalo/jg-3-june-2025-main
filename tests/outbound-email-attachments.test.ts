import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createImagesZipAttachment,
  EMAIL_SIZE_MAX_BYTES,
  estimateEncodedBase64Bytes,
  exceedsEmailSizeLimit,
} from '../src/lib/outboundEmailAttachments';

describe('outbound email attachment preparation', () => {
  it('uses a 25 MiB complete-message policy', () => {
    expect(EMAIL_SIZE_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(exceedsEmailSizeLimit(EMAIL_SIZE_MAX_BYTES)).toBe(false);
    expect(exceedsEmailSizeLimit(EMAIL_SIZE_MAX_BYTES + 1)).toBe(true);
  });

  it('estimates base64 MIME wrapping without imposing an attachment-count limit', () => {
    expect(estimateEncodedBase64Bytes('YQ==')).toBeGreaterThan(4);
  });

  it('creates one lossless ZIP and makes duplicate filenames unique', async () => {
    const first = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 4]);
    const second = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 5, 6, 7]);
    const attachment = await createImagesZipAttachment([
      { filename: 'photo.jpg', bytes: first },
      { filename: 'photo.jpg', bytes: second },
    ], 'WO-000123-images.zip');

    expect(attachment.filename).toBe('WO-000123-images.zip');
    expect(attachment.contentType).toBe('application/zip');

    const zip = await JSZip.loadAsync(attachment.content, { base64: true });
    expect(Object.keys(zip.files).sort()).toEqual(['photo-2.jpg', 'photo.jpg']);
    expect(await zip.file('photo.jpg')!.async('uint8array')).toEqual(first);
    expect(await zip.file('photo-2.jpg')!.async('uint8array')).toEqual(second);
  });

  it('keeps size warnings advisory and enforces the 25 MiB policy in the dispatcher', () => {
    const modal = readFileSync(new URL('../src/components/EnhancedPropertyNotificationModal.tsx', import.meta.url), 'utf8');
    const dispatcher = readFileSync(new URL('../supabase/functions/send-email/index.ts', import.meta.url), 'utf8');

    expect(modal).not.toContain('if (!window.confirm(warning)) return;');
    expect(dispatcher).toContain('positiveIntegerEnvironment("EMAIL_SIZE_MAX_BYTES", 25 * 1024 * 1024)');
    expect(dispatcher).toContain('if (estimatedMessageBytes > maximumMessageBytes)');
  });

  it('never runs the upload optimizer during email attachment preparation', () => {
    const modal = readFileSync(new URL('../src/components/EnhancedPropertyNotificationModal.tsx', import.meta.url), 'utf8');
    const preparationSection = modal.slice(modal.indexOf('const fetchStoredImage'), modal.indexOf('const buildSectionHtml'));
    expect(preparationSection).not.toContain('optimizeImage(');
    expect(preparationSection).toContain('createImagesZipAttachment');
  });
});
