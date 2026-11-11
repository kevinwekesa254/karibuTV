/** Resize an image client-side to ≤ maxPx on the long edge, re-encoded as JPEG (BUILD_SPEC 5: ≤1600 px). */
export async function resizeImage(file: File, maxPx = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not process image"))), "image/jpeg", quality));
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("That file isn't an image we can read."));
    img.src = URL.createObjectURL(file);
  });
}

/** Keep PNG logos (transparency) but cap size. */
export async function prepareLogo(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.size < 400_000) return file;
  return resizeImage(file, 800, 0.9);
}
