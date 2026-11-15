// =============================================================================
// LOADING IMAGES  /  CARREGAR IMAGENS
// [F9] from a URL (NASA)   ·   [F10] from a file the user picked or dropped
// [F9] de uma URL (NASA)   ·   [F10] de um arquivo escolhido ou arrastado
// =============================================================================

export class ImageLoadError extends Error {}

/**
 * Downloads an image. GIBS answers errors with an XML message instead of an image,
 * so the content type is checked too.
 * Baixa uma imagem. O GIBS responde erros com XML em vez de imagem, então o tipo também é conferido.
 */
export async function loadImageFromUrl(url: string, fetchFn: typeof fetch = fetch): Promise<ImageBitmap> {
  const res = await fetchFn(url);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) {
    throw new ImageLoadError(`Image request failed (${res.status}, ${type || "no content type"})`);
  }
  return createImageBitmap(await res.blob());
}

/** Returns null for files that aren't images. / Retorna null para arquivos que não são imagem. */
export async function loadImageFromFile(file: File): Promise<ImageBitmap | null> {
  if (!file.type.startsWith("image/")) return null;
  return createImageBitmap(file);
}

/**
 * Draws the image on the canvas (at most `maxWidth` wide) and returns its pixels.
 * Desenha a imagem no canvas (no máximo `maxWidth` de largura) e devolve os pixels.
 */
export function drawImage(canvas: HTMLCanvasElement, img: ImageBitmap, maxWidth = 960): ImageData {
  const scale = Math.min(1, maxWidth / img.width);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
