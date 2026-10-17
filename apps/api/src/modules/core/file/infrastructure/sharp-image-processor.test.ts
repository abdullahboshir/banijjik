import { ERROR_CODE } from "@banijjik/contracts";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  EXIF_MARKER,
  jpegWithExif,
  pngHeaderThenHtml,
  pngImage,
} from "../../../../test-support/file-fixtures.js";
import { SharpImageProcessor } from "./sharp-image-processor.js";

const processor = new SharpImageProcessor();

describe("SharpImageProcessor", () => {
  it("turns a JPEG into thumb, medium and large WebP variants with their longest side capped", async () => {
    const variants = await processor.process(await jpegWithExif(2400, 1800));

    expect(variants.map((variant) => variant.variantKey)).toEqual(["thumb", "medium", "large"]);
    const sizes = await Promise.all(variants.map((variant) => sharp(variant.bytes).metadata()));
    expect(sizes.map((meta) => meta.format)).toEqual(["webp", "webp", "webp"]);
    expect(sizes.map((meta) => meta.width)).toEqual([200, 800, 1600]);
    expect(sizes.map((meta) => meta.height)).toEqual([150, 600, 1200]);
  });

  it("strips EXIF and GPS data from every variant", async () => {
    const original = await jpegWithExif(1200, 900);
    expect((await sharp(original).metadata()).exif).toBeDefined();
    expect(original.includes(EXIF_MARKER)).toBe(true);

    const variants = await processor.process(original);

    for (const variant of variants) {
      const metadata = await sharp(variant.bytes).metadata();
      expect(metadata.exif, variant.variantKey).toBeUndefined();
      expect(variant.bytes.includes(EXIF_MARKER), variant.variantKey).toBe(false);
    }
  });

  it("never enlarges a small image", async () => {
    const variants = await processor.process(await pngImage(100, 50));

    for (const variant of variants) {
      expect(variant).toMatchObject({ width: 100, height: 50 });
    }
  });

  it("refuses a file with an image header that does not decode, as an unsupported type", async () => {
    await expect(processor.process(pngHeaderThenHtml())).rejects.toMatchObject({
      code: ERROR_CODE.UNSUPPORTED_MEDIA_TYPE,
    });
  });
});
