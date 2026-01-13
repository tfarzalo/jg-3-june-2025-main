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

const toExt = (mime: string) => {
  if (mime === 'image/jpeg') return 'jpg'
  return 'jpg'
}

const canOptimize = (type: string) => {
  const t = (type || '').toLowerCase()
  if (!t.startsWith('image/')) return false
  if (t === 'image/gif') return false
  if (t === 'image/svg+xml') return false
  return true
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
  const originalType = file.type || 'application/octet-stream'
  if (!canOptimize(originalType)) {
    return {
      blob: file,
      mime: originalType,
      suggestedExt: toExt(originalType),
      width: 0,
      height: 0,
      originalSize,
      optimizedSize: originalSize
    }
  }

  let targetMime = 'image/jpeg'
  const lower = originalType.toLowerCase()
  if (lower === 'image/jpeg') targetMime = 'image/jpeg'
  else if (lower === 'image/png') targetMime = 'image/jpeg'
  else if (lower === 'image/webp') targetMime = 'image/jpeg'
  else targetMime = 'image/jpeg'

  const quality = targetMime === 'image/jpeg' ? 0.82 : 0.85

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

    return {
      blob,
      mime: targetMime,
      suggestedExt: toExt(targetMime),
      width,
      height,
      originalSize,
      optimizedSize: blob.size
    }
  } catch {
    return {
      blob: file,
      mime: originalType,
      suggestedExt: toExt(originalType),
      width: 0,
      height: 0,
      originalSize,
      optimizedSize: originalSize
    }
  }
}
