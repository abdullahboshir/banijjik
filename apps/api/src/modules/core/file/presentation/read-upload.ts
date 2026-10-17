import busboy from "busboy";
import type { IncomingHttpHeaders } from "node:http";
import type { Readable } from "node:stream";
import { fileTooLarge, fileTypeNotAllowed, invalidUpload } from "../domain/errors.js";
import { UPLOAD_TIMEOUT_MS } from "../domain/file-limits.js";
import { detectFileType, SNIFF_BYTE_COUNT } from "../domain/file-types.js";
import { sizeLimitOfGroup } from "../domain/purpose-rules.js";

export interface UploadSource extends Readable {
  readonly headers: IncomingHttpHeaders;
}

export interface UploadedFile {
  readonly purpose: string | undefined;
  readonly originalName: string;
  readonly bytes: Buffer;
}

export interface ReadUploadOptions {
  readonly timeoutMs?: number;
}

const PURPOSE_FIELD = "purpose";
const FILE_FIELD = "file";
/** One file and one short text field. busboy raises a limit event on the part after the limit, and `parts` on reaching it, so 3 refuses a third part. */
const PART_LIMITS = { files: 1, fields: 1, parts: 3, fieldSize: 64 } as const;

/** The size limit of the file's type, from its first bytes; undefined while too few have arrived. */
function limitFromLeadingBytes(chunks: readonly Buffer[], received: number): number | undefined {
  if (received < SNIFF_BYTE_COUNT) return undefined;
  const detected = detectFileType(Buffer.concat(chunks).subarray(0, SNIFF_BYTE_COUNT));
  if (detected === undefined) throw fileTypeNotAllowed();
  return sizeLimitOfGroup(detected.group);
}

function createParser(source: UploadSource): busboy.Busboy | undefined {
  try {
    return busboy({ headers: source.headers, limits: PART_LIMITS, defParamCharset: "utf8" });
  } catch {
    // Not a multipart request: busboy throws on a missing or wrong content type.
    return undefined;
  }
}

/** One upload being read. The first failure wins and stops the read; later events are ignored. */
class UploadReader {
  private readonly chunks: Buffer[] = [];
  private received = 0;
  private limit: number | undefined;
  private purpose: string | undefined;
  private originalName: string | undefined;
  private isSettled = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly source: UploadSource,
    private readonly parser: busboy.Busboy,
    private readonly callbacks: {
      resolve: (file: UploadedFile) => void;
      reject: (error: Error) => void;
    },
  ) {}

  start(timeoutMs: number): void {
    this.timer = setTimeout(() => this.fail(invalidUpload(FILE_FIELD)), timeoutMs);
    this.parser.on("field", (name, value) => this.onField(name, value));
    this.parser.on("file", (name, stream, info) => {
      this.onFile(name, info.filename ?? "");
      stream.on("data", (chunk: Buffer) => this.onChunk(chunk));
      // Destroying the parser mid-file errors its file stream too; the first failure already won.
      stream.on("error", () => this.fail(invalidUpload(FILE_FIELD)));
    });
    this.parser.on("filesLimit", () => this.fail(invalidUpload(FILE_FIELD)));
    this.parser.on("fieldsLimit", () => this.fail(invalidUpload(PURPOSE_FIELD)));
    this.parser.on("partsLimit", () => this.fail(invalidUpload(FILE_FIELD)));
    this.parser.on("error", () => this.fail(invalidUpload(FILE_FIELD)));
    this.parser.on("close", () => this.finish());
    this.source.on("error", () => this.fail(invalidUpload(FILE_FIELD)));
    this.source.pipe(this.parser);
  }

  private onField(name: string, value: string): void {
    if (name !== PURPOSE_FIELD) {
      this.fail(invalidUpload(name));
      return;
    }
    this.purpose = value;
  }

  private onFile(name: string, filename: string): void {
    if (name !== FILE_FIELD) {
      this.fail(invalidUpload(name));
      return;
    }
    this.originalName = filename;
  }

  private onChunk(chunk: Buffer): void {
    if (this.isSettled) return;
    this.chunks.push(chunk);
    this.received += chunk.length;
    try {
      this.limit ??= limitFromLeadingBytes(this.chunks, this.received);
      if (this.limit !== undefined && this.received > this.limit) throw fileTooLarge(this.limit);
    } catch (error) {
      this.fail(error as Error);
    }
  }

  private finish(): void {
    if (this.isSettled) return;
    if (this.originalName === undefined || this.received === 0) {
      this.fail(invalidUpload(FILE_FIELD));
      return;
    }
    // Too short to have a recognizable header.
    if (this.limit === undefined) {
      this.fail(fileTypeNotAllowed());
      return;
    }
    this.isSettled = true;
    clearTimeout(this.timer);
    this.callbacks.resolve({
      purpose: this.purpose,
      originalName: this.originalName,
      bytes: Buffer.concat(this.chunks),
    });
  }

  /** Stops reading at once: nothing more is parsed or buffered, then the caller learns why. */
  private fail(error: Error): void {
    if (this.isSettled) return;
    this.isSettled = true;
    clearTimeout(this.timer);
    this.source.unpipe(this.parser);
    this.parser.destroy();
    this.source.pause();
    this.chunks.length = 0;
    this.callbacks.reject(error);
  }
}

/**
 * Reads exactly one file and the `purpose` field from a multipart body while it streams. The type
 * is read from the first bytes and refused at once; the size is counted chunk by chunk and the
 * read stops the moment the limit is passed, so a large upload is never buffered whole (ADR-109).
 * The caller closes the connection after answering an aborted upload (see `closeAfterResponse`).
 */
export function readUpload(
  source: UploadSource,
  options: ReadUploadOptions = {},
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const parser = createParser(source);
    if (parser === undefined) {
      reject(invalidUpload(FILE_FIELD));
      return;
    }
    new UploadReader(source, parser, { resolve, reject }).start(
      options.timeoutMs ?? UPLOAD_TIMEOUT_MS,
    );
  });
}
