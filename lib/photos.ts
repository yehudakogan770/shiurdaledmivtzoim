/**
 * Photos are made smaller on the phone before they're uploaded: about 1280 pixels on the long
 * side for the full photo and 480 for the preview on the scrolling wall. A 4 MB phone photo
 * becomes roughly 100 KB and still looks sharp on screen.
 */
const FULL = 1280;
const THUMB = 480;

export interface ShrunkPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  /** A preview to show before sending. */
  preview: string;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img); // browsers turn photos upright from their EXIF data
    img.onerror = () => reject(new Error("That file isn't a photo this phone can open."));
    img.src = url;
  });
}

/** WebP where the browser can make it (smaller); otherwise JPEG. */
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return resolve(webp);
        canvas.toBlob((jpeg) => (jpeg ? resolve(jpeg) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", quality + 0.04);
      },
      "image/webp",
      quality,
    );
  });
}

function draw(img: HTMLImageElement, max: number) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function shrinkPhoto(file: File): Promise<ShrunkPhoto> {
  const img = await loadImage(file);
  try {
    const big = draw(img, FULL);
    const small = draw(img, THUMB);
    const [full, thumb] = await Promise.all([encode(big, 0.8), encode(small, 0.74)]);
    return { full, thumb, width: big.width, height: big.height, preview: URL.createObjectURL(thumb) };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

export const extensionOf = (blob: Blob) => (blob.type === "image/webp" ? "webp" : "jpg");

/** "120 KB", "3.4 MB". */
export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
