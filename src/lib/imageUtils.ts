export const MAX_PRODUCT_IMAGE_DATA_URL_LEN = 180000;
export const MAX_PRODUCT_IMAGE_HTTP_URL_LEN = 2048;

/**
 * Validates and sanitizes a product image URL or base64 Data URL.
 * Rejects unsafe schemes (javascript:, data:text/html, svg+xml, etc.).
 */
export function sanitizeProductImageUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return trimmed.slice(0, MAX_PRODUCT_IMAGE_HTTP_URL_LEN);
      }
    } catch {
      return '';
    }
    return '';
  }

  if (
    /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed) &&
    trimmed.length <= MAX_PRODUCT_IMAGE_DATA_URL_LEN
  ) {
    return trimmed;
  }

  return '';
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to decode image file.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Resizes and compresses a selected image file on-device so it fits cleanly in
 * localStorage, Supabase PostgreSQL, Firestore, and JSON backups.
 */
export async function compressProductImageFile(
  file: File,
  maxDim = 420,
  initialQuality = 0.8
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPG, PNG, or WebP).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image file is too large (max 15 MB).');
  }

  const img = await loadImageFromFile(file);
  const srcW = img.naturalWidth || img.width || maxDim;
  const srcH = img.naturalHeight || img.height || maxDim;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas image processing is unavailable in this browser.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let dataUrl = canvas.toDataURL('image/jpeg', initialQuality);
  if (dataUrl.length > 150000) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.62);
  }
  if (dataUrl.length > MAX_PRODUCT_IMAGE_DATA_URL_LEN) {
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = Math.max(1, Math.round(targetW * 0.7));
    smallCanvas.height = Math.max(1, Math.round(targetH * 0.7));
    const sCtx = smallCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#ffffff';
      sCtx.fillRect(0, 0, smallCanvas.width, smallCanvas.height);
      sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
      dataUrl = smallCanvas.toDataURL('image/jpeg', 0.6);
    }
  }

  const sanitized = sanitizeProductImageUrl(dataUrl);
  if (!sanitized) {
    throw new Error('Compressed image exceeded size limit.');
  }
  return sanitized;
}
