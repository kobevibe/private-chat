// Compress images before upload so phone photos (3–10 MB) become ~150–400 KB.
// This keeps the Supabase storage quota tiny and avoids bucket size/type rejects.
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82
const SKIP_BELOW_BYTES = 600 * 1024 // small files aren't worth re-encoding

function loadViaImgElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode image'))
    }
    img.src = url
  })
}

export async function compressImage(file) {
  if (!file || typeof document === 'undefined') return file
  const type = file.type || ''
  // Animated GIFs must not be flattened to a still frame
  if (!type.startsWith('image/') || type === 'image/gif') return file
  if (file.size <= SKIP_BELOW_BYTES) return file

  try {
    const source =
      typeof createImageBitmap === 'function'
        ? await createImageBitmap(file)
        : await loadViaImgElement(file)

    const width = source.width || source.naturalWidth
    const height = source.height || source.naturalHeight
    if (!width || !height) return file

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    // White backdrop so transparent PNGs don't turn black in JPEG
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
    ctx.drawImage(source, 0, 0, targetW, targetH)
    if (typeof source.close === 'function') source.close()

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob || blob.size >= file.size) return file

    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Unsupported format (e.g. HEIC on some browsers) — fall back to original
    return file
  }
}
