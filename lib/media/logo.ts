import sharp from "sharp";

/**
 * Normalizes an uploaded logo while removing the common flat white JPEG
 * backdrop. Existing PNG/WebP transparency is preserved, and white artwork on
 * a genuinely non-white logo remains untouched.
 */
export async function normalizeBrandLogo(logo: Buffer, width: number, height: number) {
  const sourceMetadata = await sharp(logo, { limitInputPixels: 24_000_000 }).metadata();
  const normalized = await sharp(logo, { limitInputPixels: 24_000_000 })
    .rotate()
    .trim()
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  if (sourceMetadata.hasAlpha) return normalized;
  const { data, info } = await sharp(normalized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let palePixels = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] >= 246 && data[index + 1] >= 246 && data[index + 2] >= 246) palePixels += 1;
  }
  // Only remove white when it behaves like a backdrop, not when white is a
  // small intentional part of the mark.
  if (palePixels / (info.width * info.height) < 0.28) return normalized;
  for (let index = 0; index < data.length; index += 4) {
    const minimum = Math.min(data[index], data[index + 1], data[index + 2]);
    if (minimum >= 238) data[index + 3] = Math.max(0, Math.min(255, (255 - minimum) * 15));
  }
  return sharp(data, { raw: info }).png().toBuffer();
}
