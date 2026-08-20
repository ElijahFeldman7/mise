"use client";

/**
 * Photos are taken on a phone and are enormous. Nothing leaves the device
 * until it has been redrawn onto a canvas at a sane size — a 12 MP camera
 * frame becomes roughly 150–300 KB, which is what actually gets uploaded.
 */

export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
};

export async function compressImage(
  file: File | Blob,
  { maxEdge = 1400, quality = 0.82 }: { maxEdge?: number; quality?: number } = {},
): Promise<CompressedImage> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not get a drawing context for the photo");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);

  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not compress the photo"))),
      "image/jpeg",
      quality,
    );
  });

  return {
    blob,
    width,
    height,
    bytes: blob.size,
    previewUrl: URL.createObjectURL(blob),
  };
}

/**
 * A receipt wants the opposite treatment from a dish photo: keep it big and
 * push it to hard black and white, which is what Tesseract reads best.
 */
export async function prepareReceiptImage(file: File | Blob): Promise<Blob> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not get a drawing context for the receipt");

  context.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;

  // Greyscale first, and find the mean so the threshold suits the lighting.
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const grey = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    pixels[i] = pixels[i + 1] = pixels[i + 2] = grey;
    sum += grey;
  }
  const mean = sum / (pixels.length / 4);
  const threshold = mean * 0.86;

  for (let i = 0; i < pixels.length; i += 4) {
    const value = pixels[i] < threshold ? 0 : 255;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
  }

  context.putImageData(image, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not prepare the receipt"))),
      "image/png",
    );
  });
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari occasionally refuses; fall through to an <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read that image"));
      image.src = url;
    });
    return image;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
