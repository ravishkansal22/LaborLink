import { MAX_PHOTO_DATA_URL_CHARS } from './storage';
import { PhotoTooLargeError } from './types';

const MAX_INPUT_BYTES = 5 * 1024 * 1024;

/**
 * Resizes an image `File` to a JPEG data URL via canvas.
 * Rejects non-images and files larger than 5 MB. Applies EXIF orientation when
 * `createImageBitmap` supports `imageOrientation: 'from-image'` (no deps).
 * Guarantees the returned data URL is ≤ {@link MAX_PHOTO_DATA_URL_CHARS}.
 *
 * @param file Source image from `<input type="file">` or camera.
 * @param maxSize Longest edge in CSS pixels (default 256).
 * @param quality Initial JPEG quality 0–1 (default 0.82); may be lowered to fit the cap.
 */
export async function resizeImageToDataUrl(
  file: File,
  maxSize = 256,
  quality = 0.82,
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Image resize is only available in the browser.');
  }
  if (!(file instanceof File)) {
    throw new Error('Expected an image file.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image must be 5 MB or smaller.');
  }

  const source = await loadOrientedSource(file);
  try {
    let edge = maxSize;
    let q = quality;
    let dataUrl = drawToJpeg(source.bitmap, source.width, source.height, edge, q);

    // Recompress / shrink until under the on-device photo cap.
    while (dataUrl.length > MAX_PHOTO_DATA_URL_CHARS && (q > 0.45 || edge > 96)) {
      if (q > 0.45) {
        q = Math.max(0.45, q - 0.1);
      } else {
        edge = Math.max(96, Math.round(edge * 0.75));
        q = 0.72;
      }
      dataUrl = drawToJpeg(source.bitmap, source.width, source.height, edge, q);
    }

    if (dataUrl.length > MAX_PHOTO_DATA_URL_CHARS) {
      throw new PhotoTooLargeError();
    }
    return dataUrl;
  } finally {
    source.cleanup();
  }
}

interface OrientedSource {
  bitmap: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function loadOrientedSource(file: File): Promise<OrientedSource> {
  // Prefer createImageBitmap so EXIF orientation is applied without a dependency.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to HTMLImageElement (orientation may be wrong on some browsers).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    return {
      bitmap: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });
}

function drawToJpeg(
  source: CanvasImageSource,
  naturalW: number,
  naturalH: number,
  maxSize: number,
  quality: number,
): string {
  const { width, height } = fitWithin(naturalW, naturalH, maxSize);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the image.');
  ctx.drawImage(source, 0, 0, width, height);
  // Always JPEG for avatars — PNG/WebP data URLs often exceed the 300 KB cap.
  return canvas.toDataURL('image/jpeg', quality);
}

function fitWithin(w: number, h: number, maxSize: number): { width: number; height: number } {
  const safeW = Math.max(1, w);
  const safeH = Math.max(1, h);
  const scale = Math.min(1, maxSize / Math.max(safeW, safeH));
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}
