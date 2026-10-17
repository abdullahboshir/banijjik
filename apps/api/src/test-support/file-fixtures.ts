import sharp, { type Sharp } from "sharp";

/** A text marker written into the EXIF block of fixture photos, so a test can prove it is gone. */
export const EXIF_MARKER = "SECRET-CAMERA-OWNER";

const SOLID_BACKGROUND = { r: 200, g: 80, b: 40 };

function solidImage(width: number, height: number): Sharp {
  return sharp({ create: { width, height, channels: 3, background: SOLID_BACKGROUND } });
}

/** A JPEG that carries EXIF (a copyright text and a GPS position), like a phone photo. */
export async function jpegWithExif(width = 1200, height = 900): Promise<Buffer> {
  return solidImage(width, height)
    .withExif({
      IFD0: { Copyright: EXIF_MARKER },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "23/1 45/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "90/1 24/1 0/1",
      },
    })
    .jpeg()
    .toBuffer();
}

export function pngImage(width = 300, height = 200): Promise<Buffer> {
  return solidImage(width, height).png().toBuffer();
}

export function webpImage(width = 300, height = 200): Promise<Buffer> {
  return solidImage(width, height).webp().toBuffer();
}

/** A minimal PDF header followed by filler: enough for the content check, which reads leading bytes. */
export function pdfDocument(extraBytes = 0): Buffer {
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"),
    Buffer.alloc(extraBytes),
  ]);
}

export function svgImage(): Buffer {
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
}

export function htmlPage(): Buffer {
  return Buffer.from("<!doctype html><html><body><script>alert(1)</script></body></html>");
}

/** The PNG signature followed by HTML: it passes a naive header check but is not an image. */
export function pngHeaderThenHtml(): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, htmlPage()]);
}

/** A JPEG-sized body of the given length that starts like a JPEG, for the size limit tests. */
export function jpegHeaderWithFiller(totalBytes: number): Buffer {
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  return Buffer.concat([header, Buffer.alloc(totalBytes - header.length)]);
}
