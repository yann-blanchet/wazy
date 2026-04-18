export type EnhanceOps = {
  autobalance: boolean
  autocrop: boolean
  shadowremoval: boolean
  sharpen: boolean
}

export type RenderResult = {
  blob: Blob
  contentType: string
  width: number
  height: number
}

function clamp8(n: number) {
  return Math.max(0, Math.min(255, n))
}

function cropToAspect(
  src: HTMLCanvasElement,
  aspectW: number,
  aspectH: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const targetAspect = aspectW / aspectH
  const srcAspect = src.width / src.height

  let sx = 0
  let sy = 0
  let sw = src.width
  let sh = src.height

  if (srcAspect > targetAspect) {
    sw = Math.round(src.height * targetAspect)
    sx = Math.round((src.width - sw) / 2)
  } else if (srcAspect < targetAspect) {
    sh = Math.round(src.width / targetAspect)
    sy = Math.round((src.height - sh) / 2)
  }

  const out = document.createElement('canvas')
  out.width = sw
  out.height = sh
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('canvas_unsupported')
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh)
  return { canvas: out, ctx }
}

function cropToContentBounds(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext('2d')
  if (!ctx) throw new Error('canvas_unsupported')
  const img = ctx.getImageData(0, 0, src.width, src.height)
  const d = img.data

  // 1) Try to detect a "menu slate" (large dark rectangle) by luminance.
  // This fits common restaurant boards like the sample you provided.
  const step = Math.max(1, Math.round(Math.max(src.width, src.height) / 500))
  let dkMinX = src.width,
    dkMinY = src.height,
    dkMaxX = 0,
    dkMaxY = 0
  let darkHits = 0
  const lumThreshold = 90

  for (let y = 0; y < src.height; y += step) {
    for (let x = 0; x < src.width; x += step) {
      const i = (y * src.width + x) * 4
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (lum < lumThreshold) {
        darkHits++
        if (x < dkMinX) dkMinX = x
        if (y < dkMinY) dkMinY = y
        if (x > dkMaxX) dkMaxX = x
        if (y > dkMaxY) dkMaxY = y
      }
    }
  }

  if (darkHits > 200 && dkMinX < dkMaxX && dkMinY < dkMaxY) {
    const padX = Math.round(src.width * 0.02)
    const padY = Math.round(src.height * 0.02)
    const sx = Math.max(0, dkMinX - padX)
    const sy = Math.max(0, dkMinY - padY)
    const sw = Math.min(src.width - sx, dkMaxX - dkMinX + padX * 2)
    const sh = Math.min(src.height - sy, dkMaxY - dkMinY + padY * 2)

    if (sw >= src.width * 0.55 && sh >= src.height * 0.55) {
      const out = document.createElement('canvas')
      out.width = sw
      out.height = sh
      const octx = out.getContext('2d')
      if (!octx) throw new Error('canvas_unsupported')
      octx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh)
      return out
    }
  }

  function sample(x: number, y: number) {
    const i = (y * src.width + x) * 4
    return { r: d[i], g: d[i + 1], b: d[i + 2] }
  }

  const c1 = sample(0, 0)
  const c2 = sample(src.width - 1, 0)
  const c3 = sample(0, src.height - 1)
  const c4 = sample(src.width - 1, src.height - 1)
  const bg = {
    r: Math.round((c1.r + c2.r + c3.r + c4.r) / 4),
    g: Math.round((c1.g + c2.g + c3.g + c4.g) / 4),
    b: Math.round((c1.b + c2.b + c3.b + c4.b) / 4)
  }

  // 2) Generic fallback: crop to content that differs from estimated background.
  const threshold = 28
  let minX = src.width,
    minY = src.height,
    maxX = 0,
    maxY = 0
  let hits = 0

  // Step scan for speed
  const step2 = Math.max(1, Math.round(Math.max(src.width, src.height) / 400))

  for (let y = 0; y < src.height; y += step2) {
    for (let x = 0; x < src.width; x += step2) {
      const i = (y * src.width + x) * 4
      const dr = Math.abs(d[i] - bg.r)
      const dg = Math.abs(d[i + 1] - bg.g)
      const db = Math.abs(d[i + 2] - bg.b)
      if (dr + dg + db > threshold * 3) {
        hits++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  // If we couldn't confidently detect content, keep as-is
  if (hits < 50 || minX >= maxX || minY >= maxY) return src

  const padX = Math.round(src.width * 0.03)
  const padY = Math.round(src.height * 0.03)
  const sx = Math.max(0, minX - padX)
  const sy = Math.max(0, minY - padY)
  const sw = Math.min(src.width - sx, maxX - minX + padX * 2)
  const sh = Math.min(src.height - sy, maxY - minY + padY * 2)

  // Don't crop if it would remove too much
  if (sw < src.width * 0.5 || sh < src.height * 0.5) return src

  const out = document.createElement('canvas')
  out.width = sw
  out.height = sh
  const octx = out.getContext('2d')
  if (!octx) throw new Error('canvas_unsupported')
  octx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh)
  return out
}

function getMinMaxPerChannel(data: Uint8ClampedArray) {
  let rMin = 255,
    gMin = 255,
    bMin = 255
  let rMax = 0,
    gMax = 0,
    bMax = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r < rMin) rMin = r
    if (g < gMin) gMin = g
    if (b < bMin) bMin = b
    if (r > rMax) rMax = r
    if (g > gMax) gMax = g
    if (b > bMax) bMax = b
  }

  return { rMin, gMin, bMin, rMax, gMax, bMax }
}

function applyAutoBalance(img: ImageData) {
  const d = img.data
  const { rMin, gMin, bMin, rMax, gMax, bMax } = getMinMaxPerChannel(d)

  const rRange = Math.max(1, rMax - rMin)
  const gRange = Math.max(1, gMax - gMin)
  const bRange = Math.max(1, bMax - bMin)

  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp8(((d[i] - rMin) * 255) / rRange)
    d[i + 1] = clamp8(((d[i + 1] - gMin) * 255) / gRange)
    d[i + 2] = clamp8(((d[i + 2] - bMin) * 255) / bRange)
  }
}

function applyShadowRemoval(img: ImageData) {
  // Simple shadow lift using a curve. This is intentionally lightweight.
  const d = img.data
  const gamma = 0.85
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = d[i + c] / 255
      const lifted = Math.pow(v, gamma)
      d[i + c] = clamp8(Math.round(lifted * 255))
    }
  }
}

function applySharpen(img: ImageData) {
  // Unsharp-ish 3x3 kernel
  const w = img.width
  const h = img.height
  const src = img.data
  const out = new Uint8ClampedArray(src.length)

  const k = [
    0,
    -1,
    0,
    -1,
    5,
    -1,
    0,
    -1,
    0
  ]

  function idx(x: number, y: number) {
    return (y * w + x) * 4
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y)
      out[i + 3] = src[i + 3]

      for (let c = 0; c < 3; c++) {
        let acc = 0
        let ki = 0
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const xx = Math.max(0, Math.min(w - 1, x + ox))
            const yy = Math.max(0, Math.min(h - 1, y + oy))
            acc += src[idx(xx, yy) + c] * k[ki]
            ki++
          }
        }
        out[i + c] = clamp8(Math.round(acc))
      }
    }
  }

  img.data.set(out)
}

async function canvasToJpeg(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let quality = 0.85
  let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('compress_failed')
  if (blob.size <= maxBytes) return blob

  for (let i = 0; i < 8; i++) {
    quality = Math.max(0.35, quality - 0.1)
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('compress_failed')
    if (blob.size <= maxBytes) return blob
  }

  return blob
}

export async function renderEnhanced(
  file: File,
  ops: EnhanceOps,
  opts: { maxBytes: number; maxDimension: number; cropAspectW: number; cropAspectH: number } = {
    maxBytes: 500 * 1024,
    maxDimension: 1200,
    cropAspectW: 4,
    cropAspectH: 5
  }
): Promise<{ original: RenderResult; enhanced: RenderResult }>
{
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, opts.maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const base = document.createElement('canvas')
  base.width = width
  base.height = height
  const ctx = base.getContext('2d')
  if (!ctx) throw new Error('canvas_unsupported')
  ctx.drawImage(bitmap, 0, 0, width, height)

  // Autocrop should work for wide menu slates too, so we crop to detected content bounds.
  // (We intentionally do NOT force a 4:5 aspect ratio here.)
  const originalCanvas = ops.autocrop ? cropToContentBounds(base) : base
  const originalBlob = await canvasToJpeg(originalCanvas, opts.maxBytes)

  // Enhanced pipeline starts from the same (possibly cropped) pixels
  const work = document.createElement('canvas')
  work.width = originalCanvas.width
  work.height = originalCanvas.height
  const wctx = work.getContext('2d')
  if (!wctx) throw new Error('canvas_unsupported')
  wctx.drawImage(originalCanvas, 0, 0)

  const img = wctx.getImageData(0, 0, work.width, work.height)

  if (ops.autobalance) applyAutoBalance(img)
  if (ops.shadowremoval) applyShadowRemoval(img)
  if (ops.sharpen) applySharpen(img)

  wctx.putImageData(img, 0, 0)

  const enhancedBlob = await canvasToJpeg(work, opts.maxBytes)

  return {
    original: {
      blob: originalBlob,
      contentType: 'image/jpeg',
      width: originalCanvas.width,
      height: originalCanvas.height
    },
    enhanced: {
      blob: enhancedBlob,
      contentType: 'image/jpeg',
      width: work.width,
      height: work.height
    }
  }
}
