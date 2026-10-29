import {
  FILE_PURPOSE,
  FILE_VISIBILITY,
  FILE_VISIBILITY_BY_PURPOSE,
  type FilePurpose,
} from "@banijjik/contracts/file";
import { describe, expect, it } from "vitest";
import type { FileReferenceReader } from "../../../core/file/index.js";
import { buildSiteMediaChecker } from "./site-media.checker.js";

const LOGO = "01926b48-1234-7abc-8def-0123456789b1";
const PHOTO = "01926b48-1234-7abc-8def-0123456789b2";
const FOREIGN = "01926b48-1234-7abc-8def-0123456789b3";

/** The file module's reader, with one file per purpose. An unknown id is another business's file. */
class FakeFileReader implements FileReferenceReader {
  readonly asked: FilePurpose[] = [];
  private readonly purposeByFile = new Map<string, FilePurpose>([
    [LOGO, FILE_PURPOSE.LOGO],
    [PHOTO, FILE_PURPOSE.LISTING_PHOTO],
  ]);

  async isUsable(fileId: string, purpose: FilePurpose): Promise<boolean> {
    this.asked.push(purpose);
    return this.purposeByFile.get(fileId) === purpose;
  }
}

function publicPurposes(): FilePurpose[] {
  return Object.values(FILE_PURPOSE).filter(
    (purpose) => FILE_VISIBILITY_BY_PURPOSE[purpose] === FILE_VISIBILITY.PUBLIC,
  );
}

describe("site media checker", () => {
  it("keeps a file the business uploaded for a public purpose", async () => {
    const reader = new FakeFileReader();

    const usable = await buildSiteMediaChecker(reader).filterUsable([LOGO]);

    expect([...usable]).toEqual([LOGO]);
    // The first public purpose matched, so the rest are never asked about.
    expect(reader.asked).toEqual([FILE_PURPOSE.LOGO]);
  });

  it("refuses a file whose purpose is protected, so a listing photo cannot reach a page", async () => {
    const reader = new FakeFileReader();

    const usable = await buildSiteMediaChecker(reader).filterUsable([PHOTO]);

    expect([...usable]).toEqual([]);
    expect(reader.asked).toEqual(publicPurposes());
  });

  it("refuses a file id of another business, which its own reader never finds", async () => {
    const reader = new FakeFileReader();

    const usable = await buildSiteMediaChecker(reader).filterUsable([FOREIGN]);

    expect([...usable]).toEqual([]);
  });

  it("checks each image once and answers an empty set for a document with no images", async () => {
    const reader = new FakeFileReader();

    const usable = await buildSiteMediaChecker(reader).filterUsable([]);

    expect([...usable]).toEqual([]);
    expect(reader.asked).toEqual([]);
  });
});
