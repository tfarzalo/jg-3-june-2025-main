export type OptimizeResult = {
  blob: Blob
  mime: string
  suggestedExt: string
  width: number
  height: number
  originalSize: number
  optimizedSize: number
}

const MAX_DIMENSION = 2048

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

export const extensionForImageMime = (mime: string, filename = '') => {
  const normalizedMime = (mime || '').toLowerCase().split(';')[0].trim()
  const mapped = MIME_EXTENSIONS[normalizedMime]
  if (mapped) return mapped
  const filenameExtension = filename.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return filenameExtension || 'bin'
}

export const detectImageMime = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png'
  if (bytes.length >= 6) {
    const header = String.fromCharCode(...bytes.slice(0, 6))
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif'
  }
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(...bytes.slice(0, 4))
    const webp = String.fromCharCode(...bytes.slice(8, 12))
    if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp'
    const box = String.fromCharCode(...bytes.slice(4, 8))
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase()
    if (box === 'ftyp') {
      if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif'
      if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic'
      if (['heif', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heif'
    }
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'
  if (bytes.length >= 4) {
    const littleEndianTiff = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00
    const bigEndianTiff = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a
    if (littleEndianTiff || bigEndianTiff) return 'image/tiff'
  }
  return null
}

const canOptimize = (type: string) => {
  const t = (type || '').toLowerCase()
  return t === 'image/jpeg' || t === 'image/png' || t === 'image/webp'
}

const computeTargetSize = (w: number, h: number) => {
  const longEdge = Math.max(w, h)
  if (longEdge <= MAX_DIMENSION) return { width: w, height: h }
  const scale = MAX_DIMENSION / longEdge
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })

const canvasToBlob = (canvas: HTMLCanvasElement, mime: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    const q = Math.min(1, Math.max(0, quality))
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('toBlob failed'))
    }, mime, q)
  })

export async function optimizeImage(file: File): Promise<OptimizeResult> {
  const originalSize = file.size
  const declaredType = file.type || 'application/octet-stream'
  const detectedType = detectImageMime(new Uint8Array(await file.slice(0, 32).arrayBuffer()))
  const originalType = detectedType || declaredType
  if (!canOptimize(originalType)) {
    return {
      blob: file,
      mime: originalType,
      suggestedExt: extensionForImageMime(originalType, file.name),
      width: 0,
      height: 0,
      originalSize,
      optimizedSize: originalSize
    }
  }

  const targetMime = 'image/jpeg'
  const quality = 0.82

  try {
    const img = await loadImage(file)
    const { width, height } = computeTargetSize(img.naturalWidth || img.width, img.naturalHeight || img.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D not available')
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await canvasToBlob(canvas, targetMime, quality)
    const signature = detectImageMime(new Uint8Array(await blob.slice(0, 32).arrayBuffer()))

    // Never replace a smaller original with a larger conversion, and only label
    // the result as JPEG after verifying the actual output bytes.
    if (signature !== targetMime || blob.size >= originalSize) {
      return {
        blob: file,
        mime: originalType,
        suggestedExt: extensionForImageMime(originalType, file.name),
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        originalSize,
        optimizedSize: originalSize
      }
    }

    return {
      blob,
      mime: targetMime,
      suggestedExt: extensionForImageMime(targetMime),
      width,
      height,
      originalSize,
      optimizedSize: blob.size
    }
  } catch {
    return {
      blob: file,
      mime: originalType,
      suggestedExt: extensionForImageMime(originalType, file.name),
      width: 0,
      height: 0,
      originalSize,
      optimizedSize: originalSize
    }
  }
}
