import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Readable } from "node:stream";
import type { FileStorage } from "../application/ports/file-ports.js";
import { assertValidStorageKey } from "./storage-key.js";

const NOT_FOUND_CODE = "ENOENT";

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === NOT_FOUND_CODE
  );
}

/** Development and tests only: production config refuses this driver (ADR-109). */
export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Readable | undefined> {
    const path = this.pathOf(key);
    const stream = createReadStream(path);
    return new Promise((resolveStream) => {
      stream.once("open", () => resolveStream(stream));
      stream.once("error", (error) => {
        if (isMissingFileError(error)) resolveStream(undefined);
        else stream.destroy(error);
      });
    });
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  /** The key shape is checked first, so it can only name a file below the root. */
  private pathOf(key: string): string {
    assertValidStorageKey(key);
    const path = resolve(join(this.root, ...key.split("/")));
    return path;
  }
}
