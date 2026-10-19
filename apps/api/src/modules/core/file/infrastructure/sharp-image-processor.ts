import { FILE_VARIANT, type FileVariant } from "@banijjik/contracts/file";
import sharp from "sharp";
import type { ImageProcessor, ProcessedVariant } from "../application/ports/file-ports.js";
import { fileTypeNotAllowed } from "../domain/errors.js";
import {
  BLURRED_VARIANT_LONG_SIDE,
  BLURRED_VARIANT_SIGMA,
  IMAGE_VARIANT_LONG_SIDE,
  MAX_IMAGE_PIXELS,
} from "../domain/file-limits.js";

const IMAGE_VARIANTS: readonly FileVariant[] = [
  FILE_VARIANT.thumb,
  FILE_VARIANT.medium,
  FILE_VARIANT.large,
];

async function encodeVariant(bytes: Buffer, variantKey: FileVariant): Promise<ProcessedVariant> {
  const longSide = IMAGE_VARIANT_LONG_SIDE[variantKey as keyof typeof IMAGE_VARIANT_LONG_SIDE];
  // `sharp` drops metadata (EXIF, GPS) unless asked to keep it; the output is a fresh WebP, so a
  // polyglot file loses its second meaning. `rotate()` applies the camera orientation first.
  const { data, info } = await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate()
    .resize({ width: longSide, height: longSide, fit: "inside", withoutEnlargement: true })
    .webp()
    .toBuffer({ resolveWithObject: true });
  return { variantKey, bytes: data, width: info.width, height: info.height };
}

/** Heavily blurred public preview for LISTING_PHOTO under BLURRED_PUBLIC (ADR-127). */
async function encodeBlurredVariant(bytes: Buffer): Promise<ProcessedVariant> {
  const { data, info } = await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate()
    .resize({
      width: BLURRED_VARIANT_LONG_SIDE,
      height: BLURRED_VARIANT_LONG_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .blur(BLURRED_VARIANT_SIGMA)
    .webp()
    .toBuffer({ resolveWithObject: true });
  return {
    variantKey: FILE_VARIANT.blurred,
    bytes: data,
    width: info.width,
    height: info.height,
  };
}

/** Re-encodes every accepted image into the three sizes plus a blurred preview. Nothing of the original is kept. */
export class SharpImageProcessor implements ImageProcessor {
  async process(bytes: Buffer): Promise<readonly ProcessedVariant[]> {
    try {
      const [sized, blurred] = await Promise.all([
        Promise.all(IMAGE_VARIANTS.map((variant) => encodeVariant(bytes, variant))),
        encodeBlurredVariant(bytes),
      ]);
      return [...sized, blurred];
    } catch {
      // A file with an image header that will not decode (or is a decompression bomb) is not an image.
      throw fileTypeNotAllowed();
    }
  }
}
