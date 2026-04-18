async function fileToImageBitmap(file: Blob): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file)
  return bitmap
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export async function compressPhoto(
  file: File,
  opts: { maxBytes: number; maxDimension: number } = { maxBytes: 500 * 1024, maxDimension: 1200 }
): Promise<{ blob: Blob; contentType: string; width: number; height: number }> {
  const bitmap = await fileToImageBitmap(file)

  const scale = Math.min(1, opts.maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unsupported')

  ctx.drawImage(bitmap, 0, 0, width, height)

  const contentType = 'image/jpeg'

  let quality = 0.85
  let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, contentType, quality))
  if (!blob) throw new Error('compress_failed')

  if (blob.size <= opts.maxBytes) return { blob, contentType, width, height }

  for (let i = 0; i < 8; i++) {
    quality = clamp(quality - 0.1, 0.35, 0.9)
    blob = await new Promise((resolve) => canvas.toBlob(resolve, contentType, quality))
    if (!blob) throw new Error('compress_failed')
    if (blob.size <= opts.maxBytes) return { blob, contentType, width, height }
  }

  return { blob, contentType, width, height }
}
