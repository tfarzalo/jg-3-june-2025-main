import { describe, expect, it, vi } from 'vitest'
import {
  detectImageMime,
  filenameForOptimizedImage,
  isImageUploadCandidate,
  optimizeImage,
} from './imageOptimization'

vi.mock('heic2any', () => ({
  default: vi.fn(async () => new Blob([
    new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  ], { type: 'image/jpeg' })),
}))

const isoBaseMediaHeader = (brand: string) => new Uint8Array([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  ...Array.from(brand).map((character) => character.charCodeAt(0)),
])

describe('image upload format detection', () => {
  it('detects HEIC and HEIF from their file signatures', () => {
    expect(detectImageMime(isoBaseMediaHeader('heic'))).toBe('image/heic')
    expect(detectImageMime(isoBaseMediaHeader('mif1'))).toBe('image/heif')
  })

  it('accepts HEIC filenames even when the browser omits the MIME type', () => {
    expect(isImageUploadCandidate({ name: 'IMG_1234.HEIC', type: '' })).toBe(true)
    expect(isImageUploadCandidate({ name: 'IMG_1234.heif', type: 'application/octet-stream' })).toBe(true)
  })

  it('does not treat ordinary documents as image upload candidates', () => {
    expect(isImageUploadCandidate({ name: 'scope.pdf', type: 'application/pdf' })).toBe(false)
  })

  it('applies the optimizer extension without changing the existing base name', () => {
    expect(filenameForOptimizedImage('WO-000123_before_4.HEIC', { suggestedExt: 'jpg' }))
      .toBe('WO-000123_before_4.jpg')
    expect(filenameForOptimizedImage('kitchen.photo.heif', { suggestedExt: 'jpg' }))
      .toBe('kitchen.photo.jpg')
  })

  it('keeps a verified JPEG after HEIC conversion even when canvas optimization is unavailable', async () => {
    const heicBytes = isoBaseMediaHeader('heic')
    const file = new File([heicBytes], 'IMG_1234.HEIC', { type: '' })

    const optimized = await optimizeImage(file)

    expect(optimized.mime).toBe('image/jpeg')
    expect(optimized.suggestedExt).toBe('jpg')
    expect(optimized.originalSize).toBe(file.size)
    expect(detectImageMime(new Uint8Array(await optimized.blob.arrayBuffer()))).toBe('image/jpeg')
  })
})
