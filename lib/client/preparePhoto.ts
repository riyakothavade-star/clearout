// Runs in the browser when a photo is chosen: checks it, then shrinks it to a JPEG that the server
// accepts (max 1568 px, under about 1.2 MB) and makes a small thumbnail. Nothing is uploaded here.

export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_SIDE = 1568;
const THUMB_SIDE = 320;
const MAX_BASE64_CHARS = 1_600_000; // about 1.2 MB of JPEG; the server limit is 1.5 MB

export type PreparedPhoto =
  | { id: string; name: string; status: "ready"; base64: string; thumbUrl: string }
  | { id: string; name: string; status: "error"; message: string };

const isHeic = (file: File) => /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
const looksLikeImage = (file: File) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);

function draw(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background in the JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const name = file.name || "Photo";
  const error = (message: string): PreparedPhoto => ({ id, name, status: "error", message });

  if (!looksLikeImage(file)) return error("This isn't a photo. Choose a JPEG or PNG image.");
  if (file.size > MAX_SOURCE_BYTES) return error("This photo is over 25 MB. Choose a smaller photo.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return error(
      isHeic(file)
        ? "iPhone HEIC photos can't be opened in this browser. Export it as JPEG (or set the camera to 'Most Compatible') and try again."
        : "This photo couldn't be opened. It may be damaged; try exporting it again as JPEG.",
    );
  }

  try {
    const full = draw(bitmap, MAX_SIDE);
    let dataUrl = full.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > MAX_BASE64_CHARS) dataUrl = full.toDataURL("image/jpeg", 0.6);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (base64.length > MAX_BASE64_CHARS) return error("This photo is too detailed to send. Try a smaller photo.");
    const thumbUrl = draw(bitmap, THUMB_SIDE).toDataURL("image/jpeg", 0.7);
    return { id, name, status: "ready", base64, thumbUrl };
  } catch {
    return error("This photo couldn't be prepared. Try a different photo.");
  } finally {
    bitmap.close();
  }
}
