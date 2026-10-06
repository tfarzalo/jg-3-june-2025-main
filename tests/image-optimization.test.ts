import { describe, expect, it } from 'vitest';
import { detectImageMime, extensionForImageMime } from '../src/lib/utils/imageOptimization';

describe('image upload type safety', () => {
  it('preserves extensions for formats that are not converted', () => {
    expect(extensionForImageMime('image/heic', 'photo.HEIC')).toBe('heic');
    expect(extensionForImageMime('image/gif', 'animation.gif')).toBe('gif');
    expect(extensionForImageMime('image/svg+xml', 'drawing.svg')).toBe('svg');
    expect(extensionForImageMime('application/pdf', 'document.pdf')).toBe('pdf');
  });

  it('detects supported inline image signatures', () => {
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectImageMime(new TextEncoder().encode('GIF89a'))).toBe('image/gif');
    expect(detectImageMime(new TextEncoder().encode('RIFFxxxxWEBP'))).toBe('image/webp');
  });

  it('detects HEIC and rejects unknown byte signatures', () => {
    expect(detectImageMime(new TextEncoder().encode('xxxxftypheic'))).toBe('image/heic');
    expect(detectImageMime(new TextEncoder().encode('<html>not an image</html>'))).toBeNull();
  });
});
