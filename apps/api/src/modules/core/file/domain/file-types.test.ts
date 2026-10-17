import { describe, expect, it } from "vitest";
import {
  htmlPage,
  jpegWithExif,
  pdfDocument,
  pngHeaderThenHtml,
  pngImage,
  svgImage,
  webpImage,
} from "../../../../test-support/file-fixtures.js";
import { detectFileType, FILE_TYPE_GROUP, SNIFF_BYTE_COUNT } from "./file-types.js";

function leading(bytes: Buffer): Buffer {
  return bytes.subarray(0, SNIFF_BYTE_COUNT);
}

describe("detectFileType", () => {
  it("recognizes a JPEG, a PNG and a WebP image by their first bytes", async () => {
    expect(detectFileType(leading(await jpegWithExif(20, 20)))).toEqual({
      group: FILE_TYPE_GROUP.IMAGE,
      mimeType: "image/jpeg",
    });
    expect(detectFileType(leading(await pngImage(20, 20)))?.mimeType).toBe("image/png");
    expect(detectFileType(leading(await webpImage(20, 20)))?.mimeType).toBe("image/webp");
  });

  it("recognizes a PDF as a document", () => {
    expect(detectFileType(leading(pdfDocument()))).toEqual({
      group: FILE_TYPE_GROUP.DOCUMENT,
      mimeType: "application/pdf",
    });
  });

  it("refuses SVG and HTML, which carry scripts", () => {
    expect(detectFileType(leading(svgImage()))).toBeUndefined();
    expect(detectFileType(leading(htmlPage()))).toBeUndefined();
  });

  it("refuses a RIFF container that is not WebP", () => {
    const wave = Buffer.from("RIFF\u0000\u0000\u0000\u0000WAVEfmt ");
    expect(detectFileType(leading(wave))).toBeUndefined();
  });

  it("refuses a body too short to tell", () => {
    expect(detectFileType(Buffer.from([0xff, 0xd8]))).toBeUndefined();
  });

  it("accepts a PNG header followed by HTML here, because only decoding can refuse it", () => {
    expect(detectFileType(leading(pngHeaderThenHtml()))?.mimeType).toBe("image/png");
  });
});
