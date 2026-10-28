import { ERROR_CODE } from "@banijjik/contracts";
import { PassThrough, Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  htmlPage,
  jpegHeaderWithFiller,
  pdfDocument,
  pngImage,
} from "../../../../test-support/file-fixtures.js";
import { MAX_IMAGE_UPLOAD_BYTES } from "../domain/file-limits.js";
import { readUpload, type UploadSource } from "./read-upload.js";

const BOUNDARY = "----test-boundary";
const KILOBYTE = 1024;

interface PartSpec {
  readonly name: string;
  readonly filename?: string;
  readonly content: Buffer | string;
}

function partBytes(part: PartSpec): Buffer {
  const disposition =
    part.filename === undefined
      ? `form-data; name="${part.name}"`
      : `form-data; name="${part.name}"; filename="${part.filename}"`;
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: ${disposition}\r\n\r\n`),
    Buffer.from(part.content),
    Buffer.from("\r\n"),
  ]);
}

function asSource(
  stream: Readable,
  contentType = `multipart/form-data; boundary=${BOUNDARY}`,
): UploadSource {
  return Object.assign(stream, { headers: { "content-type": contentType } });
}

function multipartSource(parts: readonly PartSpec[]): UploadSource {
  const body = Buffer.concat([...parts.map(partBytes), Buffer.from(`--${BOUNDARY}--\r\n`)]);
  return asSource(Readable.from([body]));
}

/** A multipart body whose file part never ends, counting how many bytes the reader pulled from it. */
function endlessUpload(): { source: UploadSource; generatedBytes: () => number } {
  let generated = 0;
  const head = partBytes({ name: "file", filename: "big.jpg", content: "" }).subarray(0, -2);
  let isFirst = true;
  const stream = new Readable({
    read() {
      if (isFirst) {
        isFirst = false;
        this.push(Buffer.concat([head, jpegHeaderWithFiller(64 * KILOBYTE)]));
        generated += 64 * KILOBYTE;
        return;
      }
      generated += 64 * KILOBYTE;
      this.push(Buffer.alloc(64 * KILOBYTE));
    },
  });
  return { source: asSource(stream), generatedBytes: () => generated };
}

describe("readUpload", () => {
  it("returns the file bytes, the original name and the purpose", async () => {
    const image = await pngImage(40, 40);
    const upload = await readUpload(
      multipartSource([
        { name: "purpose", content: "LOGO" },
        { name: "file", filename: "logo.png", content: image },
      ]),
    );

    expect(upload.purpose).toBe("LOGO");
    expect(upload.originalName).toBe("logo.png");
    expect(upload.bytes.equals(image)).toBe(true);
  });

  it("accepts the purpose after the file as well", async () => {
    const upload = await readUpload(
      multipartSource([
        { name: "file", filename: "a.pdf", content: pdfDocument() },
        { name: "purpose", content: "ATTACHMENT" },
      ]),
    );

    expect(upload.purpose).toBe("ATTACHMENT");
  });

  it("returns WEBSITE_IMAGE as the purpose field without interpreting visibility", async () => {
    const image = await pngImage(40, 40);
    const upload = await readUpload(
      multipartSource([
        { name: "purpose", content: "WEBSITE_IMAGE" },
        { name: "file", filename: "hero.png", content: image },
      ]),
    );

    expect(upload.purpose).toBe("WEBSITE_IMAGE");
    expect(upload.bytes.equals(image)).toBe(true);
  });

  it("refuses a second file with a validation error", async () => {
    const image = await pngImage(10, 10);
    await expect(
      readUpload(
        multipartSource([
          { name: "file", filename: "a.png", content: image },
          { name: "file", filename: "b.png", content: image },
        ]),
      ),
    ).rejects.toMatchObject({ code: ERROR_CODE.VALIDATION_ERROR });
  });

  it("refuses a body without a file", async () => {
    await expect(
      readUpload(multipartSource([{ name: "purpose", content: "LOGO" }])),
    ).rejects.toMatchObject({ code: ERROR_CODE.VALIDATION_ERROR });
  });

  it("refuses a field it does not know", async () => {
    await expect(
      readUpload(
        multipartSource([
          { name: "visibility", content: "PUBLIC" },
          { name: "file", filename: "a.pdf", content: pdfDocument() },
        ]),
      ),
    ).rejects.toMatchObject({ code: ERROR_CODE.VALIDATION_ERROR });
  });

  it("refuses a request that is not multipart", async () => {
    const source = asSource(Readable.from([Buffer.from("{}")]), "application/json");
    await expect(readUpload(source)).rejects.toMatchObject({ code: ERROR_CODE.VALIDATION_ERROR });
  });

  it("refuses HTML as an unsupported type from its first bytes", async () => {
    await expect(
      readUpload(multipartSource([{ name: "file", filename: "x.jpg", content: htmlPage() }])),
    ).rejects.toMatchObject({ code: ERROR_CODE.UNSUPPORTED_MEDIA_TYPE });
  });

  it("stops reading an endless image upload soon after the limit, instead of buffering it", async () => {
    const { source, generatedBytes } = endlessUpload();

    await expect(readUpload(source)).rejects.toMatchObject({
      code: ERROR_CODE.PAYLOAD_TOO_LARGE,
    });

    const slackBytes = 2 * 1024 * KILOBYTE;
    expect(generatedBytes()).toBeLessThan(MAX_IMAGE_UPLOAD_BYTES + slackBytes);
    const generatedAtStop = generatedBytes();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(generatedBytes()).toBe(generatedAtStop);
  });

  it("gives up on an upload that stalls", async () => {
    const stalled = asSource(new PassThrough());
    await expect(readUpload(stalled, { timeoutMs: 30 })).rejects.toMatchObject({
      code: ERROR_CODE.VALIDATION_ERROR,
    });
  });
});
