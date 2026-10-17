import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newId } from "@banijjik/ids";
import { afterAll, describe, expect, it } from "vitest";
import type { FileStorage } from "../application/ports/file-ports.js";
import { LocalFileStorage } from "./local-file-storage.js";

const root = mkdtempSync(join(tmpdir(), "local-storage-test-"));
const storage: FileStorage = new LocalFileStorage(root);

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function aKey(variant = "medium"): string {
  return `org/${newId()}/${newId()}/${variant}`;
}

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

describe("LocalFileStorage", () => {
  it("stores bytes under a key, reads them back and deletes them", async () => {
    const key = aKey();
    await storage.put(key, Buffer.from("hello"), "image/webp");

    const stream = await storage.get(key);
    if (stream === undefined) throw new Error("the stored object was not found");
    expect((await readAll(stream)).toString()).toBe("hello");

    await storage.delete(key);
    expect(await storage.get(key)).toBeUndefined();
  });

  it("treats deleting a missing object as success", async () => {
    await expect(storage.delete(aKey())).resolves.toBeUndefined();
  });

  it("answers undefined for an object that was never stored", async () => {
    expect(await storage.get(aKey())).toBeUndefined();
  });

  it("refuses a key that is not built from ids, so a path cannot escape the root", async () => {
    for (const key of ["../../etc/passwd", "org/x/y/z", `org/${newId()}/../${newId()}/thumb`, ""]) {
      await expect(storage.put(key, Buffer.from("x"), "image/webp"), key).rejects.toThrow();
      await expect(storage.get(key), key).rejects.toThrow();
    }
  });
});
