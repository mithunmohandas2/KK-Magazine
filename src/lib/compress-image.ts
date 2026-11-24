const maxEdge = 1200;
const webpQuality = 0.7;
const smallWebpBytes = 300 * 1024;
export const maxSourceImageBytes = 20 * 1024 * 1024;

// Crop coordinates are fractions of the source image.
export type ImageCrop = { x: number; y: number; width: number; height: number };

export async function compressImage(file: File, extension: string, crop?: ImageCrop) {
  // Keep GIFs intact so uploads preserve animation.
  if (!crop && extension === 'gif') return file;
  if (file.size > maxSourceImageBytes) throw new Error('Choose an image up to 20 MB.');
  if (!crop && extension === 'webp') {
    const header = new Uint8Array(await file.slice(0, 21).arrayBuffer());
    const chunk = new TextDecoder().decode(header.subarray(12, 16));
    // The VP8X feature byte marks WebP animation with bit 1.
    if (chunk === 'VP8X' && (header[20] & 0x02)) return file;
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This image could not be opened. Check the file and try again.');
  });
  try {
    const source = crop ? {
      x: crop.x * bitmap.width,
      y: crop.y * bitmap.height,
      width: crop.width * bitmap.width,
      height: crop.height * bitmap.height,
    }
      : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
    if (!crop && scale === 1 && file.type === 'image/webp' && file.size <= smallWebpBytes) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image compression is unavailable in this browser.');
    context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => {
        if (result?.type === 'image/webp') resolve(result);
        else reject(new Error('This browser could not compress the image to WebP.'));
      }, 'image/webp', webpQuality);
    });
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.webp`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}
